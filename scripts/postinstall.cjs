#!/usr/bin/env node
/**
 * Postinstall validation for beads-kanban.
 * Warns (doesn't fail) if prerequisites are missing.
 */

const { execSync } = require('child_process');
const { platform } = require('os');

function checkCommand(cmd, name, installInstructions) {
  try {
    execSync(`${cmd} --version`, { stdio: 'pipe' });
    return true;
  } catch {
    console.warn(`⚠️  ${name} not found. ${installInstructions}`);
    return false;
  }
}

console.log('📦 Validating beads-kanban installation...');

// Check Node version
const nodeMajor = parseInt(process.versions.node.split('.')[0]);
if (nodeMajor < 18) {
  console.warn(`⚠️  Node ${process.versions.node} detected. Node 18+ recommended.`);
}

// Check bd CLI
checkCommand('bd', 'Beads CLI', 'Install with: brew install beads (https://github.com/gastownhall/beads)');

// Check native build tools for better-sqlite3
const buildTools = {
  darwin: ['xcode-select', 'Xcode Command Line Tools', 'Install with: xcode-select --install'],
  linux: ['gcc', 'GCC compiler', 'Install with: sudo apt install build-essential (Debian/Ubuntu)']
};
const tools = buildTools[platform()];
if (tools) checkCommand(...tools);

console.log('✅ Installation validation complete');
