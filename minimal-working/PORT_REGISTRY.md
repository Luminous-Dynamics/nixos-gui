# 🚨 PORT REGISTRY - ALWAYS CHECK THIS FIRST!

## PORTS IN USE - DO NOT USE THESE:

- **8080** - SACRED ECONOMICS SYSTEM (Flask Well)
- **8090** - Another service (currently running)
- **7890** - NixOS GUI MVP
- **7891** - NixOS GUI Backend  
- **3333** - Sacred Core
- **3001** - The Weave
- **7777** - Sacred Bridge

## SAFE PORTS FOR NEW PROJECTS:

- **8001-8010** - Available range
- **9000-9010** - Available range
- **5500-5510** - Available range

## For NixOS GUI Minimal:

Let's use:
- **Frontend**: 8001
- **Backend**: 5001

## CHECK BEFORE USE:
```bash
lsof -i :8001  # Should return nothing
lsof -i :5001  # Should return nothing
```