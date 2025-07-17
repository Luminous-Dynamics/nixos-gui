/**
 * Nix Package Interface
 * Real integration with Nix package manager
 * Built with love to make package discovery delightful
 */

const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class NixInterface {
  constructor() {
    this.searchCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.nixpkgsChannel = 'nixpkgs'; // Default channel
  }

  /**
   * Search packages using nix search
   */
  async searchPackages(query, options = {}) {
    const { 
      channel = this.nixpkgsChannel,
      maxResults = 100,
      includeUnfree = false 
    } = options;

    // Check cache first
    const cacheKey = `${channel}:${query}:${includeUnfree}`;
    const cached = this.searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      // Use nix search with JSON output
      const searchCmd = `nix search ${channel} ${query} --json`;
      const { stdout } = await execAsync(searchCmd, {
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large results
        timeout: 30000 // 30 second timeout
      });

      const searchResults = JSON.parse(stdout);
      const packages = await this.parseSearchResults(searchResults);

      // Filter and limit results
      let filtered = packages;
      if (!includeUnfree) {
        filtered = packages.filter(pkg => !pkg.unfree);
      }
      if (maxResults > 0) {
        filtered = filtered.slice(0, maxResults);
      }

      // Cache results
      this.searchCache.set(cacheKey, {
        data: filtered,
        timestamp: Date.now()
      });

      return filtered;
    } catch (error) {
      console.error('Nix search failed:', error);
      
      // Fallback to package list if search fails
      return this.fallbackSearch(query);
    }
  }

  /**
   * Parse nix search JSON results into our format
   */
  async parseSearchResults(searchResults) {
    const packages = [];
    
    for (const [attrPath, pkgInfo] of Object.entries(searchResults)) {
      const name = pkgInfo.pname || attrPath.split('.').pop();
      
      packages.push({
        name,
        attrPath,
        version: pkgInfo.version || 'latest',
        description: this.cleanDescription(pkgInfo.description || ''),
        homepage: pkgInfo.meta?.homepage || '',
        license: this.parseLicense(pkgInfo.meta?.license),
        platforms: pkgInfo.meta?.platforms || [],
        unfree: pkgInfo.meta?.unfree || false,
        broken: pkgInfo.meta?.broken || false,
        installed: await this.isInstalled(name),
        category: this.guessCategory(name, pkgInfo.description)
      });
    }

    // Sort by relevance (exact matches first)
    packages.sort((a, b) => {
      const queryLower = query.toLowerCase();
      const aExact = a.name.toLowerCase() === queryLower;
      const bExact = b.name.toLowerCase() === queryLower;
      
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      
      // Then by name match
      const aStarts = a.name.toLowerCase().startsWith(queryLower);
      const bStarts = b.name.toLowerCase().startsWith(queryLower);
      
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      
      // Finally alphabetical
      return a.name.localeCompare(b.name);
    });

    return packages;
  }

  /**
   * Check if a package is installed
   */
  async isInstalled(packageName) {
    try {
      const { stdout } = await execAsync(`nix-env -q ${packageName}`, {
        timeout: 5000
      });
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get detailed package information
   */
  async getPackageInfo(attrPath) {
    try {
      const cmd = `nix eval --json ${this.nixpkgsChannel}#${attrPath}.meta`;
      const { stdout } = await execAsync(cmd);
      return JSON.parse(stdout);
    } catch (error) {
      console.error('Failed to get package info:', error);
      return null;
    }
  }

  /**
   * Get list of installed packages
   */
  async getInstalledPackages() {
    try {
      const { stdout } = await execAsync('nix-env -q --json', {
        timeout: 10000
      });
      
      const installed = JSON.parse(stdout);
      return Object.entries(installed).map(([name, info]) => ({
        name,
        version: info.version || 'unknown',
        system: info.system || 'unknown'
      }));
    } catch (error) {
      console.error('Failed to get installed packages:', error);
      return [];
    }
  }

  /**
   * Get available updates
   */
  async getUpdates() {
    try {
      const { stdout } = await execAsync('nix-env -u --dry-run --json', {
        timeout: 30000
      });
      
      if (!stdout.trim()) return [];
      
      const updates = JSON.parse(stdout);
      return Object.entries(updates).map(([name, info]) => ({
        name,
        currentVersion: info.currentVersion,
        newVersion: info.newVersion,
        attrPath: info.attrPath
      }));
    } catch (error) {
      console.error('Failed to check updates:', error);
      return [];
    }
  }

  /**
   * Install a package (returns command to run)
   */
  generateInstallCommand(packageName, options = {}) {
    const { 
      attrPath = `nixpkgs.${packageName}`,
      user = false,
      dryRun = false 
    } = options;

    if (user) {
      // User environment installation
      const flags = dryRun ? '--dry-run' : '';
      return `nix-env -iA ${attrPath} ${flags}`;
    } else {
      // System-wide installation (requires config edit)
      return {
        type: 'config-edit',
        instruction: 'Add to environment.systemPackages in configuration.nix',
        code: `environment.systemPackages = with pkgs; [\n  ${packageName}\n];`
      };
    }
  }

  /**
   * Remove a package (returns command to run)
   */
  generateRemoveCommand(packageName, options = {}) {
    const { user = false, dryRun = false } = options;

    if (user) {
      const flags = dryRun ? '--dry-run' : '';
      return `nix-env -e ${packageName} ${flags}`;
    } else {
      return {
        type: 'config-edit',
        instruction: 'Remove from environment.systemPackages in configuration.nix',
        code: `# Remove "${packageName}" from systemPackages`
      };
    }
  }

  /**
   * Search available channels
   */
  async getChannels() {
    try {
      const { stdout } = await execAsync('nix-channel --list');
      const channels = stdout.trim().split('\n').map(line => {
        const [name, url] = line.split(' ');
        return { name, url };
      });
      return channels;
    } catch (error) {
      console.error('Failed to get channels:', error);
      return [{ name: 'nixpkgs', url: 'default' }];
    }
  }

  /**
   * Get system information
   */
  async getSystemInfo() {
    const info = {
      nixVersion: 'unknown',
      nixosVersion: 'unknown',
      systemArch: process.arch,
      channels: []
    };

    try {
      // Get Nix version
      const { stdout: nixVersion } = await execAsync('nix --version');
      info.nixVersion = nixVersion.trim();

      // Get NixOS version if available
      try {
        const { stdout: nixosVersion } = await execAsync('nixos-version');
        info.nixosVersion = nixosVersion.trim();
      } catch {
        // Not on NixOS
        info.nixosVersion = 'Not running NixOS';
      }

      // Get channels
      info.channels = await this.getChannels();

      return info;
    } catch (error) {
      console.error('Failed to get system info:', error);
      return info;
    }
  }

  /**
   * Fallback search using package list
   */
  async fallbackSearch(query) {
    try {
      // Try to use nix-env -qa for basic search
      const cmd = `nix-env -qa '.*${query}.*' --json | head -100`;
      const { stdout } = await execAsync(cmd, {
        timeout: 15000,
        maxBuffer: 10 * 1024 * 1024
      });

      if (!stdout.trim()) return [];

      const packages = JSON.parse(stdout);
      return Object.entries(packages).map(([name, info]) => ({
        name: info.pname || name,
        version: info.version || 'unknown',
        description: 'Package information unavailable in fallback mode',
        installed: false,
        category: 'other'
      }));
    } catch (error) {
      console.error('Fallback search failed:', error);
      return [];
    }
  }

  /**
   * Clean up description text
   */
  cleanDescription(description) {
    if (!description) return 'No description available';
    
    // Remove excessive whitespace and newlines
    return description
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, ' ')
      .trim()
      .substring(0, 200); // Limit length
  }

  /**
   * Parse license information
   */
  parseLicense(license) {
    if (!license) return 'Unknown';
    
    if (typeof license === 'string') return license;
    
    if (Array.isArray(license)) {
      return license.map(l => this.parseLicense(l)).join(', ');
    }
    
    if (license.fullName) return license.fullName;
    if (license.spdxId) return license.spdxId;
    if (license.shortName) return license.shortName;
    
    return 'Custom';
  }

  /**
   * Guess package category based on name and description
   */
  guessCategory(name, description = '') {
    const text = `${name} ${description}`.toLowerCase();
    
    const categories = {
      development: [
        'compiler', 'ide', 'editor', 'vim', 'emacs', 'vscode', 
        'git', 'docker', 'node', 'python', 'rust', 'gcc', 'clang',
        'debugger', 'profiler', 'sdk', 'framework'
      ],
      productivity: [
        'browser', 'firefox', 'chrome', 'chromium', 'office', 
        'libreoffice', 'email', 'thunderbird', 'calendar'
      ],
      multimedia: [
        'video', 'audio', 'music', 'player', 'vlc', 'mpv', 
        'gimp', 'inkscape', 'blender', 'kdenlive', 'audacity'
      ],
      system: [
        'shell', 'terminal', 'htop', 'tmux', 'systemd', 'kernel',
        'driver', 'firmware', 'boot', 'grub'
      ],
      games: [
        'game', 'steam', 'minecraft', 'emulator', 'wine', 'proton'
      ],
      networking: [
        'vpn', 'firewall', 'proxy', 'tor', 'wireguard', 'openvpn',
        'ssh', 'ftp', 'download', 'torrent'
      ],
      science: [
        'math', 'calculator', 'matlab', 'octave', 'r-', 'julia',
        'notebook', 'jupyter', 'scipy', 'numpy'
      ]
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return category;
      }
    }

    return 'other';
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.searchCache.clear();
  }
}

module.exports = NixInterface;