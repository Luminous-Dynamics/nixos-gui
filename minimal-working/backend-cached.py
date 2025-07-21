#!/usr/bin/env python3
"""
Cached NixOS Package Search Backend
Adds caching to reduce repeated nix-env calls
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import subprocess
import json
import re
import os
import sys
import time
import hashlib

class CachedPackageSearchHandler(BaseHTTPRequestHandler):
    # Class-level cache shared across all requests
    search_cache = {}
    installed_cache = {'packages': set(), 'timestamp': 0}
    CACHE_TTL = 3600  # 1 hour for search results
    INSTALLED_TTL = 300  # 5 minutes for installed packages
    
    def __init__(self, *args, **kwargs):
        # Update installed packages cache if expired
        if time.time() - self.installed_cache['timestamp'] > self.INSTALLED_TTL:
            print("🔄 Refreshing installed packages cache...")
            self.installed_cache['packages'] = self.get_installed_packages()
            self.installed_cache['timestamp'] = time.time()
        super().__init__(*args, **kwargs)
    
    @staticmethod
    def get_cache_key(query):
        """Generate cache key for search query"""
        return hashlib.md5(query.encode()).hexdigest()
    
    @classmethod
    def clean_cache(cls):
        """Remove expired entries from cache"""
        current_time = time.time()
        expired_keys = []
        
        for key, entry in cls.search_cache.items():
            if current_time - entry['timestamp'] > cls.CACHE_TTL:
                expired_keys.append(key)
        
        for key in expired_keys:
            del cls.search_cache[key]
        
        if expired_keys:
            print(f"🧹 Cleaned {len(expired_keys)} expired cache entries")
    
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
                        # Remove ANSI color codes
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
                    'error': None,
                    'cached': False
                }).encode())
                return
            
            # Check cache first
            cache_key = self.get_cache_key(query)
            if cache_key in self.search_cache:
                cache_entry = self.search_cache[cache_key]
                if time.time() - cache_entry['timestamp'] < self.CACHE_TTL:
                    print(f"💾 Cache HIT for '{query}'")
                    response = cache_entry['data'].copy()
                    response['cached'] = True
                    self.wfile.write(json.dumps(response).encode())
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
                    response = {
                        'results': [],
                        'error': f'Search failed: {result.stderr[:200]}',
                        'cached': False
                    }
                    self.wfile.write(json.dumps(response).encode())
                    return
                
                # Parse results
                try:
                    packages = json.loads(result.stdout)
                except json.JSONDecodeError:
                    response = {
                        'results': [],
                        'error': 'Invalid response from nix-env',
                        'cached': False
                    }
                    self.wfile.write(json.dumps(response).encode())
                    return
                
                # Get current installed packages
                installed_packages = self.installed_cache['packages']
                
                # Format results with installed status
                formatted_results = []
                for name, info in list(packages.items())[:50]:
                    # Check installed status if we have that data
                    is_installed = False
                    if installed_packages:
                        base_name = name.split('-')[0]
                        is_installed = (
                            name in installed_packages or
                            base_name in installed_packages or
                            any(inst.startswith(base_name) for inst in installed_packages)
                        )
                    
                    formatted_results.append({
                        'name': name,
                        'version': info.get('version', 'unknown'),
                        'description': info.get('meta', {}).get('description', 'No description'),
                        'installed': is_installed,
                        'hasInstalledData': bool(installed_packages)
                    })
                
                response = {
                    'results': formatted_results,
                    'error': None,
                    'total': len(packages),
                    'installedCheckAvailable': bool(installed_packages),
                    'cached': False
                }
                
                # Cache the response
                self.search_cache[cache_key] = {
                    'data': response,
                    'timestamp': time.time()
                }
                print(f"💾 Cached results for '{query}'")
                
                # Clean old cache entries periodically
                if len(self.search_cache) > 100:
                    self.clean_cache()
                
                self.wfile.write(json.dumps(response).encode())
                
            except subprocess.TimeoutExpired:
                response = {
                    'results': [],
                    'error': 'Search timed out. Try a more specific query.',
                    'cached': False
                }
                self.wfile.write(json.dumps(response).encode())
            except Exception as e:
                response = {
                    'results': [],
                    'error': f'Server error: {str(e)}',
                    'cached': False
                }
                self.wfile.write(json.dumps(response).encode())
        
        elif parsed_path.path == '/health':
            self.wfile.write(json.dumps({
                'status': 'ok',
                'service': 'nixos-package-search-cached',
                'features': {
                    'search': True,
                    'installedStatus': bool(self.installed_cache['packages']),
                    'installedCount': len(self.installed_cache['packages']),
                    'caching': True,
                    'cacheSize': len(self.search_cache)
                },
                'port': 5001
            }).encode())
        
        elif parsed_path.path == '/cache/stats':
            # Cache statistics endpoint
            total_searches = sum(1 for entry in self.search_cache.values())
            avg_age = 0
            if self.search_cache:
                avg_age = sum(time.time() - entry['timestamp'] 
                             for entry in self.search_cache.values()) / len(self.search_cache)
            
            self.wfile.write(json.dumps({
                'searchCache': {
                    'entries': len(self.search_cache),
                    'avgAge': f"{avg_age:.0f} seconds" if avg_age else "N/A",
                    'ttl': self.CACHE_TTL
                },
                'installedCache': {
                    'packages': len(self.installed_cache['packages']),
                    'age': f"{time.time() - self.installed_cache['timestamp']:.0f} seconds",
                    'ttl': self.INSTALLED_TTL
                }
            }).encode())
        
        elif parsed_path.path == '/cache/clear':
            # Clear cache endpoint
            old_size = len(self.search_cache)
            self.search_cache.clear()
            self.installed_cache = {'packages': set(), 'timestamp': 0}
            
            self.wfile.write(json.dumps({
                'cleared': True,
                'entriesRemoved': old_size
            }).encode())
        
        elif parsed_path.path == '/debug':
            # Debug endpoint to check what's happening
            self.wfile.write(json.dumps({
                'installedPackages': list(self.installed_cache['packages'])[:20],
                'totalInstalled': len(self.installed_cache['packages']),
                'cacheEntries': len(self.search_cache),
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
                'availableEndpoints': [
                    '/search?q=query',
                    '/health',
                    '/cache/stats',
                    '/cache/clear',
                    '/debug'
                ]
            }).encode())
    
    def log_message(self, format, *args):
        # Only log errors
        if args[1] != '200':
            print(format % args)

if __name__ == '__main__':
    PORT = 5001  # Using our designated port!
    
    print("🚀 Cached NixOS Package Search Backend")
    print(f"📍 Running on http://localhost:{PORT}")
    print("✨ Features:")
    print("   - In-memory caching for search results (1 hour TTL)")
    print("   - Cached installed package detection (5 minute TTL)")
    print("   - Handles permission issues gracefully")
    print("   - Works with different Nix versions")
    print(f"🔍 Try http://localhost:{PORT}/search?q=firefox")
    print(f"📊 Cache stats at http://localhost:{PORT}/cache/stats")
    print()
    
    server = HTTPServer(('localhost', PORT), CachedPackageSearchHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 Shutting down gracefully...")
        server.shutdown()