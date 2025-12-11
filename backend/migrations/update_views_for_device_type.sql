-- Update views to use device_type instead of sub_category
-- This migration should be run after rename_sub_category_to_device_type.sql

-- First, drop and recreate the views with device_type

-- Drop existing views
DROP VIEW IF EXISTS cps.v_cps_catalog_effective_validated;
DROP VIEW IF EXISTS cps.v_cps_catalog_effective;

-- Recreate v_cps_catalog_effective with device_type
CREATE VIEW cps.v_cps_catalog_effective AS
WITH latest_device AS (
    SELECT 
        u.device_uuid, 
        u.field_name, 
        u.new_value, 
        u.is_validated, 
        u.changed_at, 
        u.id,
        ROW_NUMBER() OVER (
            PARTITION BY u.device_uuid, u.field_name 
            ORDER BY u.is_validated DESC, u.changed_at DESC, u.id DESC
        ) AS rn
    FROM cps.user_input_cps_catalog u
    WHERE u.apply_for_all = FALSE OR u.apply_for_all IS NULL
),
latest_cps_id AS (
    SELECT 
        g.cps_id,
        u.field_name, 
        u.new_value, 
        u.is_validated, 
        u.changed_at, 
        u.id,
        ROW_NUMBER() OVER (
            PARTITION BY g.cps_id, u.field_name 
            ORDER BY u.is_validated DESC, u.changed_at DESC, u.id DESC
        ) AS rn
    FROM cps.user_input_cps_catalog u
    JOIN cps.cps_catalog_gold g ON u.device_uuid = g.device_uuid
    WHERE u.apply_for_all = TRUE
)
SELECT 
    g.device_uuid,
    g.cps_id,
    COALESCE(
        NULLIF(l_vendor_dev.new_value, ''::text),
        NULLIF(l_vendor_cps.new_value, ''::text),
        g.vendor
    ) AS vendor,
    COALESCE(
        NULLIF(l_model_dev.new_value, ''::text),
        NULLIF(l_model_cps.new_value, ''::text),
        g.model
    ) AS model,
    COALESCE(
        NULLIF(l_hw_versions_dev.new_value, ''::text),
        NULLIF(l_hw_versions_cps.new_value, ''::text),
        g.hw_versions
    ) AS hw_versions,
    COALESCE(
        NULLIF(l_sw_versions_dev.new_value, ''::text),
        NULLIF(l_sw_versions_cps.new_value, ''::text),
        g.sw_versions
    ) AS sw_versions,
    COALESCE(
        NULLIF(l_os_names_dev.new_value, ''::text),
        NULLIF(l_os_names_cps.new_value, ''::text),
        g.os_names
    ) AS os_names,
    COALESCE(
        NULLIF(l_os_versions_dev.new_value, ''::text),
        NULLIF(l_os_versions_cps.new_value, ''::text),
        g.os_versions
    ) AS os_versions,
    COALESCE(
        NULLIF(l_os_revisions_dev.new_value, ''::text),
        NULLIF(l_os_revisions_cps.new_value, ''::text),
        g.os_revisions
    ) AS os_revisions,
    COALESCE(
        NULLIF(l_mpc_dev.new_value, ''::text),
        NULLIF(l_mpc_cps.new_value, ''::text),
        g.manufacturer_product_code
    ) AS manufacturer_product_code,
    COALESCE(
        NULLIF(l_cps_vector_dev.new_value, ''::text),
        NULLIF(l_cps_vector_cps.new_value, ''::text),
        g.cps_vector
    ) AS cps_vector,
    COALESCE(
        NULLIF(l_is_eol_dev.new_value, ''::text),
        NULLIF(l_is_eol_cps.new_value, ''::text),
        g.is_eol
    ) AS is_eol,
    COALESCE(
        NULLIF(l_cves_dev.new_value, ''::text),
        NULLIF(l_cves_cps.new_value, ''::text),
        g.potential_cves
    ) AS potential_cves,
    COALESCE(
        NULLIF(l_needs_vendor_dev.new_value, ''::text),
        NULLIF(l_needs_vendor_cps.new_value, ''::text),
        g.needs_vendor
    ) AS needs_vendor,
    COALESCE(
        NULLIF(l_cert_patches_dev.new_value, ''::text),
        NULLIF(l_cert_patches_cps.new_value, ''::text),
        g.certified_patches
    ) AS certified_patches,
    COALESCE(
        NULLIF(l_preapps_dev.new_value, ''::text),
        NULLIF(l_preapps_cps.new_value, ''::text),
        g.pre_installed_applications
    ) AS pre_installed_applications,
    COALESCE(
        NULLIF(l_links_dev.new_value, ''::text),
        NULLIF(l_links_cps.new_value, ''::text),
        g.links
    ) AS links,
    COALESCE(
        NULLIF(l_image_url_dev.new_value, ''::text),
        NULLIF(l_image_url_cps.new_value, ''::text),
        g.image_url
    ) AS image_url,
    COALESCE(
        NULLIF(l_category_dev.new_value, ''::text),
        NULLIF(l_category_cps.new_value, ''::text),
        g.category
    ) AS category,
    COALESCE(
        NULLIF(l_device_type_dev.new_value, ''::text),
        NULLIF(l_device_type_cps.new_value, ''::text),
        g.device_type::text
    ) AS device_type,
    COALESCE(
        NULLIF(l_network_type_dev.new_value, ''::text),
        NULLIF(l_network_type_cps.new_value, ''::text),
        g.network_type
    ) AS network_type,
    COALESCE(
        NULLIF(l_patch_resp_dev.new_value, ''::text),
        NULLIF(l_patch_resp_cps.new_value, ''::text),
        g.patching_responsibility
    ) AS patching_responsibility,
    g.created_at,
    g.updated_at
