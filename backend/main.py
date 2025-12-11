"""
FastAPI backend for CPS Catalog Portal React App - Databricks Apps compatible
"""
import warnings
import os

# Suppress Streamlit context warnings (not used in FastAPI app)
warnings.filterwarnings('ignore', message='.*ScriptRunContext.*')

from fastapi import FastAPI, HTTPException, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from pathlib import Path

try:
    from db_connection import get_db_session, init_db
    from models import (
        get_effective_catalog,
        get_device_by_uuid,
        get_device_overrides,
        commit_field_override,
        get_stats,
        get_groups_by_cps_id,
        get_cps_id_variants,
        get_all_changes,
        get_device_changes_over_time,
        delete_change,
        get_table_schema,
        to_jsonable
    )
except ImportError as e:
    import sys
    import traceback
    print(f"ERROR: Failed to import modules: {e}")
    print(f"Python path: {sys.path}")
    traceback.print_exc()
    raise

app = FastAPI(title="CPS Catalog Portal")

# CORS middleware - in Databricks Apps, frontend and backend are same origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ignore Streamlit WebSocket connection attempts (403 is correct response)
@app.get("/_stcore/{path:path}")
async def ignore_streamlit(path: str):
    """Ignore Streamlit connection attempts (browser extensions, etc.)"""
    raise HTTPException(status_code=403, detail="Not a Streamlit app")

@app.websocket("/_stcore/{path:path}")
async def ignore_streamlit_ws(path: str):
    """Ignore Streamlit WebSocket connection attempts"""
    raise HTTPException(status_code=403, detail="Not a Streamlit app")

# Request models
class FieldOverrideRequest(BaseModel):
    device_uuid: str
    field_name: str
    new_value: str
    editor_user_id: str
    editor_user_name: str
    apply_for_all: bool = False

class FilterRequest(BaseModel):
    validated_only: bool = False
    search_term: str = ""
    vendor: Optional[str] = None
    category: Optional[str] = None
    risk_bucket: Optional[str] = None

@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    try:
        init_db()
    except Exception as e:
        print(f"Warning: Database initialization issue: {e}")

# Note: Root endpoint moved below - frontend serving takes priority

@app.get("/api/catalog")
async def get_catalog(
    validated_only: bool = False,
    search_term: str = "",
    vendor: Optional[str] = None,
    category: Optional[str] = None,
    risk_bucket: Optional[str] = None
):
    """Get catalog with filters"""
    try:
        filters = {}
        if vendor:
            filters['vendor'] = vendor
        if category:
            filters['category'] = category
        if risk_bucket:
            filters['risk_bucket'] = risk_bucket
        
        devices = get_effective_catalog(
            validated_only=validated_only,
            search_term=search_term,
            filters=filters if filters else None
        )
        
        return {
            "success": True,
            "data": [to_jsonable(d) for d in devices]
        }
    except Exception as e:
        import traceback
        error_detail = str(e)
        traceback.print_exc()
        print(f"Error in get_catalog: {error_detail}")
        raise HTTPException(status_code=500, detail=error_detail)

@app.get("/api/catalog/groups")
async def get_catalog_groups(
    validated_only: bool = False,
    search_term: str = "",
    vendor: Optional[str] = None,
    category: Optional[str] = None,
    risk_bucket: Optional[str] = None
):
    """Get catalog grouped by cps_id"""
    try:
        filters = {}
        if vendor:
            filters['vendor'] = vendor
        if category:
            filters['category'] = category
        if risk_bucket:
            filters['risk_bucket'] = risk_bucket
        
        groups = get_groups_by_cps_id(
            validated_only=validated_only,
            search_term=search_term,
            filters=filters if filters else None
        )
        
        return {
            "success": True,
            "data": [to_jsonable(g) for g in groups]
        }
    except Exception as e:
        import traceback
        error_detail = str(e)
        traceback.print_exc()
        print(f"Error in get_catalog_groups: {error_detail}")
        raise HTTPException(status_code=500, detail=error_detail)

