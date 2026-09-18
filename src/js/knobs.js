import { KNOBS_KEY } from './constants.js';

export const DEFAULT_KNOBS = {
  enabled: true,
  glassOpacity: 0.46,
  blurPx: 28,
  saturate: 1.55,
  dim: 0.28,
};

const RANGES = {
  glassOpacity: [0.18, 0.82],
  blurPx: [8, 64],
  saturate: [1, 2],
  dim: [0, 0.65],
};

export function clampKnob(key, value) {
  const [min, max] = RANGES[key];
  if (!Number.isFinite(value)) return DEFAULT_KNOBS[key];
  return Math.min(max, Math.max(min, value));
}

export function normalizeKnobs(raw) {
  const input = raw !== null && typeof raw === 'object' ? raw : {};
  return {
    enabled: input.enabled !== false,
    glassOpacity: clampKnob('glassOpacity', Number(input.glassOpacity)),
    blurPx: clampKnob('blurPx', Number(input.blurPx)),
    saturate: clampKnob('saturate', Number(input.saturate)),
    dim: clampKnob('dim', Number(input.dim)),
  };
}

export function loadKnobs() {
  try {
    const raw = localStorage.getItem(KNOBS_KEY);
    if (raw === null) return { ...DEFAULT_KNOBS };
    return normalizeKnobs(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_KNOBS };
  }
}

export async function loadKnobsAsync() {
  try {
    if (typeof window !== 'undefined' && window.nativeStorage && window.nativeStorage.getItems) {
      const items = await window.nativeStorage.getItems();
      if (items && items[KNOBS_KEY]) {
        const parsed = typeof items[KNOBS_KEY] === 'string' ? JSON.parse(items[KNOBS_KEY]) : items[KNOBS_KEY];
        const normalized = normalizeKnobs(parsed);
        try {
          localStorage.setItem(KNOBS_KEY, JSON.stringify(normalized));
        } catch {}
        return normalized;
      }
    }
  } catch (e) {
    console.warn('[FrostedWindow] nativeStorage load error:', e);
  }
  const fallback = loadKnobs();
  saveKnobs(fallback);
  return fallback;
}

export function saveKnobs(knobs) {
  const normalized = normalizeKnobs(knobs);
  try {
    localStorage.setItem(KNOBS_KEY, JSON.stringify(normalized));
  } catch {}
  if (typeof window !== 'undefined' && window.nativeStorage && window.nativeStorage.updateItems) {
    window.nativeStorage.updateItems({ [KNOBS_KEY]: JSON.stringify(normalized) }).catch(() => {});
  }
}
