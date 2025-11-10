-- ============================================
-- 청년국 전자투표 시스템 - v2 마이그레이션
-- 당선 기준 설정 & 참석 체크 & 투표 시리즈
-- ============================================

-- 1. elections 테이블에 새 컬럼 추가
ALTER TABLE elections 
  ADD COLUMN IF NOT EXISTS winning_criteria JSONB DEFAULT '{"type": "plurality"}',
  ADD COLUMN IF NOT EXISTS series_id UUID,
  ADD COLUMN IF NOT EXISTS series_title TEXT;

-- winning_criteria 기본값 설정 (기존 데이터)
UPDATE elections 
SET winning_criteria = '{"type": "plurality"}'
WHERE winning_criteria IS NULL;

-- 2. voter_codes 테이블에 참석 체크 컬럼 추가
ALTER TABLE voter_codes 
  ADD COLUMN IF NOT EXISTS first_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- 3. votes 테이블에 UNIQUE 제약조건 추가 (중복 투표 방지)
DO $$ 
BEGIN
  -- 중복 투표 제거 (가장 오래된 투표만 유지)
  -- WITH를 사용한 안전한 방법
  WITH duplicates AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY election_id, voter_code_id 
        ORDER BY created_at ASC
      ) as rn
    FROM votes
  )
  DELETE FROM votes
  WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
  );
  
  -- UNIQUE 제약조건 추가
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'votes_election_voter_unique'
  ) THEN
    ALTER TABLE votes 
      ADD CONSTRAINT votes_election_voter_unique 
      UNIQUE(election_id, voter_code_id);
  END IF;
END $$;

-- 4. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_elections_series ON elections(series_id);
CREATE INDEX IF NOT EXISTS idx_voter_codes_first_login ON voter_codes(first_login_at);
CREATE INDEX IF NOT EXISTS idx_votes_voter_code ON votes(voter_code_id);

-- 5. 기존 데이터 마이그레이션: is_used = true인 코드에 로그인 시각 추가
UPDATE voter_codes 
SET first_login_at = used_at,
    last_login_at = used_at
WHERE is_used = true 
  AND first_login_at IS NULL 
  AND used_at IS NOT NULL;

-- ============================================
-- 완료 메시지
-- ============================================
DO $$ 
BEGIN
  RAISE NOTICE '✅ 마이그레이션 완료!';
  RAISE NOTICE '   - elections.winning_criteria 추가';
  RAISE NOTICE '   - elections.series_id, series_title 추가';
  RAISE NOTICE '   - voter_codes.first_login_at, last_login_at 추가';
  RAISE NOTICE '   - votes 테이블에 UNIQUE 제약조건 추가';
END $$;
