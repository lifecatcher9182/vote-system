-- Migration v5: Election Groups System
-- 투표 그룹 시스템 추가 (총대 투표, 임원 투표를 그룹으로 묶어 관리)

-- 1. election_groups 테이블 생성
CREATE TABLE IF NOT EXISTS election_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  group_type TEXT NOT NULL CHECK (group_type IN ('delegate', 'officer')),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'closed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. elections 테이블에 group_id 컬럼 추가
ALTER TABLE elections 
ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES election_groups(id) ON DELETE SET NULL;

-- 3. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_election_groups_type ON election_groups(group_type);
CREATE INDEX IF NOT EXISTS idx_election_groups_status ON election_groups(group_type, status);
CREATE INDEX IF NOT EXISTS idx_elections_group_id ON elections(group_id);

-- 4. RLS 정책 설정
ALTER TABLE election_groups ENABLE ROW LEVEL SECURITY;

-- 인증된 사용자는 모든 그룹 조회 가능
CREATE POLICY "Authenticated users can view election groups"
  ON election_groups
  FOR SELECT
  TO authenticated
  USING (true);

-- 인증된 사용자는 그룹 생성 가능
CREATE POLICY "Authenticated users can create election groups"
  ON election_groups
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 인증된 사용자는 그룹 수정 가능
CREATE POLICY "Authenticated users can update election groups"
  ON election_groups
  FOR UPDATE
  TO authenticated
  USING (true);

-- 인증된 사용자는 그룹 삭제 가능
CREATE POLICY "Authenticated users can delete election groups"
  ON election_groups
  FOR DELETE
  TO authenticated
  USING (true);

-- 5. updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_election_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER election_groups_updated_at
  BEFORE UPDATE ON election_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_election_groups_updated_at();

-- 6. 주석 추가
COMMENT ON TABLE election_groups IS '투표 그룹 (총대 투표, 임원 투표를 그룹으로 묶어 관리)';
COMMENT ON COLUMN election_groups.id IS '그룹 고유 ID';
COMMENT ON COLUMN election_groups.title IS '그룹 제목 (예: "2025년 상반기 총대 투표")';
COMMENT ON COLUMN election_groups.description IS '그룹 설명';
COMMENT ON COLUMN election_groups.group_type IS '그룹 타입 (delegate: 총대 투표, officer: 임원 투표)';
COMMENT ON COLUMN election_groups.status IS '그룹 상태 (waiting: 대기, active: 활성, closed: 종료)';
COMMENT ON COLUMN election_groups.created_at IS '생성 일시';
COMMENT ON COLUMN election_groups.updated_at IS '수정 일시';

COMMENT ON COLUMN elections.group_id IS '소속 투표 그룹 ID';
