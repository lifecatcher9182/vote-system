-- ============================================
-- voter_codes 테이블에 group_id 추가
-- 초대 코드를 투표 그룹별로 분리 관리
-- ============================================

-- 1. group_id 컬럼 추가
ALTER TABLE voter_codes
ADD COLUMN group_id UUID REFERENCES election_groups(id) ON DELETE CASCADE;

-- 2. 기존 데이터 정리 (선택사항)
-- 기존 코드들은 group_id가 NULL이므로, 필요시 수동으로 업데이트하거나 삭제

-- 3. 인덱스 추가 (성능 최적화)
CREATE INDEX idx_voter_codes_group_id ON voter_codes(group_id);
CREATE INDEX idx_voter_codes_code_group ON voter_codes(code, group_id);

-- 4. 설명
COMMENT ON COLUMN voter_codes.group_id IS '소속 투표 그룹 ID - 코드를 그룹별로 분리 관리';

-- ============================================
-- 사용 방법
-- ============================================
-- 1. Supabase SQL Editor에서 위 SQL 실행
-- 2. 기존 코드 정리 (선택):
--    DELETE FROM voter_codes WHERE group_id IS NULL;
-- 3. 코드 생성 시 group_id 반드시 포함
-- ============================================