FROM cps.cps_catalog_gold g
LEFT JOIN latest_device l_vendor_dev ON l_vendor_dev.device_uuid = g.device_uuid AND l_vendor_dev.field_name = 'vendor'::text AND l_vendor_dev.rn = 1
LEFT JOIN latest_device l_model_dev ON l_model_dev.device_uuid = g.device_uuid AND l_model_dev.field_name = 'model'::text AND l_model_dev.rn = 1
LEFT JOIN latest_device l_hw_versions_dev ON l_hw_versions_dev.device_uuid = g.device_uuid AND l_hw_versions_dev.field_name = 'hw_versions'::text AND l_hw_versions_dev.rn = 1
LEFT JOIN latest_device l_sw_versions_dev ON l_sw_versions_dev.device_uuid = g.device_uuid AND l_sw_versions_dev.field_name = 'sw_versions'::text AND l_sw_versions_dev.rn = 1
LEFT JOIN latest_device l_os_names_dev ON l_os_names_dev.device_uuid = g.device_uuid AND l_os_names_dev.field_name = 'os_names'::text AND l_os_names_dev.rn = 1
LEFT JOIN latest_device l_os_versions_dev ON l_os_versions_dev.device_uuid = g.device_uuid AND l_os_versions_dev.field_name = 'os_versions'::text AND l_os_versions_dev.rn = 1
LEFT JOIN latest_device l_os_revisions_dev ON l_os_revisions_dev.device_uuid = g.device_uuid AND l_os_revisions_dev.field_name = 'os_revisions'::text AND l_os_revisions_dev.rn = 1
LEFT JOIN latest_device l_mpc_dev ON l_mpc_dev.device_uuid = g.device_uuid AND l_mpc_dev.field_name = 'manufacturer_product_code'::text AND l_mpc_dev.rn = 1
LEFT JOIN latest_device l_cps_vector_dev ON l_cps_vector_dev.device_uuid = g.device_uuid AND l_cps_vector_dev.field_name = 'cps_vector'::text AND l_cps_vector_dev.rn = 1
LEFT JOIN latest_device l_is_eol_dev ON l_is_eol_dev.device_uuid = g.device_uuid AND l_is_eol_dev.field_name = 'is_eol'::text AND l_is_eol_dev.rn = 1
LEFT JOIN latest_device l_cves_dev ON l_cves_dev.device_uuid = g.device_uuid AND l_cves_dev.field_name = 'potential_cves'::text AND l_cves_dev.rn = 1
LEFT JOIN latest_device l_needs_vendor_dev ON l_needs_vendor_dev.device_uuid = g.device_uuid AND l_needs_vendor_dev.field_name = 'needs_vendor'::text AND l_needs_vendor_dev.rn = 1
LEFT JOIN latest_device l_cert_patches_dev ON l_cert_patches_dev.device_uuid = g.device_uuid AND l_cert_patches_dev.field_name = 'certified_patches'::text AND l_cert_patches_dev.rn = 1
LEFT JOIN latest_device l_preapps_dev ON l_preapps_dev.device_uuid = g.device_uuid AND l_preapps_dev.field_name = 'pre_installed_applications'::text AND l_preapps_dev.rn = 1
LEFT JOIN latest_device l_links_dev ON l_links_dev.device_uuid = g.device_uuid AND l_links_dev.field_name = 'links'::text AND l_links_dev.rn = 1
LEFT JOIN latest_device l_image_url_dev ON l_image_url_dev.device_uuid = g.device_uuid AND l_image_url_dev.field_name = 'image_url'::text AND l_image_url_dev.rn = 1
LEFT JOIN latest_device l_category_dev ON l_category_dev.device_uuid = g.device_uuid AND l_category_dev.field_name = 'category'::text AND l_category_dev.rn = 1
LEFT JOIN latest_device l_device_type_dev ON l_device_type_dev.device_uuid = g.device_uuid AND l_device_type_dev.field_name = 'device_type'::text AND l_device_type_dev.rn = 1
LEFT JOIN latest_device l_network_type_dev ON l_network_type_dev.device_uuid = g.device_uuid AND l_network_type_dev.field_name = 'network_type'::text AND l_network_type_dev.rn = 1
LEFT JOIN latest_device l_patch_resp_dev ON l_patch_resp_dev.device_uuid = g.device_uuid AND l_patch_resp_dev.field_name = 'patching_responsibility'::text AND l_patch_resp_dev.rn = 1
LEFT JOIN latest_cps_id l_vendor_cps ON l_vendor_cps.cps_id = g.cps_id AND l_vendor_cps.field_name = 'vendor'::text AND l_vendor_cps.rn = 1
LEFT JOIN latest_cps_id l_model_cps ON l_model_cps.cps_id = g.cps_id AND l_model_cps.field_name = 'model'::text AND l_model_cps.rn = 1
LEFT JOIN latest_cps_id l_hw_versions_cps ON l_hw_versions_cps.cps_id = g.cps_id AND l_hw_versions_cps.field_name = 'hw_versions'::text AND l_hw_versions_cps.rn = 1
LEFT JOIN latest_cps_id l_sw_versions_cps ON l_sw_versions_cps.cps_id = g.cps_id AND l_sw_versions_cps.field_name = 'sw_versions'::text AND l_sw_versions_cps.rn = 1
LEFT JOIN latest_cps_id l_os_names_cps ON l_os_names_cps.cps_id = g.cps_id AND l_os_names_cps.field_name = 'os_names'::text AND l_os_names_cps.rn = 1
LEFT JOIN latest_cps_id l_os_versions_cps ON l_os_versions_cps.cps_id = g.cps_id AND l_os_versions_cps.field_name = 'os_versions'::text AND l_os_versions_cps.rn = 1
LEFT JOIN latest_cps_id l_os_revisions_cps ON l_os_revisions_cps.cps_id = g.cps_id AND l_os_revisions_cps.field_name = 'os_revisions'::text AND l_os_revisions_cps.rn = 1
LEFT JOIN latest_cps_id l_mpc_cps ON l_mpc_cps.cps_id = g.cps_id AND l_mpc_cps.field_name = 'manufacturer_product_code'::text AND l_mpc_cps.rn = 1
LEFT JOIN latest_cps_id l_cps_vector_cps ON l_cps_vector_cps.cps_id = g.cps_id AND l_cps_vector_cps.field_name = 'cps_vector'::text AND l_cps_vector_cps.rn = 1
LEFT JOIN latest_cps_id l_is_eol_cps ON l_is_eol_cps.cps_id = g.cps_id AND l_is_eol_cps.field_name = 'is_eol'::text AND l_is_eol_cps.rn = 1
LEFT JOIN latest_cps_id l_cves_cps ON l_cves_cps.cps_id = g.cps_id AND l_cves_cps.field_name = 'potential_cves'::text AND l_cves_cps.rn = 1
LEFT JOIN latest_cps_id l_needs_vendor_cps ON l_needs_vendor_cps.cps_id = g.cps_id AND l_needs_vendor_cps.field_name = 'needs_vendor'::text AND l_needs_vendor_cps.rn = 1
LEFT JOIN latest_cps_id l_cert_patches_cps ON l_cert_patches_cps.cps_id = g.cps_id AND l_cert_patches_cps.field_name = 'certified_patches'::text AND l_cert_patches_cps.rn = 1
LEFT JOIN latest_cps_id l_preapps_cps ON l_preapps_cps.cps_id = g.cps_id AND l_preapps_cps.field_name = 'pre_installed_applications'::text AND l_preapps_cps.rn = 1
LEFT JOIN latest_cps_id l_links_cps ON l_links_cps.cps_id = g.cps_id AND l_links_cps.field_name = 'links'::text AND l_links_cps.rn = 1
LEFT JOIN latest_cps_id l_image_url_cps ON l_image_url_cps.cps_id = g.cps_id AND l_image_url_cps.field_name = 'image_url'::text AND l_image_url_cps.rn = 1
LEFT JOIN latest_cps_id l_category_cps ON l_category_cps.cps_id = g.cps_id AND l_category_cps.field_name = 'category'::text AND l_category_cps.rn = 1
LEFT JOIN latest_cps_id l_device_type_cps ON l_device_type_cps.cps_id = g.cps_id AND l_device_type_cps.field_name = 'device_type'::text AND l_device_type_cps.rn = 1
LEFT JOIN latest_cps_id l_network_type_cps ON l_network_type_cps.cps_id = g.cps_id AND l_network_type_cps.field_name = 'network_type'::text AND l_network_type_cps.rn = 1
LEFT JOIN latest_cps_id l_patch_resp_cps ON l_patch_resp_cps.cps_id = g.cps_id AND l_patch_resp_cps.field_name = 'patching_responsibility'::text AND l_patch_resp_cps.rn = 1;

