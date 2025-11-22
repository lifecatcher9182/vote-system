-- 기권 기능 추가
-- votes 테이블에 is_abstain 컬럼 추가 및 candidate_id nullable 변경

-- 1. candidate_id를 nullable로 변경 (기권 시 null 허용)
ALTER TABLE votes 
  ALTER COLUMN candidate_id DROP NOT NULL;

-- 2. is_abstain 컬럼 추가 (기본값 false)
ALTER TABLE votes 
  ADD COLUMN is_abstain BOOLEAN DEFAULT false NOT NULL;

-- 3. 기권 투표는 candidate_id가 null이어야 함
ALTER TABLE votes
  ADD CONSTRAINT check_abstain_consistency 
  CHECK (
    (is_abstain = true AND candidate_id IS NULL) OR 
    (is_abstain = false AND candidate_id IS NOT NULL)
  );

-- 4. 기존 UNIQUE 제약조건 삭제 (election_id, voter_code_id)
-- 이유: 기권은 한 코드당 1개만 가능하지만, 일반 투표는 여러 개 가능
ALTER TABLE votes
  DROP CONSTRAINT IF EXISTS votes_election_id_voter_code_id_key;

-- 5. 새로운 제약조건 추가
-- - 기권은 한 코드당 해당 선거에 1개만 (is_abstain=true)
-- - 일반 투표는 중복 방지하지 않음 (복수 선택 가능)
CREATE UNIQUE INDEX idx_votes_abstain_unique 
  ON votes(election_id, voter_code_id) 
  WHERE is_abstain = true;

-- 6. 인덱스 추가
CREATE INDEX idx_votes_abstain ON votes(is_abstain);

-- ============================================
-- 주의사항
-- ============================================
-- 이 마이그레이션을 실행하면:
-- 1. 기존 투표 데이터의 is_abstain은 모두 false로 설정됨
-- 2. 기권 투표 시 candidate_id는 null로 저장됨
-- 3. 일반 투표는 여러 후보자 선택 가능 (기존과 동일)
-- 4. 기권은 한 선거당 1회만 가능
