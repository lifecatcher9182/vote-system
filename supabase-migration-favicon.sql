-- Add favicon_url column to system_config table
-- Migration: Add favicon support to system configuration

ALTER TABLE system_config 
ADD COLUMN IF NOT EXISTS favicon_url TEXT;

COMMENT ON COLUMN system_config.favicon_url IS 'URL of the custom favicon uploaded to storage';