-- Recreate v_cps_catalog_effective_validated with device_type (same structure but filtered by is_validated = true)
CREATE VIEW cps.v_cps_catalog_effective_validated AS
WITH latest_device AS (
    SELECT 
        u.device_uuid, 
        u.field_name, 
        u.new_value, 
        u.changed_at, 
        u.id,
        ROW_NUMBER() OVER (
            PARTITION BY u.device_uuid, u.field_name 
            ORDER BY u.changed_at DESC, u.id DESC
        ) AS rn
    FROM cps.user_input_cps_catalog u
    WHERE (u.apply_for_all = FALSE OR u.apply_for_all IS NULL)
      AND u.is_validated = true
),
latest_cps_id AS (
    SELECT 
        g.cps_id,
        u.field_name, 
        u.new_value, 
        u.changed_at, 
        u.id,
        ROW_NUMBER() OVER (
            PARTITION BY g.cps_id, u.field_name 
            ORDER BY u.changed_at DESC, u.id DESC
        ) AS rn
    FROM cps.user_input_cps_catalog u
    JOIN cps.cps_catalog_gold g ON u.device_uuid = g.device_uuid
    WHERE u.apply_for_all = TRUE
      AND u.is_validated = true
)
SELECT 
    g.device_uuid,
    g.cps_id,
    COALESCE(
        NULLIF(l_vendor_dev.new_value, ''::text),
        NULLIF(l_vendor_cps.new_value, ''::text),
        g.vendor
    ) AS vendor,
    COALESCE(
        NULLIF(l_model_dev.new_value, ''::text),
        NULLIF(l_model_cps.new_value, ''::text),
        g.model
    ) AS model,
    COALESCE(
        NULLIF(l_hw_versions_dev.new_value, ''::text),
        NULLIF(l_hw_versions_cps.new_value, ''::text),
        g.hw_versions
    ) AS hw_versions,
    COALESCE(
        NULLIF(l_sw_versions_dev.new_value, ''::text),
        NULLIF(l_sw_versions_cps.new_value, ''::text),
        g.sw_versions
    ) AS sw_versions,
    COALESCE(
        NULLIF(l_os_names_dev.new_value, ''::text),
        NULLIF(l_os_names_cps.new_value, ''::text),
        g.os_names
    ) AS os_names,
    COALESCE(
        NULLIF(l_os_versions_dev.new_value, ''::text),
        NULLIF(l_os_versions_cps.new_value, ''::text),
        g.os_versions
    ) AS os_versions,
    COALESCE(
        NULLIF(l_os_revisions_dev.new_value, ''::text),
        NULLIF(l_os_revisions_cps.new_value, ''::text),
        g.os_revisions
    ) AS os_revisions,
    COALESCE(
        NULLIF(l_mpc_dev.new_value, ''::text),
        NULLIF(l_mpc_cps.new_value, ''::text),
        g.manufacturer_product_code
    ) AS manufacturer_product_code,
    COALESCE(
        NULLIF(l_cps_vector_dev.new_value, ''::text),
        NULLIF(l_cps_vector_cps.new_value, ''::text),
        g.cps_vector
    ) AS cps_vector,
    COALESCE(
        NULLIF(l_is_eol_dev.new_value, ''::text),
        NULLIF(l_is_eol_cps.new_value, ''::text),
        g.is_eol
    ) AS is_eol,
    COALESCE(
        NULLIF(l_cves_dev.new_value, ''::text),
        NULLIF(l_cves_cps.new_value, ''::text),
        g.potential_cves
    ) AS potential_cves,
    COALESCE(
        NULLIF(l_needs_vendor_dev.new_value, ''::text),
        NULLIF(l_needs_vendor_cps.new_value, ''::text),
        g.needs_vendor
    ) AS needs_vendor,
    COALESCE(
        NULLIF(l_cert_patches_dev.new_value, ''::text),
        NULLIF(l_cert_patches_cps.new_value, ''::text),
        g.certified_patches
    ) AS certified_patches,
    COALESCE(
        NULLIF(l_preapps_dev.new_value, ''::text),
        NULLIF(l_preapps_cps.new_value, ''::text),
        g.pre_installed_applications
    ) AS pre_installed_applications,
    COALESCE(
        NULLIF(l_links_dev.new_value, ''::text),
        NULLIF(l_links_cps.new_value, ''::text),
        g.links
    ) AS links,
    COALESCE(
        NULLIF(l_image_url_dev.new_value, ''::text),
        NULLIF(l_image_url_cps.new_value, ''::text),
        g.image_url
    ) AS image_url,
    COALESCE(
        NULLIF(l_category_dev.new_value, ''::text),
        NULLIF(l_category_cps.new_value, ''::text),
        g.category
    ) AS category,
    COALESCE(
        NULLIF(l_device_type_dev.new_value, ''::text),
        NULLIF(l_device_type_cps.new_value, ''::text),
        g.device_type::text
    ) AS device_type,
    COALESCE(
        NULLIF(l_network_type_dev.new_value, ''::text),
        NULLIF(l_network_type_cps.new_value, ''::text),
        g.network_type
    ) AS network_type,
    COALESCE(
        NULLIF(l_patch_resp_dev.new_value, ''::text),
        NULLIF(l_patch_resp_cps.new_value, ''::text),
        g.patching_responsibility
    ) AS patching_responsibility,
    g.created_at,
    g.updated_at
