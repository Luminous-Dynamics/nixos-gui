#!/usr/bin/env bash

echo "🚀 Starting NixOS Package Search - Robust Version"
echo "================================================"
echo

# ALWAYS CHECK PORTS FIRST!
echo "🔍 Checking if ports are available..."
if lsof -i :5001 >/dev/null 2>&1; then
    echo "❌ Port 5001 is already in use!"
    echo "   Something is already running on the backend port."
    lsof -i :5001
    echo
    echo "To stop it: kill $(lsof -t -i:5001)"
    exit 1
fi

if lsof -i :8001 >/dev/null 2>&1; then
    echo "❌ Port 8001 is already in use!"
    echo "   Something is already running on the frontend port."
    lsof -i :8001
    echo
    echo "To stop it: kill $(lsof -t -i:8001)"
    exit 1
fi

echo "✅ Ports 5001 and 8001 are free!"

# Clean up any stray Python processes
echo "🧹 Cleaning up old processes..."
pkill -f "python3.*backend-robust.py" 2>/dev/null
sleep 1

# Start the robust backend
echo "🔧 Starting robust backend on port 5001..."
cd /srv/luminous-dynamics/nixos-gui/minimal-working
python3 backend-robust.py &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

# Wait for backend to start
echo "⏳ Waiting for backend to initialize..."
sleep 3

# Test backend
if curl -s http://localhost:5001/health | grep -q '"status": "ok"'; then
    echo "✅ Backend is running and healthy!"
    
    # Show feature status
    INSTALLED_COUNT=$(curl -s http://localhost:5001/health | grep -o '"installedCount": [0-9]*' | grep -o '[0-9]*')
    if [ "$INSTALLED_COUNT" -gt 0 ]; then
        echo "✅ Installed package detection working! ($INSTALLED_COUNT packages found)"
    else
        echo "⚠️  Installed package detection not available (permission issue)"
    fi
else
    echo "❌ Backend failed to start properly"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

# Start frontend
echo "🌐 Starting frontend on port 8001..."
python3 -m http.server 8001 --directory . >/dev/null 2>&1 &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"

echo
echo "✨ NixOS Package Search (Robust) is ready!"
echo "========================================="
echo
echo "📍 Open in browser: http://localhost:8001/index-robust.html"
echo "📍 Backend API: http://localhost:5001"
echo "🔍 Debug info: http://localhost:5001/debug"
echo
echo "Features:"
echo "  ✅ Package search (always works)"
echo "  ${INSTALLED_COUNT:-0} installed packages detected"
echo
echo "🛑 To stop: Press Ctrl+C or run:"
echo "   kill $BACKEND_PID $FRONTEND_PID"
echo

# Trap to clean up on exit
trap "echo; echo 'Shutting down...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped.'" EXIT

# Keep script running
wait