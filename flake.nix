{
  description = "NixOS GUI - Making NixOS accessible to everyone with love";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    
    # For Tauri/Rust development
    rust-overlay = {
      url = "github:oxalica/rust-overlay";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, flake-utils, rust-overlay }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        overlays = [ (import rust-overlay) ];
        pkgs = import nixpkgs {
          inherit system overlays;
        };
        
        rustToolchain = pkgs.rust-bin.stable.latest.default.override {
          extensions = [ "rust-src" "rustfmt" "clippy" ];
        };
      in
      {
        packages = {
          # The main GUI application (future)
          nixos-gui = pkgs.stdenv.mkDerivation {
            pname = "nixos-gui";
            version = "0.1.0";
            
            src = ./.;
            
            buildInputs = with pkgs; [
              nodejs_20
              rustToolchain
            ];
            
            installPhase = ''
              mkdir -p $out/bin
              cp -r backend $out/
              cp -r mvp $out/
              cp -r docs $out/
              
              # Create wrapper script
              cat > $out/bin/nixos-gui <<EOF
              #!${pkgs.bash}/bin/bash
              cd $out
              ${pkgs.nodejs_20}/bin/node backend/nixos-gui-api.js
              EOF
              chmod +x $out/bin/nixos-gui
            '';
            
            meta = with pkgs.lib; {
              description = "Beautiful GUI for NixOS configuration";
              homepage = "https://github.com/Luminous-Dynamics/nixos-gui";
              license = licenses.mit;
              maintainers = [ ];
              platforms = platforms.linux;
            };
          };
          
          default = self.packages.${system}.nixos-gui;
        };
        
        devShells.default = pkgs.mkShell {
          name = "nixos-gui-dev";
          
          buildInputs = with pkgs; [
            # Node.js development
            nodejs_20
            nodePackages.npm
            nodePackages.pnpm
            nodePackages.nodemon
            nodePackages.typescript
            nodePackages.eslint
            
            # Rust/Tauri development
            rustToolchain
            pkg-config
            webkitgtk
            libsoup
            openssl
            
            # Nix development
            nil # Nix LSP
            nixpkgs-fmt
            
            # General development
            git
            gh
            ripgrep
            fd
            jq
            httpie
            watchman
            
            # Sacred tools
            figlet
            lolcat
            toilet
            cowsay
            fortune
          ];
          
          shellHook = ''
            figlet -f slant "NixOS GUI" | lolcat
            echo
            echo "🌟 Development Environment Ready! 🌟"
            echo
            echo "Quick commands:"
            echo "  nix run          - Run the GUI"
            echo "  nix build        - Build the package"
            echo "  npm install      - Install Node dependencies"
            echo "  npm run dev      - Start development server"
            echo
            echo "Project structure:"
            echo "  backend/   - Node.js API server"
            echo "  mvp/       - Web-based demo interface"
            echo "  docs/      - Documentation and landing page"
            echo
            echo "💝 Let's make NixOS accessible together!"
            
            # Development environment
            export NODE_ENV=development
            export RUST_LOG=debug
            export NIXOS_GUI_DEV=1
            
            # Convenience aliases
            alias gui-api="cd backend && npm run dev"
            alias gui-demo="xdg-open mvp/index.html"
            alias gui-docs="xdg-open docs/index.html"
            
            # Check if dependencies are installed
            if [ ! -d "backend/node_modules" ]; then
              echo
              echo "📦 Installing Node.js dependencies..."
              (cd backend && npm install)
            fi
          '';
        };
        
        # NixOS module for system integration
        nixosModules.default = { config, lib, pkgs, ... }:
          with lib;
          let
            cfg = config.services.nixos-gui;
          in {
            options.services.nixos-gui = {
              enable = mkEnableOption "NixOS GUI service";
              
              port = mkOption {
                type = types.port;
                default = 7778;
                description = "Port for the NixOS GUI API server";
              };
              
              openFirewall = mkOption {
                type = types.bool;
                default = false;
                description = "Open firewall for the GUI service";
              };
            };
            
            config = mkIf cfg.enable {
              systemd.services.nixos-gui = {
                description = "NixOS GUI API Server";
                after = [ "network.target" ];
                wantedBy = [ "multi-user.target" ];
                
                serviceConfig = {
                  Type = "simple";
                  ExecStart = "${self.packages.${system}.nixos-gui}/bin/nixos-gui";
                  Restart = "on-failure";
                  RestartSec = 10;
                  
                  # Security hardening
                  DynamicUser = true;
                  PrivateTmp = true;
                  ProtectSystem = "strict";
                  ProtectHome = true;
                  NoNewPrivileges = true;
                  
                  # Allow reading system configuration
                  ReadOnlyPaths = [ "/etc/nixos" "/nix/store" ];
                };
                
                environment = {
                  NODE_ENV = "production";
                  PORT = toString cfg.port;
                };
              };
              
              networking.firewall.allowedTCPPorts = 
                mkIf cfg.openFirewall [ cfg.port ];
            };
          };
      }
    ) // {
      # Overlay for adding nixos-gui to nixpkgs
      overlay = final: prev: {
        nixos-gui = self.packages.${prev.system}.nixos-gui;
      };
    };
}