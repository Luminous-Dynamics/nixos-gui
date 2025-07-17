/**
 * Real Service Manager for NixOS
 * Manages systemd services with proper safety checks
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class ServiceManager {
  constructor() {
    this.serviceCache = new Map();
    this.cacheTimeout = 30 * 1000; // 30 seconds
  }

  /**
   * Get list of all available services
   */
  async getAllServices() {
    const cacheKey = 'all-services';
    const cached = this.serviceCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      // Get all systemd services
      const { stdout } = await execAsync('systemctl list-unit-files --type=service --no-pager --no-legend', {
        timeout: 10000
      });

      const services = [];
      const lines = stdout.trim().split('\n');

      for (const line of lines) {
        const [unitFile, state] = line.trim().split(/\s+/);
        if (!unitFile || !state) continue;

        const serviceName = unitFile.replace('.service', '');
        
        // Skip certain system services for safety
        if (this.isSystemCritical(serviceName)) continue;

        services.push({
          name: serviceName,
          unitFile,
          enabled: state === 'enabled',
          state,
          category: this.categorizeService(serviceName)
        });
      }

      // Get runtime status for each service
      const servicesWithStatus = await this.enrichWithRuntimeStatus(services);

      this.serviceCache.set(cacheKey, {
        data: servicesWithStatus,
        timestamp: Date.now()
      });

      return servicesWithStatus;
    } catch (error) {
      console.error('Failed to get services:', error);
      return [];
    }
  }

  /**
   * Get detailed information about a specific service
   */
  async getServiceDetails(serviceName) {
    try {
      // Get service status
      const { stdout: statusOut } = await execAsync(`systemctl status ${serviceName}.service --no-pager`, {
        timeout: 5000
      }).catch(err => ({ stdout: err.stdout || '' }));

      // Parse status output
      const lines = statusOut.split('\n');
      let description = '';
      let mainPid = null;
      let memory = null;
      let activeSince = null;
      let logs = [];

      for (const line of lines) {
        if (line.includes('Loaded:')) {
          const match = line.match(/\(([^)]+)\)/);
          if (match) description = match[1];
        } else if (line.includes('Main PID:')) {
          const match = line.match(/Main PID: (\d+)/);
          if (match) mainPid = match[1];
        } else if (line.includes('Memory:')) {
          const match = line.match(/Memory: (.+)/);
          if (match) memory = match[1];
        } else if (line.includes('Active:')) {
          const match = line.match(/since (.+);/);
          if (match) activeSince = match[1];
        }
      }

      // Get recent logs
      try {
        const { stdout: logsOut } = await execAsync(`journalctl -u ${serviceName}.service -n 20 --no-pager`, {
          timeout: 5000
        });
        logs = logsOut.split('\n').filter(l => l.trim());
      } catch (e) {
        // Ignore log errors
      }

      // Get service configuration from NixOS
      let nixConfig = null;
      try {
        const { stdout: configOut } = await execAsync(`nixos-option services.${serviceName}.enable 2>/dev/null`, {
          timeout: 5000
        });
        if (configOut.includes('Value:')) {
          nixConfig = {
            inConfiguration: true,
            enabled: configOut.includes('true')
          };
        }
      } catch (e) {
        // Service might not be in NixOS config
      }

      return {
        name: serviceName,
        description,
        mainPid,
        memory,
        activeSince,
        logs: logs.slice(0, 20),
        nixConfig,
        canManage: !this.isSystemCritical(serviceName)
      };
    } catch (error) {
      console.error(`Failed to get details for ${serviceName}:`, error);
      return null;
    }
  }

  /**
   * Start a service (requires sudo)
   */
  async startService(serviceName) {
    if (this.isSystemCritical(serviceName)) {
      return {
        success: false,
        error: 'Cannot manage critical system services'
      };
    }

    try {
      const { stdout, stderr } = await execAsync(`sudo systemctl start ${serviceName}.service`, {
        timeout: 30000
      });

      return {
        success: true,
        message: `Service ${serviceName} started`,
        output: stdout || stderr
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        suggestion: 'Make sure you have sudo privileges'
      };
    }
  }

  /**
   * Stop a service (requires sudo)
   */
  async stopService(serviceName) {
    if (this.isSystemCritical(serviceName)) {
      return {
        success: false,
        error: 'Cannot manage critical system services'
      };
    }

    try {
      const { stdout, stderr } = await execAsync(`sudo systemctl stop ${serviceName}.service`, {
        timeout: 30000
      });

      return {
        success: true,
        message: `Service ${serviceName} stopped`,
        output: stdout || stderr
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Restart a service (requires sudo)
   */
  async restartService(serviceName) {
    if (this.isSystemCritical(serviceName)) {
      return {
        success: false,
        error: 'Cannot manage critical system services'
      };
    }

    try {
      const { stdout, stderr } = await execAsync(`sudo systemctl restart ${serviceName}.service`, {
        timeout: 30000
      });

      return {
        success: true,
        message: `Service ${serviceName} restarted`,
        output: stdout || stderr
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Enable/disable service in NixOS configuration
   * This returns the configuration change, not actually applies it
   */
  generateServiceConfig(serviceName, enable) {
    const configLine = `services.${serviceName}.enable = ${enable};`;
    
    return {
      serviceName,
      action: enable ? 'enable' : 'disable',
      configLine,
      configSection: 'services',
      instruction: `Add this to your configuration.nix:\n\n${configLine}`,
      warning: 'Remember to run nixos-rebuild switch after editing'
    };
  }

  /**
   * Get current status of multiple services
   */
  async getServicesStatus(serviceNames) {
    const statuses = {};
    
    for (const name of serviceNames) {
      try {
        const { stdout } = await execAsync(`systemctl is-active ${name}.service`, {
          timeout: 2000
        }).catch(err => ({ stdout: 'inactive' }));
        
        statuses[name] = stdout.trim();
      } catch (error) {
        statuses[name] = 'unknown';
      }
    }
    
    return statuses;
  }

  /**
   * Enrich services with runtime status
   */
  async enrichWithRuntimeStatus(services) {
    const names = services.map(s => s.name);
    const statuses = await this.getServicesStatus(names);
    
    return services.map(service => ({
      ...service,
      running: statuses[service.name] === 'active',
      status: statuses[service.name] || 'unknown'
    }));
  }

  /**
   * Check if a service is critical and shouldn't be managed
   */
  isSystemCritical(serviceName) {
    const critical = [
      'systemd-',
      'dbus',
      'kernel',
      'boot',
      'emergency',
      'rescue',
      'halt',
      'poweroff',
      'reboot',
      'shutdown',
      'umount',
      'final',
      'quotaon',
      'rc-local',
      'systemd',
      'user@',
      'init'
    ];
    
    return critical.some(prefix => serviceName.startsWith(prefix));
  }

  /**
   * Categorize service based on name
   */
  categorizeService(serviceName) {
    const categories = {
      network: ['network', 'dhcp', 'dns', 'firewall', 'iptables', 'ssh', 'vpn', 'wifi', 'ethernet'],
      system: ['cron', 'ntp', 'time', 'mount', 'swap', 'device', 'udev', 'power'],
      desktop: ['display', 'gdm', 'sddm', 'lightdm', 'xserver', 'wayland', 'audio', 'cups'],
      development: ['docker', 'mysql', 'postgresql', 'redis', 'nginx', 'apache', 'jenkins'],
      security: ['apparmor', 'audit', 'fail2ban', 'selinux', 'polkit']
    };
    
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => serviceName.toLowerCase().includes(keyword))) {
        return category;
      }
    }
    
    return 'other';
  }

  /**
   * Search services by name or description
   */
  async searchServices(query) {
    const allServices = await this.getAllServices();
    const queryLower = query.toLowerCase();
    
    return allServices.filter(service => 
      service.name.toLowerCase().includes(queryLower) ||
      (service.description && service.description.toLowerCase().includes(queryLower))
    );
  }
}

module.exports = ServiceManager;