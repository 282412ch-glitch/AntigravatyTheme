import { BODY_ATTR } from './constants.js';
import { DEFAULT_WALLPAPER } from './image-store.js';

let wallpaperEl = null;
let dimEl = null;

export function getEffectiveScheme() {
  if (document.body.classList.contains('theme-dark')) return 'dark';
  if (document.body.classList.contains('theme-light')) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ensureChrome() {
  if (!wallpaperEl || !wallpaperEl.isConnected) {
    wallpaperEl = document.querySelector(`[${BODY_ATTR}-wallpaper]`);
    if (!wallpaperEl) {
      wallpaperEl = document.createElement('div');
      wallpaperEl.setAttribute(`${BODY_ATTR}-wallpaper`, '');
      document.body.prepend(wallpaperEl);
    }
  }

  if (!dimEl || !dimEl.isConnected) {
    dimEl = document.querySelector(`[${BODY_ATTR}-dim]`);
    if (!dimEl) {
      dimEl = document.createElement('div');
      dimEl.setAttribute(`${BODY_ATTR}-dim`, '');
      wallpaperEl.after(dimEl);
    }
  }
}

export function retractChrome() {
  document.body.removeAttribute(BODY_ATTR);
  if (wallpaperEl) {
    wallpaperEl.remove();
    wallpaperEl = null;
  }
  if (dimEl) {
    dimEl.remove();
    dimEl = null;
  }
}

export function applySurface(knobs, imageUrl) {
  if (!knobs.enabled) {
    retractChrome();
    return;
  }

  ensureChrome();
  const finalImage = imageUrl || DEFAULT_WALLPAPER;
  wallpaperEl.style.backgroundImage = `url("${finalImage}")`;

  const scheme = getEffectiveScheme();
  document.body.setAttribute(BODY_ATTR, scheme);

  // Set CSS variables on body and root for live reactivity
  const root = document.documentElement;
  const blurVal = `${Math.round(knobs.blurPx)}px`;
  const satVal = `${Math.round(knobs.saturate * 100)}%`;
  const dimVal = String(knobs.dim);
  const glassVal = String(knobs.glassOpacity);

  root.style.setProperty('--fw-blur', blurVal);
  root.style.setProperty('--fw-saturate', satVal);
  root.style.setProperty('--fw-dim', dimVal);
  root.style.setProperty('--fw-glass', glassVal);

  document.body.style.setProperty('--fw-blur', blurVal);
  document.body.style.setProperty('--fw-saturate', satVal);
  document.body.style.setProperty('--fw-dim', dimVal);
  document.body.style.setProperty('--fw-glass', glassVal);
}
