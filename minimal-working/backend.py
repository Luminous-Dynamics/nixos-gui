#!/usr/bin/env python3
"""
Minimal NixOS Package Search Backend
Actually runs nix commands and returns real results
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import subprocess
import json

app = Flask(__name__)
CORS(app)  # Allow frontend to connect

@app.route('/search')
def search():
    """Search for NixOS packages using nix-env"""
    query = request.args.get('q', '').strip()
    
    if not query:
        return jsonify({'results': [], 'error': None})
    
    try:
        # Run actual nix command
        # Note: This will be slow on first run as it builds cache
        result = subprocess.run(
            ['nix-env', '-qa', f'.*{query}.*', '--json'],
            capture_output=True,
            text=True,
            timeout=30  # Prevent hanging
        )
        
        if result.returncode != 0:
            return jsonify({
                'results': [],
                'error': f'nix command failed: {result.stderr}'
            })
        
        # Parse nix output
        packages = json.loads(result.stdout)
        
        # Format for frontend (limit to 50 results)
        formatted_results = []
        for name, info in list(packages.items())[:50]:
            formatted_results.append({
                'name': name,
                'version': info.get('version', 'unknown'),
                'description': info.get('meta', {}).get('description', 'No description available')
            })
        
        return jsonify({
            'results': formatted_results,
            'error': None,
            'total': len(packages)
        })
        
    except subprocess.TimeoutExpired:
        return jsonify({
            'results': [],
            'error': 'Search timed out. Try a more specific query.'
        })
    except Exception as e:
        return jsonify({
            'results': [],
            'error': f'Server error: {str(e)}'
        })

@app.route('/health')
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'service': 'nixos-package-search'})

if __name__ == '__main__':
    print("🚀 NixOS Package Search Backend")
    print("📍 Running on http://localhost:5000")
    print("🔍 Try http://localhost:5000/search?q=firefox")
    app.run(host='127.0.0.1', port=5000, debug=True)