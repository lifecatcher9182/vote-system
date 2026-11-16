-- ============================================
-- 2026-11 관리자 이메일 쓰기 권한
--  2026-11-cast-vote-and-admin-rls.sql 에서 admin_emails 쓰기 정책이 빠져
--  설정 화면의 관리자 추가/삭제가 RLS 에 막히던 문제.
--  등록된 관리자만 추가/삭제할 수 있다.
--
-- 실행: Supabase SQL Editor 에 붙여넣고 실행. 여러 번 실행해도 안전.
-- ============================================
drop policy if exists "admin write" on admin_emails;
create policy "admin write" on admin_emails for all
  using (public.is_admin()) with check (public.is_admin());
