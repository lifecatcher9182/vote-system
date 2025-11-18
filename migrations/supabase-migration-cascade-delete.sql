-- Migration: CASCADE DELETE for election_groups
-- 투표 그룹 삭제 시 그룹 내 모든 투표도 자동 삭제되도록 변경

-- 1. 기존 외래 키 제약 조건 삭제
ALTER TABLE elections DROP CONSTRAINT IF EXISTS elections_group_id_fkey;

-- 2. CASCADE로 외래 키 제약 조건 재생성
ALTER TABLE elections 
ADD CONSTRAINT elections_group_id_fkey 
FOREIGN KEY (group_id) 
REFERENCES election_groups(id) 
ON DELETE CASCADE;

-- 이제 투표 그룹 삭제 시 자동으로:
-- 1. election_groups 삭제
-- 2. → elections (CASCADE)
-- 3. → candidates (CASCADE)
-- 4. → votes (CASCADE)
-- 모든 관련 데이터가 연쇄적으로 삭제됩니다.

COMMENT ON CONSTRAINT elections_group_id_fkey ON elections IS 
'투표 그룹 삭제 시 그룹 내 모든 투표 자동 삭제 (CASCADE)';
