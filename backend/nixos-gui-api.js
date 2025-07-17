#!/usr/bin/env node

/**
 * NixOS GUI Backend API
 * Sacred technology for making NixOS accessible to everyone
 * Built with love, designed with care
 */

const express = require('express');
const cors = require('cors');
const { exec, spawn } = require('child_process');
const { promises: fs } = require('fs');
const path = require('path');
const os = require('os');
const NixInterface = require('./nix-interface');
const RealNixSearch = require('./nix-search-real');
const ConfigReader = require('./config-reader');
const SafeInstaller = require('./safe-installer');
const ServiceManager = require('./service-manager');

const app = express();
const PORT = process.env.PORT || 7778;
const nixInterface = new NixInterface();
const realNixSearch = new RealNixSearch();
const configReader = new ConfigReader();
const safeInstaller = new SafeInstaller();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from mvp directory
app.use(express.static(path.join(__dirname, '../mvp')));
app.use(express.static(path.join(__dirname, '../public')));

// Sacred greeting
console.log('🌟 NixOS GUI API Starting...');
console.log('💝 Making NixOS accessible with love');

// Default route - redirect to dashboard
app.get('/', (req, res) => {
  res.redirect('/dashboard.html');
});

// Cache for package data
let packageCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get current NixOS generation info
 */
app.get('/api/system/info', async (req, res) => {
  try {
    const info = await getSystemInfo();
    res.json(info);
  } catch (error) {
    console.error('Error getting system info:', error);
    res.status(500).json({ error: 'Failed to get system information' });
  }
});

/**
 * Search packages with caching
 */
app.get('/api/packages/search', async (req, res) => {
  try {
    const { query = '', category = 'all' } = req.query;
    
    // Try real Nix search first
    try {
      console.log(`Searching packages: query="${query}", category="${category}"`);
      const packages = await realNixSearch.searchPackages(query);
      
      // Filter by category if specified
      const filtered = category === 'all' 
        ? packages 
        : packages.filter(pkg => pkg.category === category);
      
      console.log(`Found ${filtered.length} packages`);
      res.json(filtered);
      return;
    } catch (nixError) {
      console.error('Real Nix search failed:', nixError.message);
      
      // Only fall back to mock data if explicitly in demo mode
      if (process.env.DEMO_MODE === 'true') {
        console.log('Falling back to mock data (DEMO_MODE=true)');
        const packages = await searchPackages(query, category);
        res.json(packages);
      } else {
        // Return empty results with error message
        res.json([]);
      }
    }
  } catch (error) {
    console.error('Error searching packages:', error);
    res.status(500).json({ error: 'Failed to search packages' });
  }
});

/**
 * Get installed packages
 */
app.get('/api/packages/installed', async (req, res) => {
  try {
    const packages = await getInstalledPackages();
    res.json(packages);
  } catch (error) {
    console.error('Error getting installed packages:', error);
    res.status(500).json({ error: 'Failed to get installed packages' });
  }
});

/**
 * Preview package installation
 */
app.post('/api/packages/preview', async (req, res) => {
  try {
    const { packageName } = req.body;
    
    if (!packageName) {
      return res.status(400).json({ error: 'Missing packageName' });
    }
    
    console.log(`Getting installation preview for: ${packageName}`);
    const preview = await realNixSearch.getInstallPreview(packageName);
    res.json(preview);
  } catch (error) {
    console.error('Error generating preview:', error);
    res.status(500).json({ error: 'Failed to generate preview' });
  }
});

/**
 * Preview configuration changes
 */
app.post('/api/config/preview', async (req, res) => {
  try {
    const { action, packageName } = req.body;
    
    if (!action || !packageName) {
      return res.status(400).json({ error: 'Missing action or packageName' });
    }
    
    const preview = await generateConfigPreview(action, packageName);
    res.json(preview);
  } catch (error) {
    console.error('Error generating preview:', error);
    res.status(500).json({ error: 'Failed to generate preview' });
  }
});

