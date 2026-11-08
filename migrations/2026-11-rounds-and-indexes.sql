-- ============================================
-- 2026-11 회차 중심 구조 + 성능 인덱스
--  1) 마을을 회차(election_groups) 안으로: villages.group_id
--  2) 회차는 임원·총대 선거를 함께 담는다: group_type 'mixed' 허용
--  3) 동시 접속 대비 인덱스 (배열 포함 검색, 코드별 투표 조회)
--
-- 실행: Supabase SQL Editor 에 통째로 붙여넣고 실행. 여러 번 실행해도 안전.
-- 기존 마을(group_id NULL)과 기존 회차는 그대로 동작한다.
-- ============================================

-- 1) 마을 → 회차 소속
alter table public.villages add column if not exists group_id uuid references public.election_groups(id) on delete cascade;
create index if not exists idx_villages_group on public.villages(group_id);

-- 2) 회차 유형에 mixed 추가 (임원 + 총대 함께)
alter table public.election_groups drop constraint if exists election_groups_group_type_check;
alter table public.election_groups add constraint election_groups_group_type_check
  check (group_type in ('delegate', 'officer', 'mixed'));

-- 3) 인덱스
--   관리자 화면의 "이 선거에 접근 가능한 코드" 조회(@> 연산)가 전체 스캔을 하지 않게
create index if not exists idx_voter_codes_accessible on public.voter_codes using gin (accessible_elections);
--   cast_vote() 의 중복 확인, 관리자 화면의 코드별 투표 여부 조회
create index if not exists idx_votes_election_code on public.votes(election_id, voter_code_id);
create index if not exists idx_voter_codes_group on public.voter_codes(group_id);
