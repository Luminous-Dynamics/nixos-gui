/**
 * Nix Expression Generator
 * Safely generates Nix configuration expressions
 * Built with love to protect users from mistakes
 */

const fs = require('fs').promises;
const path = require('path');

class NixGenerator {
  constructor() {
    this.indentSize = 2;
    this.configPath = '/etc/nixos/configuration.nix';
  }

  /**
   * Generate a package installation expression
   */
  generatePackageInstall(packageName, options = {}) {
    const { 
      attribute = 'environment.systemPackages',
      overlay = false,
      unfree = false 
    } = options;

    if (unfree) {
      return {
        imports: [`
  # Allow unfree package: ${packageName}
  nixpkgs.config.allowUnfreePredicate = pkg: 
    builtins.elem (lib.getName pkg) [
      "${packageName}"
    ];`],
        packages: `    ${packageName}`
      };
    }

    return {
      packages: `    ${packageName}`
    };
  }

  /**
   * Generate a service configuration
   */
  generateServiceConfig(serviceName, config = {}) {
    const {
      enable = true,
      description = `${serviceName} service`,
      after = ['network.target'],
      wantedBy = ['multi-user.target'],
      serviceConfig = {}
    } = config;

    return `
  services.${serviceName} = {
    enable = ${enable};
    description = "${description}";
    
    serviceConfig = {
      ${this.formatServiceConfig(serviceConfig)}
    };
  };`;
  }

  /**
   * Generate a user configuration
   */
  generateUserConfig(username, options = {}) {
    const {
      isNormalUser = true,
      extraGroups = ['wheel'],
      shell = null,
      packages = []
    } = options;

    let config = `
  users.users.${username} = {
    isNormalUser = ${isNormalUser};`;

    if (extraGroups.length > 0) {
      config += `
    extraGroups = [ ${extraGroups.map(g => `"${g}"`).join(' ')} ];`;
    }

    if (shell) {
      config += `
    shell = pkgs.${shell};`;
    }

    if (packages.length > 0) {
      config += `
    packages = with pkgs; [
      ${packages.join('\n      ')}
    ];`;
    }

    config += `
  };`;

    return config;
  }

  /**
   * Parse existing configuration to find insertion points
   */
  async parseConfiguration(configPath = this.configPath) {
    try {
      const content = await fs.readFile(configPath, 'utf8');
      const lines = content.split('\n');
      
      const structure = {
        imports: [],
        systemPackages: [],
        services: {},
        users: {},
        networking: {},
        boot: {}
      };

      let currentSection = null;
      let depth = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Track nesting depth
        depth += (line.match(/{/g) || []).length;
        depth -= (line.match(/}/g) || []).length;

        // Detect sections
        if (trimmed.includes('imports =')) {
          currentSection = 'imports';
          structure.imports.lineNumber = i;
        } else if (trimmed.includes('environment.systemPackages')) {
          currentSection = 'systemPackages';
          structure.systemPackages.lineNumber = i;
        } else if (trimmed.includes('services.')) {
          currentSection = 'services';
        } else if (trimmed.includes('users.users.')) {
          currentSection = 'users';
        }

        // Store section content
        if (currentSection && structure[currentSection]) {
          if (!structure[currentSection].lines) {
            structure[currentSection].lines = [];
          }
          structure[currentSection].lines.push({ 
            number: i, 
            content: line, 
            depth 
          });
        }
      }

      return structure;
    } catch (error) {
      throw new Error(`Failed to parse configuration: ${error.message}`);
    }
  }

  /**
   * Generate a diff preview for changes
   */
  async generateDiff(changes) {
    const diffs = [];

    for (const change of changes) {
      const { type, target, value, action } = change;

      switch (type) {
        case 'package':
          diffs.push({
            description: `${action} package: ${target}`,
            diff: action === 'add' 
              ? `+    ${target}`
              : `-    ${target}`,
            location: 'environment.systemPackages'
          });
          break;

        case 'service':
          diffs.push({
            description: `${action} service: ${target}`,
            diff: this.generateServiceConfig(target, value),
            location: 'services'
          });
          break;

        case 'user':
          diffs.push({
            description: `${action} user: ${target}`,
            diff: this.generateUserConfig(target, value),
            location: 'users.users'
          });
          break;
      }
    }

    return diffs;
  }

  /**
   * Validate a package name
   */
  validatePackageName(name) {
    // Basic validation - can be expanded
    const valid = /^[a-zA-Z0-9_-]+$/.test(name);
    const reserved = ['nixos', 'nixpkgs', 'system', 'config'];
    
    return {
      valid: valid && !reserved.includes(name),
      reason: !valid ? 'Invalid characters in package name' :
              reserved.includes(name) ? 'Reserved package name' :
              null
    };
  }

  /**
   * Format service configuration object
   */
  formatServiceConfig(config) {
    return Object.entries(config)
      .map(([key, value]) => {
        if (typeof value === 'string') {
          return `${key} = "${value}";`;
        } else if (typeof value === 'boolean') {
          return `${key} = ${value};`;
        } else if (typeof value === 'number') {
          return `${key} = ${value};`;
        } else if (Array.isArray(value)) {
          return `${key} = [ ${value.map(v => `"${v}"`).join(' ')} ];`;
        } else {
          return `${key} = ${JSON.stringify(value)};`;
        }
      })
      .join('\n      ');
  }

  /**
   * Generate safe configuration backup
   */
  async backupConfiguration(configPath = this.configPath) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${configPath}.backup.${timestamp}`;
    
    try {
      await fs.copyFile(configPath, backupPath);
      return {
        success: true,
        backupPath,
        message: `Configuration backed up to ${backupPath}`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to create backup'
      };
    }
  }

  /**
   * Generate a complete configuration example
   */
  generateExampleConfig() {
    return `{ config, pkgs, ... }:

{
  imports = [
    ./hardware-configuration.nix
  ];

  # Boot loader
  boot.loader.systemd-boot.enable = true;
  boot.loader.efi.canTouchEfiVariables = true;

  # Networking
  networking.hostName = "nixos-gui-example";
  networking.networkmanager.enable = true;

  # Time zone
  time.timeZone = "America/Chicago";

  # Packages
  environment.systemPackages = with pkgs; [
    # Essential tools
    vim
    git
    wget
    
    # GUI applications
    firefox
    vscode
    
    # Development
    nodejs
    rustc
    cargo
  ];

  # Services
  services.xserver = {
    enable = true;
    displayManager.gdm.enable = true;
    desktopManager.gnome.enable = true;
  };

  # Users
  users.users.alice = {
    isNormalUser = true;
    extraGroups = [ "wheel" "networkmanager" ];
    packages = with pkgs; [
      thunderbird
      gimp
    ];
  };

  # Enable sound
  sound.enable = true;
  hardware.pulseaudio.enable = true;

  # This value determines the NixOS release
  system.stateVersion = "23.11";
}`;
  }
}

module.exports = NixGenerator;