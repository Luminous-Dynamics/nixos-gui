#!/usr/bin/env node

/**
 * Test script for real Nix package search
 * Run this to verify Nix integration is working
 */

const RealNixSearch = require('./backend/nix-search-real');

async function test() {
  const searcher = new RealNixSearch();
  
  console.log('🧪 Testing Real Nix Package Search...\n');
  
  // Test 1: Search for common packages
  console.log('Test 1: Searching for "firefox"...');
  try {
    const results = await searcher.searchPackages('firefox');
    console.log(`✅ Found ${results.length} packages`);
    if (results.length > 0) {
      console.log('First result:', {
        name: results[0].name,
        version: results[0].version,
        installed: results[0].installed
      });
    }
  } catch (error) {
    console.error('❌ Search failed:', error.message);
  }
  
  console.log('\n---\n');
  
  // Test 2: Get installation preview
  console.log('Test 2: Getting installation preview for "git"...');
  try {
    const preview = await searcher.getInstallPreview('git');
    console.log('✅ Preview generated:');
    console.log('- Packages to install:', preview.changes.toInstall.length);
    console.log('- Command:', preview.command);
    if (preview.warning) {
      console.log('- Warning:', preview.warning);
    }
  } catch (error) {
    console.error('❌ Preview failed:', error.message);
  }
  
  console.log('\n---\n');
  
  // Test 3: Check channels
  console.log('Test 3: Getting NixOS channels...');
  try {
    const channels = await searcher.getChannels();
    console.log(`✅ Found ${channels.length} channels:`);
    channels.forEach(ch => console.log(`- ${ch.name}: ${ch.url}`));
  } catch (error) {
    console.error('❌ Channels failed:', error.message);
  }
  
  console.log('\n✨ Tests complete!');
}

// Run tests
test().catch(console.error);