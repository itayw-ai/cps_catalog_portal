#!/usr/bin/env python3
"""
Startup script for FastAPI app in Databricks Apps.
This is the entry point that Databricks Apps will run.
"""
import os
import sys
from pathlib import Path

# Add backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

# Change to backend directory so imports work correctly
os.chdir(backend_dir)

# Now import and run the app
if __name__ == "__main__":
    import uvicorn
    import logging
    
    # Suppress Streamlit context warnings
    import warnings
    warnings.filterwarnings('ignore', message='.*ScriptRunContext.*')
    
    # Suppress uvicorn access logs and warnings
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    
    # Databricks Apps sets PORT automatically (try both common env var names)
    port = int(os.getenv("DATABRICKS_APP_PORT") or os.getenv("PORT", "8000"))
    
    print(f"Starting FastAPI server on port {port}...")
    print(f"Python path: {sys.path}")
    print(f"Working directory: {os.getcwd()}")
    
    try:
        uvicorn.run(
            "main:app",
            host="0.0.0.0",
            port=port,
            log_level="info"
        )
    except Exception as e:
        print(f"ERROR: Failed to start server: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

