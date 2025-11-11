-- ============================================
-- villages 테이블에 is_active 컬럼 추가
-- ============================================

-- is_active 컬럼 추가 (기본값 TRUE)
ALTER TABLE villages 
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 기존 마을들은 모두 활성화 상태로 설정
UPDATE villages SET is_active = TRUE WHERE is_active IS NULL;

-- 인덱스 생성 (활성화 상태로 필터링할 때 성능 향상)
CREATE INDEX IF NOT EXISTS idx_villages_is_active ON villages(is_active);
