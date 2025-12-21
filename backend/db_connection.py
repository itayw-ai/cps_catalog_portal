# db_connection.py
"""
Database connection module for Databricks App.
Uses OAuth token authentication with Lakebase Postgres.
"""
import os
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import NullPool
from databricks.sdk import WorkspaceClient
from databricks.sdk.core import Config


def get_db_connection_string() -> str:
    """Build the SQLAlchemy connection URL (psycopg3)."""
    # Check if we're in local dev mode
    is_local_dev = os.getenv("LOCAL_DEV", "false").lower() == "true"
    
    if is_local_dev:
        # Local development mode - use Databricks token authentication
        host = os.getenv("PGHOST", "localhost")
        port = os.getenv("PGPORT", "5432")
        db_name = os.getenv("PGDATABASE", "postgres")
        
        # Try to get username from env, otherwise use client_id from Databricks config
        username = os.getenv("PGUSER")
        if not username:
            try:
                cfg = Config()
                username = cfg.client_id
            except:
                username = "postgres"  # fallback
        
        # Password will be set via OAuth token in setup_db_engine
        # Return connection string without password (will be injected at connect time)
        return f"postgresql+psycopg://{username}:@{host}:{port}/{db_name}"
    
    # Production mode - use OAuth token authentication
    host = os.getenv("PGHOST")
    port = os.getenv("PGPORT", "5432")
    db_name = os.getenv("PGDATABASE")  # support either var

    # Use the app's client id as the Postgres username (no static password)
    cfg = Config()
    username = cfg.client_id

    missing = []
    if not host: missing.append("PGHOST")
    if not db_name: missing.append("PGDATABASE/DB_NAME")
    if not username: missing.append("client_id")
    if missing:
        raise RuntimeError(f"Missing required environment: {', '.join(missing)}")

    return f"postgresql+psycopg://{username}:@{host}:{port}/{db_name}"

def get_oauth_token() -> str:
    """Retrieve a short-lived OAuth token for the App."""
    # This is the supported way within Databricks Apps
    # Works both in production and local dev mode
    try:
        w = WorkspaceClient()
        tok = w.config.oauth_token()
        if not tok or not tok.access_token:
            raise RuntimeError("OAuth token not available")
        return tok.access_token
    except Exception as e:
        # If OAuth fails, try using PGPASSWORD from env as fallback (for local dev)
        password = os.getenv("PGPASSWORD")
        if password:
            return password
        raise RuntimeError(f"OAuth token not available and PGPASSWORD not set: {e}")

def setup_db_engine():
    """Create SQLAlchemy engine and inject OAuth token on connect."""
    url = get_db_connection_string()
    is_local_dev = os.getenv("LOCAL_DEV", "false").lower() == "true"
    
    # Both local dev and production require SSL for Lakebase
    engine = create_engine(
        url,
        poolclass=NullPool,
        connect_args={"sslmode": "require"},
    )

    @event.listens_for(engine, "do_connect")
    def provide_token(dialect, conn_rec, cargs, cparams):
        # Provide the OAuth token (or PGPASSWORD fallback) as the password at connect time
        cparams["password"] = get_oauth_token()

    @event.listens_for(engine, "connect")
    def set_search_path(dbapi_conn, connection_record):
        # psycopg2 or psycopg3 both expose .cursor()
        with dbapi_conn.cursor() as cur:
            cur.execute("SET search_path TO mvp_gold_tables;")

    return engine

_engine = None

def get_db_session() -> Session:
    global _engine
    if _engine is None:
        _engine = setup_db_engine()
    SessionLocal = sessionmaker(bind=_engine, autocommit=False, autoflush=False)
    return SessionLocal()

def init_db():
    # Views are created separately; nothing to do here
    return

