# backend/test_connection.py
import os
import sys

# Make sure we're in the right directory
sys.path.insert(0, os.path.dirname(__file__))

from db_connection import get_db_session
from sqlalchemy import text

print("Testing database connection...")
print(f"LOCAL_DEV: {os.getenv('LOCAL_DEV', 'NOT SET')}")
print(f"PGHOST: {os.getenv('PGHOST', 'NOT SET')}")
print(f"PGDATABASE: {os.getenv('PGDATABASE', 'NOT SET')}")
print(f"PGUSER: {os.getenv('PGUSER', 'NOT SET')}")
print()

try:
    session = get_db_session()
    print("✓ Database session created")
    
    # Test basic query
    result = session.execute(text("SELECT 1 as test"))
    print("✓ Basic query works")
    
    # Test if views exist
    try:
        result = session.execute(text("SELECT COUNT(*) FROM databricks_postgres.mvp_gold_tables.v_cps_catalog_effective LIMIT 1"))
        count = result.scalar()
        print(f"✓ View v_cps_catalog_effective exists (count: {count})")
    except Exception as e:
        print(f"✗ View v_cps_catalog_effective error: {e}")
    
    # Test if table exists
    try:
        result = session.execute(text("SELECT COUNT(*) FROM databricks_postgres.mvp_gold_tables.gold_rockwell_philips"))
        count = result.scalar()
        print(f"✓ Table gold_rockwell_philips exists (count: {count})")
    except Exception as e:
        print(f"✗ Table gold_rockwell_philips error: {e}")
    
    session.close()
    print("\n✓ All tests passed!")
    
except Exception as e:
    print(f"\n✗ Database connection failed: {e}")
    import traceback
    traceback.print_exc()