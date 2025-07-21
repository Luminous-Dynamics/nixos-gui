# 🌟 NixOS GUI - Healing-Centered System Management

A gentle, web-based interface for NixOS that transforms system administration from anxiety to peace. Built with consciousness-first principles and universal accessibility.

**[📖 Quick Start Guide](README-QUICKSTART.md)** | **[💝 Philosophy](PHILOSOPHY.md)** | **[🌐 Demo](https://infin.love/nixos-gui)**

![NixOS GUI Dashboard](docs/images/dashboard.png)

## 🚀 Get Started in 2 Minutes

```bash
# One-line install
curl -sL https://infin.love/nixos-gui/install.sh | bash

# Open in browser
xdg-open http://localhost:7778
```

Default login created during install (check output for password).

## ✨ Features

### 🎯 Core Features

- **📦 Package Management**
  - Search and install packages from nixpkgs
  - Remove installed packages with confirmation
  - View package details and dependencies
  - System rollback capabilities
  - Update checker for outdated packages
  - Real-time installation progress

- **⚙️ Configuration Editor**
  - Edit `/etc/nixos/configuration.nix` with syntax highlighting
  - Live validation of Nix expressions
  - Visual diff before applying changes
  - Safe staging with rollback options
  - Real-time error detection
  - CodeMirror integration

- **🔧 Service Manager**
  - Start, stop, restart, and reload services
  - Real-time service status monitoring
  - Live log streaming with Server-Sent Events
  - Service configuration editing
  - Health metrics and performance data
  - Systemd unit file viewer

- **💻 Hardware Configuration**
  - Comprehensive hardware detection (CPU, GPU, disks, network)
  - Driver recommendations and installation
  - Kernel module management
  - Hardware-specific NixOS configurations
  - PCI/USB device information
  - BIOS/UEFI settings display

- **👥 User & Permissions Manager**
  - Create and manage users with full options
  - Group management and membership
  - Sudo permissions configuration
  - Shell selection (bash, zsh, fish)
  - Password management
  - Home directory configuration

### 🔐 Security Features

- JWT-based authentication with secure tokens
- Role-based access control
- Secure token management with expiry
- CORS protection
- Audit logging for all operations
- Session management

## 🚀 Quick Start

### Option 1: NixOS Module (Recommended)

1. Add to your `/etc/nixos/configuration.nix`:

```nix
{ config, pkgs, ... }:

{
  imports = [
    /path/to/nixos-gui/nixos-module.nix
  ];

  services.nixos-gui = {
    enable = true;
    openFirewall = true;  # For local network access
  };
}
```

2. Rebuild your system:
```bash
sudo nixos-rebuild switch
```

3. Access the GUI at: http://localhost:8080

Default credentials:
- Username: `admin`
- Password: `nixos123`

### Option 2: Quick Installation Script

```bash
git clone https://github.com/yourusername/nixos-gui.git
cd nixos-gui
sudo ./install.sh
```

### Option 3: Development Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/nixos-gui.git
cd nixos-gui

# Install dependencies
cd backend
npm install

# Start the backend
CORS_ORIGIN="*" node nixos-gui-api-enhanced-fixed.js

# In another terminal, serve the frontend
cd ../mvp
python3 -m http.server 8000
```

Access at: http://localhost:8000

## 📖 Documentation

- [Installation Guide](INSTALLATION.md) - Detailed setup instructions
- [Quick Start Guide](QUICK_START.md) - Get running in 5 minutes
- [API Documentation](docs/API.md) - REST API reference
- [Architecture Overview](docs/ARCHITECTURE.md) - System design
- [Contributing Guide](CONTRIBUTING.md) - Development guidelines

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│           Web Frontend (HTML/JS)             │
│  Dashboard │ Packages │ Config │ Services   │
└─────────────────┬───────────────────────────┘
                  │ REST API + SSE
┌─────────────────┴───────────────────────────┐
│         Node.js Backend (Express)            │
│  Auth │ Nix Ops │ System Mgmt │ Real-time   │
└─────────────────┬───────────────────────────┘
                  │ System Calls
┌─────────────────┴───────────────────────────┐
│            NixOS System Layer                │
│  Nix │ Systemd │ Hardware │ Users/Groups    │
└─────────────────────────────────────────────┘
```

### Key Components

- **Backend API**: Node.js/Express server with JWT authentication
- **Frontend**: Pure HTML/CSS/JavaScript (no framework dependencies)
- **Real-time Updates**: Server-Sent Events for logs and status
- **System Integration**: Direct Nix and systemd command execution
- **Security**: JWT tokens, CORS protection, secure command execution

## 🛠️ Technology Stack

- **Frontend**: 
  - Vanilla JavaScript (ES6+)
  - HTML5, CSS3
  - CodeMirror for code editing
  - No framework dependencies
  
- **Backend**:
  - Node.js 18+
  - Express.js
  - JWT for authentication
  - Server-Sent Events
  
- **System Integration**:
  - Child process execution
  - Nix commands (search, install, query)
  - Systemd control
  - Hardware detection tools

## 📋 Requirements

- NixOS (tested on 23.11 and unstable)
- Node.js 18+ 
- npm or yarn
- Modern web browser (Chrome, Firefox, Safari)
- For development: Python 3 (for simple HTTP server)

## 🔧 Configuration

### NixOS Module Options

```nix
services.nixos-gui = {
  enable = true;
  apiPort = 7778;        # Backend API port
  frontendPort = 8080;   # Frontend web server port
  openFirewall = false;  # Open ports in firewall
  
  # CORS configuration for security
  allowedOrigins = [ 
    "http://localhost:8080"
    "http://192.168.1.100:8080"  # Your LAN IP
  ];
  
  # JWT secret (auto-generated if empty)
  jwtSecret = "";
  
  # State directory for persistent data
  stateDir = "/var/lib/nixos-gui";
  
  # Service user/group
  user = "nixos-gui";
  group = "nixos-gui";
};
```

### Environment Variables

For manual setup:

```bash
# API Server
PORT=7778                    # API port
CORS_ORIGIN="*"             # CORS origins (* for dev only!)
JWT_SECRET="your-secret"    # JWT secret key
NODE_ENV="production"       # Environment

# Frontend
# No special config needed, just serve static files
```

## 🚦 Development

### Running Tests

```bash
cd backend
npm test
```

### Building for Production

```bash
cd backend
npm run build
```

### Development Mode

```bash
# Watch mode with auto-restart
cd backend
npm run dev
```

### Creating a Release

```bash
./scripts/release.sh v1.0.0
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

1. Fork the repository
2. Clone your fork
3. Install dependencies: `npm install`
4. Create a feature branch: `git checkout -b feature/amazing-feature`
5. Make your changes
6. Run tests: `npm test`
7. Commit: `git commit -m 'Add amazing feature'`
8. Push: `git push origin feature/amazing-feature`
9. Open a Pull Request

### Areas for Contribution

- [ ] Dark mode theme
- [ ] Mobile-responsive design  
- [ ] WebSocket support for real-time updates
- [ ] Backup and restore functionality
- [ ] Multi-user collaboration features
- [ ] Plugin system for extensions
- [ ] Internationalization (i18n)
- [ ] Flake support
- [ ] Home-manager integration
- [ ] Container/VM management

## 🎨 Screenshots

### Dashboard
![Dashboard](docs/images/dashboard.png)
*The main dashboard provides system overview and quick actions*

### Package Manager
![Package Manager](docs/images/packages.png)
*Search, install, and manage packages with ease*

### Configuration Editor
![Config Editor](docs/images/config-editor.png)
*Edit NixOS configuration with syntax highlighting and validation*

### Service Manager
![Service Manager](docs/images/services.png)
*Monitor and control systemd services with real-time logs*

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with consciousness-first principles from [Luminous Dynamics](https://github.com/Luminous-Dynamics)
- Inspired by the need for accessible NixOS management
- Thanks to the NixOS community for excellent documentation
- CodeMirror for the excellent code editor
- All contributors who help make this better

## 🐛 Known Issues

- Service logs may show "permission denied" for some system services
- Package search can be slow on first run (building cache)
- Some hardware detection requires root privileges
- WebKit-based browsers may have SSE connection limits

## 📞 Support

- 📋 Open an issue on [GitHub](https://github.com/yourusername/nixos-gui/issues)
- 📖 Check the [FAQ](docs/FAQ.md)
- 💬 Join our [Discord](https://discord.gg/nixos-gui)
- 📧 Email: support@nixos-gui.org

## 🚀 Roadmap

### Version 1.0 (Current)
- ✅ Package management
- ✅ Configuration editing
- ✅ Service management
- ✅ Hardware configuration
- ✅ User management

### Version 1.1 (Q2 2024)
- [ ] Dark mode
- [ ] Mobile support
- [ ] Backup/restore
- [ ] Plugin system

### Version 2.0 (Q4 2024)
- [ ] Multi-system management
- [ ] Declarative GUI configuration
- [ ] Advanced monitoring
- [ ] Kubernetes integration

---

Made with ❤️ for the NixOS community. May your configurations always be reproducible! 🌊

*"The future of computing is declarative, and we're here to make it accessible to everyone."*