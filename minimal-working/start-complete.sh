#!/usr/bin/env bash

echo "🚀 Starting NixOS Package Search - Complete Version!"
echo "==================================================="
echo

# Kill any existing processes
echo "🧹 Cleaning up old processes..."
pkill -f "python3.*backend" 2>/dev/null
pkill -f "python3.*5000" 2>/dev/null
pkill -f "python3.*8080" 2>/dev/null
sleep 2

# Start the new backend with status checking
echo "🔧 Starting backend with installed status checking..."
cd /srv/luminous-dynamics/nixos-gui/minimal-working
python3 backend-with-status.py &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

# Give backend time to start and cache installed packages
echo "📦 Backend is checking installed packages..."
sleep 3

# Test backend
if curl -s http://localhost:5000/health | grep -q "installed-status"; then
    echo "✅ Backend is running with status feature!"
else
    echo "❌ Backend failed to start"
    exit 1
fi

# Start frontend
echo "🌐 Starting frontend on port 8080..."
python3 -m http.server 8080 &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"

echo
echo "✨ Complete NixOS Package Search is ready!"
echo "========================================="
echo
echo "📍 Frontend: http://localhost:8080/index-complete.html"
echo
echo "✨ Features:"
echo "   1. Search packages ✅"
echo "   2. See installed status ✅"
echo "   3. Copy install commands ✅"
echo
echo "🎯 Try searching for packages you have installed"
echo "   (like firefox, vim, git) to see the status badges!"
echo
echo "🛑 To stop: Press Ctrl+C or run:"
echo "   kill $BACKEND_PID $FRONTEND_PID"
echo

# Keep running
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped.'" EXIT
wait