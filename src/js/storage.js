/**
 * Storage module:
 * - IndexedDB for high-res / large wallpaper images (bypasses 5MB localStorage limit)
 * - localStorage for theme settings & slider values
 */

const DB_NAME = 'AntigravityThemeDB';
const DB_VERSION = 1;
const STORE_NAME = 'wallpapers';
const KEY_WALLPAPER = 'current_wallpaper';
const SETTINGS_KEY = 'ag_frosted_theme_settings';

export const DEFAULT_SETTINGS = {
  enabled: true,
  blur: 16,            // px (0 - 40)
  dim: 0.45,           // (0.0 - 0.9)
  saturate: 125,       // % (50 - 200)
  opacity: 0.65,       // (0.1 - 0.95)
  activePreset: 'nebula', // preset id or 'custom'
  customUrl: ''
};

// Open IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Save image data to IndexedDB
export async function saveWallpaperToDB(imageDataUrl) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(imageDataUrl, KEY_WALLPAPER);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Get image data from IndexedDB
export async function getWallpaperFromDB() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(KEY_WALLPAPER);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

// Clear image data in IndexedDB
export async function clearWallpaperFromDB() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(KEY_WALLPAPER);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Get stored theme settings
export function getSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    console.error('[AntigravityTheme] Error reading settings from localStorage:', e);
    return { ...DEFAULT_SETTINGS };
  }
}

// Save theme settings
export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('[AntigravityTheme] Error saving settings to localStorage:', e);
  }
}
