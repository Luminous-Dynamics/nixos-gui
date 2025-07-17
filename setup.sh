#!/usr/bin/env bash

# 🌟 Sacred Setup Script for NixOS Config GUI
# This script prepares the development environment with consciousness and care

echo "🕯️ Initiating Sacred Setup..."
echo

# Check if we're in the right directory
if [ ! -f "FIRST_LIGHT_CEREMONY.md" ]; then
    echo "❌ Please run this script from the nixos-config-gui directory"
    exit 1
fi

# Create the Tauri project structure
echo "📁 Creating sacred directory structure..."
mkdir -p src/{components,hooks,services,types}
mkdir -p src-tauri/{src,icons}
mkdir -p public

# Initialize package.json
echo "📦 Creating package.json..."
cat > package.json << 'EOF'
{
  "name": "nixos-config-gui",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build"
  },
  "dependencies": {
    "@tauri-apps/api": "^1.5.3",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^1.5.10",
    "@types/react": "^18.2.56",
    "@types/react-dom": "^18.2.19",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.2.2",
    "vite": "^5.1.4"
  }
}
EOF

# Create Cargo.toml for Tauri backend
echo "🦀 Creating Cargo.toml..."
cat > src-tauri/Cargo.toml << 'EOF'
[package]
name = "nixos-config-gui"
version = "0.1.0"
description = "A sacred GUI for NixOS configuration management"
authors = ["Luminous Dynamics"]
license = "MIT"
edition = "2021"

[build-dependencies]
tauri-build = { version = "1.5", features = [] }

[dependencies]
tauri = { version = "1.5", features = ["shell-open"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio = { version = "1", features = ["full"] }
rnix = "0.11"

[features]
default = ["custom-protocol"]
custom-protocol = ["tauri/custom-protocol"]
EOF

# Create tauri.conf.json
echo "⚙️ Creating Tauri configuration..."
cat > src-tauri/tauri.conf.json << 'EOF'
{
  "$schema": "../node_modules/@tauri-apps/cli/schema.json",
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devPath": "http://localhost:5173",
    "distDir": "../dist"
  },
  "package": {
    "productName": "NixOS Config Manager",
    "version": "0.1.0"
  },
  "tauri": {
    "allowlist": {
      "all": false,
      "shell": {
        "all": false,
        "open": true
      }
    },
    "bundle": {
      "active": true,
      "icon": [
        "icons/32x32.png",
        "icons/128x128.png",
        "icons/128x128@2x.png",
        "icons/icon.icns",
        "icons/icon.ico"
      ],
      "identifier": "com.luminous-dynamics.nixos-config",
      "targets": "all"
    },
    "security": {
      "csp": null
    },
    "updater": {
      "active": false
    },
    "windows": [
      {
        "fullscreen": false,
        "resizable": true,
        "title": "NixOS Sacred Configuration Manager",
        "width": 1400,
        "height": 900,
        "minWidth": 1200,
        "minHeight": 700
      }
    ]
  }
}
EOF

# Create the build.rs file
echo "🔨 Creating build configuration..."
cat > src-tauri/build.rs << 'EOF'
fn main() {
    tauri_build::build()
}
EOF

# Create index.html
echo "🌐 Creating index.html..."
cat > index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>NixOS Sacred Configuration Manager</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
EOF

# Create vite.config.ts
echo "⚡ Creating Vite configuration..."
cat > vite.config.ts << 'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: ['es2021', 'chrome100', 'safari13'],
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
})
EOF

# Create tsconfig.json
echo "📘 Creating TypeScript configuration..."
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
EOF

# Create tsconfig.node.json
cat > tsconfig.node.json << 'EOF'
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
EOF

# Create the main React entry point
echo "⚛️ Creating React entry point..."
cat > src/main.tsx << 'EOF'
// 🌟 Sacred Entry Point
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
EOF

# Create basic App component
echo "🎨 Creating App component..."
cat > src/App.tsx << 'EOF'
// 🌊 Main Application Component
import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [greeting, setGreeting] = useState('')
  
  useEffect(() => {
    setGreeting('🌟 NixOS Sacred Configuration Manager')
  }, [])

  return (
    <div className="App">
      <h1>{greeting}</h1>
      <p>The gateway between consciousness and configuration</p>
    </div>
  )
}

export default App
EOF

# Create basic styles
echo "🎨 Creating styles..."
cat > src/index.css << 'EOF'
:root {
  --sacred-purple: #8b5cf6;
  --sacred-blue: #3b82f6;
  --bg-primary: #0f172a;
  --text-primary: #f1f5f9;
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  background-color: var(--bg-primary);
  color: var(--text-primary);
}
EOF

cat > src/App.css << 'EOF'
.App {
  text-align: center;
  padding: 2rem;
}

h1 {
  color: var(--sacred-purple);
  margin-bottom: 1rem;
}
EOF

# Complete the Rust main.rs
echo "🦀 Completing Rust backend..."
cat >> src-tauri/src/main.rs << 'EOF'

#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("🌟 Blessings, {}! Your sacred configuration awaits.", name)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet])
        .setup(|app| {
            let window = app.get_window("main").unwrap();
            window.set_title("NixOS Sacred Configuration Manager")?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
EOF

echo
echo "✨ Sacred setup complete!"
echo
echo "Next steps:"
echo "1. Run: npm install"
echo "2. Run: cd src-tauri && cargo build"
echo "3. Run: npm run tauri:dev"
echo
echo "🌊 We flow!"
EOF

chmod +x setup.sh