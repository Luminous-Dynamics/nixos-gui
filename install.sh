#!/usr/bin/env bash

# NixOS GUI Installation Script
# Making NixOS accessible to everyone with love 💝

set -e

# Colors for beautiful output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Sacred greeting
echo -e "${PURPLE}"
echo "╔═══════════════════════════════════════╗"
echo "║        NixOS GUI Installer            ║"
echo "║   Making NixOS Accessible with Love   ║"
echo "╚═══════════════════════════════════════╝"
echo -e "${NC}"

# Check if running on NixOS
if ! command -v nixos-version &> /dev/null; then
    echo -e "${RED}❌ This installer requires NixOS${NC}"
    echo "Please run this on a NixOS system"
    exit 1
fi

echo -e "${BLUE}🔍 Checking system...${NC}"

# Check for required commands
for cmd in git nix-env systemctl; do
    if ! command -v $cmd &> /dev/null; then
        echo -e "${RED}❌ Missing required command: $cmd${NC}"
        exit 1
    fi
done

echo -e "${GREEN}✅ System checks passed${NC}"

# Installation options
echo
echo "Choose installation method:"
echo "1) Flake-based (recommended for modern NixOS)"
echo "2) Traditional (for older NixOS versions)"
echo "3) Development mode (for contributors)"
read -p "Enter choice (1-3): " INSTALL_METHOD

case $INSTALL_METHOD in
    1)
        echo -e "\n${BLUE}📦 Installing via Flake...${NC}"
        
        # Check if flakes are enabled
        if ! nix flake --help &> /dev/null 2>&1; then
            echo -e "${PURPLE}Flakes not enabled. Adding to configuration...${NC}"
            echo
            echo "Add this to your configuration.nix:"
            echo
            echo "  nix.settings.experimental-features = [ \"nix-command\" \"flakes\" ];"
            echo
            read -p "Have you added this and rebuilt? (y/n): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                echo "Please enable flakes first, then run this installer again"
                exit 1
            fi
        fi
        
        # Create NixOS module file
        cat > nixos-gui-module.nix << 'EOF'
{ config, lib, pkgs, ... }:

{
  imports = [
    (builtins.fetchGit {
      url = "https://github.com/Luminous-Dynamics/nixos-gui";
      ref = "main";
    } + "/flake.nix").nixosModules.default
  ];

  services.nixos-gui = {
    enable = true;
    port = 7778;
    openFirewall = true; # Allow local network access
  };
}
EOF

        echo -e "${GREEN}✅ Module file created${NC}"
        echo
        echo "Add this to your configuration.nix imports:"
        echo -e "${PURPLE}  imports = ["
        echo "    ./hardware-configuration.nix"
        echo "    ./nixos-gui-module.nix  # Add this line"
        echo -e "  ];${NC}"
        echo
        echo "Then rebuild with: sudo nixos-rebuild switch"
        ;;
        
    2)
        echo -e "\n${BLUE}📦 Traditional installation...${NC}"
        
        # Clone repository
        INSTALL_DIR="/opt/nixos-gui"
        sudo mkdir -p $INSTALL_DIR
        
        if [ -d "$INSTALL_DIR/.git" ]; then
            echo "Updating existing installation..."
            sudo git -C $INSTALL_DIR pull
        else
            echo "Cloning repository..."
            sudo git clone https://github.com/Luminous-Dynamics/nixos-gui $INSTALL_DIR
        fi
        
        # Install Node.js dependencies
        echo -e "${BLUE}📦 Installing dependencies...${NC}"
        cd $INSTALL_DIR/backend
        sudo npm install --production
        
        # Create systemd service
        sudo tee /etc/systemd/system/nixos-gui.service > /dev/null << EOF
[Unit]
Description=NixOS GUI Service
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/nixos-gui/backend
ExecStart=/usr/bin/env node nixos-gui-api.js
Restart=on-failure
Environment="NODE_ENV=production"
Environment="PORT=7778"

[Install]
WantedBy=multi-user.target
EOF

        # Start service
        sudo systemctl daemon-reload
        sudo systemctl enable nixos-gui
        sudo systemctl start nixos-gui
        
        echo -e "${GREEN}✅ Service installed and started${NC}"
        ;;
        
    3)
        echo -e "\n${BLUE}🛠️  Development installation...${NC}"
        
        # Clone to user directory
        DEV_DIR="$HOME/nixos-gui-dev"
        
        if [ -d "$DEV_DIR" ]; then
            echo "Development directory already exists at $DEV_DIR"
            read -p "Remove and reinstall? (y/n): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                rm -rf $DEV_DIR
            else
                exit 0
            fi
        fi
        
        git clone https://github.com/Luminous-Dynamics/nixos-gui $DEV_DIR
        cd $DEV_DIR
        
        echo -e "${BLUE}Setting up development environment...${NC}"
        
        # Create development script
        cat > start-dev.sh << 'EOF'
#!/usr/bin/env bash
echo "🌟 Starting NixOS GUI in development mode..."

# Enter nix shell and start services
nix-shell --run "
  cd backend && npm install
  echo '✨ Starting API server on http://localhost:7778'
  npm run dev &
  API_PID=$!
  
  echo '🌐 Opening demo interface...'
  sleep 2
  xdg-open http://localhost:7778 || open http://localhost:7778
  
  echo
  echo 'Press Ctrl+C to stop'
  wait $API_PID
"
EOF
        chmod +x start-dev.sh
        
        echo -e "${GREEN}✅ Development environment ready${NC}"
        echo
        echo "To start development:"
        echo "  cd $DEV_DIR"
        echo "  ./start-dev.sh"
        ;;
        
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

# Post-installation message
echo
echo -e "${PURPLE}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}✨ Installation complete!${NC}"
echo
echo "Access NixOS GUI at: http://localhost:7778"
echo
echo "Next steps:"
echo "  - Visit the web interface"
echo "  - Search and install packages"
echo "  - Manage your system with love"
echo
echo -e "${PURPLE}Thank you for making NixOS more accessible! 💝${NC}"
echo -e "${PURPLE}═══════════════════════════════════════════${NC}"

# Check if service is running (for methods 1 & 2)
if [ $INSTALL_METHOD != "3" ]; then
    sleep 2
    if systemctl is-active --quiet nixos-gui; then
        echo -e "\n${GREEN}✅ Service is running${NC}"
        echo "Opening in browser..."
        xdg-open http://localhost:7778 || echo "Please open http://localhost:7778 in your browser"
    else
        echo -e "\n${RED}⚠️  Service not running${NC}"
        echo "Check status with: systemctl status nixos-gui"
        echo "View logs with: journalctl -u nixos-gui -f"
    fi
fi