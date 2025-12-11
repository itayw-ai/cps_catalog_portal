-- Migration: Update v_cps_catalog_effective view to handle apply_for_all
-- This is a simpler approach that works with the existing view structure
-- 
-- IMPORTANT: You may need to adjust this based on your existing view definition.
-- The key concept is:
-- 1. When apply_for_all = TRUE, the override applies to ALL devices with that cps_id
-- 2. Device-specific overrides (apply_for_all = FALSE or NULL) take precedence
-- 3. The view should JOIN with apply_for_all overrides by cps_id

-- First, ensure the column exists
ALTER TABLE cps.user_input_cps_catalog
ADD COLUMN IF NOT EXISTS apply_for_all BOOLEAN DEFAULT FALSE;

-- Note: The actual view update depends on your current view definition.
-- Here's a template that you can adapt:

-- The view logic should be:
-- 1. Start with cps_catalog_gold (base data)
-- 2. LEFT JOIN with device-specific overrides (apply_for_all = FALSE or NULL)
-- 3. LEFT JOIN with cps_id-wide overrides (apply_for_all = TRUE) 
-- 4. Use COALESCE to prefer device-specific, then cps_id-wide, then base value

-- Example structure (adjust based on your actual view):
/*
CREATE OR REPLACE VIEW cps.v_cps_catalog_effective AS
WITH device_specific_overrides AS (
    SELECT device_uuid, field_name, new_value, changed_at, is_validated
    FROM cps.user_input_cps_catalog
    WHERE apply_for_all = FALSE OR apply_for_all IS NULL
    QUALIFY ROW_NUMBER() OVER (PARTITION BY device_uuid, field_name ORDER BY changed_at DESC) = 1
),
cps_id_wide_overrides AS (
    SELECT cps_id, field_name, new_value, changed_at, is_validated
    FROM cps.user_input_cps_catalog
    WHERE apply_for_all = TRUE
    QUALIFY ROW_NUMBER() OVER (PARTITION BY cps_id, field_name ORDER BY changed_at DESC) = 1
)
SELECT 
    g.*,
    -- Apply overrides: device-specific first, then cps_id-wide, then base value
    COALESCE(
        MAX(CASE WHEN dso.field_name = 'category' THEN dso.new_value END),
        MAX(CASE WHEN cwo.field_name = 'category' THEN cwo.new_value END),
        g.category
    ) as category,
    -- Repeat for other fields...
FROM cps.cps_catalog_gold g
LEFT JOIN device_specific_overrides dso ON g.device_uuid = dso.device_uuid
LEFT JOIN cps_id_wide_overrides cwo ON g.cps_id = cwo.cps_id
GROUP BY g.device_uuid, ...;
*/

-- For now, just add the column. You'll need to update your view manually
-- or provide the current view definition so I can create the proper update.

