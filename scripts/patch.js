/**
 * Antigravity Patch Script
 * 
 * Safely injects the Theme Loader hook into Antigravity's preload script.
 * 1. Creates a backup of app.asar (app.asar.bak) if not already present.
 * 2. Unpacks app.asar to a temporary directory.
 * 3. Appends/updates the lightweight loader hook in dist/preload.js.
 * 4. Repacks app.asar cleanly.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const THEME_PROJECT_DIR = path.resolve(__dirname, '..');
const THEME_DIST_DIR = path.join(THEME_PROJECT_DIR, 'dist');

// Find Antigravity installation
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

const HOOK_SIGNATURE = '/* == Antigravity Frosted Theme Loader Hook == */';

function archiveContainsHook(archivePath) {
  try {
    return fs.readFileSync(archivePath).includes(Buffer.from(HOOK_SIGNATURE, 'utf8'));
  } catch (_) {
    return false;
  }
}

function filesMatch(leftPath, rightPath) {
  try {
    const left = fs.statSync(leftPath);
    const right = fs.statSync(rightPath);
    if (left.size !== right.size) return false;
    return fs.readFileSync(leftPath).equals(fs.readFileSync(rightPath));
  } catch (_) {
    return false;
  }
}

function generateHookCode() {
  const cleanDist = THEME_DIST_DIR.replace(/\\/g, '/');
  return `
${HOOK_SIGNATURE}
(function() {
  try {
    const _fs = require('fs');
    const _path = require('path');
    const { webFrame } = require('electron');
    const _themeDist = "${cleanDist}";

    const _injectThemeFiles = () => {
      try {
        const cssFile = _path.join(_themeDist, 'theme.css');
        const jsFile = _path.join(_themeDist, 'theme.js');

        // 1. Inject or update CSS
        if (_fs.existsSync(cssFile)) {
          let styleEl = document.getElementById('ag-frosted-theme-css');
          if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'ag-frosted-theme-css';
            document.head.appendChild(styleEl);
          }
          styleEl.textContent = _fs.readFileSync(cssFile, 'utf8');
        }

        // 2. Execute JS via webFrame in page context
        if (_fs.existsSync(jsFile)) {
          const jsCode = _fs.readFileSync(jsFile, 'utf8');
          if (typeof webFrame !== 'undefined' && webFrame.executeJavaScript) {
            webFrame.executeJavaScript(jsCode);
          }
        }
      } catch (err) {
        console.error('[FrostedThemeLoader] Failed to inject theme:', err);
      }
    };

    if (document.readyState === 'loading') {
      window.addEventListener('DOMContentLoaded', _injectThemeFiles);
    } else {
      _injectThemeFiles();
    }
  } catch (e) {
    console.error('[FrostedThemeLoader] Hook error:', e);
  }
})();
`;
}

