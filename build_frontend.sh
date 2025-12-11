#!/bin/bash

# Build script for Databricks Apps deployment
# This builds the React frontend and prepares it for deployment

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "Error: npm is not installed."
    echo ""
    echo "Please install Node.js and npm first:"
    echo "  macOS: brew install node"
    echo "  Or download from: https://nodejs.org/"
    echo ""
    echo "After installing, run this script again."
    exit 1
fi

echo "Building React frontend..."
cd frontend

echo "Installing dependencies..."
npm install

echo "Building production bundle..."
npm run build

cd ..

if [ -d "frontend/dist" ]; then
    echo ""
    echo "✅ Build complete! Frontend files are in frontend/dist/"
    echo ""
    echo "To deploy to Databricks Apps:"
    echo "1. Run: databricks sync --watch . /Workspace/Users/YOUR_USER/cps-catalog-portal-react"
    echo "2. Run: databricks apps deploy cps-catalog-portal-react --source-code-path /Workspace/Users/YOUR_USER/cps-catalog-portal-react"
else
    echo "❌ Build failed - frontend/dist/ directory not found"
    exit 1
fi

