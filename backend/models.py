"""
Data models and database query functions.
"""
from typing import List, Optional, Dict, Any
from sqlalchemy import text
from db_connection import get_db_session
from validators import validate_field
import json
import uuid
from datetime import datetime
from decimal import Decimal

def to_jsonable(obj, _seen_ids=None, _depth=0):
    """Recursively coerce objects to JSON-safe primitives. Prevents circular refs."""
    # Prevent infinite recursion
    if _depth > 50:
        return "<<max_depth>>"
    
    if _seen_ids is None:
        _seen_ids = set()

    # Only track mutable objects for circular reference detection
    # Don't track immutable types (str, int, float, etc.) as they can't be circular
    if isinstance(obj, (dict, list, set)):
        oid = id(obj)
        if oid in _seen_ids:
            return "<<circular>>"
        _seen_ids.add(oid)

    # Primitives
    if obj is None or isinstance(obj, (bool, int, float, str)):
        return obj

    # Common non-JSON types
    if isinstance(obj, uuid.UUID):
        return str(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, Decimal):
        # choose str to preserve 4,1 precision from DB; or float() if you prefer
        return str(obj)

    # Containers
    if isinstance(obj, dict):
        return {str(k): to_jsonable(v, _seen_ids, _depth + 1) for k, v in obj.items()}
    if isinstance(obj, (list, tuple, set)):
        return [to_jsonable(v, _seen_ids, _depth + 1) for v in obj]

    # Fallback: string repr
    return str(obj)


