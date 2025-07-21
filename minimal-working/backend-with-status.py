#!/usr/bin/env python3
"""
NixOS Package Search Backend - With Installed Status
Now checks if packages are installed using 'nix profile list'
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import subprocess
import json
import re

class PackageSearchHandler(BaseHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # Cache installed packages on startup
        self.installed_packages = self.get_installed_packages()
        super().__init__(*args, **kwargs)
    
    @staticmethod
    def get_installed_packages():
        """Get list of installed package names"""
        try:
            # Try new nix profile command first
            result = subprocess.run(
                ['nix', 'profile', 'list'],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if result.returncode == 0:
                # Parse output to extract package names
                installed = set()
                for line in result.stdout.split('\n'):
                    if line.startswith('Name:'):
                        # Remove ANSI color codes and extract name
                        name = re.sub(r'\x1b\[[0-9;]*m', '', line)
                        name = name.replace('Name:', '').strip()
                        if name:
                            installed.add(name)
                print(f"📦 Found {len(installed)} installed packages")
                return installed
            else:
                # Fallback to old nix-env -q command
                result = subprocess.run(
                    ['nix-env', '-q'],
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                if result.returncode == 0:
                    installed = set(line.strip() for line in result.stdout.split('\n') if line.strip())
                    print(f"📦 Found {len(installed)} installed packages (using nix-env)")
                    return installed
        except Exception as e:
            print(f"⚠️  Could not get installed packages: {e}")
        
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
                # Run nix-env command
                result = subprocess.run(
                    ['nix-env', '-qa', f'.*{query}.*', '--json'],
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                
                if result.returncode != 0:
                    self.wfile.write(json.dumps({
                        'results': [],
                        'error': f'nix command failed: {result.stderr}'
                    }).encode())
                    return
                
                # Parse results
                packages = json.loads(result.stdout)
                
                # Refresh installed packages cache
                self.installed_packages = self.get_installed_packages()
                
                # Format results with installed status
                formatted_results = []
                for name, info in list(packages.items())[:50]:
                    # Check if installed - match by base name
                    base_name = name.split('-')[0]
                    is_installed = any(
                        base_name == inst or 
                        inst.startswith(base_name + '-') or
                        name == inst
                        for inst in self.installed_packages
                    )
                    
                    formatted_results.append({
                        'name': name,
                        'version': info.get('version', 'unknown'),
                        'description': info.get('meta', {}).get('description', 'No description'),
                        'installed': is_installed
                    })
                
                self.wfile.write(json.dumps({
                    'results': formatted_results,
                    'error': None,
                    'total': len(packages)
                }).encode())
                
            except Exception as e:
                self.wfile.write(json.dumps({
                    'results': [],
                    'error': str(e)
                }).encode())
        
        elif parsed_path.path == '/health':
            self.wfile.write(json.dumps({
                'status': 'ok',
                'service': 'nixos-package-search-with-status',
                'features': ['search', 'installed-status']
            }).encode())
        
        elif parsed_path.path == '/installed':
            # Endpoint to get just installed packages
            self.wfile.write(json.dumps({
                'installed': list(self.installed_packages),
                'count': len(self.installed_packages)
            }).encode())
        
        else:
            self.wfile.write(json.dumps({
                'error': 'Not found'
            }).encode())
    
    def log_message(self, format, *args):
        # Only log errors
        if args[1] != '200':
            print(format % args)

if __name__ == '__main__':
    print("🚀 NixOS Package Search Backend - With Installed Status!")
    print("📍 Running on http://localhost:5000")
    print("✨ NEW: Shows which packages are installed")
    print("🔍 Try http://localhost:5000/search?q=firefox")
    
    server = HTTPServer(('localhost', 5000), PackageSearchHandler)
    server.serve_forever()