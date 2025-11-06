-- ============================================
-- system_config 테이블 업데이트
-- ============================================

-- secondary_color와 system_name 컬럼 추가
ALTER TABLE system_config 
ADD COLUMN IF NOT EXISTS secondary_color TEXT DEFAULT '#10b981',
ADD COLUMN IF NOT EXISTS system_name TEXT DEFAULT '청년국 투표 시스템';

-- 기존 데이터가 없으면 초기 데이터 삽입
INSERT INTO system_config (primary_color, secondary_color, system_name) 
SELECT '#2563eb', '#10b981', '청년국 투표 시스템'
WHERE NOT EXISTS (SELECT 1 FROM system_config);

-- primary_color 기본값 업데이트 (기존 #3B82F6 → #2563eb)
UPDATE system_config 
SET primary_color = '#2563eb' 
WHERE primary_color = '#3B82F6';

-- ============================================
-- RLS 정책 추가 (system_config 쓰기 권한)
-- ============================================

-- 기존 정책이 있다면 먼저 삭제
DROP POLICY IF EXISTS "Authenticated users can insert system_config" ON system_config;
DROP POLICY IF EXISTS "Authenticated users can update system_config" ON system_config;
DROP POLICY IF EXISTS "Authenticated users can delete system_config" ON system_config;

-- 인증된 사용자가 system_config를 INSERT 할 수 있도록
CREATE POLICY "Authenticated users can insert system_config" 
ON system_config FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- 인증된 사용자가 system_config를 UPDATE 할 수 있도록
CREATE POLICY "Authenticated users can update system_config" 
ON system_config FOR UPDATE 
USING (auth.role() = 'authenticated');

-- 인증된 사용자가 system_config를 DELETE 할 수 있도록
CREATE POLICY "Authenticated users can delete system_config" 
ON system_config FOR DELETE 
USING (auth.role() = 'authenticated');
