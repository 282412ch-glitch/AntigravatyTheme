/**
 * Build Script
 * Bundles glass.css and JS modules into dist/ deliverables
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function buildCSS() {
  console.log('[Build] Packaging CSS...');
  const cssFile = path.join(SRC_DIR, 'styles', 'glass.css');
  const cssContent = fs.readFileSync(cssFile, 'utf8');
  fs.writeFileSync(path.join(DIST_DIR, 'theme.css'), cssContent, 'utf8');
  console.log(`[Build] Wrote dist/theme.css (${(cssContent.length / 1024).toFixed(1)} KB)`);
}

function buildJS() {
  console.log('[Build] Bundling JS modules into standalone IIFE...');

  function readModule(filename) {
    let content = fs.readFileSync(path.join(SRC_DIR, 'js', filename), 'utf8');
    // Remove imports
    content = content.replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, '');
    // Replace "export const X =" with "const X ="
    content = content.replace(/export\s+(const|let|var|function|async function|class)\s+/g, '$1 ');
    return content;
  }

  const defaultImageCode = readModule('default-image.js');
  const constantsCode = readModule('constants.js');
  const knobsCode = readModule('knobs.js');
  const imageStoreCode = readModule('image-store.js');
  const wallpaperCode = readModule('wallpaper.js');
  const uiCode = readModule('ui.js');
  const indexCode = readModule('index.js');

  const bundledJS = `/**
 * dsh-frosted-window replica for Antigravity
 * Bundled Client Script
 */
(function() {
  'use strict';

  // --- Default Image ---
  ${defaultImageCode}

  // --- Constants ---
  ${constantsCode}

  // --- Knobs ---
  ${knobsCode}

  // --- Image Store (IndexedDB) ---
  ${imageStoreCode}

  // --- Wallpaper Presenter ---
  ${wallpaperCode}

  // --- UI Modal & Sliders ---
  ${uiCode}

  // --- Bootstrap ---
  ${indexCode}
})();
`;

  fs.writeFileSync(path.join(DIST_DIR, 'theme.js'), bundledJS, 'utf8');
  console.log(`[Build] Wrote dist/theme.js (${(bundledJS.length / 1024).toFixed(1)} KB)`);
}

function main() {
  ensureDir(DIST_DIR);
  buildCSS();
  buildJS();
  console.log('[Build] Build successful!');
}

main();
