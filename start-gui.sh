#!/usr/bin/env bash

# NixOS GUI Startup Script
# Starts the backend API and opens the interface

echo "🌟 Starting NixOS GUI..."
echo

# Check if we're in nix-shell
if [ -z "$IN_NIX_SHELL" ]; then
    echo "⚠️  Not in nix-shell. Starting with system Node.js..."
    echo "   For best results, run: nix-shell"
    echo
fi

# Navigate to backend directory
cd "$(dirname "$0")/backend" || exit 1

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo
fi

# Start the API server
echo "🚀 Starting API server on http://localhost:7778"
echo "   Press Ctrl+C to stop"
echo

# Export environment variables
export NODE_ENV=production
export PORT=7778

# Start the server
node nixos-gui-api.js &
SERVER_PID=$!

# Wait a moment for server to start
sleep 2

# Open the interface
echo "🌐 Opening NixOS GUI in browser..."
xdg-open "http://localhost:7778/dashboard.html" 2>/dev/null || \
    open "http://localhost:7778/dashboard.html" 2>/dev/null || \
    echo "   Please open: http://localhost:7778/dashboard.html"

# Wait for server process
wait $SERVER_PID