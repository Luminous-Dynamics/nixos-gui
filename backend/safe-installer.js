/**
 * Safe Package Installer
 * Requires explicit user confirmation and provides rollback information
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const crypto = require('crypto');

class SafeInstaller {
  constructor() {
    this.pendingOperations = new Map();
    this.operationTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Create a pending installation operation
   * Returns a confirmation token that must be used to proceed
   */
  async createInstallOperation(packageName, userAgent) {
    // Generate a unique token for this operation
    const token = crypto.randomBytes(32).toString('hex');
    const timestamp = Date.now();
    
    // Get current generation for rollback info
    const currentGen = await this.getCurrentGeneration();
    
    // Store the pending operation
    this.pendingOperations.set(token, {
      packageName,
      action: 'install',
      timestamp,
      userAgent,
      currentGeneration: currentGen,
      confirmed: false
    });
    
    // Clean up old operations
    this.cleanupExpiredOperations();
    
    return {
      token,
      packageName,
      currentGeneration: currentGen,
      expiresIn: this.operationTimeout / 1000, // seconds
      rollbackCommand: `sudo nix-env --rollback`,
      confirmationRequired: true,
      warning: 'This will modify your system. You can rollback if needed.'
    };
  }

  /**
   * Confirm and execute the installation
   */
  async confirmAndInstall(token, confirmation) {
    const operation = this.pendingOperations.get(token);
    
    if (!operation) {
      return {
        success: false,
        error: 'Invalid or expired token'
      };
    }
    
    if (Date.now() - operation.timestamp > this.operationTimeout) {
      this.pendingOperations.delete(token);
      return {
        success: false,
        error: 'Operation expired. Please try again.'
      };
    }
    
    if (confirmation !== 'CONFIRM') {
      return {
        success: false,
        error: 'Invalid confirmation. Must be "CONFIRM"'
      };
    }
    
    // Mark as confirmed
    operation.confirmed = true;
    
    try {
      // Execute the installation
      console.log(`Installing package: ${operation.packageName}`);
      
      // For safety, we'll use nix-env for user packages
      // System-wide changes would require nixos-rebuild
      const command = `nix-env -iA nixpkgs.${operation.packageName}`;
      
      const { stdout, stderr } = await execAsync(command, {
        timeout: 120000 // 2 minute timeout
      });
      
      // Get new generation number
      const newGen = await this.getCurrentGeneration();
      
      // Clean up the operation
      this.pendingOperations.delete(token);
      
      return {
        success: true,
        packageName: operation.packageName,
        previousGeneration: operation.currentGeneration,
        newGeneration: newGen,
        output: stdout,
        rollbackCommand: `nix-env --switch-generation ${operation.currentGeneration}`,
        message: `Successfully installed ${operation.packageName}. You can rollback to generation ${operation.currentGeneration} if needed.`
      };
    } catch (error) {
      // Clean up the operation
      this.pendingOperations.delete(token);
      
      return {
        success: false,
        error: error.message,
        command: `nix-env -iA nixpkgs.${operation.packageName}`,
        suggestion: 'Try running the command manually to see detailed error'
      };
    }
  }

  /**
   * Create uninstall operation
   */
  async createUninstallOperation(packageName, userAgent) {
    const token = crypto.randomBytes(32).toString('hex');
    const timestamp = Date.now();
    const currentGen = await this.getCurrentGeneration();
    
    this.pendingOperations.set(token, {
      packageName,
      action: 'uninstall',
      timestamp,
      userAgent,
      currentGeneration: currentGen,
      confirmed: false
    });
    
    this.cleanupExpiredOperations();
    
    return {
      token,
      packageName,
      currentGeneration: currentGen,
      expiresIn: this.operationTimeout / 1000,
      rollbackCommand: `sudo nix-env --rollback`,
      confirmationRequired: true,
      warning: 'This will remove the package from your system.'
    };
  }

  /**
   * Confirm and execute uninstallation
   */
  async confirmAndUninstall(token, confirmation) {
    const operation = this.pendingOperations.get(token);
    
    if (!operation || operation.action !== 'uninstall') {
      return {
        success: false,
        error: 'Invalid or expired token'
      };
    }
    
    if (confirmation !== 'CONFIRM') {
      return {
        success: false,
        error: 'Invalid confirmation'
      };
    }
    
    try {
      const command = `nix-env -e ${operation.packageName}`;
      const { stdout, stderr } = await execAsync(command, {
        timeout: 60000
      });
      
      const newGen = await this.getCurrentGeneration();
      this.pendingOperations.delete(token);
      
      return {
        success: true,
        packageName: operation.packageName,
        previousGeneration: operation.currentGeneration,
        newGeneration: newGen,
        output: stdout,
        rollbackCommand: `nix-env --switch-generation ${operation.currentGeneration}`
      };
    } catch (error) {
      this.pendingOperations.delete(token);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get current generation number
   */
  async getCurrentGeneration() {
    try {
      const { stdout } = await execAsync('nix-env --list-generations | tail -1', {
        timeout: 5000
      });
      
      const match = stdout.match(/^\s*(\d+)/);
      return match ? parseInt(match[1]) : null;
    } catch (error) {
      console.error('Failed to get current generation:', error);
      return null;
    }
  }

  /**
   * Clean up expired operations
   */
  cleanupExpiredOperations() {
    const now = Date.now();
    for (const [token, operation] of this.pendingOperations.entries()) {
      if (now - operation.timestamp > this.operationTimeout) {
        this.pendingOperations.delete(token);
      }
    }
  }

  /**
   * Get rollback information
   */
  async getRollbackInfo() {
    try {
      const { stdout } = await execAsync('nix-env --list-generations | tail -5', {
        timeout: 5000
      });
      
      const generations = stdout.trim().split('\n').map(line => {
        const match = line.match(/^\s*(\d+)\s+(\d{4}-\d{2}-\d{2})/);
        if (match) {
          return {
            number: parseInt(match[1]),
            date: match[2],
            current: line.includes('(current)')
          };
        }
        return null;
      }).filter(Boolean);
      
      return {
        generations,
        rollbackAvailable: generations.length > 1,
        commands: {
          rollback: 'nix-env --rollback',
          switchTo: (gen) => `nix-env --switch-generation ${gen}`
        }
      };
    } catch (error) {
      return {
        error: 'Failed to get rollback information',
        suggestion: 'Check nix-env --list-generations manually'
      };
    }
  }
}

module.exports = SafeInstaller;