def get_effective_catalog(validated_only: bool = False, search_term: str = "", 
                         filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """
    Get effective catalog rows (gold + overrides).
    
    Args:
        validated_only: If True, only include validated overrides
        search_term: Search string for vendor/model/cps_id/vector/category/CVE
        filters: Dict of filter criteria (vendor, category, risk_bucket, etc.)
    
    Returns:
        List of device dictionaries
    """
    session = get_db_session()
    try:
        # Views are in the new schema
        view_name = "databricks_postgres.mvp_gold_tables.v_cps_catalog_effective_validated" if validated_only else "databricks_postgres.mvp_gold_tables.v_cps_catalog_effective"
        
        query = f"SELECT * FROM {view_name}"
        conditions = []
        params = {}
        
        if search_term:
            search_lower = search_term.lower()
            conditions.append(
                "(LOWER(cps_id) LIKE :search OR LOWER(cps_vector) LIKE :search OR "
                "LOWER(model) LIKE :search OR LOWER(vendor) LIKE :search OR "
                "LOWER(category) LIKE :search OR LOWER(potential_cves) LIKE :search)"
            )
            params['search'] = f"%{search_lower}%"
        
        if filters:
            if filters.get('vendor'):
                conditions.append("LOWER(vendor) = LOWER(:vendor)")
                params['vendor'] = filters['vendor']
            
            if filters.get('category'):
                conditions.append("LOWER(category) = LOWER(:category)")
                params['category'] = filters['category']
            
            # risk_bucket filter removed - risk_score field no longer exists
        
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        
        query += " ORDER BY vendor, model"
        
        result = session.execute(text(query), params)
        # Get column names from result metadata (SQLAlchemy 2.0 compatible)
        columns = list(result.keys()) if hasattr(result, 'keys') else [desc[0] for desc in result.cursor.description]
        rows = result.fetchall()
        
        return [dict(zip(columns, row)) for row in rows]
    finally:
        session.close()


def get_device_by_uuid(device_uuid: str, validated_only: bool = False) -> Optional[Dict[str, Any]]:
    """Get a single device by device UUID."""
    session = get_db_session()
    try:
        view_name = "databricks_postgres.mvp_gold_tables.v_cps_catalog_effective_validated" if validated_only else "databricks_postgres.mvp_gold_tables.v_cps_catalog_effective"
        query = text(f"SELECT * FROM {view_name} WHERE device_uuid = :device_uuid")
        result = session.execute(query, {"device_uuid": device_uuid})
        row = result.fetchone()
        if row:
            # SQLAlchemy 2.0 compatible column access
            if hasattr(result, 'keys'):
                columns = list(result.keys())
            else:
                columns = [col.name for col in result.column_descriptions] if hasattr(result, 'column_descriptions') else [desc[0] for desc in result.cursor.description]
            return dict(zip(columns, row))
        return None
    finally:
        session.close()


def get_device_overrides(device_uuid: str) -> List[Dict[str, Any]]:
    """Get all override history for a device by UUID."""
    session = get_db_session()
    try:
        query = text("""
            SELECT * FROM databricks_postgres.mvp_gold_tables.user_input_cps_catalog
            WHERE device_uuid = :device_uuid
            ORDER BY changed_at DESC
        """)
        result = session.execute(query, {"device_uuid": device_uuid})
        # SQLAlchemy 2.0 compatible column access
        if hasattr(result, 'keys'):
            columns = list(result.keys())
        else:
            columns = [col.name for col in result.column_descriptions] if hasattr(result, 'column_descriptions') else [desc[0] for desc in result.cursor.description]
        rows = result.fetchall()
        return [dict(zip(columns, row)) for row in rows]
    finally:
        session.close()


def get_gold_row(device_uuid: str) -> Optional[Dict[str, Any]]:
    """Get the gold (base) row for a device by UUID."""
    session = get_db_session()
    try:
        query = text("SELECT * FROM databricks_postgres.mvp_gold_tables.gold_rockwell_philips_v2 WHERE device_uuid = :device_uuid")
        result = session.execute(query, {"device_uuid": device_uuid})
        row = result.fetchone()
        if row:
            # SQLAlchemy 2.0 compatible column access
            if hasattr(result, 'keys'):
                columns = list(result.keys())
            else:
                columns = [col.name for col in result.column_descriptions] if hasattr(result, 'column_descriptions') else [desc[0] for desc in result.cursor.description]
            return dict(zip(columns, row))
        return None
    finally:
        session.close()


def commit_field_override(device_uuid: str, field_name: str, new_value: str, 
                         editor_user_id: str, editor_user_name: str,
                         note: Optional[str] = None, apply_for_all: bool = False) -> Dict[str, Any]:
    """
    Commit a field override.
    
    Args:
        device_uuid: UUID of the device to update
        field_name: Name of the field to update
        new_value: New value for the field
        editor_user_id: ID of the user making the change
        editor_user_name: Name of the user making the change
        note: Optional note about the change
        apply_for_all: If True, apply this change to all devices with the same cps_id
    
    Returns:
        Dict with success status and any error message
    """
    # Validate the field value
    is_valid, error_msg = validate_field(field_name, new_value)
    if not is_valid:
        return {"success": False, "error": error_msg}
    
    # Get current effective row (snapshot_before)
    effective_device = get_device_by_uuid(device_uuid, validated_only=False)
    if not effective_device:
        return {"success": False, "error": f"Device {device_uuid} not found"}
    
    cps_id = effective_device.get("cps_id")
    
    # Insert override record
    session = get_db_session()
    try:
        import json
        
        # Get snapshot for the current device
        snapshot_before = {k: v for k, v in effective_device.items() if k != 'created_at' and k != 'updated_at'}
        snapshot_after = snapshot_before.copy()
        snapshot_after[field_name] = new_value
        
        # Always verify that the device_uuid exists in gold_rockwell_philips_v2 to satisfy foreign key constraint
        # The device might exist in the view but not in the base gold table
        verify_uuid_query = text("""
            SELECT device_uuid 
            FROM databricks_postgres.mvp_gold_tables.gold_rockwell_philips_v2 
            WHERE device_uuid = :device_uuid
        """)
        uuid_exists = session.execute(verify_uuid_query, {"device_uuid": device_uuid}).fetchone()
        
        if uuid_exists:
            # The device_uuid exists in gold table, use it
            target_device_uuid = device_uuid
        else:
            # Device doesn't exist in gold table, find a valid one for this cps_id
            find_uuid_query = text("""
                SELECT device_uuid 
                FROM databricks_postgres.mvp_gold_tables.gold_rockwell_philips_v2 
                WHERE cps_id = :cps_id 
                LIMIT 1
            """)
            uuid_result = session.execute(find_uuid_query, {"cps_id": cps_id}).fetchone()
            if uuid_result:
                target_device_uuid = uuid_result[0]
            else:
                return {"success": False, "error": f"No device found in gold_rockwell_philips_v2 for cps_id {cps_id}"}
        
        query = text("""
            INSERT INTO databricks_postgres.mvp_gold_tables.user_input_cps_catalog
            (device_uuid, cps_id, field_name, new_value, editor_user_id, editor_user_name, 
            note, snapshot_before, snapshot_after, source, is_validated, apply_for_all)
            VALUES
            (:device_uuid, :cps_id, :field_name, :new_value, :editor_user_id, :editor_user_name,
            :note, :snapshot_before, :snapshot_after, 'ui', FALSE, :apply_for_all)
            RETURNING id
        """)
        result = session.execute(query, {
            "device_uuid": target_device_uuid,
            "cps_id": cps_id,
            "field_name": field_name,
            "new_value": str(new_value) if new_value is not None else '',
            "editor_user_id": editor_user_id,
            "editor_user_name": editor_user_name,
            "note": note,
            "snapshot_before": json.dumps(to_jsonable(snapshot_before)),
            "snapshot_after": json.dumps(to_jsonable(snapshot_after)),
            "apply_for_all": apply_for_all
        })
        override_id = result.fetchone()[0]
        
        session.commit()
        return {"success": True, "override_id": override_id}
    except Exception as e:
        session.rollback()
        import traceback
        error_trace = traceback.format_exc()
        print(f"Error in commit_field_override: {error_trace}")
        return {"success": False, "error": str(e)}
    finally:
        session.close()


def get_stats() -> Dict[str, Any]:
    """Get catalog statistics."""
    session = get_db_session()
    try:
        # Total devices
        query = text("SELECT COUNT(*) FROM databricks_postgres.mvp_gold_tables.gold_rockwell_philips_v2")
        total = session.execute(query).scalar()
        
        # Vendors
        query = text("SELECT COUNT(DISTINCT vendor) FROM databricks_postgres.mvp_gold_tables.gold_rockwell_philips_v2 WHERE vendor IS NOT NULL")
        vendors = session.execute(query).scalar()
        
        # Total overrides
        query = text("SELECT COUNT(*) FROM databricks_postgres.mvp_gold_tables.user_input_cps_catalog")
        total_overrides = session.execute(query).scalar()
        
        return {
            "total_devices": total or 0,
            "vendors": vendors or 0,
            "total_overrides": total_overrides or 0,
        }
    finally:
        session.close()


from sqlalchemy import text

def get_groups_by_cps_id(validated_only: bool=False, search_term: str="", filters: Optional[Dict[str,Any]]=None):
    view_name = "databricks_postgres.mvp_gold_tables.v_cps_catalog_effective_validated" if validated_only else "databricks_postgres.mvp_gold_tables.v_cps_catalog_effective"
    session = get_db_session()
    try:
        base = f"SELECT * FROM {view_name}"
        conditions, params = [], {}
        if search_term:
            conditions.append(
                "(LOWER(cps_id) LIKE :s OR LOWER(cps_vector) LIKE :s OR LOWER(model) LIKE :s OR "
                "LOWER(vendor) LIKE :s OR LOWER(category) LIKE :s OR LOWER(potential_cves) LIKE :s)"
            )
            params['s'] = f"%{search_term.lower()}%"
        if filters:
            if filters.get('vendor'):
                conditions.append("LOWER(vendor) LIKE LOWER(:vendor)")
                params['vendor'] = f"%{filters['vendor']}%"
            if filters.get('category'):
                conditions.append("LOWER(category) LIKE LOWER(:category)")
                params['category'] = f"%{filters['category']}%"
            # risk_bucket filter removed - risk_score field no longer exists
        if conditions:
            base += " WHERE " + " AND ".join(conditions)

        q = text(f"""
            WITH rows AS ({base})
            SELECT
              cps_id,
              MIN(vendor) AS vendor,
              MIN(model)  AS model,
              COUNT(*)    AS count,
              MAX(image_url) FILTER (WHERE image_url IS NOT NULL AND image_url <> '') AS sample_image_url
            FROM rows
            GROUP BY cps_id
            ORDER BY vendor, model
        """)
        rows = session.execute(q, params).fetchall()
        return [dict(r._mapping) for r in rows]
    finally:
        session.close()


def get_cps_id_variants(cps_id: str, validated_only: bool=False):
    view_name = "databricks_postgres.mvp_gold_tables.v_cps_catalog_effective_validated" if validated_only else "databricks_postgres.mvp_gold_tables.v_cps_catalog_effective"
    session = get_db_session()
    try:
        q = text(f"SELECT * FROM {view_name} WHERE cps_id = :cid ORDER BY model, cps_vector")
        result = session.execute(q, {"cid": cps_id})
        rows = result.fetchall()
        # SQLAlchemy 2.0 compatible column access
        if rows:
            if hasattr(result, 'keys'):
                cols = list(result.keys())
            else:
                try:
                    cols = [col.name for col in result.column_descriptions] if hasattr(result, 'column_descriptions') else [desc[0] for desc in result.cursor.description]
                except:
                    # Fallback: use _mapping if available
                    items = [dict(r._mapping) for r in rows]
                    diff_fields = []
                    if len(items) > 1:
                        for key in items[0].keys():
                            if key not in ['device_uuid', 'created_at', 'updated_at']:
                                values = set(str(items[i].get(key, '')) for i in range(len(items)))
                                if len(values) > 1:
                                    diff_fields.append(key)
                    return items, diff_fields
            items = [dict(zip(cols, r)) for r in rows]
        else:
            cols = []
            items = []
        # compute diffs: keep only fields with >1 unique value
        diff_fields = []
        if items:
            keys = list(items[0].keys())
            for k in keys:
                vals = {str(it.get(k)) for it in items}
                if len(vals) > 1 and k not in {"device_uuid","created_at","updated_at"}:
                    diff_fields.append(k)
        return items, diff_fields
    finally:
        session.close()


def get_all_changes(limit: int = 1000) -> List[Dict[str, Any]]:
    """Get all changes/overrides across all devices, sorted by timestamp."""
    session = get_db_session()
    try:
        query = text("""
            SELECT 
                u.*,
                g.model,
                g.vendor,
                g.cps_id as device_cps_id
            FROM databricks_postgres.mvp_gold_tables.user_input_cps_catalog u
            LEFT JOIN databricks_postgres.mvp_gold_tables.gold_rockwell_philips_v2 g ON u.device_uuid = g.device_uuid
            ORDER BY u.changed_at DESC
            LIMIT :limit
        """)
        result = session.execute(query, {"limit": limit})
        rows = result.fetchall()
        # SQLAlchemy 2.0 compatible column access
        if hasattr(result, 'keys'):
            columns = list(result.keys())
        else:
            try:
                columns = [col.name for col in result.column_descriptions] if hasattr(result, 'column_descriptions') else [desc[0] for desc in result.cursor.description]
            except:
                # Fallback: use _mapping
                return [dict(r._mapping) for r in rows]
        return [dict(zip(columns, row)) for row in rows]
    finally:
        session.close()


def get_device_changes_over_time(device_uuid: str, days: int = 7) -> List[Dict[str, Any]]:
    """Get changes over time for a specific device, grouped by date."""
    session = get_db_session()
    try:
        query = text("""
            SELECT 
                DATE(changed_at) as date,
                COUNT(*) as count
            FROM databricks_postgres.mvp_gold_tables.user_input_cps_catalog
            WHERE device_uuid = :device_uuid
              AND changed_at >= CURRENT_DATE - INTERVAL '1 day' * :days
            GROUP BY DATE(changed_at)
            ORDER BY date ASC
        """)
        result = session.execute(query, {"device_uuid": device_uuid, "days": days})
        rows = result.fetchall()
        if hasattr(result, 'keys'):
            columns = list(result.keys())
        else:
            try:
                columns = [col.name for col in result.column_descriptions] if hasattr(result, 'column_descriptions') else [desc[0] for desc in result.cursor.description]
            except:
                return [dict(r._mapping) for r in rows]
        return [dict(zip(columns, row)) for row in rows]
    finally:
        session.close()


def delete_change(change_id: int) -> bool:
    """Delete a change/override by ID."""
    session = get_db_session()
    try:
        query = text("""
            DELETE FROM databricks_postgres.mvp_gold_tables.user_input_cps_catalog
            WHERE id = :change_id
        """)
        result = session.execute(query, {"change_id": change_id})
        session.commit()
        return result.rowcount > 0
    except Exception as e:
        session.rollback()
        raise e
    finally:
        session.close()


def get_table_schema(table_name: str = "gold_rockwell_philips_v2") -> Dict[str, Dict[str, Any]]:
    """
    Get column metadata from the database schema.
    Returns a dict mapping column names to their metadata (type, nullable, etc.)
    """
    session = get_db_session()
    try:
        query = text("""
            SELECT 
                c.column_name,
                c.data_type,
                c.udt_name,
                c.is_nullable,
                c.character_maximum_length,
                c.numeric_precision,
                c.numeric_scale
            FROM information_schema.columns c
            WHERE c.table_schema = 'mvp_gold_tables' 
              AND c.table_name = :table_name
              AND c.column_name NOT IN ('created_at', 'updated_at', 'device_uuid', 'risk_score', 'needs_vector')
              ORDER BY c.ordinal_position
        """)
        result = session.execute(query, {"table_name": table_name})
        rows = result.fetchall()
        
        # Map field names to their associated enum types
        field_to_enum_map = {
            'device_type': 'device_type_family'
        }
        
        schema = {}
        for row in rows:
            col_name = row[0]
            data_type = row[1]
            udt_name = row[2]  # User-defined type name (more specific)
            is_nullable = row[3] == 'YES'
            max_length = row[4]
            numeric_precision = row[5]
            numeric_scale = row[6]
            
            # Map PostgreSQL types to React input types
            input_type = 'text'  # default
            input_metadata = {}
            
            # Check if this field has an associated enum
            if col_name in field_to_enum_map:
                enum_type_name = field_to_enum_map[col_name]
                # Fetch enum values from the associated enum type
                enum_query = text("""
                    SELECT enumlabel 
                    FROM pg_enum 
                    WHERE enumtypid = (
                        SELECT oid FROM pg_type WHERE typname = :enum_type
                    )
                    ORDER BY enumsortorder
                """)
                try:
                    enum_result = session.execute(enum_query, {"enum_type": enum_type_name})
                    enum_values = [row[0] for row in enum_result.fetchall()]
                    if enum_values:
                        input_type = 'combobox'
                        input_metadata = { 'options': enum_values }
                except Exception as e:
                    # If enum doesn't exist or query fails, fall back to text
                    print(f"Warning: Could not fetch enum values for {col_name}: {e}")
                    input_type = 'text'
            elif udt_name == 'date':
                input_type = 'date'
            elif udt_name == 'timestamp' or udt_name == 'timestamptz':
                input_type = 'datetime-local'
            elif udt_name == 'time':
                input_type = 'time'
            elif udt_name in ('int2', 'int4', 'int8', 'smallint', 'integer', 'bigint'):
                input_type = 'number'
                input_metadata = { 'step': 1 }
            elif udt_name in ('numeric', 'decimal', 'float4', 'float8', 'real', 'double'):
                input_type = 'number'
                input_metadata = { 'step': 0.01 if numeric_scale else 0.1 }
            elif udt_name == 'bool' or udt_name == 'boolean':
                input_type = 'checkbox'
            elif udt_name in ('text', 'varchar', 'char'):
                if max_length and max_length > 200:
                    input_type = 'textarea'
                else:
                    input_type = 'text'
            elif udt_name == 'json' or udt_name == 'jsonb':
                input_type = 'textarea'
            
            schema[col_name] = {
                'type': input_type,
                'data_type': data_type,
                'udt_name': udt_name,
                'nullable': is_nullable,
                'max_length': max_length,
                'numeric_precision': numeric_precision,
                'numeric_scale': numeric_scale,
                'metadata': input_metadata
            }
        
        return schema
    finally:
        session.close()
