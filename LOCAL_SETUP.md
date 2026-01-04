# Local Development Setup Guide

This guide will help you build and test the CPS Catalog Portal locally.

## Prerequisites

1. **Python 3.13+** (or Python 3.8+)
2. **Node.js 18+** and npm
3. **PostgreSQL database** with access to:
   - `databricks_postgres.mvp_gold_tables.gold_rockwell_philips_v2`
   - `databricks_postgres.mvp_gold_tables.user_input_cps_catalog`
   - `databricks_postgres.mvp_gold_tables.v_cps_catalog_effective`
   - `databricks_postgres.mvp_gold_tables.v_cps_catalog_effective_validated`

## Step 1: Set Up Environment Variables

**Option A: Using .env file (Recommended)**

Create a `.env` file in the `backend/` directory:

```bash
cd backend
cp .env.example .env
# Then edit .env with your actual values
```

The `.env` file should contain:
```bash
# Local development mode
LOCAL_DEV=true

# Database connection (adjust to your local setup)
PGHOST=localhost
PGPORT=5432
PGDATABASE=your_database_name
PGUSER=your_username
PGPASSWORD=your_password
```

**Option B: Export environment variables (Alternative)**

If you prefer to export variables instead:
```bash
export LOCAL_DEV=true
export PGHOST=localhost
export PGPORT=5432
export PGDATABASE=your_database_name
export PGUSER=your_username
export PGPASSWORD=your_password
```

**Note:** The `.env` file is automatically loaded when you run the backend. No need to export variables each time!

## Step 2: Set Up Backend

```bash
# Navigate to backend directory
cd backend

# Create virtual environment (if not already created)
python3 -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
# venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Test database connection
python test_connection.py
```

If the test passes, you should see:
```
✓ Database session created
✓ Basic query works
✓ View v_cps_catalog_effective exists (count: X)
✓ Table gold_rockwell_philips_v2 exists (count: X)
✓ All tests passed!
```

## Step 3: Set Up Frontend

```bash
# Navigate to frontend directory
cd ../frontend

# Install dependencies
npm install

# Build for production (optional, for testing production build)
npm run build
```

## Step 4: Run the Application

### Option A: Run Both Services Separately (Recommended for Development)

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate  # if not already activated
python main.py
# or
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Backend will run on: http://localhost:8000

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

Frontend will run on: http://localhost:3000

### Option B: Use the Start Script

```bash
# Make sure the script is executable
chmod +x start.sh

# Run both services
./start.sh
```

This will start both backend and frontend in the background.

## Step 5: Test the Application

1. **Open the frontend**: Navigate to http://localhost:3000
2. **Test API endpoints**: 
   - Backend API docs: http://localhost:8000/docs
   - Catalog: http://localhost:8000/api/catalog
   - Schema: http://localhost:8000/api/schema

3. **Test functionality**:
   - Browse the catalog
   - Click on a device to view details
   - Try editing a field (e.g., image_url, network_type)
   - Test "Apply to all devices" checkbox
   - Check override history

## Troubleshooting

### Database Connection Issues

If you get connection errors:
1. Verify your database credentials in environment variables
2. Check that the database is running and accessible
3. Verify table/view names match:
   - `databricks_postgres.mvp_gold_tables.gold_rockwell_philips_v2`
   - `databricks_postgres.mvp_gold_tables.user_input_cps_catalog`
   - `databricks_postgres.mvp_gold_tables.v_cps_catalog_effective`

### Frontend Not Connecting to Backend

1. Check that backend is running on port 8000
2. Check `frontend/vite.config.js` - proxy should point to `http://localhost:8000`
3. Check browser console for CORS errors

### Foreign Key Constraint Errors

If you see foreign key violations:
1. Ensure the `device_uuid` exists in `gold_rockwell_philips_v2` table
2. The code should automatically find a valid UUID, but verify the table has data

### Port Already in Use

If port 8000 or 3000 is already in use:
```bash
# Find and kill process on port 8000
lsof -ti:8000 | xargs kill -9

# Find and kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

## Development Workflow

1. **Make code changes** in `backend/` or `frontend/src/`
2. **Backend**: Restart the server (Ctrl+C and run again) or use `--reload` flag
3. **Frontend**: Vite will auto-reload on changes (HMR - Hot Module Replacement)
4. **Test changes** in the browser

## Building for Production

```bash
# Build frontend
cd frontend
npm run build

# The built files will be in frontend/dist/
# Backend serves these files automatically when running in production mode
```

## Useful Commands

```bash
# Backend
cd backend
python test_connection.py          # Test DB connection
python main.py                      # Run backend
uvicorn main:app --reload           # Run with auto-reload

# Frontend
cd frontend
npm run dev                         # Development server
npm run build                       # Production build
npm run preview                     # Preview production build
```


