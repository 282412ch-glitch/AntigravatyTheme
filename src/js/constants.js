/** Package id and storage keys matching dsh-frosted-window */
export const PACKAGE_ID = 'dsh-frosted-window';
export const BODY_ATTR = 'data-dsh-frosted-window';
export const KNOBS_KEY = 'dsh-frosted-window:knobs';
export const IMAGE_DB = 'dsh-frosted-window';
export const IMAGE_STORE = 'files';
export const IMAGE_KEY = 'dsh-frosted-window:wallpaper';
export const LEGACY_IMAGE_KEY = 'wallpaper';
export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
// Keep the renderer responsive and avoid overflowing nativeStorage with an
// image that is too large to persist reliably. Data URLs are larger than the
// original file, so this limit intentionally leaves headroom for encoding.
export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
