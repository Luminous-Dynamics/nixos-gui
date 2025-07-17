/**
 * Safe Configuration Reader
 * Read-only access to NixOS configuration files
 */

const fs = require('fs').promises;
const path = require('path');

class ConfigReader {
  constructor() {
    this.configPaths = [
      '/etc/nixos/configuration.nix',
      '/etc/nixos/hardware-configuration.nix'
    ];
  }

  /**
   * Read the main configuration file (read-only)
   */
  async readConfiguration() {
    const mainConfig = this.configPaths[0];
    
    try {
      // Check if file exists and is readable
      await fs.access(mainConfig, fs.constants.R_OK);
      
      // Read the file
      const content = await fs.readFile(mainConfig, 'utf8');
      
      return {
        path: mainConfig,
        content: content,
        editable: false, // For safety, mark as non-editable in GUI
        lastModified: (await fs.stat(mainConfig)).mtime,
        analysis: this.analyzeConfig(content)
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return {
          error: 'Configuration file not found',
          suggestion: 'Make sure you are running on NixOS',
          demoContent: this.getDemoConfig()
        };
      } else if (error.code === 'EACCES') {
        return {
          error: 'Permission denied',
          suggestion: 'The GUI needs read access to /etc/nixos/configuration.nix',
          demoContent: this.getDemoConfig()
        };
      }
      throw error;
    }
  }

  /**
   * Analyze configuration content to extract useful information
   */
  analyzeConfig(content) {
    const lines = content.split('\n');
    const analysis = {
      systemPackages: [],
      enabledServices: [],
      users: [],
      imports: [],
      bootLoader: null,
      hostname: null,
      timezone: null
    };

    let inPackages = false;
    let inServices = false;
    let bracketDepth = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      // Track bracket depth
      bracketDepth += (line.match(/\{/g) || []).length;
      bracketDepth -= (line.match(/\}/g) || []).length;

      // Find imports
      if (trimmed.includes('imports =')) {
        inPackages = false;
        inServices = false;
      }

      // Find system packages
      if (trimmed.includes('environment.systemPackages')) {
        inPackages = true;
        continue;
      }

      // Extract package names
      if (inPackages && trimmed && !trimmed.startsWith('#')) {
        const packageMatch = trimmed.match(/^\s*([a-zA-Z0-9_-]+)/);
        if (packageMatch && !trimmed.includes(']')) {
          analysis.systemPackages.push(packageMatch[1]);
        }
        if (trimmed.includes(']')) {
          inPackages = false;
        }
      }

      // Find services
      if (trimmed.startsWith('services.') && trimmed.includes('.enable = true')) {
        const serviceMatch = trimmed.match(/services\.([a-zA-Z0-9_-]+)\.enable\s*=\s*true/);
        if (serviceMatch) {
          analysis.enabledServices.push(serviceMatch[1]);
        }
      }

      // Find hostname
      if (trimmed.includes('networking.hostName')) {
        const hostnameMatch = trimmed.match(/networking\.hostName\s*=\s*"([^"]+)"/);
        if (hostnameMatch) {
          analysis.hostname = hostnameMatch[1];
        }
      }

      // Find timezone
      if (trimmed.includes('time.timeZone')) {
        const timezoneMatch = trimmed.match(/time\.timeZone\s*=\s*"([^"]+)"/);
        if (timezoneMatch) {
          analysis.timezone = timezoneMatch[1];
        }
      }

      // Find boot loader
      if (trimmed.includes('boot.loader') && trimmed.includes('.enable = true')) {
        const bootMatch = trimmed.match(/boot\.loader\.([a-zA-Z0-9_-]+)\.enable\s*=\s*true/);
        if (bootMatch) {
          analysis.bootLoader = bootMatch[1];
        }
      }

      // Find users
      if (trimmed.includes('users.users.') && trimmed.includes('isNormalUser = true')) {
        const userMatch = line.match(/users\.users\.([a-zA-Z0-9_-]+)/);
        if (userMatch) {
          analysis.users.push(userMatch[1]);
        }
      }
    }

    return analysis;
  }

  /**
   * Check if a package is in the configuration
   */
  async isPackageInConfig(packageName) {
    try {
      const config = await this.readConfiguration();
      if (config.error) return false;
      
      return config.analysis.systemPackages.includes(packageName);
    } catch (error) {
      console.error('Error checking package in config:', error);
      return false;
    }
  }

  /**
   * Get a list of all configured packages
   */
  async getConfiguredPackages() {
    try {
      const config = await this.readConfiguration();
      if (config.error) return [];
      
      return config.analysis.systemPackages;
    } catch (error) {
      console.error('Error getting configured packages:', error);
      return [];
    }
  }

  /**
   * Generate a preview of what the config would look like with a new package
   */
  generatePackageAdditionPreview(currentContent, packageName) {
    const lines = currentContent.split('\n');
    const modifiedLines = [...lines];
    
    // Find the systemPackages section
    let packageLineIndex = -1;
    let insidePackages = false;
    let bracketCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.includes('environment.systemPackages')) {
        packageLineIndex = i;
        insidePackages = true;
      }
      
      if (insidePackages) {
        if (line.includes('[')) bracketCount++;
        if (line.includes(']')) {
          // Insert before the closing bracket
          modifiedLines.splice(i, 0, `    ${packageName}`);
          break;
        }
      }
    }
    
    return {
      original: currentContent,
      modified: modifiedLines.join('\n'),
      changes: [{
        line: packageLineIndex + bracketCount + 1,
        type: 'addition',
        content: `    ${packageName}`
      }]
    };
  }

  /**
   * Get demo configuration for testing
   */
  getDemoConfig() {
    return `{ config, pkgs, ... }:

{
  imports = [
    ./hardware-configuration.nix
  ];

  # Boot loader
  boot.loader.systemd-boot.enable = true;
  boot.loader.efi.canTouchEfiVariables = true;

  # Networking
  networking.hostName = "nixos-demo";
  networking.networkmanager.enable = true;

  # Time zone
  time.timeZone = "America/Chicago";

  # Packages
  environment.systemPackages = with pkgs; [
    vim
    wget
    firefox
    git
  ];

  # Services
  services.xserver.enable = true;
  services.xserver.displayManager.gdm.enable = true;
  services.xserver.desktopManager.gnome.enable = true;

  # Users
  users.users.demo = {
    isNormalUser = true;
    extraGroups = [ "wheel" ];
  };

  system.stateVersion = "23.11";
}`;
  }
}

module.exports = ConfigReader;