# CPS Catalog Portal - React App

A React + FastAPI version of the CPS Catalog Portal with proper state management and no page reloads on edits.

## Structure

- `backend/` - FastAPI server with database connection
- `frontend/` - React app with Vite

## Setup

### Backend

```bash
cd react_app/backend
pip install -r requirements.txt
python main.py
```

Backend runs on http://localhost:8000

### Frontend

```bash
cd react_app/frontend
npm install
npm run dev
```

Frontend runs on http://localhost:3000

## Local Development Mode

To run the app locally and connect to a local Lakebase database:

1. Set environment variables for local database connection:
```bash
export LOCAL_DEV=true
export PGHOST=localhost
export PGPORT=5432
export PGDATABASE=your_database_name
export PGUSER=your_username
export PGPASSWORD=your_password  # Optional if using passwordless auth
```

2. Run the backend:
```bash
cd backend
python main.py
```

3. Run the frontend:
```bash
cd frontend
npm run dev
```

The app will connect to your local PostgreSQL database instead of using OAuth authentication.

## Features

- ✅ No page reloads on edits (React state management)
- ✅ Inline field editing with Save/Cancel buttons
- ✅ Real-time validation and feedback
- ✅ Device catalog grid with search and filters
- ✅ Group chooser for multi-variant devices
- ✅ Changes log page
- ✅ Override history per device
- ✅ Modern UI with shadcn/ui components
- ✅ Local development mode support
- ✅ Protected fields (vendor, model, cps_id, cps_vector cannot be edited)
- ✅ Category enum (OT, IoT, Medical Devices)
- ✅ Mini tables for certified patches and potential CVEs
- ✅ Apply changes to all devices with same CPS-ID option

## Key Differences from Streamlit

1. **State Management**: React uses component state, not session state
2. **No Reloads**: Changes update UI immediately without page refresh
3. **Real-time Updates**: API calls happen in background, UI stays responsive
4. **Better UX**: Faster, more responsive interactions

