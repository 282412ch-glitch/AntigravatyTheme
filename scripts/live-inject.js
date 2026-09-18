/**
 * Live Inject Script
 * Injects dist/theme.css and dist/theme.js into the currently running Antigravity
 * window via Chrome DevTools Protocol (CDP) for instant hot reload.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const CSS_PATH = path.join(DIST_DIR, 'theme.css');
const JS_PATH = path.join(DIST_DIR, 'theme.js');

const PORT_FILE = path.join(os.homedir(), 'AppData', 'Roaming', 'Antigravity', 'DevToolsActivePort');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readPages(port) {
  const res = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!res.ok) {
    throw new Error(`DevTools returned HTTP ${res.status}`);
  }
  return res.json();
}

async function findApplicationPage(port) {
  let lastError = null;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const pages = await readPages(port);
      const page = pages.find((candidate) => (
        candidate.type === 'page'
        && /^https:\/\/127\.0\.0\.1/.test(candidate.url || '')
        && candidate.webSocketDebuggerUrl
      ));
      if (page) return page;
    } catch (err) {
      lastError = err;
    }
    await sleep(500);
  }
  throw lastError || new Error('No ready Antigravity application page found');
}

async function main() {
  console.log('[LiveInject] Connecting to running Antigravity client...');

  if (!fs.existsSync(PORT_FILE)) {
    console.error('[LiveInject] Error: Antigravity DevToolsActivePort file not found.');
    console.error('Make sure Antigravity is currently running.');
    process.exit(1);
  }

  const portLines = fs.readFileSync(PORT_FILE, 'utf8').trim().split('\n');
  const port = parseInt(portLines[0], 10);
  if (isNaN(port)) {
    console.error('[LiveInject] Invalid port found in DevToolsActivePort:', portLines[0]);
    process.exit(1);
  }

  console.log(`[LiveInject] Found DevTools port: ${port}`);

  let targetPage;
  try {
    targetPage = await findApplicationPage(port);
  } catch (err) {
    console.error('[LiveInject] No ready Antigravity application page found:', err.message);
    process.exit(1);
  }

  console.log(`[LiveInject] Target Window: "${targetPage.title}" (${targetPage.url})`);

  const cssContent = fs.readFileSync(CSS_PATH, 'utf8');
  const jsContent = fs.readFileSync(JS_PATH, 'utf8');

  const ws = new WebSocket(targetPage.webSocketDebuggerUrl);

  ws.onopen = () => {
    console.log('[LiveInject] WebSocket connected. Pushing styles and scripts...');
    
    // Inject or update CSS
    const injectionScript = `
      (() => {
        if (!document.body || location.href.startsWith('chrome-error://')) {
          return { success: false, error: 'Antigravity page is not ready', href: location.href };
        }

        // 1. Inject or update CSS
        let styleEl = document.getElementById('ag-frosted-theme-css');
        if (!styleEl) {
          styleEl = document.createElement('style');
          styleEl.id = 'ag-frosted-theme-css';
          document.head.appendChild(styleEl);
        }
        styleEl.textContent = ${JSON.stringify(cssContent)};

        // 2. Clean previous theme UI elements if present to re-mount cleanly
        document.getElementById('ag-theme-trigger-btn')?.remove();
        document.getElementById('ag-theme-modal-overlay')?.remove();
        document.getElementById('fw-quick-trigger')?.remove();
        document.getElementById('fw-modal-backdrop')?.remove();

        // 3. Evaluate new JS bundle
        try {
          ${jsContent}
          return { success: true, href: location.href };
        } catch (e) {
          return { success: false, error: e.stack || e.message, href: location.href };
        }
      })()
    `;

    ws.send(JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: {
        expression: injectionScript,
        returnByValue: true
      }
    }));
  };

  ws.onmessage = (event) => {
    const resp = JSON.parse(event.data);
    const val = resp.result?.result?.value;
    if (val?.success && val?.href && !val.href.startsWith('chrome-error://')) {
      console.log('✨ [LiveInject] SUCCESS: Frosted Glass Theme has been applied to Antigravity!');
      console.log('👉 Look at the bottom-right corner of Antigravity for the "Frosted Glass" button, or press Alt+F!');
    } else {
      console.error('❌ [LiveInject] Injection evaluation error:', val?.error || resp);
    }
    ws.close();
    process.exit(val?.success && val?.href && !val.href.startsWith('chrome-error://') ? 0 : 1);
  };

  ws.onerror = (err) => {
    console.error('[LiveInject] WebSocket error:', err.message);
    process.exit(1);
  };
}

main().catch(err => {
  console.error('[LiveInject] Fatal error:', err);
  process.exit(1);
});
