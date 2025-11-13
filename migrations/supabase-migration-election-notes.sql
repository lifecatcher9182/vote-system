-- 투표 비고/메모 테이블 생성
CREATE TABLE IF NOT EXISTS election_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by TEXT, -- 작성자 이름 (옵션)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_election_notes_election_id ON election_notes(election_id);
CREATE INDEX IF NOT EXISTS idx_election_notes_created_at ON election_notes(created_at DESC);

-- RLS (Row Level Security) 활성화
ALTER TABLE election_notes ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽을 수 있도록 설정
CREATE POLICY "Anyone can read election notes" ON election_notes
  FOR SELECT USING (true);

-- 인증된 사용자만 생성 가능
CREATE POLICY "Authenticated users can create election notes" ON election_notes
  FOR INSERT WITH CHECK (true);

-- 인증된 사용자만 수정 가능
CREATE POLICY "Authenticated users can update election notes" ON election_notes
  FOR UPDATE USING (true);

-- 인증된 사용자만 삭제 가능
CREATE POLICY "Authenticated users can delete election notes" ON election_notes
  FOR DELETE USING (true);
