-- Add system_description column to system_config table
ALTER TABLE system_config 
ADD COLUMN IF NOT EXISTS system_description TEXT DEFAULT '투명하고 안전한 온라인 투표 시스템';

-- Update existing row to have the default description
UPDATE system_config 
SET system_description = '투명하고 안전한 온라인 투표 시스템'
WHERE system_description IS NULL;
