#!/usr/bin/env bash

echo "🚀 Starting NixOS Package Search - With Correct Ports!"
echo "====================================================="
echo

# ALWAYS CHECK PORTS FIRST!
echo "🔍 Checking if ports are available..."
if lsof -i :5001 >/dev/null 2>&1; then
    echo "❌ Port 5001 is already in use!"
    lsof -i :5001
    exit 1
fi

if lsof -i :8001 >/dev/null 2>&1; then
    echo "❌ Port 8001 is already in use!"
    lsof -i :8001
    exit 1
fi

echo "✅ Ports 5001 and 8001 are free!"

# Kill any of OUR old processes
echo "🧹 Cleaning up old processes..."
pkill -f "python3.*backend" 2>/dev/null
sleep 2

# Start the backend on port 5001 (NOT 5000!)
echo "🔧 Starting backend on port 5001..."
cd /srv/luminous-dynamics/nixos-gui/minimal-working

# Update backend to use port 5001
sed 's/5000/5001/g' backend-simple.py > backend-port-5001.py
python3 backend-port-5001.py &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

sleep 3

# Test backend
if curl -s http://localhost:5001/health | grep -q "ok"; then
    echo "✅ Backend is running on port 5001!"
else
    echo "❌ Backend failed to start"
    exit 1
fi

# Start frontend on port 8001 (NOT 8080!)
echo "🌐 Starting frontend on port 8001..."
python3 -m http.server 8001 &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"

echo
echo "✨ NixOS Package Search is ready!"
echo "================================"
echo
echo "📍 Frontend: http://localhost:8001"
echo "📍 Backend API: http://localhost:5001"
echo
echo "⚠️  IMPORTANT: The frontend expects backend on port 5000"
echo "   You may need to update the JavaScript to use port 5001"
echo
echo "🛑 To stop: Press Ctrl+C or run:"
echo "   kill $BACKEND_PID $FRONTEND_PID"
echo

# Keep running
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped.'" EXIT
wait