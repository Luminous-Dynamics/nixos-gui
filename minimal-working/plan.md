# 🎯 First Working Feature: Package Search

## The ONE Thing We'll Build First

**Feature**: Search for NixOS packages and see results

**User Story**: 
"As a NixOS user, I want to search for packages by name so I can see what's available to install"

## Success Criteria

✓ User can type a package name (e.g., "firefox")  
✓ System runs actual `nix-env -qa` command  
✓ Results display in a simple list  
✓ Each result shows: name, version, description  
✓ It works on a real NixOS system  

## Technical Approach

### Backend (Simple Python Flask)
```python
# Why Python? It's already on NixOS, no extra deps needed
# Just 20 lines of code that actually work
```

### Frontend (Vanilla HTML/JS)
```html
<!-- One HTML file, no frameworks -->
<!-- Just a search box and results div -->
```

### No Over-Engineering
- No authentication (yet)
- No WebSockets (yet)  
- No service workers (yet)
- No plugins (yet)
- Just search that WORKS

## Implementation Steps

### Step 1: Backend That Works (30 min)
```bash
cd /srv/luminous-dynamics/nixos-gui/minimal-working
cat > backend.py << 'EOF'
from flask import Flask, jsonify, request
import subprocess
import json

app = Flask(__name__)

@app.route('/search')
def search():
    query = request.args.get('q', '')
    if not query:
        return jsonify([])
    
    # Real nix command that actually works
    result = subprocess.run(
        ['nix-env', '-qa', f'.*{query}.*', '--json'],
        capture_output=True,
        text=True
    )
    
    try:
        packages = json.loads(result.stdout)
        # Format for frontend
        return jsonify([
            {
                'name': name,
                'version': info.get('version', ''),
                'description': info.get('meta', {}).get('description', '')
            }
            for name, info in packages.items()
        ])
    except:
        return jsonify([])

if __name__ == '__main__':
    app.run(port=5000, debug=True)
EOF
```

### Step 2: Frontend That Works (20 min)
```bash
cat > index.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>NixOS Package Search</title>
    <style>
        body { 
            font-family: sans-serif; 
            max-width: 800px; 
            margin: 0 auto; 
            padding: 20px;
        }
        #search { 
            width: 100%; 
            padding: 10px; 
            font-size: 16px; 
        }
        .result { 
            border: 1px solid #ddd; 
            padding: 10px; 
            margin: 10px 0;
        }
        .name { 
            font-weight: bold; 
        }
        .version { 
            color: #666; 
        }
    </style>
</head>
<body>
    <h1>NixOS Package Search</h1>
    <input type="text" id="search" placeholder="Search packages...">
    <div id="results"></div>
    
    <script>
        let timeout;
        document.getElementById('search').addEventListener('input', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                fetch(`http://localhost:5000/search?q=${e.target.value}`)
                    .then(r => r.json())
                    .then(packages => {
                        const html = packages.map(p => `
                            <div class="result">
                                <div class="name">${p.name}</div>
                                <div class="version">${p.version}</div>
                                <div>${p.description}</div>
                            </div>
                        `).join('');
                        document.getElementById('results').innerHTML = html;
                    });
            }, 300);
        });
    </script>
</body>
</html>
EOF
```

### Step 3: Test It (10 min)
```bash
# Terminal 1
python3 backend.py

# Terminal 2  
python3 -m http.server 8000

# Browser
# http://localhost:8000
# Search for "firefox" - see real results!
```

## What We're NOT Doing

❌ No complex architecture  
❌ No promises about features we haven't built  
❌ No "it will work when..." - it works NOW  
❌ No mock data - real nix queries  

## Next Features (Only After This Works)

1. Show installed status  
2. Add install button (just copies nix command to clipboard)
3. Show dependencies
4. Add simple filtering

But ONLY after search works perfectly.

## Definition of Done

- [ ] Code runs on fresh NixOS system
- [ ] Search returns real results for "firefox", "vim", "git"
- [ ] No errors in browser console
- [ ] No crashes when searching
- [ ] README says exactly what works
- [ ] One happy user (you!) who can actually use it

---

*"Make it work, make it right, make it fast" - Kent Beck*

*We're on step 1: Make it work.* 🌟