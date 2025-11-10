-- ============================================
-- 마이그레이션 확인 쿼리
-- ============================================

-- 1. elections 테이블 컬럼 확인
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'elections'
  AND column_name IN ('winning_criteria', 'series_id', 'series_title')
ORDER BY column_name;

-- 2. voter_codes 테이블 컬럼 확인
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'voter_codes'
  AND column_name IN ('first_login_at', 'last_login_at')
ORDER BY column_name;

-- 3. votes 테이블 UNIQUE 제약조건 확인
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'votes'::regclass
  AND conname = 'votes_election_voter_unique';

-- 4. 인덱스 확인
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('elections', 'voter_codes', 'votes')
  AND indexname IN ('idx_elections_series', 'idx_voter_codes_first_login', 'idx_votes_voter_code')
ORDER BY indexname;

-- 5. 기존 투표 데이터의 winning_criteria 확인
SELECT 
  id, 
  title, 
  round,
  winning_criteria,
  created_at
FROM elections
ORDER BY created_at DESC
LIMIT 5;

-- ============================================
-- 예상 결과
-- ============================================
-- 1. elections 컬럼: winning_criteria (jsonb), series_id (uuid), series_title (text)
-- 2. voter_codes 컬럼: first_login_at (timestamp), last_login_at (timestamp)
-- 3. UNIQUE 제약: votes_election_voter_unique UNIQUE (election_id, voter_code_id)
-- 4. 인덱스 3개 확인
-- 5. 기존 투표들의 winning_criteria가 {"type": "plurality"}로 설정됨