/**
 * Create installation operation (requires confirmation)
 */
app.post('/api/packages/install', async (req, res) => {
  try {
    const { packageName } = req.body;
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    if (!packageName) {
      return res.status(400).json({ error: 'Missing packageName' });
    }
    
    console.log(`Creating installation operation for: ${packageName}`);
    const operation = await safeInstaller.createInstallOperation(packageName, userAgent);
    res.json(operation);
  } catch (error) {
    console.error('Error creating installation:', error);
    res.status(500).json({ error: 'Failed to create installation operation' });
  }
});

/**
 * Confirm and execute installation
 */
app.post('/api/packages/confirm-install', async (req, res) => {
  try {
    const { token, confirmation } = req.body;
    
    if (!token || !confirmation) {
      return res.status(400).json({ error: 'Missing token or confirmation' });
    }
    
    const result = await safeInstaller.confirmAndInstall(token, confirmation);
    res.json(result);
  } catch (error) {
    console.error('Error confirming installation:', error);
    res.status(500).json({ error: 'Failed to confirm installation' });
  }
});

/**
 * Get rollback information
 */
app.get('/api/rollback/info', async (req, res) => {
  try {
    const info = await safeInstaller.getRollbackInfo();
    res.json(info);
  } catch (error) {
    console.error('Error getting rollback info:', error);
    res.status(500).json({ error: 'Failed to get rollback information' });
  }
});

/**
 * Apply configuration changes
 */
app.post('/api/config/apply', async (req, res) => {
  try {
    const { action, packageName, dryRun = false } = req.body;
    
    if (!action || !packageName) {
      return res.status(400).json({ error: 'Missing action or packageName' });
    }
    
    const result = await applyConfiguration(action, packageName, dryRun);
    res.json(result);
  } catch (error) {
    console.error('Error applying configuration:', error);
    res.status(500).json({ error: 'Failed to apply configuration' });
  }
});

/**
 * Get current configuration (read-only)
 */
app.get('/api/config/current', async (req, res) => {
  try {
    const config = await configReader.readConfiguration();
    res.json(config);
  } catch (error) {
    console.error('Error reading configuration:', error);
    res.status(500).json({ error: 'Failed to read configuration' });
  }
});

/**
 * Get generations list
 */
app.get('/api/generations', async (req, res) => {
  try {
    const generations = await getGenerations();
    res.json(generations);
  } catch (error) {
    console.error('Error getting generations:', error);
    res.status(500).json({ error: 'Failed to get generations' });
  }
});

/**
 * Switch to a specific generation
 */
app.post('/api/generations/switch', async (req, res) => {
  try {
    const { generation } = req.body;
    
    if (!generation) {
      return res.status(400).json({ error: 'Missing generation number' });
    }
    
    const result = await switchGeneration(generation);
    res.json(result);
  } catch (error) {
    console.error('Error switching generation:', error);
    res.status(500).json({ error: 'Failed to switch generation' });
  }
});

/**
 * Get all services
 */
app.get('/api/services', async (req, res) => {
  try {
    const services = await serviceManager.getAllServices();
    res.json(services);
  } catch (error) {
    console.error('Error getting services:', error);
    res.status(500).json({ error: 'Failed to get services' });
  }
});

/**
 * Get service details
 */
app.get('/api/services/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const details = await serviceManager.getServiceDetails(name);
    
    if (!details) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    res.json(details);
  } catch (error) {
    console.error('Error getting service details:', error);
    res.status(500).json({ error: 'Failed to get service details' });
  }
});

/**
 * Start a service
 */
app.post('/api/services/:name/start', async (req, res) => {
  try {
    const { name } = req.params;
    const result = await serviceManager.startService(name);
    res.json(result);
  } catch (error) {
    console.error('Error starting service:', error);
    res.status(500).json({ error: 'Failed to start service' });
  }
});

