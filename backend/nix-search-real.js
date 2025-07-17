/**
 * Real Nix Package Search Implementation
 * Safe, read-only operations that actually work with Nix
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class RealNixSearch {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Search packages using real nix-env -qa command
   * This is read-only and safe
   */
  async searchPackages(query = '') {
    // Check cache first
    const cacheKey = `search:${query}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      console.log(`Searching for packages: "${query}"`);
      
      // Use nix-env -qa with JSON output for better parsing
      // Limit results to prevent overwhelming the system
      const searchPattern = query ? `.*${query}.*` : '.*';
      const cmd = `nix-env -qa '${searchPattern}' --json | head -c 1000000`; // Limit to 1MB
      
      const { stdout, stderr } = await execAsync(cmd, {
        timeout: 30000, // 30 second timeout
        maxBuffer: 2 * 1024 * 1024 // 2MB buffer
      });

      if (stderr) {
        console.warn('Nix search warning:', stderr);
      }

      // Parse the JSON output
      const packages = this.parseNixOutput(stdout);
      
      // Get installation status for each package
      const packagesWithStatus = await this.checkInstallationStatus(packages);
      
      // Cache the results
      this.cache.set(cacheKey, {
        data: packagesWithStatus,
        timestamp: Date.now()
      });

      return packagesWithStatus;
    } catch (error) {
      console.error('Real Nix search failed:', error);
      throw error;
    }
  }

  /**
   * Parse nix-env JSON output into our format
   */
  parseNixOutput(jsonStr) {
    try {
      const nixPackages = JSON.parse(jsonStr);
      const packages = [];

      for (const [fullName, info] of Object.entries(nixPackages)) {
        // Extract package name from the full attribute path
        const name = info.pname || fullName.split('.').pop().split('-')[0];
        
        packages.push({
          name: name,
          fullName: fullName,
          version: info.version || 'unknown',
          description: this.cleanDescription(info.meta?.description || 'No description available'),
          homepage: info.meta?.homepage || '',
          license: this.formatLicense(info.meta?.license),
          maintainers: this.formatMaintainers(info.meta?.maintainers),
          platforms: info.meta?.platforms || [],
          installed: false, // Will be checked separately
          available: info.meta?.available !== false,
          broken: info.meta?.broken === true,
          unfree: info.meta?.unfree === true,
          category: this.guessCategory(name, info.meta?.description || '')
        });
      }

      // Sort by relevance (name match first, then alphabetical)
      packages.sort((a, b) => a.name.localeCompare(b.name));

      return packages.slice(0, 100); // Limit to 100 results for performance
    } catch (error) {
      console.error('Failed to parse Nix output:', error);
      return [];
    }
  }

  /**
   * Check which packages are currently installed
   * This is a read-only operation
   */
  async checkInstallationStatus(packages) {
    try {
      // Get list of installed packages
      const { stdout } = await execAsync('nix-env -q --json', {
        timeout: 10000
      });

      const installed = JSON.parse(stdout);
      const installedNames = new Set(Object.keys(installed).map(name => 
        name.split('-')[0] // Get base package name
      ));

      // Mark installed packages
      return packages.map(pkg => ({
        ...pkg,
        installed: installedNames.has(pkg.name)
      }));
    } catch (error) {
      console.warn('Could not check installation status:', error);
      // Return packages without installation status
      return packages;
    }
  }

  /**
   * Get detailed information about a specific package
   * This is a read-only operation
   */
  async getPackageDetails(packageName) {
    try {
      // Try to get more detailed info using nix-env
      const cmd = `nix-env -qa '${packageName}' --json --meta`;
      const { stdout } = await execAsync(cmd, {
        timeout: 15000
      });

      const packages = JSON.parse(stdout);
      const [fullName, info] = Object.entries(packages)[0] || [];

      if (!info) return null;

      return {
        name: packageName,
        fullName: fullName,
        version: info.version,
        description: info.meta?.description || 'No description available',
        longDescription: info.meta?.longDescription || '',
        homepage: info.meta?.homepage || '',
        license: this.formatLicense(info.meta?.license),
        maintainers: this.formatMaintainers(info.meta?.maintainers),
        platforms: info.meta?.platforms || [],
        dependencies: [], // Would need nix-store -q --tree
        size: 'Unknown', // Would need nix-store -q --size
        source: info.src?.url || 'Unknown'
      };
    } catch (error) {
      console.error('Failed to get package details:', error);
      return null;
    }
  }

  /**
   * Get available NixOS channels
   * This is a read-only operation
   */
  async getChannels() {
    try {
      const { stdout } = await execAsync('nix-channel --list', {
        timeout: 5000
      });

      const channels = stdout.trim().split('\n').map(line => {
        const [name, url] = line.split(/\s+/);
        return { name, url };
      }).filter(ch => ch.name && ch.url);

      return channels;
    } catch (error) {
      console.error('Failed to get channels:', error);
      return [];
    }
  }

  /**
   * Clean up description text
   */
  cleanDescription(description) {
    if (!description) return 'No description available';
    
    return description
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, ' ')
      .trim()
      .substring(0, 200);
  }

  /**
   * Format license information
   */
  formatLicense(license) {
    if (!license) return 'Unknown';
    
    if (typeof license === 'string') return license;
    
    if (Array.isArray(license)) {
      return license.map(l => this.formatLicense(l)).join(', ');
    }
    
    if (license.fullName) return license.fullName;
    if (license.spdxId) return license.spdxId;
    if (license.shortName) return license.shortName;
    
    return 'Custom';
  }

  /**
   * Format maintainer information
   */
  formatMaintainers(maintainers) {
    if (!maintainers || !Array.isArray(maintainers)) return [];
    
    return maintainers.map(m => {
      if (typeof m === 'string') return m;
      if (m.name) return m.name;
      if (m.github) return `@${m.github}`;
      return 'Unknown';
    });
  }

  /**
   * Guess package category based on name and description
   */
  guessCategory(name, description = '') {
    const text = `${name} ${description}`.toLowerCase();
    
    const categories = {
      development: ['compiler', 'ide', 'editor', 'debug', 'language', 'framework', 'library', 'sdk', 'git', 'docker', 'build'],
      productivity: ['office', 'browser', 'email', 'calendar', 'notes', 'document', 'pdf'],
      multimedia: ['video', 'audio', 'music', 'player', 'media', 'image', 'photo', 'graphics'],
      system: ['kernel', 'driver', 'firmware', 'monitor', 'system', 'hardware', 'network'],
      games: ['game', 'steam', 'play', 'entertainment', 'emulator'],
      security: ['security', 'firewall', 'vpn', 'encryption', 'password', 'auth']
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return category;
      }
    }

    return 'other';
  }

  /**
   * Generate installation preview (read-only)
   * Shows what would happen if package was installed
   */
  async getInstallPreview(packageName) {
    try {
      // Get package info
      const details = await this.getPackageDetails(packageName);
      if (!details) {
        return {
          error: 'Package not found',
          suggestion: 'Check the package name and try again'
        };
      }

      // Try to get dependencies (dry-run)
      const { stdout } = await execAsync(`nix-env -iA nixpkgs.${packageName} --dry-run 2>&1`, {
        timeout: 20000
      });

      // Parse the dry-run output
      const lines = stdout.split('\n');
      const toInstall = [];
      const toUpgrade = [];
      const toRemove = [];

      lines.forEach(line => {
        if (line.includes('installing')) {
          const match = line.match(/installing '([^']+)'/);
          if (match) toInstall.push(match[1]);
        } else if (line.includes('upgrading')) {
          const match = line.match(/upgrading '([^']+)' to '([^']+)'/);
          if (match) toUpgrade.push({ from: match[1], to: match[2] });
        } else if (line.includes('removing')) {
          const match = line.match(/removing '([^']+)'/);
          if (match) toRemove.push(match[1]);
        }
      });

      return {
        package: details,
        changes: {
          toInstall,
          toUpgrade,
          toRemove,
          totalChanges: toInstall.length + toUpgrade.length + toRemove.length
        },
        command: `nix-env -iA nixpkgs.${packageName}`,
        reversible: true,
        warning: details.unfree ? 'This package has an unfree license' : null
      };
    } catch (error) {
      // If dry-run fails, provide basic info
      return {
        package: { name: packageName },
        changes: {
          toInstall: [packageName],
          toUpgrade: [],
          toRemove: [],
          totalChanges: 1
        },
        command: `nix-env -iA nixpkgs.${packageName}`,
        reversible: true,
        error: error.message
      };
    }
  }
}

module.exports = RealNixSearch;