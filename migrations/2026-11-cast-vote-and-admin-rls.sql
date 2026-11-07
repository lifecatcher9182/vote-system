-- ============================================
-- 2026-11 보안·정합성 마이그레이션
--  1) 관리자 판별 함수 is_admin()
--  2) 쓰기 정책: "로그인한 누구나" → "admin_emails 에 등록된 계정만"
--  3) 참여코드·투표 기록은 더 이상 공개 조회 불가 (RPC 로만 접근)
--  4) 투표 제출을 cast_vote() 한 번으로 원자화 (중복 제출·뒤로가기 재제출 차단)
--
-- 실행: Supabase SQL Editor 에 통째로 붙여넣고 실행. 여러 번 실행해도 안전.
-- 주의: 아래 테이블의 기존 정책은 전부 삭제 후 재생성된다.
-- ============================================

-- 1) 관리자 판별 -------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from admin_emails where email = auth.jwt() ->> 'email'
  );
$$;

-- 2) 정책 재생성 -------------------------------------------------
do $$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'admin_emails','system_config','villages','elections','candidates',
    'voter_codes','votes','election_groups','election_notes'
  ] loop
    if to_regclass('public.' || t) is null then continue; end if;
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- 공개 읽기: 설정, 마을, 선거 (후보자·코드·투표기록은 비공개)
create policy "public read"  on system_config for select using (true);
create policy "public read"  on villages      for select using (true);
create policy "public read"  on elections     for select using (true);

-- 관리자 읽기
create policy "admin read" on admin_emails    for select using (auth.role() = 'authenticated');
create policy "admin read" on candidates      for select using (public.is_admin());
create policy "admin read" on voter_codes     for select using (public.is_admin());
create policy "admin read" on votes           for select using (public.is_admin());
create policy "admin read" on election_groups for select using (public.is_admin());
create policy "admin read" on election_notes  for select using (public.is_admin());

-- 관리자 쓰기 (insert/update/delete)
do $$
declare t text;
begin
  foreach t in array array[
    'system_config','villages','elections','candidates','voter_codes','votes',
    'election_groups','election_notes'
  ] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('create policy "admin write" on public.%I for all using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- 3) 투표자용 RPC (security definer: 정책을 우회하되 필요한 것만 돌려준다) ----

-- 코드 입력: 코드 검증 + 참석 기록 + 접근 가능한 진행중 선거 목록 + 이미 투표한 선거
create or replace function public.enter_code(p_code text)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  vc    voter_codes;
  voted uuid[];
  els   jsonb;
begin
  select * into vc from voter_codes where code = upper(trim(p_code));
  if not found then return null; end if;

  update voter_codes
     set first_login_at = coalesce(first_login_at, now()),
         last_login_at  = now()
   where id = vc.id;

  select coalesce(array_agg(distinct election_id), '{}') into voted
    from votes where voter_code_id = vc.id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', e.id, 'title', e.title, 'election_type', e.election_type,
           'position', e.position, 'max_selections', e.max_selections,
           'round', e.round, 'status', e.status, 'village_name', v.name
         ) order by e.created_at desc), '[]')
    into els
    from elections e left join villages v on v.id = e.village_id
   where e.id = any(vc.accessible_elections) and e.status = 'active';

  return jsonb_build_object(
    'id', vc.id, 'code', vc.code, 'code_type', vc.code_type,
    'accessible_elections', to_jsonb(vc.accessible_elections),
    'voted', to_jsonb(voted), 'elections', els
  );
end $$;

-- 후보 목록 (득표수 제외)
create or replace function public.list_candidates(p_election_id uuid)
returns table (id uuid, name text)
language sql stable security definer
set search_path = public
as $$
  select id, name from candidates where election_id = p_election_id order by name;
$$;

-- 투표 제출. 실패 시 예외 메시지: INVALID_CODE / NO_ACCESS / NOT_ACTIVE /
-- ALREADY_VOTED / WRONG_COUNT / DUPLICATE_CANDIDATE / INVALID_CANDIDATE
create or replace function public.cast_vote(
  p_code text, p_election_id uuid, p_candidate_ids uuid[], p_abstain boolean default false
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  vc        voter_codes;
  el        elections;
  n         int;
  remaining int;
begin
  -- 같은 코드의 동시 제출을 직렬화
  select * into vc from voter_codes where code = upper(trim(p_code)) for update;
  if not found then raise exception 'INVALID_CODE'; end if;
  if not (p_election_id = any(vc.accessible_elections)) then raise exception 'NO_ACCESS'; end if;

  select * into el from elections where id = p_election_id;
  if not found or el.status <> 'active' then raise exception 'NOT_ACTIVE'; end if;

  if exists (select 1 from votes where voter_code_id = vc.id and election_id = p_election_id) then
    raise exception 'ALREADY_VOTED';
  end if;

  if p_abstain then
    insert into votes (election_id, candidate_id, voter_code_id, is_abstain)
    values (p_election_id, null, vc.id, true);
  else
    n := coalesce(array_length(p_candidate_ids, 1), 0);
    if n <> el.max_selections then raise exception 'WRONG_COUNT'; end if;
    if (select count(distinct c) from unnest(p_candidate_ids) c) <> n then raise exception 'DUPLICATE_CANDIDATE'; end if;
    if (select count(*) from candidates where id = any(p_candidate_ids) and election_id = p_election_id) <> n then
      raise exception 'INVALID_CANDIDATE';
    end if;

    insert into votes (election_id, candidate_id, voter_code_id, is_abstain)
    select p_election_id, c, vc.id, false from unnest(p_candidate_ids) c;

    update candidates set vote_count = vote_count + 1 where id = any(p_candidate_ids);
  end if;

  select count(*) into remaining
    from unnest(vc.accessible_elections) e
   where e not in (select election_id from votes where voter_code_id = vc.id);

  if remaining = 0 then
    update voter_codes set is_used = true, used_at = now() where id = vc.id;
  end if;

  return jsonb_build_object('remaining', remaining);
end $$;

revoke all on function public.enter_code(text) from public;
revoke all on function public.list_candidates(uuid) from public;
revoke all on function public.cast_vote(text, uuid, uuid[], boolean) from public;
grant execute on function public.enter_code(text) to anon, authenticated;
grant execute on function public.list_candidates(uuid) to anon, authenticated;
grant execute on function public.cast_vote(text, uuid, uuid[], boolean) to anon, authenticated;
