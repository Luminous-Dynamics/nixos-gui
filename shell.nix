{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  name = "nixos-gui-dev";
  
  buildInputs = with pkgs; [
    # Node.js for backend
    nodejs_20
    nodePackages.npm
    nodePackages.nodemon
    
    # Rust for future Tauri integration
    rustc
    cargo
    rustfmt
    clippy
    pkg-config
    
    # Tauri dependencies
    webkitgtk
    libsoup
    openssl
    
    # Development tools
    git
    ripgrep
    fd
    jq
    httpie
    
    # Sacred tools
    figlet
    lolcat
    cowsay
  ];
  
  shellHook = ''
    echo "🌟 NixOS GUI Development Environment 🌟" | lolcat
    echo
    echo "Available commands:"
    echo "  npm install     - Install Node.js dependencies"
    echo "  npm start       - Start the API server"
    echo "  npm run dev     - Start with auto-reload"
    echo "  cargo build     - Build Rust components"
    echo
    echo "Services:"
    echo "  API: http://localhost:7778"
    echo "  Demo: file://$PWD/mvp/index.html"
    echo
    echo "💝 Building with love for the Nix community!"
    
    # Set up environment
    export NODE_ENV=development
    export NIXOS_GUI_ROOT=$PWD
    
    # Create aliases
    alias nix-gui-api="node backend/nixos-gui-api.js"
    alias nix-gui-demo="xdg-open mvp/index.html"
  '';
}