@app.get("/api/device/{device_uuid}")
async def get_device(device_uuid: str, validated_only: bool = False):
    """Get single device by UUID"""
    try:
        device = get_device_by_uuid(device_uuid, validated_only=validated_only)
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")
        
        return {
            "success": True,
            "data": to_jsonable(device)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/device/{device_uuid}/overrides")
async def get_device_overrides_endpoint(device_uuid: str):
    """Get override history for a device"""
    try:
        overrides = get_device_overrides(device_uuid)
        return {
            "success": True,
            "data": [to_jsonable(o) for o in overrides]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/cps-id/{cps_id}/variants")
async def get_variants(cps_id: str, validated_only: bool = False):
    """Get all variants (device_uuid) for a cps_id"""
    try:
        items, diff_fields = get_cps_id_variants(cps_id, validated_only=validated_only)
        return {
            "success": True,
            "data": {
                "items": [to_jsonable(i) for i in items],
                "diff_fields": diff_fields
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def get_current_user(request: Request) -> tuple[str, str]:
    """Extract Databricks user from request headers."""
    # Check if we're in local dev mode - use environment variables or PGUSER
    is_local_dev = os.getenv("LOCAL_DEV", "false").lower() == "true"
    
    if is_local_dev:
        # In local dev, use PGUSER or environment variables
        local_user = os.getenv("PGUSER") or os.getenv("LOCAL_USER") or os.getenv("USER") or "local_dev_user"
        local_name = os.getenv("LOCAL_USER_NAME") or local_user
        return local_user, local_name
    
    # Production mode - extract from Databricks headers
    # Based on Streamlit app, Databricks Apps uses these headers:
    # X-Forwarded-Email, X-Forwarded-Preferred-Username, X-Forwarded-User
    email = request.headers.get("X-Forwarded-Email")
    username = request.headers.get("X-Forwarded-Preferred-Username") or email
    user_id = request.headers.get("X-Forwarded-User") or email
    
    # Fallbacks
    if not user_id:
        user_id = (
            request.headers.get("X-Databricks-User-Id") or
            request.headers.get("Databricks-User-Id") or
            request.headers.get("X-User-Id") or
            os.getenv("DATABRICKS_USER_NAME") or
            os.getenv("DATABRICKS_USERNAME") or
            "unknown_user"
        )
    
    if not username:
        username = (
            request.headers.get("X-Databricks-User-Name") or
            request.headers.get("Databricks-User-Name") or
            request.headers.get("X-User-Name") or
            user_id  # Fallback to user_id if name not found
        )
    
    return user_id or "unknown_user", username or user_id or "unknown_user"

@app.post("/api/device/override")
async def commit_override(request: FieldOverrideRequest, http_request: Request):
    """Commit a field override"""
    try:
        # Get actual user from Databricks session
        editor_user_id, editor_user_name = get_current_user(http_request)
        
        # Use provided user info if available, otherwise use session user
        final_user_id = request.editor_user_id if request.editor_user_id != "current_user" else editor_user_id
        final_user_name = request.editor_user_name if request.editor_user_name != "Current User" else editor_user_name
        
        result = commit_field_override(
            device_uuid=request.device_uuid,
            field_name=request.field_name,
            new_value=request.new_value,
            editor_user_id=final_user_id,
            editor_user_name=final_user_name,
            apply_for_all=request.apply_for_all
        )
        
        if result.get('success'):
            return {
                "success": True,
                "message": result.get('message', 'Override committed')
            }
        else:
            raise HTTPException(status_code=400, detail=result.get('error', 'Unknown error'))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stats")
async def get_stats_endpoint():
    """Get catalog statistics"""
    try:
        stats = get_stats()
        return {
            "success": True,
            "data": to_jsonable(stats)
        }
    except Exception as e:
        import traceback
        error_detail = str(e)
        traceback.print_exc()
        print(f"Error in get_stats_endpoint: {error_detail}")
        raise HTTPException(status_code=500, detail=error_detail)

@app.get("/api/changes")
async def get_all_changes_endpoint(limit: int = 1000):
    """Get all changes across all devices"""
    try:
        changes = get_all_changes(limit=limit)
        return {
            "success": True,
            "data": [to_jsonable(c) for c in changes]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/device/{device_uuid}/changes-over-time")
async def get_device_changes_over_time_endpoint(device_uuid: str, days: int = 7):
    """Get changes over time for a specific device"""
    try:
        changes = get_device_changes_over_time(device_uuid, days=days)
        return {
            "success": True,
            "data": [to_jsonable(c) for c in changes]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/changes/{change_id}")
async def delete_change_endpoint(change_id: int):
    """Delete/revert a change by ID"""
    try:
        success = delete_change(change_id)
        if success:
            return {
                "success": True,
                "message": "Change reverted successfully"
            }
        else:
            raise HTTPException(status_code=404, detail="Change not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/schema")
async def get_schema_endpoint():
    """Get database schema metadata for dynamic field rendering"""
    try:
        from models import get_table_schema
        schema = get_table_schema("cps_catalog_gold")
        return {
            "success": True,
            "data": to_jsonable(schema)
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# Serve static files from frontend build
# In Databricks Apps, the frontend build will be in the same directory
# Try multiple possible paths (relative to backend, relative to root, absolute)
_backend_dir = Path(__file__).parent
_possible_paths = [
    _backend_dir.parent / "frontend" / "dist",  # react_app/frontend/dist
    _backend_dir / ".." / "frontend" / "dist",  # Alternative relative
    Path.cwd() / "frontend" / "dist",           # From working directory
]

_frontend_path = None
for path in _possible_paths:
    path_resolved = path.resolve()
    if path_resolved.exists() and (path_resolved / "index.html").exists():
        _frontend_path = path_resolved
        break

if not _frontend_path:
    # Try to find it anywhere - search from the source_code root
    import os
    # In Databricks Apps, we're at /app/python/source_code/backend
    # So search from /app/python/source_code/
    search_root = _backend_dir.parent
    print(f"Searching for frontend/dist/ starting from: {search_root}")
    for root, dirs, files in os.walk(search_root):
        if "index.html" in files and "dist" in root:
            _frontend_path = Path(root).resolve()
            print(f"Found frontend at: {_frontend_path}")
            break

print(f"Frontend path: {_frontend_path}")
print(f"Frontend exists: {_frontend_path.exists() if _frontend_path else False}")
if _frontend_path:
    print(f"Index.html exists: {(_frontend_path / 'index.html').exists()}")

# Mount static assets (JS, CSS, images) - must be before catch-all route
if _frontend_path and _frontend_path.exists() and (_frontend_path / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(_frontend_path / "assets")), name="assets")
    print(f"Mounted assets from: {_frontend_path / 'assets'}")

# Root endpoint - serve React app index.html
@app.get("/")
async def serve_index():
    """Serve React app index.html"""
    if not _frontend_path or not _frontend_path.exists():
        return {
            "message": "Frontend not found",
            "searched_paths": [str(p) for p in _possible_paths],
            "current_dir": str(Path.cwd()),
            "backend_dir": str(_backend_dir),
            "hint": "Make sure frontend/dist/ is synced to Databricks workspace"
        }
    
    index_path = _frontend_path / "index.html"
    print(f"Serving index from: {index_path}, exists: {index_path.exists()}")
    if index_path.exists():
        return FileResponse(str(index_path))
    return {"message": f"Frontend index.html not found at: {index_path}", "frontend_path": str(_frontend_path)}

# Catch-all route for React Router (must be last)
@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    """Serve React app for all non-API routes (React Router SPA)"""
    # Don't serve API routes as static files
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404)
    
    # Don't serve assets route (already mounted)
    if full_path.startswith("assets/"):
        raise HTTPException(status_code=404)
    
    # Try to serve the requested file
    file_path = _frontend_path / full_path
    if file_path.exists() and file_path.is_file():
        return FileResponse(str(file_path))
    
    # For SPA routing (e.g., /device/123), return index.html
    # React Router will handle the routing on the client side
    if _frontend_path:
        index_path = _frontend_path / "index.html"
        if index_path.exists():
            return FileResponse(str(index_path))
    
    raise HTTPException(status_code=404, detail=f"File not found: {full_path}")

# Note: This file should be run via start.py for Databricks Apps
# Direct execution is for local development only
if __name__ == "__main__":
    import uvicorn
    import logging
    
    # Suppress uvicorn access logs and warnings
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    
    # Databricks Apps sets PORT automatically
    port = int(os.getenv("PORT", "8000"))
    
    try:
        uvicorn.run(
            "main:app",  # Use string reference for better compatibility
            host="0.0.0.0", 
            port=port,
            log_level="info"
        )
    except Exception as e:
        print(f"Error starting server: {e}")
        import traceback
        traceback.print_exc()
        raise

