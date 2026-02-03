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

function checkNodeVersion() {
  const [major] = process.versions.node.split('.').map(Number);
  if (major < 18) {
    console.warn(`⚠️  Node ${process.versions.node} detected. Node 18+ recommended.`);
    return false;
  }
  return true;
}

console.log('📦 Validating beads-kanban installation...');

checkNodeVersion();

checkCommand(
  'bd',
  'Beads CLI',
  'Install with: brew install bd (https://github.com/steveyegge/beads)'
);

// Check for native build tools (better-sqlite3 requirement)
if (platform() === 'darwin') {
  checkCommand('xcode-select', 'Xcode Command Line Tools', 'Install with: xcode-select --install');
} else if (platform() === 'linux') {
  checkCommand('gcc', 'GCC compiler', 'Install with: sudo apt install build-essential (Debian/Ubuntu)');
}

console.log('✅ Installation validation complete');
