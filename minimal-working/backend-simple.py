#!/usr/bin/env python3
"""
Ultra-minimal NixOS Package Search Backend
Uses only Python standard library - no Flask needed!
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import subprocess
import json

class PackageSearchHandler(BaseHTTPRequestHandler):
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
                
                # Format results (limit to 50)
                formatted_results = []
                for name, info in list(packages.items())[:50]:
                    formatted_results.append({
                        'name': name,
                        'version': info.get('version', 'unknown'),
                        'description': info.get('meta', {}).get('description', 'No description')
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
                'service': 'nixos-package-search-simple'
            }).encode())
        
        else:
            self.wfile.write(json.dumps({
                'error': 'Not found'
            }).encode())
    
    def log_message(self, format, *args):
        # Suppress default logging
        pass

if __name__ == '__main__':
    print("🚀 NixOS Package Search Backend (No Flask needed!)")
    print("📍 Running on http://localhost:5000")
    print("🔍 Try http://localhost:5000/search?q=firefox")
    
    server = HTTPServer(('localhost', 5000), PackageSearchHandler)
    server.serve_forever()