/**
 * Stop a service
 */
app.post('/api/services/:name/stop', async (req, res) => {
  try {
    const { name } = req.params;
    const result = await serviceManager.stopService(name);
    res.json(result);
  } catch (error) {
    console.error('Error stopping service:', error);
    res.status(500).json({ error: 'Failed to stop service' });
  }
});

/**
 * Restart a service
 */
app.post('/api/services/:name/restart', async (req, res) => {
  try {
    const { name } = req.params;
    const result = await serviceManager.restartService(name);
    res.json(result);
  } catch (error) {
    console.error('Error restarting service:', error);
    res.status(500).json({ error: 'Failed to restart service' });
  }
});

/**
 * Get service configuration for NixOS
 */
app.post('/api/services/:name/config', async (req, res) => {
  try {
    const { name } = req.params;
    const { enable } = req.body;
    
    const config = serviceManager.generateServiceConfig(name, enable);
    res.json(config);
  } catch (error) {
    console.error('Error generating service config:', error);
    res.status(500).json({ error: 'Failed to generate service configuration' });
  }
});

// Helper functions

async function getSystemInfo() {
  return new Promise((resolve, reject) => {
    exec('nixos-version && nix-store -q --size /run/current-system', (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      
      const lines = stdout.trim().split('\n');
      const version = lines[0] || 'Unknown';
      const size = lines[1] || '0';
      
      // Get current generation
      exec('readlink /run/current-system | grep -oP "\\d+" | tail -1', (err, genStdout) => {
        const generation = genStdout.trim() || 'Unknown';
        
        // Count installed packages
        exec('nix-env -q | wc -l', (err2, pkgStdout) => {
          const installedPackages = parseInt(pkgStdout.trim()) || 0;
          
          resolve({
            version,
            generation,
            systemSize: formatBytes(parseInt(size)),
            installedPackages,
            lastUpdated: new Date().toISOString()
          });
        });
      });
    });
  });
}

async function searchPackages(query, category) {
  // Check cache first
  if (packageCache && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return filterPackages(packageCache, query, category);
  }
  
  return new Promise((resolve, reject) => {
    // For MVP, use nix search command
    const searchCmd = `nix search nixpkgs ${query} --json`;
    
    exec(searchCmd, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        // Fallback to mock data for demo
        resolve(getMockPackages(query, category));
        return;
      }
      
      try {
        const searchResults = JSON.parse(stdout);
        const packages = Object.entries(searchResults).map(([key, pkg]) => ({
          name: pkg.pname || key.split('.').pop(),
          version: pkg.version || 'latest',
          description: pkg.description || 'No description available',
          installed: false, // Will be checked separately
          category: guessCategory(pkg.pname || key)
        }));
        
        packageCache = packages;
        cacheTimestamp = Date.now();
        
        resolve(filterPackages(packages, query, category));
      } catch (parseError) {
        resolve(getMockPackages(query, category));
      }
    });
  });
}

async function getInstalledPackages() {
  return new Promise((resolve, reject) => {
    exec('nix-env -q --json', (error, stdout, stderr) => {
      if (error) {
        resolve([]);
        return;
      }
      
      try {
        const installed = JSON.parse(stdout);
        resolve(installed);
      } catch (parseError) {
        resolve([]);
      }
    });
  });
}

async function generateConfigPreview(action, packageName) {
  const configPath = '/etc/nixos/configuration.nix';
  
  try {
    const configContent = await fs.readFile(configPath, 'utf8');
    const lines = configContent.split('\n');
    
    // Find systemPackages section
    const packageLineIndex = lines.findIndex(line => 
      line.includes('environment.systemPackages')
    );
    
    if (packageLineIndex === -1) {
      return {
        error: 'Could not find systemPackages in configuration',
        suggestion: 'Manual edit required'
      };
    }
    
    // Generate diff preview
    const diff = action === 'install' 
      ? `+    ${packageName}`
      : `-    ${packageName}`;
    
    return {
      file: configPath,
      preview: diff,
      changes: [{
        line: packageLineIndex + 2,
        action,
        package: packageName
      }]
    };
  } catch (error) {
    return {
      error: 'Could not read configuration file',
      suggestion: 'Check file permissions'
    };
  }
}

