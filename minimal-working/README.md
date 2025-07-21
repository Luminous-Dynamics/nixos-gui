# NixOS Package Search - Minimal Working Version

## What This Is

A **actually working** package search for NixOS. No promises, no hype - just one feature that works.

## What It Does

- ✅ Searches real NixOS packages using `nix-env -qa`
- ✅ Shows package name, version, and description
- ✅ Works on any NixOS system
- ✅ No authentication needed
- ✅ No complex setup

## What It Doesn't Do (Yet)

- ❌ Install packages
- ❌ Show if package is installed
- ❌ Manage services
- ❌ Edit configuration
- ❌ Any other feature

We'll add these one at a time, only after each works perfectly.

## Requirements

- NixOS (or any system with `nix-env` command)
- Python 3 with Flask
- A web browser

## Quick Start

```bash
# 1. Start the application
./start.sh

# 2. Open your browser
firefox http://localhost:8080

# 3. Search for packages!
# Try: firefox, vim, python, nodejs
```

## How It Works

1. **Frontend** (index.html): Simple search box that sends queries to backend
2. **Backend** (backend.py): Runs `nix-env -qa` and returns JSON results
3. **Real Nix**: No mock data - actual package information

## Architecture

```
[Browser] <--HTTP--> [Frontend :8080] <--HTTP--> [Backend :5000] <--subprocess--> [nix-env]
```

## First Run Note

The first search might take 10-30 seconds as `nix-env` builds its cache. Subsequent searches are fast.

## Development

Want to help? Here's how:

1. **Test it**: Does search work for you?
2. **Report bugs**: What doesn't work?
3. **Suggest the NEXT feature**: What ONE thing should we add next?

## Philosophy

- Build one thing at a time
- Make it actually work
- Test on real systems
- Be honest about capabilities
- Ship something useful, however small

## Status

- **Current feature**: Package search ✅ WORKING
- **Code lines**: ~200 (that actually do something)
- **Dependencies**: Just Flask
- **Complexity**: Minimal
- **It works**: YES!

---

*"Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away." - Antoine de Saint-Exupéry*