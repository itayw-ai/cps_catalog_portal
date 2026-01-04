#!/bin/bash

# Start backend in background
echo "Starting backend server..."
cd backend

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
    echo "✓ Virtual environment activated"
fi

# Use python3 if python is not available
if command -v python3 &> /dev/null; then
    PYTHON_CMD=python3
elif command -v python &> /dev/null; then
    PYTHON_CMD=python
else
    echo "✗ Error: python or python3 not found"
    exit 1
fi

echo "Using: $PYTHON_CMD"
$PYTHON_CMD main.py &
BACKEND_PID=$!
cd ..

# Wait a bit for backend to start
echo "Waiting for backend to start..."
sleep 3

# Check if backend is running
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "✗ Error: Backend failed to start"
    exit 1
fi

echo "✓ Backend started (PID: $BACKEND_PID)"

# Start frontend
echo "Starting frontend..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✓ Backend PID: $BACKEND_PID"
echo "✓ Frontend PID: $FRONTEND_PID"
echo "✓ Backend: http://localhost:8000"
echo "✓ Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for Ctrl+C
trap "echo ''; echo 'Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
wait

