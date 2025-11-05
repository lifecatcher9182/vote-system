-- voter_codes 테이블에 읽기 권한 추가
-- Supabase SQL Editor에서 실행하세요

-- 인증된 사용자(관리자)가 voter_codes를 읽을 수 있도록 허용
CREATE POLICY "Authenticated users can read voter_codes" 
ON voter_codes 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- 또는 모든 사람이 읽을 수 있도록 허용 (투표자도 자신의 코드 확인 가능)
-- CREATE POLICY "Public read voter_codes" 
-- ON voter_codes 
-- FOR SELECT 
-- USING (true);
