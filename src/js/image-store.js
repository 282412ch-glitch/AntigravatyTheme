import { IMAGE_DB, IMAGE_STORE, IMAGE_KEY, LEGACY_IMAGE_KEY } from './constants.js';
import { DEFAULT_WALLPAPER_DATA } from './default-image.js';

export const DEFAULT_WALLPAPER = DEFAULT_WALLPAPER_DATA;

function isValidImageRecord(record) {
  return Boolean(
    record
    && typeof record === 'object'
    && typeof record.data === 'string'
    && /^data:image\/(?:jpeg|png|webp|gif);base64,/i.test(record.data)
  );
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IMAGE_DB, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IMAGE_STORE)) {
        db.createObjectStore(IMAGE_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getImage() {
  // 1. Try nativeStorage first (persists across random ports & restarts in app_storage.json)
  try {
    if (typeof window !== 'undefined' && window.nativeStorage && window.nativeStorage.getItems) {
      const items = await window.nativeStorage.getItems();
      if (items) {
        for (const key of [IMAGE_KEY, LEGACY_IMAGE_KEY]) {
          const raw = items[key];
          if (!raw) continue;
          try {
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            if (isValidImageRecord(parsed)) return parsed;
          } catch {
            // Try the compatibility key before falling back to IndexedDB.
          }
        }
      }
    }
  } catch (e) {
    console.warn('[FrostedWindow] nativeStorage image load error:', e);
  }

  // 2. Fallback to IndexedDB (and auto-migrate to nativeStorage if found)
  try {
    const db = await openDB();
    const record = await new Promise((resolve) => {
      const tx = db.transaction(IMAGE_STORE, 'readonly');
      const store = tx.objectStore(IMAGE_STORE);
      const req = store.get(LEGACY_IMAGE_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
    if (isValidImageRecord(record)) {
      // Auto-migrate to nativeStorage so future launches with different ports will have it
      putImage(record).catch(() => {});
      return record;
    }
  } catch {
    return null;
  }
  return null;
}

export async function putImage(record) {
  if (!isValidImageRecord(record)) return;
  // 1. Persist to nativeStorage (AppData/Roaming/Antigravity/app_storage.json)
  try {
    if (typeof window !== 'undefined' && window.nativeStorage && window.nativeStorage.updateItems) {
      const json = JSON.stringify(record);
      await window.nativeStorage.updateItems({
        [IMAGE_KEY]: json,
        [LEGACY_IMAGE_KEY]: json
      });
    }
  } catch (e) {
    console.warn('[FrostedWindow] nativeStorage image save error:', e);
  }

  // 2. Fallback to IndexedDB
  try {
    const db = await openDB();
    await new Promise((resolve) => {
      const tx = db.transaction(IMAGE_STORE, 'readwrite');
      const store = tx.objectStore(IMAGE_STORE);
      const req = store.put(record, LEGACY_IMAGE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {}
}

export async function clearImage() {
  try {
    if (typeof window !== 'undefined' && window.nativeStorage && window.nativeStorage.updateItems) {
      await window.nativeStorage.updateItems({
        [IMAGE_KEY]: null,
        [LEGACY_IMAGE_KEY]: null
      });
    }
  } catch {}

  try {
    const db = await openDB();
    await new Promise((resolve) => {
      const tx = db.transaction(IMAGE_STORE, 'readwrite');
      const store = tx.objectStore(IMAGE_STORE);
      const req = store.delete(LEGACY_IMAGE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {}
}
