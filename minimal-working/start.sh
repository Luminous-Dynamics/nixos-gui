#!/usr/bin/env bash

echo "🚀 Starting NixOS Package Search - Minimal Working Version"
echo "========================================================"
echo

# Check if Flask is available
if ! python3 -c "import flask" 2>/dev/null; then
    echo "📦 Flask not found. Installing..."
    pip3 install --user flask flask-cors
fi

# Kill any existing processes on our ports
echo "🧹 Cleaning up old processes..."
pkill -f "python3.*backend.py" 2>/dev/null
pkill -f "python3.*8080" 2>/dev/null
sleep 1

# Start backend
echo "🔧 Starting backend on port 5000..."
python3 backend.py &
BACKEND_PID=$!
echo "   PID: $BACKEND_PID"

# Give backend time to start
sleep 2

# Test backend
if curl -s http://localhost:5000/health | grep -q "ok"; then
    echo "✅ Backend is running!"
else
    echo "❌ Backend failed to start"
    exit 1
fi

# Start frontend
echo "🌐 Starting frontend on port 8080..."
python3 -m http.server 8080 &
FRONTEND_PID=$!
echo "   PID: $FRONTEND_PID"

echo
echo "✨ NixOS Package Search is ready!"
echo "================================="
echo "🔍 Open http://localhost:8080 in your browser"
echo "🛑 To stop: Press Ctrl+C or run: kill $BACKEND_PID $FRONTEND_PID"
echo
echo "📝 Note: First search might be slow as nix builds its cache"
echo

# Keep script running
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped.'" EXIT
wait