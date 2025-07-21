#!/usr/bin/env bash

echo "🧪 Testing NixOS Package Search with Install Button"
echo "================================================="
echo

# Check if backend is running
if ! curl -s http://localhost:5000/health | grep -q "ok"; then
    echo "⚠️  Backend not running. Starting it..."
    python3 backend-simple.py > backend.log 2>&1 &
    sleep 3
fi

# Check if frontend server is running
if ! curl -s http://localhost:8080 > /dev/null 2>&1; then
    echo "⚠️  Frontend server not running. Starting it..."
    cd /srv/luminous-dynamics/nixos-gui/minimal-working
    python3 -m http.server 8080 > frontend.log 2>&1 &
    sleep 2
fi

echo "✅ Services are running!"
echo
echo "📋 To test the new install button feature:"
echo "1. Open http://localhost:8080/index-with-install.html"
echo "2. Search for 'firefox' or 'vim'"
echo "3. Click the blue 'Install' button"
echo "4. The command will be copied to your clipboard!"
echo
echo "🎨 Notice how we borrowed MVP v2's nice button styles"
echo "   but kept our simple, working backend!"
echo
echo "Press Ctrl+C to stop servers when done testing."

# Keep script running
trap "pkill -f 'python3.*backend' && pkill -f 'python3.*8080' && echo 'Stopped.'" EXIT
wait