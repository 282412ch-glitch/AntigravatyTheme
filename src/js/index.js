/**
 * Antigravity Frosted Window Theme - Main Entry
 * Replicating dsh-frosted-window for Antigravity
 */

import { loadKnobs, loadKnobsAsync } from './knobs.js';
import { getImage, DEFAULT_WALLPAPER } from './image-store.js';
import { applySurface } from './wallpaper.js';
import { createSettingsModal } from './ui.js';

export async function bootstrap() {
  try {
    const bootToken = {};
    // Live injection can evaluate the bundle more than once. Tear down the
    // previous runtime first so old observers and key handlers do not linger.
    if (typeof window !== 'undefined' && window.__fwThemeRuntime?.cleanup) {
      window.__fwThemeRuntime.cleanup();
    }
    if (typeof window !== 'undefined') window.__fwThemeBootToken = bootToken;

    // 0. Transparent Window Controls Overlay (minimize, maximize, close)
    if (typeof window !== 'undefined' && window.electronNative && window.electronNative.setTitleBarOverlay) {
      window.electronNative.setTitleBarOverlay({ color: '#00000000', height: 30 }).catch(() => {});
    }

    // 1. Load persistent knobs (from nativeStorage or localStorage)
    const knobs = await loadKnobsAsync();
    if (typeof window !== 'undefined' && window.__fwThemeBootToken !== bootToken) return;

    // 2. Get stored wallpaper or fallback to default
    let imageUrl = DEFAULT_WALLPAPER;
    let storedImageRecord = null;
    try {
      const stored = await getImage();
      if (stored && stored.data) {
        imageUrl = stored.data;
        storedImageRecord = stored;
      }
    } catch (e) {
      console.warn('[FrostedWindow] Could not load image from storage, using default:', e);
    }
    if (typeof window !== 'undefined' && window.__fwThemeBootToken !== bootToken) return;

    // 3. Apply initial frosted glass surface
    applySurface(knobs, imageUrl);

    // 4. Mount UI settings modal and trigger
    const modalApi = createSettingsModal(knobs, storedImageRecord);

    // 4. Hook into Antigravity settings modal if opened
    let syncQueued = false;
    const syncNativeSettingsEntry = () => {
      syncQueued = false;
      // If native Antigravity settings modal is opened, add "磨砂主题" tab right after Appearance.
      const dialog = document.querySelector('.settings-modal-container') || document.querySelector('[role="dialog"]');
      if (!dialog || dialog.id === 'fw-modal-window' || dialog.querySelector('#native-fw-nav-item')) return;

      const appBtn = Array.from(dialog.querySelectorAll('button')).find((button) => {
        const text = button.textContent || '';
        return text.includes('Appearance') || text.includes('外观');
      });
      if (!appBtn) return;

      const item = document.createElement('button');
      item.id = 'native-fw-nav-item';
      item.type = 'button';
      item.className = 'flex items-center gap-1.5 group mx-2 px-2 py-1 rounded-lg cursor-pointer border-none text-left transition-all outline-none hover:bg-sidebar-muted text-foreground';
      item.setAttribute('aria-label', '打开磨砂主题设置');
      item.innerHTML = '<span aria-hidden="true">◈</span><span class="truncate text-sm font-normal">磨砂主题</span>';
      item.addEventListener('click', () => {
        if (window.__fwOpenFrostedTheme) {
          window.__fwOpenFrostedTheme();
        } else {
          document.getElementById('fw-modal-backdrop')?.classList.add('fw-open');
        }
      });
      appBtn.after(item);
    };

    const observer = new MutationObserver(() => {
      if (syncQueued) return;
      syncQueued = true;
      queueMicrotask(syncNativeSettingsEntry);
    });

    observer.observe(document.body, { childList: true, subtree: true });
    syncNativeSettingsEntry();

    if (typeof window !== 'undefined') {
      const runtime = {
        cleanup() {
          observer.disconnect();
          modalApi?.cleanup?.();
          if (window.__fwThemeRuntime === runtime) {
            delete window.__fwThemeRuntime;
          }
          if (window.__fwThemeBootToken === bootToken) {
            delete window.__fwThemeBootToken;
          }
        }
      };
      window.__fwThemeRuntime = runtime;
    }

    console.log('✨ [FrostedWindow] dsh-frosted-window theme active on Antigravity.');
  } catch (err) {
    console.error('❌ [FrostedWindow] Bootstrap failed:', err);
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => bootstrap());
} else {
  bootstrap();
}
