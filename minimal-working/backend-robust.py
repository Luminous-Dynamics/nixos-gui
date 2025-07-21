#!/usr/bin/env python3
"""
Robust NixOS Package Search Backend
Handles permission issues and different Nix versions gracefully
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import subprocess
import json
import re
import os
import sys

class PackageSearchHandler(BaseHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # Cache installed packages on startup
        print("🔍 Checking installed packages...")
        self.installed_packages = self.get_installed_packages()
        super().__init__(*args, **kwargs)
    
    @staticmethod
    def get_installed_packages():
        """Get list of installed package names - handles multiple scenarios"""
        installed = set()
        
        # Method 1: Try nix profile list (newer Nix)
        try:
            print("  Trying 'nix profile list'...")
            result = subprocess.run(
                ['nix', 'profile', 'list'],
                capture_output=True,
                text=True,
                timeout=10,
                env={**os.environ, 'TERM': 'dumb'}  # Avoid color codes
            )
            
            if result.returncode == 0:
                for line in result.stdout.split('\n'):
                    if line.startswith('Name:'):
                        # Remove ANSI color codes more thoroughly
                        name = re.sub(r'\x1b\[[0-9;]*m', '', line)
                        name = re.sub(r'\033\[[0-9;]*m', '', name)
                        name = name.replace('Name:', '').strip()
                        if name:
                            installed.add(name)
                print(f"  ✅ Found {len(installed)} packages via 'nix profile'")
                return installed
            else:
                print(f"  ❌ 'nix profile list' failed: {result.stderr[:100]}")
        except Exception as e:
            print(f"  ❌ Error with 'nix profile': {str(e)}")
        
        # Method 2: Try nix-env -q (older Nix)
        try:
            print("  Trying 'nix-env -q'...")
            result = subprocess.run(
                ['nix-env', '-q'],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode == 0 and result.stdout.strip():
                for line in result.stdout.split('\n'):
                    if line.strip():
                        # Extract package name (before version)
                        parts = line.strip().split('-')
                        if parts:
                            installed.add(parts[0])
                print(f"  ✅ Found {len(installed)} packages via 'nix-env'")
                return installed
            else:
                print(f"  ❌ 'nix-env -q' failed or empty")
        except Exception as e:
            print(f"  ❌ Error with 'nix-env': {str(e)}")
        
        # Method 3: Check system profile
        try:
            print("  Trying system profile...")
            result = subprocess.run(
                ['nix-env', '-q', '--profile', '/nix/var/nix/profiles/system'],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode == 0 and result.stdout.strip():
                for line in result.stdout.split('\n'):
                    if line.strip():
                        parts = line.strip().split('-')
                        if parts:
                            installed.add(parts[0])
                print(f"  ✅ Found {len(installed)} system packages")
                return installed
        except Exception as e:
            print(f"  ❌ Error with system profile: {str(e)}")
        
        print("  ⚠️  Could not determine installed packages - feature disabled")
        return set()
    
    def do_GET(self):
        # Parse URL
        parsed_path = urlparse(self.path)
        
        # Enable CORS
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        
        if parsed_path.path == '/search':
            # Get query parameter
            query_params = parse_qs(parsed_path.query)
            query = query_params.get('q', [''])[0]
            
            if not query:
                self.wfile.write(json.dumps({
                    'results': [],
                    'error': None
                }).encode())
                return
            
            try:
                # Run nix search with timeout
                print(f"🔍 Searching for '{query}'...")
                result = subprocess.run(
                    ['nix-env', '-qa', f'.*{query}.*', '--json'],
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                
                if result.returncode != 0:
                    self.wfile.write(json.dumps({
                        'results': [],
                        'error': f'Search failed: {result.stderr[:200]}'
                    }).encode())
                    return
                
                # Parse results
                try:
                    packages = json.loads(result.stdout)
                except json.JSONDecodeError:
                    self.wfile.write(json.dumps({
                        'results': [],
                        'error': 'Invalid response from nix-env'
                    }).encode())
                    return
                
                # Format results with installed status
                formatted_results = []
                for name, info in list(packages.items())[:50]:
                    # Check installed status if we have that data
                    is_installed = False
                    if self.installed_packages:
                        base_name = name.split('-')[0]
                        is_installed = (
                            name in self.installed_packages or
                            base_name in self.installed_packages or
                            any(inst.startswith(base_name) for inst in self.installed_packages)
                        )
                    
                    formatted_results.append({
                        'name': name,
                        'version': info.get('version', 'unknown'),
                        'description': info.get('meta', {}).get('description', 'No description'),
                        'installed': is_installed,
                        'hasInstalledData': bool(self.installed_packages)
                    })
                
                self.wfile.write(json.dumps({
                    'results': formatted_results,
                    'error': None,
                    'total': len(packages),
                    'installedCheckAvailable': bool(self.installed_packages)
                }).encode())
                
            except subprocess.TimeoutExpired:
                self.wfile.write(json.dumps({
                    'results': [],
                    'error': 'Search timed out. Try a more specific query.'
                }).encode())
            except Exception as e:
                self.wfile.write(json.dumps({
                    'results': [],
                    'error': f'Server error: {str(e)}'
                }).encode())
        
        elif parsed_path.path == '/health':
            self.wfile.write(json.dumps({
                'status': 'ok',
                'service': 'nixos-package-search-robust',
                'features': {
                    'search': True,
                    'installedStatus': bool(self.installed_packages),
                    'installedCount': len(self.installed_packages)
                },
                'port': 5001
            }).encode())
        
        elif parsed_path.path == '/debug':
            # Debug endpoint to check what's happening
            self.wfile.write(json.dumps({
                'installedPackages': list(self.installed_packages)[:20],
                'totalInstalled': len(self.installed_packages),
                'pythonVersion': sys.version,
                'env': {
                    'USER': os.environ.get('USER'),
                    'HOME': os.environ.get('HOME'),
                    'NIX_PATH': os.environ.get('NIX_PATH', 'not set')
                }
            }).encode())
        
        else:
            self.wfile.write(json.dumps({
                'error': 'Not found',
                'availableEndpoints': ['/search?q=query', '/health', '/debug']
            }).encode())
    
    def log_message(self, format, *args):
        # Only log errors
        if args[1] != '200':
            print(format % args)

if __name__ == '__main__':
    PORT = 5001  # Using our designated port!
    
    print("🚀 Robust NixOS Package Search Backend")
    print(f"📍 Running on http://localhost:{PORT}")
    print("✨ Features:")
    print("   - Handles permission issues gracefully")
    print("   - Works with different Nix versions")
    print("   - Shows installed status when available")
    print(f"🔍 Try http://localhost:{PORT}/search?q=firefox")
    print(f"🐛 Debug info at http://localhost:{PORT}/debug")
    print()
    
    server = HTTPServer(('localhost', PORT), PackageSearchHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 Shutting down gracefully...")
        server.shutdown()