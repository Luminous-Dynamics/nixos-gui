#!/usr/bin/env bash

echo "🚀 Starting NixOS Package Search - No Dependencies Version!"
echo "========================================================="
echo

# Kill any existing processes on our ports
echo "🧹 Cleaning up old processes..."
pkill -f "python3.*backend" 2>/dev/null
pkill -f "python3.*5000" 2>/dev/null
pkill -f "python3.*8080" 2>/dev/null
sleep 1

# Start backend
echo "🔧 Starting backend on port 5000 (no Flask needed!)..."
python3 backend-simple.py &
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
cd /srv/luminous-dynamics/nixos-gui/minimal-working
python3 -m http.server 8080 &
FRONTEND_PID=$!
echo "   PID: $FRONTEND_PID"

echo
echo "✨ NixOS Package Search is ready!"
echo "================================="
echo "🔍 Open http://localhost:8080 in your browser"
echo "🛑 To stop: Press Ctrl+C or run: kill $BACKEND_PID $FRONTEND_PID"
echo
echo "📝 This version uses NO external dependencies - just Python stdlib!"
echo

# Keep script running
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped.'" EXIT
wait