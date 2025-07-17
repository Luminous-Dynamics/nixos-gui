/**
 * System-wide Package Installation
 * Manages packages in configuration.nix with proper safety
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const crypto = require('crypto');

class SystemInstaller {
  constructor() {
    this.configPath = '/etc/nixos/configuration.nix';
    this.backupDir = '/etc/nixos/backups';
    this.pendingChanges = new Map();
    this.changeTimeout = 10 * 60 * 1000; // 10 minutes
  }

  /**
   * Create a system-wide installation plan
   */
  async createSystemInstallPlan(packageName, options = {}) {
    const { dryRun = true } = options;
    
    try {
      // Read current configuration
      const configContent = await fs.readFile(this.configPath, 'utf8');
      const analysis = this.analyzeConfig(configContent);
      
      // Check if package already exists
      if (analysis.systemPackages.includes(packageName)) {
        return {
          error: 'Package already in system configuration',
          exists: true
        };
      }
      
      // Generate the change
      const change = this.generatePackageAddition(configContent, packageName);
      
      // Create change token
      const token = crypto.randomBytes(32).toString('hex');
      const timestamp = Date.now();
      
      this.pendingChanges.set(token, {
        type: 'add-package',
        packageName,
        change,
        timestamp,
        dryRun
      });
      
      // Clean up old changes
      this.cleanupExpiredChanges();
      
      return {
        token,
        packageName,
        preview: change.preview,
        configPath: this.configPath,
        requiresSudo: true,
        dryRun,
        expiresIn: this.changeTimeout / 1000,
        steps: [
          '1. Backup current configuration',
          '2. Add package to systemPackages',
          '3. Run nixos-rebuild switch',
          '4. Verify installation'
        ]
      };
    } catch (error) {
      console.error('Failed to create install plan:', error);
      return {
        error: error.message,
        suggestion: 'Check configuration file permissions'
      };
    }
  }

  /**
   * Apply system-wide changes
   */
  async applySystemChanges(token, confirmation, sudoPassword = null) {
    const change = this.pendingChanges.get(token);
    
    if (!change) {
      return {
        success: false,
        error: 'Invalid or expired token'
      };
    }
    
    if (Date.now() - change.timestamp > this.changeTimeout) {
      this.pendingChanges.delete(token);
      return {
        success: false,
        error: 'Change request expired'
      };
    }
    
    if (confirmation !== 'CONFIRM_SYSTEM_CHANGE') {
      return {
        success: false,
        error: 'Invalid confirmation'
      };
    }
    
    try {
      // Step 1: Create backup
      const backupPath = await this.backupConfiguration();
      
      // Step 2: Apply changes (would need proper sudo handling)
      if (change.dryRun) {
        // Dry run - just show what would happen
        return {
          success: true,
          dryRun: true,
          backupPath,
          changes: change.change,
          command: 'sudo nixos-rebuild switch',
          message: 'Dry run completed. No actual changes made.'
        };
      }
      
      // Real implementation would:
      // 1. Write new configuration
      // 2. Run nixos-rebuild switch with sudo
      // 3. Verify success
      
      return {
        success: false,
        error: 'System-wide installation requires manual sudo execution',
        instruction: `
1. Edit ${this.configPath}
2. Add: ${change.packageName}
3. Run: sudo nixos-rebuild switch
        `,
        backupPath
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    } finally {
      this.pendingChanges.delete(token);
    }
  }

  /**
   * Analyze configuration file
   */
  analyzeConfig(content) {
    const lines = content.split('\n');
    const analysis = {
      systemPackages: [],
      packageLineStart: -1,
      packageLineEnd: -1,
      indentation: '  '
    };
    
    let inPackages = false;
    let bracketDepth = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      if (trimmed.includes('environment.systemPackages')) {
        analysis.packageLineStart = i;
        inPackages = true;
      }
      
      if (inPackages) {
        if (line.includes('[')) bracketDepth++;
        if (line.includes(']')) {
          bracketDepth--;
          if (bracketDepth === 0) {
            analysis.packageLineEnd = i;
            inPackages = false;
          }
        }
        
        // Extract package names
        if (trimmed && !trimmed.startsWith('#') && !trimmed.includes('[') && !trimmed.includes(']')) {
          const match = trimmed.match(/^\s*([a-zA-Z0-9_-]+)/);
          if (match) {
            analysis.systemPackages.push(match[1]);
          }
        }
        
        // Detect indentation
        if (trimmed && !trimmed.includes('environment.systemPackages')) {
          const indent = line.match(/^(\s*)/);
          if (indent && indent[1].length > 0) {
            analysis.indentation = indent[1];
          }
        }
      }
    }
    
    return analysis;
  }

  /**
   * Generate package addition change
   */
  generatePackageAddition(configContent, packageName) {
    const lines = configContent.split('\n');
    const analysis = this.analyzeConfig(configContent);
    
    if (analysis.packageLineEnd === -1) {
      return {
        error: 'Could not find systemPackages section',
        suggestion: 'Manual edit required'
      };
    }
    
    // Insert before the closing bracket
    const insertLine = analysis.packageLineEnd;
    const newLine = `${analysis.indentation}${packageName}`;
    
    const newLines = [...lines];
    newLines.splice(insertLine, 0, newLine);
    
    return {
      original: configContent,
      modified: newLines.join('\n'),
      preview: this.generateDiffPreview(lines, newLines),
      insertedAt: insertLine
    };
  }

  /**
   * Generate diff preview
   */
  generateDiffPreview(oldLines, newLines) {
    const maxContext = 3;
    let diff = [];
    
    for (let i = 0; i < Math.max(oldLines.length, newLines.length); i++) {
      if (oldLines[i] !== newLines[i]) {
        // Show context before
        for (let j = Math.max(0, i - maxContext); j < i; j++) {
          diff.push(`  ${oldLines[j]}`);
        }
        
        // Show change
        if (i < oldLines.length && i < newLines.length) {
          diff.push(`- ${oldLines[i]}`);
          diff.push(`+ ${newLines[i]}`);
        } else if (i >= oldLines.length) {
          diff.push(`+ ${newLines[i]}`);
        } else {
          diff.push(`- ${oldLines[i]}`);
        }
        
        // Show context after
        for (let j = i + 1; j < Math.min(newLines.length, i + maxContext + 1); j++) {
          if (newLines[j] === oldLines[j]) {
            diff.push(`  ${newLines[j]}`);
          }
        }
        
        break;
      }
    }
    
    return diff.join('\n');
  }

  /**
   * Backup configuration
   */
  async backupConfiguration() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupDir, `configuration.nix.${timestamp}`);
    
    try {
      // Ensure backup directory exists
      await fs.mkdir(this.backupDir, { recursive: true });
      
      // Copy configuration
      const content = await fs.readFile(this.configPath, 'utf8');
      await fs.writeFile(backupPath, content, 'utf8');
      
      return backupPath;
    } catch (error) {
      console.error('Failed to backup configuration:', error);
      throw new Error('Could not create configuration backup');
    }
  }

  /**
   * Get rebuild preview
   */
  async getRebuildPreview() {
    try {
      // Dry run of nixos-rebuild
      const { stdout, stderr } = await execAsync('nixos-rebuild dry-build 2>&1', {
        timeout: 60000 // 1 minute
      });
      
      const output = stdout || stderr;
      
      // Parse output for useful information
      const toInstall = [];
      const toUpdate = [];
      const toRemove = [];
      
      const lines = output.split('\n');
      for (const line of lines) {
        if (line.includes('will be installed')) {
          const match = line.match(/these (\d+) paths will be installed/);
          if (match) {
            // Would need to parse specific packages
          }
        }
      }
      
      return {
        success: true,
        output: output.substring(0, 1000), // Limit output size
        summary: {
          toInstall: toInstall.length,
          toUpdate: toUpdate.length,
          toRemove: toRemove.length
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        suggestion: 'Check your configuration for errors'
      };
    }
  }

  /**
   * Clean up expired changes
   */
  cleanupExpiredChanges() {
    const now = Date.now();
    for (const [token, change] of this.pendingChanges.entries()) {
      if (now - change.timestamp > this.changeTimeout) {
        this.pendingChanges.delete(token);
      }
    }
  }
}

module.exports = SystemInstaller;