FROM cps.cps_catalog_gold g
LEFT JOIN latest_device l_vendor_dev ON l_vendor_dev.device_uuid = g.device_uuid AND l_vendor_dev.field_name = 'vendor'::text AND l_vendor_dev.rn = 1
LEFT JOIN latest_device l_model_dev ON l_model_dev.device_uuid = g.device_uuid AND l_model_dev.field_name = 'model'::text AND l_model_dev.rn = 1
LEFT JOIN latest_device l_hw_versions_dev ON l_hw_versions_dev.device_uuid = g.device_uuid AND l_hw_versions_dev.field_name = 'hw_versions'::text AND l_hw_versions_dev.rn = 1
LEFT JOIN latest_device l_sw_versions_dev ON l_sw_versions_dev.device_uuid = g.device_uuid AND l_sw_versions_dev.field_name = 'sw_versions'::text AND l_sw_versions_dev.rn = 1
LEFT JOIN latest_device l_os_names_dev ON l_os_names_dev.device_uuid = g.device_uuid AND l_os_names_dev.field_name = 'os_names'::text AND l_os_names_dev.rn = 1
LEFT JOIN latest_device l_os_versions_dev ON l_os_versions_dev.device_uuid = g.device_uuid AND l_os_versions_dev.field_name = 'os_versions'::text AND l_os_versions_dev.rn = 1
LEFT JOIN latest_device l_os_revisions_dev ON l_os_revisions_dev.device_uuid = g.device_uuid AND l_os_revisions_dev.field_name = 'os_revisions'::text AND l_os_revisions_dev.rn = 1
LEFT JOIN latest_device l_mpc_dev ON l_mpc_dev.device_uuid = g.device_uuid AND l_mpc_dev.field_name = 'manufacturer_product_code'::text AND l_mpc_dev.rn = 1
LEFT JOIN latest_device l_cps_vector_dev ON l_cps_vector_dev.device_uuid = g.device_uuid AND l_cps_vector_dev.field_name = 'cps_vector'::text AND l_cps_vector_dev.rn = 1
LEFT JOIN latest_device l_is_eol_dev ON l_is_eol_dev.device_uuid = g.device_uuid AND l_is_eol_dev.field_name = 'is_eol'::text AND l_is_eol_dev.rn = 1
LEFT JOIN latest_device l_cves_dev ON l_cves_dev.device_uuid = g.device_uuid AND l_cves_dev.field_name = 'potential_cves'::text AND l_cves_dev.rn = 1
LEFT JOIN latest_device l_needs_vendor_dev ON l_needs_vendor_dev.device_uuid = g.device_uuid AND l_needs_vendor_dev.field_name = 'needs_vendor'::text AND l_needs_vendor_dev.rn = 1
LEFT JOIN latest_device l_cert_patches_dev ON l_cert_patches_dev.device_uuid = g.device_uuid AND l_cert_patches_dev.field_name = 'certified_patches'::text AND l_cert_patches_dev.rn = 1
LEFT JOIN latest_device l_preapps_dev ON l_preapps_dev.device_uuid = g.device_uuid AND l_preapps_dev.field_name = 'pre_installed_applications'::text AND l_preapps_dev.rn = 1
LEFT JOIN latest_device l_links_dev ON l_links_dev.device_uuid = g.device_uuid AND l_links_dev.field_name = 'links'::text AND l_links_dev.rn = 1
LEFT JOIN latest_device l_image_url_dev ON l_image_url_dev.device_uuid = g.device_uuid AND l_image_url_dev.field_name = 'image_url'::text AND l_image_url_dev.rn = 1
LEFT JOIN latest_device l_category_dev ON l_category_dev.device_uuid = g.device_uuid AND l_category_dev.field_name = 'category'::text AND l_category_dev.rn = 1
LEFT JOIN latest_device l_device_type_dev ON l_device_type_dev.device_uuid = g.device_uuid AND l_device_type_dev.field_name = 'device_type'::text AND l_device_type_dev.rn = 1
LEFT JOIN latest_device l_network_type_dev ON l_network_type_dev.device_uuid = g.device_uuid AND l_network_type_dev.field_name = 'network_type'::text AND l_network_type_dev.rn = 1
LEFT JOIN latest_device l_patch_resp_dev ON l_patch_resp_dev.device_uuid = g.device_uuid AND l_patch_resp_dev.field_name = 'patching_responsibility'::text AND l_patch_resp_dev.rn = 1
LEFT JOIN latest_cps_id l_vendor_cps ON l_vendor_cps.cps_id = g.cps_id AND l_vendor_cps.field_name = 'vendor'::text AND l_vendor_cps.rn = 1
LEFT JOIN latest_cps_id l_model_cps ON l_model_cps.cps_id = g.cps_id AND l_model_cps.field_name = 'model'::text AND l_model_cps.rn = 1
LEFT JOIN latest_cps_id l_hw_versions_cps ON l_hw_versions_cps.cps_id = g.cps_id AND l_hw_versions_cps.field_name = 'hw_versions'::text AND l_hw_versions_cps.rn = 1
LEFT JOIN latest_cps_id l_sw_versions_cps ON l_sw_versions_cps.cps_id = g.cps_id AND l_sw_versions_cps.field_name = 'sw_versions'::text AND l_sw_versions_cps.rn = 1
LEFT JOIN latest_cps_id l_os_names_cps ON l_os_names_cps.cps_id = g.cps_id AND l_os_names_cps.field_name = 'os_names'::text AND l_os_names_cps.rn = 1
LEFT JOIN latest_cps_id l_os_versions_cps ON l_os_versions_cps.cps_id = g.cps_id AND l_os_versions_cps.field_name = 'os_versions'::text AND l_os_versions_cps.rn = 1
LEFT JOIN latest_cps_id l_os_revisions_cps ON l_os_revisions_cps.cps_id = g.cps_id AND l_os_revisions_cps.field_name = 'os_revisions'::text AND l_os_revisions_cps.rn = 1
LEFT JOIN latest_cps_id l_mpc_cps ON l_mpc_cps.cps_id = g.cps_id AND l_mpc_cps.field_name = 'manufacturer_product_code'::text AND l_mpc_cps.rn = 1
LEFT JOIN latest_cps_id l_cps_vector_cps ON l_cps_vector_cps.cps_id = g.cps_id AND l_cps_vector_cps.field_name = 'cps_vector'::text AND l_cps_vector_cps.rn = 1
LEFT JOIN latest_cps_id l_is_eol_cps ON l_is_eol_cps.cps_id = g.cps_id AND l_is_eol_cps.field_name = 'is_eol'::text AND l_is_eol_cps.rn = 1
LEFT JOIN latest_cps_id l_cves_cps ON l_cves_cps.cps_id = g.cps_id AND l_cves_cps.field_name = 'potential_cves'::text AND l_cves_cps.rn = 1
LEFT JOIN latest_cps_id l_needs_vendor_cps ON l_needs_vendor_cps.cps_id = g.cps_id AND l_needs_vendor_cps.field_name = 'needs_vendor'::text AND l_needs_vendor_cps.rn = 1
LEFT JOIN latest_cps_id l_cert_patches_cps ON l_cert_patches_cps.cps_id = g.cps_id AND l_cert_patches_cps.field_name = 'certified_patches'::text AND l_cert_patches_cps.rn = 1
LEFT JOIN latest_cps_id l_preapps_cps ON l_preapps_cps.cps_id = g.cps_id AND l_preapps_cps.field_name = 'pre_installed_applications'::text AND l_preapps_cps.rn = 1
LEFT JOIN latest_cps_id l_links_cps ON l_links_cps.cps_id = g.cps_id AND l_links_cps.field_name = 'links'::text AND l_links_cps.rn = 1
LEFT JOIN latest_cps_id l_image_url_cps ON l_image_url_cps.cps_id = g.cps_id AND l_image_url_cps.field_name = 'image_url'::text AND l_image_url_cps.rn = 1
LEFT JOIN latest_cps_id l_category_cps ON l_category_cps.cps_id = g.cps_id AND l_category_cps.field_name = 'category'::text AND l_category_cps.rn = 1
LEFT JOIN latest_cps_id l_device_type_cps ON l_device_type_cps.cps_id = g.cps_id AND l_device_type_cps.field_name = 'device_type'::text AND l_device_type_cps.rn = 1
LEFT JOIN latest_cps_id l_network_type_cps ON l_network_type_cps.cps_id = g.cps_id AND l_network_type_cps.field_name = 'network_type'::text AND l_network_type_cps.rn = 1
LEFT JOIN latest_cps_id l_patch_resp_cps ON l_patch_resp_cps.cps_id = g.cps_id AND l_patch_resp_cps.field_name = 'patching_responsibility'::text AND l_patch_resp_cps.rn = 1;

-- Restore permissions
ALTER VIEW cps.v_cps_catalog_effective OWNER TO new_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON cps.v_cps_catalog_effective TO databricks_superuser WITH GRANT OPTION;
GRANT SELECT ON cps.v_cps_catalog_effective TO databricks_gateway;
GRANT SELECT ON cps.v_cps_catalog_effective TO databricks_replicator;
GRANT SELECT ON cps.v_cps_catalog_effective TO databricks_reader_16473;
GRANT SELECT ON cps.v_cps_catalog_effective TO "c16be518-d1a8-42c2-bbf7-18ed6393e61c";

ALTER VIEW cps.v_cps_catalog_effective_validated OWNER TO new_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON cps.v_cps_catalog_effective_validated TO databricks_superuser WITH GRANT OPTION;
GRANT SELECT ON cps.v_cps_catalog_effective_validated TO databricks_gateway;
GRANT SELECT ON cps.v_cps_catalog_effective_validated TO databricks_replicator;
GRANT SELECT ON cps.v_cps_catalog_effective_validated TO databricks_reader_16473;
GRANT SELECT ON cps.v_cps_catalog_effective_validated TO "c16be518-d1a8-42c2-bbf7-18ed6393e61c";

