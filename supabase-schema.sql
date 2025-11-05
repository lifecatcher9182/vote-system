-- ============================================
-- 청년국 전자투표 시스템 - 데이터베이스 스키마
-- ============================================

-- 1. admin_emails 테이블 (관리자 화이트리스트)
CREATE TABLE admin_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. system_config 테이블 (시스템 설정)
CREATE TABLE system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  logo_url TEXT,
  primary_color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. villages 테이블 (마을 정보)
CREATE TABLE villages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. elections 테이블 (투표)
CREATE TABLE elections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  election_type TEXT NOT NULL CHECK (election_type IN ('delegate', 'officer')),
  position TEXT,
  village_id UUID REFERENCES villages(id) ON DELETE CASCADE,
  max_selections INTEGER NOT NULL DEFAULT 1,
  round INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'registering', 'active', 'closed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. candidates 테이블 (후보자)
CREATE TABLE candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  vote_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. voter_codes 테이블 (참여코드)
CREATE TABLE voter_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  code_type TEXT NOT NULL CHECK (code_type IN ('delegate', 'officer')),
  accessible_elections UUID[] DEFAULT '{}',
  village_id UUID REFERENCES villages(id) ON DELETE SET NULL,
  is_used BOOLEAN DEFAULT FALSE,
  voter_name TEXT,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. votes 테이블 (투표 기록)
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  voter_code_id UUID NOT NULL REFERENCES voter_codes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 인덱스 생성 (성능 최적화)
-- ============================================

CREATE INDEX idx_elections_status ON elections(status);
CREATE INDEX idx_elections_type ON elections(election_type);
CREATE INDEX idx_voter_codes_code ON voter_codes(code);
CREATE INDEX idx_voter_codes_is_used ON voter_codes(is_used);
CREATE INDEX idx_votes_election ON votes(election_id);
CREATE INDEX idx_votes_candidate ON votes(candidate_id);
CREATE INDEX idx_candidates_election ON candidates(election_id);

-- ============================================
-- Row Level Security (RLS) 정책
-- ============================================

-- RLS 활성화
ALTER TABLE admin_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE villages ENABLE ROW LEVEL SECURITY;
ALTER TABLE elections ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE voter_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽을 수 있음 (공개 데이터)
CREATE POLICY "Public read access" ON villages FOR SELECT USING (true);
CREATE POLICY "Public read access" ON elections FOR SELECT USING (true);
CREATE POLICY "Public read access" ON candidates FOR SELECT USING (true);
CREATE POLICY "Public read access" ON system_config FOR SELECT USING (true);

-- 인증된 사용자만 쓰기 가능 (관리자는 서비스 키로 우회)
CREATE POLICY "Authenticated users can insert villages" ON villages FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update villages" ON villages FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete villages" ON villages FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert elections" ON elections FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update elections" ON elections FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete elections" ON elections FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert candidates" ON candidates FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update candidates" ON candidates FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete candidates" ON candidates FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert voter_codes" ON voter_codes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update voter_codes" ON voter_codes FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete voter_codes" ON voter_codes FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone can insert votes" ON votes FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read votes" ON votes FOR SELECT USING (true);

-- ============================================
-- 초기 데이터 삽입
-- ============================================

-- 시스템 설정 초기값
INSERT INTO system_config (primary_color) VALUES ('#3B82F6');

-- 예시 관리자 이메일 (본인의 Google 이메일로 변경하세요!)
-- INSERT INTO admin_emails (email) VALUES ('your-email@gmail.com');
