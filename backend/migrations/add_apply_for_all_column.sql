-- Migration: Add apply_for_all column to user_input_cps_catalog table
-- Run this SQL script on your database to add the apply_for_all column

ALTER TABLE cps.user_input_cps_catalog
ADD COLUMN IF NOT EXISTS apply_for_all BOOLEAN DEFAULT FALSE;

-- Add a comment to document the column
COMMENT ON COLUMN cps.user_input_cps_catalog.apply_for_all IS 
'If true, this override should be applied to all devices with the same cps_id';

