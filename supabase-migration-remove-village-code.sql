-- Remove village_code column from villages table
-- This column is not used in the application

-- Step 1: Drop the unique constraint on village_code if it exists
ALTER TABLE villages DROP CONSTRAINT IF EXISTS villages_code_key;

-- Step 2: Drop the village_code column
ALTER TABLE villages DROP COLUMN IF EXISTS code;

-- Verification query (run after migration to check)
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'villages';