function main() {
  console.log('🚀 [Patch] Starting Antigravity theme patcher...');

  // 1. Ensure build outputs exist first
  const distCss = path.join(THEME_DIST_DIR, 'theme.css');
  const distJs = path.join(THEME_DIST_DIR, 'theme.js');
  if (!fs.existsSync(distCss) || !fs.existsSync(distJs)) {
    console.log('[Patch] dist/ outputs missing, running build first...');
    execSync('node scripts/build.js', { cwd: THEME_PROJECT_DIR, stdio: 'inherit' });
  }

  // 2. Locate app.asar
  const appDir = findAntigravityDir();
  console.log(`[Patch] Found Antigravity directory: ${appDir}`);

  const resourcesDir = path.join(appDir, 'resources');
  const asarPath = path.join(resourcesDir, 'app.asar');
  const backupPath = path.join(resourcesDir, 'app.asar.bak');

  if (!fs.existsSync(asarPath)) {
    console.error(`[Patch] Error: app.asar not found at ${asarPath}`);
    process.exit(1);
  }

  // 3. Keep a rollback backup for the currently installed, unpatched version.
  //    Auto-updates replace app.asar, so an old backup must not be reused.
  const alreadyPatched = archiveContainsHook(asarPath);
  if (!fs.existsSync(backupPath) && alreadyPatched) {
    throw new Error('[Patch] app.asar is already patched but no clean rollback backup exists.');
  }
  if (!fs.existsSync(backupPath) || (!alreadyPatched && !filesMatch(asarPath, backupPath))) {
    console.log('[Patch] Updating rollback backup: app.asar -> app.asar.bak');
    fs.copyFileSync(asarPath, backupPath);
    console.log('[Patch] Backup successfully created.');
  } else {
    console.log('[Patch] Existing backup found (app.asar.bak), preserving it.');
  }

  // 4. Temporary extraction directory
  const tempDir = path.join(os.tmpdir(), `antigravity_patch_${Date.now()}`);
  console.log(`[Patch] Extracting app.asar to temporary location: ${tempDir}`);
  execSync(`npx asar extract "${asarPath}" "${tempDir}"`, { stdio: 'inherit' });

  // 5. Inject hook into dist/utils.js (Main Process Window Lifecycle)
  const cleanDist = THEME_DIST_DIR.replace(/\\/g, '/');
  const utilsPath = path.join(tempDir, 'dist', 'utils.js');
  if (!fs.existsSync(utilsPath)) {
    throw new Error(`[Patch] Expected createWindow module not found: ${utilsPath}`);
  }
  {
    let utilsContent = fs.readFileSync(utilsPath, 'utf8');
    const targetPoint = 'void win.loadURL(url);';
    if (!utilsContent.includes(targetPoint)) {
      throw new Error('[Patch] Antigravity createWindow signature changed; no safe injection point found.');
    }
    console.log('[Patch] Injecting theme loader into dist/utils.js createWindow...');
      const utilsHook = `
    /* == Antigravity Frosted Theme Loader Hook == */
    win.webContents.on('did-finish-load', () => {
        try {
            try { win.setTitleBarOverlay({ color: '#00000000', height: 30 }); } catch (_) {}
            const _fs = require('fs');
            const _path = require('path');
            const _themeDist = "${cleanDist}";
            const cssFile = _path.join(_themeDist, 'theme.css');
            const jsFile = _path.join(_themeDist, 'theme.js');
            if (_fs.existsSync(cssFile)) {
                win.webContents.insertCSS(_fs.readFileSync(cssFile, 'utf8'));
            }
            if (_fs.existsSync(jsFile)) {
                win.webContents.executeJavaScript(_fs.readFileSync(jsFile, 'utf8')).catch(err => {
                    console.error('[FrostedTheme] Execute error:', err);
                });
            }
        } catch (e) {
            console.error('[FrostedTheme] Auto-load error:', e);
        }
    });
`;
      if (utilsContent.includes(HOOK_SIGNATURE)) {
        utilsContent = utilsContent.replace(/\/\* == Antigravity Frosted Theme Loader Hook == \*\/[\s\S]*?win\.webContents\.on\('did-finish-load',[\s\S]*?\n    \}\);/g, '');
      }
      utilsContent = utilsContent.replace(targetPoint, utilsHook + '\n    ' + targetPoint);
      fs.writeFileSync(utilsPath, utilsContent, 'utf8');
  }

  // 6. Ensure preload.js is clean (avoid renderer sandbox restrictions)
  const preloadPath = path.join(tempDir, 'dist', 'preload.js');
  if (fs.existsSync(preloadPath)) {
    let preloadContent = fs.readFileSync(preloadPath, 'utf8');
    if (preloadContent.includes(HOOK_SIGNATURE)) {
      console.log('[Patch] Removing legacy hook from preload.js...');
      const hookStart = preloadContent.indexOf(HOOK_SIGNATURE);
      preloadContent = preloadContent.substring(0, hookStart).trimEnd() + '\n';
      fs.writeFileSync(preloadPath, preloadContent, 'utf8');
    }
  }

  // 7. Repack asar
  console.log('[Patch] Repacking modified app.asar...');
  const tempAsar = path.join(os.tmpdir(), `app_repacked_${Date.now()}.asar`);
  execSync(`npx asar pack "${tempDir}" "${tempAsar}"`, { stdio: 'inherit' });

  if (!archiveContainsHook(tempAsar)) {
    throw new Error('[Patch] Repacked app.asar does not contain the theme loader hook.');
  }

  // 8. Replace app.asar
  console.log('[Patch] Replacing app.asar with patched version...');
  fs.copyFileSync(tempAsar, asarPath);

  // Clean up temporary directories
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.unlinkSync(tempAsar);
  } catch (_) {}

  console.log('\n🎉 [Patch] Antigravity successfully patched!');
  console.log(`✨ The theme is linked to: ${THEME_DIST_DIR}`);
  console.log('👉 You only need to patch ONCE. Any future changes in this project will automatically load when Antigravity starts!');
}

main();
