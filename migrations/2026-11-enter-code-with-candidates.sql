-- ============================================
-- 2026-11 투표자 요청 수 줄이기
--  enter_code() 가 선거마다 후보 목록까지 함께 돌려준다.
--  → 투표자 1명당 DB 호출: 코드 입력 1회 + 제출 1회 (기존 4회)
--
-- 실행: Supabase SQL Editor 에 붙여넣고 실행. 여러 번 실행해도 안전.
-- list_candidates() 는 남겨 둔다 (예전 클라이언트 호환).
-- ============================================

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
           'round', e.round, 'status', e.status, 'village_name', v.name,
           'candidates', coalesce((
             select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.name)
               from candidates c where c.election_id = e.id
           ), '[]')
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

grant execute on function public.enter_code(text) to anon, authenticated;
