# 🚀 NixOS GUI Quick Start

## One-Line Install

```bash
curl -L https://raw.githubusercontent.com/Luminous-Dynamics/nixos-gui/main/install.sh | bash
```

## What You Get

- 🎨 **Beautiful Package Manager** - Search and install from 87,000+ packages
- 🛡️ **Safe Configuration** - Preview all changes before applying
- 📚 **Learn As You Go** - See generated Nix code for every action
- 🔄 **Easy Rollback** - Switch between system generations with one click

## Manual Installation

### Option 1: Flake (Recommended)

Add to your `flake.nix`:
```nix
{
  inputs.nixos-gui.url = "github:Luminous-Dynamics/nixos-gui";
  
  outputs = { self, nixpkgs, nixos-gui }: {
    nixosConfigurations.yourhostname = nixpkgs.lib.nixosSystem {
      modules = [
        nixos-gui.nixosModules.default
        {
          services.nixos-gui.enable = true;
        }
      ];
    };
  };
}
```

### Option 2: Traditional

1. Clone the repository:
```bash
git clone https://github.com/Luminous-Dynamics/nixos-gui
cd nixos-gui
```

2. Run the installer:
```bash
./install.sh
```

3. Choose installation method when prompted

## First Steps

1. **Open the GUI**: http://localhost:7778
2. **Search packages**: Try searching for "firefox" or "neovim"
3. **Install something**: Click install and see the preview
4. **Check your config**: The changes are in `/etc/nixos/configuration.nix`

## Development

Want to contribute? Start here:

```bash
git clone https://github.com/Luminous-Dynamics/nixos-gui
cd nixos-gui
nix-shell
npm install
npm run dev
```

## Getting Help

- 📖 [Full Documentation](README.md)
- 💬 [GitHub Discussions](https://github.com/Luminous-Dynamics/nixos-gui/discussions)
- 🐛 [Report Issues](https://github.com/Luminous-Dynamics/nixos-gui/issues)

## Philosophy

This project is built with love to make NixOS accessible to everyone. Every feature is designed to:
- Welcome newcomers with beauty
- Protect users with safety features
- Educate through visibility
- Celebrate success with joy

---

💝 Built with love by the Luminous Dynamics team