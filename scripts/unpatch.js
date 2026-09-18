/**
 * Antigravity Unpatch Script
 * Restores the original unmodified app.asar from app.asar.bak
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

function findAntigravityDir() {
  if (process.env.ANTIGRAVITY_PATH && fs.existsSync(process.env.ANTIGRAVITY_PATH)) {
    return process.env.ANTIGRAVITY_PATH;
  }
  const defaultPath = path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'antigravity');
  if (fs.existsSync(defaultPath)) {
    return defaultPath;
  }
  throw new Error(`Antigravity installation not found at default location: ${defaultPath}`);
}

function main() {
  console.log('🔄 [Unpatch] Restoring official Antigravity client...');

  const appDir = findAntigravityDir();
  const resourcesDir = path.join(appDir, 'resources');
  const asarPath = path.join(resourcesDir, 'app.asar');
  const backupPath = path.join(resourcesDir, 'app.asar.bak');

  if (!fs.existsSync(backupPath)) {
    console.error(`❌ [Unpatch] No backup found at: ${backupPath}`);
    console.error('Antigravity has either not been patched yet or the backup was deleted.');
    process.exit(1);
  }

  try {
    fs.copyFileSync(backupPath, asarPath);
    console.log('✅ [Unpatch] Successfully restored original app.asar from backup!');
    console.log('Restart Antigravity to verify the official interface.');
  } catch (err) {
    console.error('❌ [Unpatch] Failed to restore app.asar:', err.message);
    process.exit(1);
  }
}

main();
