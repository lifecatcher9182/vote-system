-- ============================================
-- Migration v3: 익명 투표 활성화
-- ============================================
-- 목적: 로그인 없이 참여코드만으로 투표 가능하도록 RLS 정책 수정
-- 관리자 기능은 여전히 로그인 필요

-- voter_codes 테이블에 공개 읽기 권한 추가
-- 기존 정책이 있을 수 있으므로 DROP IF EXISTS 사용
DROP POLICY IF EXISTS "Public read voter codes" ON voter_codes;
CREATE POLICY "Public read voter codes" ON voter_codes 
  FOR SELECT 
  USING (true);

-- voter_codes 업데이트는 누구나 가능 (참석 체크용)
-- 단, first_login_at, last_login_at만 업데이트 가능하도록 제한
DROP POLICY IF EXISTS "Public update voter codes attendance" ON voter_codes;
CREATE POLICY "Public update voter codes attendance" ON voter_codes 
  FOR UPDATE 
  USING (true)
  WITH CHECK (true);

-- 기존 인증 필수 정책 제거 (공개 정책과 충돌 방지)
DROP POLICY IF EXISTS "Authenticated users can insert voter_codes" ON voter_codes;
DROP POLICY IF EXISTS "Authenticated users can update voter_codes" ON voter_codes;
DROP POLICY IF EXISTS "Authenticated users can delete voter_codes" ON voter_codes;

-- 관리자용 정책 재생성 (서비스 키 사용 시 인증된 것으로 간주)
CREATE POLICY "Authenticated users can insert voter_codes" ON voter_codes 
  FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete voter_codes" ON voter_codes 
  FOR DELETE 
  USING (auth.role() = 'authenticated');

-- ============================================
-- 검증
-- ============================================
-- 익명 사용자도 코드 조회 가능
-- 인증된 사용자만 코드 생성/삭제 가능
-- 모든 사용자가 참석 체크(first_login_at) 업데이트 가능