async function applyConfiguration(action, packageName, dryRun) {
  if (dryRun) {
    return {
      success: true,
      message: `Would ${action} ${packageName}`,
      dryRun: true
    };
  }
  
  // For real implementation, this would modify configuration.nix
  // and run nixos-rebuild
  return {
    success: false,
    message: 'Real implementation pending - use nix-env for now',
    command: action === 'install' 
      ? `nix-env -iA nixos.${packageName}`
      : `nix-env -e ${packageName}`
  };
}

async function getGenerations() {
  return new Promise((resolve, reject) => {
    exec('nix-env --list-generations', (error, stdout, stderr) => {
      if (error) {
        resolve([]);
        return;
      }
      
      const generations = stdout.trim().split('\n').map(line => {
        const match = line.match(/(\d+)\s+(\d{4}-\d{2}-\d{2})/);
        if (match) {
          return {
            number: parseInt(match[1]),
            date: match[2],
            current: line.includes('(current)')
          };
        }
        return null;
      }).filter(Boolean);
      
      resolve(generations);
    });
  });
}

async function switchGeneration(generation) {
  // For safety, this would need proper authentication
  // and system permissions
  return {
    success: false,
    message: 'Generation switching requires system privileges',
    command: `sudo nix-env --switch-generation ${generation}`
  };
}

// Utility functions

function filterPackages(packages, query, category) {
  return packages.filter(pkg => {
    const matchesQuery = !query || 
      pkg.name.toLowerCase().includes(query.toLowerCase()) ||
      pkg.description.toLowerCase().includes(query.toLowerCase());
    
    const matchesCategory = category === 'all' || pkg.category === category;
    
    return matchesQuery && matchesCategory;
  });
}

function guessCategory(packageName) {
  const categories = {
    development: ['vim', 'emacs', 'vscode', 'git', 'docker', 'nodejs', 'python', 'rust', 'gcc'],
    productivity: ['firefox', 'chromium', 'libreoffice', 'thunderbird'],
    system: ['htop', 'tmux', 'zsh', 'fish', 'systemd'],
    games: ['steam', 'minecraft', 'wine'],
    multimedia: ['vlc', 'mpv', 'gimp', 'inkscape', 'blender']
  };
  
  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => packageName.toLowerCase().includes(keyword))) {
      return category;
    }
  }
  
  return 'other';
}

function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

function getMockPackages(query, category) {
  // Fallback mock data for demo
  const mockPackages = [
    {
      name: 'firefox',
      version: '122.0.1',
      description: 'A free and open source web browser from Mozilla',
      installed: true,
      category: 'productivity'
    },
    {
      name: 'neovim',
      version: '0.9.5',
      description: 'Vim-fork focused on extensibility and usability',
      installed: true,
      category: 'development'
    },
    {
      name: 'docker',
      version: '24.0.7',
      description: 'Pack, ship and run any application as a lightweight container',
      installed: false,
      category: 'development'
    },
    {
      name: 'vscode',
      version: '1.85.2',
      description: 'Open source code editor from Microsoft',
      installed: false,
      category: 'development'
    }
  ];
  
  return filterPackages(mockPackages, query, category);
}

// Start server
app.listen(PORT, () => {
  console.log(`✨ NixOS GUI API running on port ${PORT}`);
  console.log(`🌐 Access at http://localhost:${PORT}`);
  console.log(`💝 Making NixOS configuration delightful!`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🌙 Shutting down gracefully...');
  process.exit(0);
});