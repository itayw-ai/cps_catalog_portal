-- Rename sub_category column to device_type
ALTER TABLE cps.cps_catalog_gold 
    RENAME COLUMN sub_category TO device_type;

-- Keep device_type as text/varchar (not enum type)
-- The enum cps.device_type_family exists separately and will be used for validation/options

-- Update user_input_cps_catalog table to use device_type instead of sub_category
-- Update any existing records
UPDATE cps.user_input_cps_catalog 
SET field_name = 'device_type' 
WHERE field_name = 'sub_category';

-- Add comment
COMMENT ON COLUMN cps.cps_catalog_gold.device_type IS 'Device type classification - values should match cps.device_type_family enum';

