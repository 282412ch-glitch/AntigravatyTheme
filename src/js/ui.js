/** Settings surface for the Antigravity frosted theme. */

import { DEFAULT_KNOBS, loadKnobs, loadKnobsAsync, saveKnobs } from './knobs.js';
import { getImage, putImage, clearImage, DEFAULT_WALLPAPER } from './image-store.js';
import { ALLOWED_TYPES, MAX_IMAGE_BYTES } from './constants.js';
import { applySurface } from './wallpaper.js';

function isImageDataUrl(value) {
  return typeof value === 'string' && /^data:image\/(?:jpeg|png|webp|gif);base64,/i.test(value);
}

function isSupportedImage(file) {
  if (!file) return false;
  if (ALLOWED_TYPES.includes(file.type)) return true;
  return /\.(?:jpe?g|png|webp|gif)$/i.test(file.name || '');
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function createSettingsModal(initialKnobs = null, initialImageRecord = null) {
  if (typeof window !== 'undefined') {
    window.__fwModalCleanup?.();
    window.__fwModalCleanup = null;
  }
  if (document.getElementById('fw-modal-backdrop')) return;

  const knobs = initialKnobs || loadKnobs();
  let liveKnobs = { ...knobs };
  let isDirty = false;
  let imageDirty = false;
  let imageSelectionStarted = false;
  let autoSaveTimer = null;
  let statusTimer = null;
  let isPersisting = false;
  let lastFocusedElement = null;
  let imageReadToken = 0;
  let changeVersion = 0;
  let persistChain = Promise.resolve();
  let pendingFlushTask = null;
  const safeInitialImage = initialImageRecord && isImageDataUrl(initialImageRecord.data) ? initialImageRecord : null;
  let currentImageUrl = safeInitialImage?.data || DEFAULT_WALLPAPER;
  let currentFileName = safeInitialImage?.name || (safeInitialImage ? 'custom_wallpaper' : 'anime_scenery.jpg');
  let currentDimensions = safeInitialImage?.dimensions || '1920×1080';

  // Ensure transparent window control overlay
  if (typeof window !== 'undefined' && window.electronNative && window.electronNative.setTitleBarOverlay) {
    window.electronNative.setTitleBarOverlay({ color: '#00000000', height: 30 }).catch(() => {});
  }

  // 1. Compact quick trigger
  const quickTrigger = document.createElement('button');
  quickTrigger.id = 'fw-quick-trigger';
  quickTrigger.type = 'button';
  quickTrigger.title = '打开磨砂主题设置（Alt+F）';
  quickTrigger.setAttribute('aria-label', '打开磨砂主题设置');
  quickTrigger.setAttribute('data-tooltip', '磨砂主题 · Alt+F');
  quickTrigger.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="1" x2="7" y1="14" y2="14"/><line x1="9" x2="15" y1="8" y2="8"/><line x1="17" x2="23" y1="16" y2="16"/>
    </svg>
  `;
  document.body.appendChild(quickTrigger);

  // 2. Full Settings Modal Window (Two-column layout)
  const backdrop = document.createElement('div');
  backdrop.id = 'fw-modal-backdrop';
  backdrop.innerHTML = `
    <div id="fw-modal-window" role="dialog" aria-modal="true" aria-labelledby="fw-modal-title">
      <!-- Main Content Pane -->
      <div class="fw-modal-content">
        <!-- Top controls bar -->
        <div class="fw-modal-topbar">
          <div class="fw-modal-top-title">
            <span class="fw-brand-mark" aria-hidden="true">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10c0-1.1-.9-2-2-2h-1.8a2 2 0 0 1-1.7-3l.5-.9A2.7 2.7 0 0 0 14.7 2H12Z"/><circle cx="7.5" cy="10.5" r=".7" fill="currentColor"/><circle cx="10.5" cy="6.5" r=".7" fill="currentColor"/><circle cx="15.5" cy="6.5" r=".7" fill="currentColor"/></svg>
            </span>
            <span class="fw-brand-copy">
              <strong id="fw-modal-title">磨砂主题</strong>
              <small>壁纸与窗口材质</small>
            </span>
          </div>
          <div class="fw-modal-top-actions">
            <span class="fw-chip" id="fw-chip-status" role="status" aria-live="polite">已保存</span>
            <button type="button" class="fw-top-btn" id="fw-btn-open-config" aria-label="查看存储说明" title="查看存储说明">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 14 8.5 9h9.8a2 2 0 0 1 1.8 2.9l-3.1 6A2 2 0 0 1 15.2 19H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.2a2 2 0 0 1 1.4.6L11 5h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
            <button type="button" class="fw-close-btn" id="fw-btn-close" aria-label="关闭磨砂主题设置" title="关闭">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        <div class="fw-section">
          <div class="fw-panel">
            <!-- Intro and enable switch -->
            <div class="fw-head">
              <div class="fw-lead">
                <div class="fw-title">玻璃材质</div>
                <div class="fw-desc">壁纸铺满窗口，界面材质跟随浅色或深色外观。</div>
              </div>
              <label class="fw-switch">
                <span class="fw-switch-copy"><strong>启用</strong><small>即时应用</small></span>
                <input type="checkbox" id="fw-switch-enabled" aria-label="启用磨砂主题">
              </label>
            </div>

            <!-- Hero Image Preview -->
            <button type="button" class="fw-hero" id="fw-hero-card" aria-describedby="fw-hero-copy-desc">
              <img id="fw-hero-preview-img" src="" alt="当前壁纸预览">
              <span class="fw-hero-scrim" aria-hidden="true"></span>
              <span class="fw-hero-glass" id="fw-hero-glass-badge"><span>玻璃效果</span></span>
              <div class="fw-hero-copy">
                <strong id="fw-hero-copy-title">选择壁纸</strong>
                <span id="fw-hero-copy-desc"></span>
              </div>
              <span class="fw-hero-pick" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/></svg>
              </span>
            </button>
            <input type="file" id="fw-file-uploader" class="fw-hidden" accept="image/jpeg,image/png,image/webp,image/gif">

            <!-- 2x2 Grid of Sliders -->
            <div class="fw-controls-head">
              <strong>材质参数</strong>
              <button type="button" class="fw-inline-btn" id="fw-btn-reset-controls">恢复默认参数</button>
            </div>
            <div class="fw-grid">
              <!-- 玻璃浓度 -->
              <label class="fw-row">
                <div class="fw-row-head">
                  <span>玻璃浓度</span>
                  <span id="fw-label-glass">46%</span>
                </div>
                <input type="range" id="fw-slider-glass" min="0.18" max="0.82" step="0.01">
              </label>

              <!-- 磨砂模糊 -->
              <label class="fw-row">
                <div class="fw-row-head">
                  <span>磨砂模糊</span>
                  <span id="fw-label-blur">28px</span>
                </div>
                <input type="range" id="fw-slider-blur" min="8" max="64" step="1">
              </label>

              <!-- 色彩饱和 -->
              <label class="fw-row">
                <div class="fw-row-head">
                  <span>色彩饱和</span>
                  <span id="fw-label-saturate">155%</span>
                </div>
                <input type="range" id="fw-slider-saturate" min="1" max="2" step="0.01">
              </label>

              <!-- 壁纸压暗 -->
              <label class="fw-row">
                <div class="fw-row-head">
                  <span>壁纸压暗</span>
                  <span id="fw-label-dim">28%</span>
                </div>
                <input type="range" id="fw-slider-dim" min="0" max="0.65" step="0.01">
              </label>
            </div>

            <!-- Action Buttons Bar -->
            <div class="fw-bar">
              <button type="button" class="fw-btn" data-kind="quiet" id="fw-btn-delete">恢复默认</button>
              <button type="button" class="fw-btn" id="fw-btn-pick">更换壁纸</button>
              <button type="button" class="fw-btn" data-kind="primary" id="fw-btn-save" disabled>保存更改</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  backdrop.setAttribute('aria-hidden', 'true');
  document.body.appendChild(backdrop);

  // Element handles
  const switchEnabled = document.getElementById('fw-switch-enabled');
  const sliderGlass = document.getElementById('fw-slider-glass');
  const sliderBlur = document.getElementById('fw-slider-blur');
  const sliderSaturate = document.getElementById('fw-slider-saturate');
  const sliderDim = document.getElementById('fw-slider-dim');

  const labelGlass = document.getElementById('fw-label-glass');
  const labelBlur = document.getElementById('fw-label-blur');
  const labelSaturate = document.getElementById('fw-label-saturate');
  const labelDim = document.getElementById('fw-label-dim');

  const chipStatus = document.getElementById('fw-chip-status');
  const btnSave = document.getElementById('fw-btn-save');
  const btnDelete = document.getElementById('fw-btn-delete');
  const btnPick = document.getElementById('fw-btn-pick');
  const heroCard = document.getElementById('fw-hero-card');
  const heroGlassBadge = document.getElementById('fw-hero-glass-badge');
  const heroImg = document.getElementById('fw-hero-preview-img');
  const fileUploader = document.getElementById('fw-file-uploader');
  const btnClose = document.getElementById('fw-btn-close');
  const btnOpenConfig = document.getElementById('fw-btn-open-config');
  const btnResetControls = document.getElementById('fw-btn-reset-controls');
  const heroCopyDesc = document.getElementById('fw-hero-copy-desc');
  heroImg.src = currentImageUrl;
  heroCopyDesc.textContent = `${currentFileName} · ${currentDimensions}`;
  const statusNote = document.createElement('p');
  statusNote.id = 'fw-status-note';
  statusNote.className = 'fw-status-note';
  statusNote.setAttribute('role', 'status');
  statusNote.setAttribute('aria-live', 'polite');
  document.querySelector('.fw-bar')?.before(statusNote);

  function setStatus(message, tone = '') {
    clearTimeout(statusTimer);
    statusNote.textContent = message || '';
    statusNote.dataset.tone = tone;
    if (message) {
      statusTimer = setTimeout(() => {
        statusNote.textContent = '';
        statusNote.removeAttribute('data-tone');
      }, 3200);
    }
  }

  function setRangeProgress(input) {
    const min = Number(input.min);
    const max = Number(input.max);
    const value = Number(input.value);
    const progress = max > min ? ((value - min) / (max - min)) * 100 : 0;
    input.style.setProperty('--fw-range-progress', `${Math.max(0, Math.min(100, progress))}%`);
  }

  // Sync state to UI
  function syncUI() {
    switchEnabled.checked = liveKnobs.enabled;

    sliderGlass.value = liveKnobs.glassOpacity;
    labelGlass.textContent = `${Math.round(liveKnobs.glassOpacity * 100)}%`;
    sliderGlass.setAttribute('aria-valuetext', `${Math.round(liveKnobs.glassOpacity * 100)}%`);
    setRangeProgress(sliderGlass);

    sliderBlur.value = liveKnobs.blurPx;
    labelBlur.textContent = `${Math.round(liveKnobs.blurPx)}px`;
    sliderBlur.setAttribute('aria-valuetext', `${Math.round(liveKnobs.blurPx)} 像素`);
    setRangeProgress(sliderBlur);

    sliderSaturate.value = liveKnobs.saturate;
    labelSaturate.textContent = `${Math.round(liveKnobs.saturate * 100)}%`;
    sliderSaturate.setAttribute('aria-valuetext', `${Math.round(liveKnobs.saturate * 100)}%`);
    setRangeProgress(sliderSaturate);

    sliderDim.value = liveKnobs.dim;
    labelDim.textContent = `${Math.round(liveKnobs.dim * 100)}%`;
    sliderDim.setAttribute('aria-valuetext', `${Math.round(liveKnobs.dim * 100)}%`);
    setRangeProgress(sliderDim);

    heroGlassBadge.style.setProperty('--fw-ui-glass', String(liveKnobs.glassOpacity));
    heroGlassBadge.style.setProperty('--fw-ui-blur', `${liveKnobs.blurPx}px`);
    heroGlassBadge.style.setProperty('--fw-ui-sat', `${Math.round(liveKnobs.saturate * 100)}%`);

    if (isDirty) {
      chipStatus.textContent = '未保存';
      chipStatus.setAttribute('data-tone', 'warn');
      if (!isPersisting) btnSave.removeAttribute('disabled');
    } else {
      chipStatus.textContent = '已保存';
      chipStatus.removeAttribute('data-tone');
      btnSave.setAttribute('disabled', 'true');
    }
    if (isPersisting) {
      chipStatus.textContent = '保存中';
      chipStatus.setAttribute('data-tone', 'success');
      btnSave.setAttribute('disabled', 'true');
      btnSave.setAttribute('aria-busy', 'true');
    } else {
      btnSave.removeAttribute('aria-busy');
    }
    quickTrigger.setAttribute('aria-expanded', backdrop.classList.contains('fw-open') ? 'true' : 'false');
  }

  // Initial UI sync
  syncUI();

  function persist(includeImage = imageDirty) {
    const knobsSnapshot = { ...liveKnobs };
    const imageSnapshot = {
      name: currentFileName,
      dimensions: currentDimensions,
      data: currentImageUrl
    };
    const shouldPersistImage = Boolean(includeImage);
    const readToken = imageReadToken;
    const task = persistChain.then(async () => {
      saveKnobs(knobsSnapshot);
      if (shouldPersistImage) {
        await putImage(imageSnapshot);
        if (imageReadToken === readToken && currentImageUrl === imageSnapshot.data) {
          imageDirty = false;
        }
      }
    });
    persistChain = task.catch(() => {});
    return task;
  }

  // Keep live preview responsive while limiting disk writes during slider drags.
  function scheduleAutoSave() {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(async () => {
      const scheduledVersion = changeVersion;
      isPersisting = true;
      syncUI();
      try {
        await persist(imageDirty);
        if (changeVersion === scheduledVersion) isDirty = false;
        if (changeVersion === scheduledVersion) setStatus('已自动保存。', 'success');
        syncUI();
      } catch (error) {
        setStatus('自动保存失败，请重试。', 'error');
        console.warn('[FrostedWindow] Auto-save failed:', error);
      } finally {
        isPersisting = false;
        syncUI();
      }
    }, 400);
  }

  function flushPendingChanges() {
    clearTimeout(autoSaveTimer);
    if (pendingFlushTask) return pendingFlushTask;
    if (!isDirty && !imageDirty) return;
    const scheduledVersion = changeVersion;
    pendingFlushTask = persist(imageDirty).then(() => {
      if (changeVersion === scheduledVersion) {
        isDirty = false;
        imageDirty = false;
      }
    }).catch((error) => {
      console.warn('[FrostedWindow] Pending settings could not be saved:', error);
    }).finally(() => {
      pendingFlushTask = null;
    });
    return pendingFlushTask;
  }

  // Apply live changes immediately
  function updateLive({ imageChanged = false } = {}) {
    if (imageChanged) imageDirty = true;
    changeVersion += 1;
    isDirty = true;
    syncUI();
    applySurface(liveKnobs, currentImageUrl);
    scheduleAutoSave();
  }

  // Restore stored state (knobs + image) asynchronously if not preloaded
  if (!initialKnobs) {
    loadKnobsAsync().then((storedKnobs) => {
      if (changeVersion > 0) return;
      liveKnobs = { ...storedKnobs };
      syncUI();
      applySurface(liveKnobs, currentImageUrl);
    });
  }

  if (!initialImageRecord) {
    getImage().then((stored) => {
      if (imageSelectionStarted || imageDirty) return;
      if (stored && isImageDataUrl(stored.data)) {
        currentImageUrl = stored.data;
        currentFileName = stored.name || 'custom_wallpaper';
        currentDimensions = stored.dimensions || 'Custom';
        heroImg.src = currentImageUrl;
        heroCopyDesc.textContent = `${currentFileName} · ${currentDimensions}`;
      }
      syncUI();
      applySurface(liveKnobs, currentImageUrl);
    }).catch(() => {
      syncUI();
      applySurface(liveKnobs, currentImageUrl);
    });
  }


  // Event Listeners for Sliders (Real-time dragging updates with auto-save!)
  sliderGlass.addEventListener('input', (e) => {
    liveKnobs.glassOpacity = Number(e.target.value);
    updateLive();
  });

  sliderBlur.addEventListener('input', (e) => {
    liveKnobs.blurPx = Number(e.target.value);
    updateLive();
  });

  sliderSaturate.addEventListener('input', (e) => {
    liveKnobs.saturate = Number(e.target.value);
    updateLive();
  });

  sliderDim.addEventListener('input', (e) => {
    liveKnobs.dim = Number(e.target.value);
    updateLive();
  });

  switchEnabled.addEventListener('change', (e) => {
    liveKnobs.enabled = e.target.checked;
    updateLive();
  });

  btnResetControls.addEventListener('click', () => {
    liveKnobs = { ...DEFAULT_KNOBS };
    updateLive();
    setStatus('材质参数已恢复默认，自动保存中。');
  });

  function readImageFile(file) {
    if (!isSupportedImage(file)) {
      setStatus('请选择 JPG、PNG、WebP 或 GIF 图片。', 'error');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setStatus(`图片过大（${formatBytes(file.size)}），请选择 12 MB 以内的图片。`, 'error');
      return;
    }
    imageSelectionStarted = true;
    const readToken = ++imageReadToken;

    const reader = new FileReader();
    reader.onerror = () => setStatus('图片读取失败，请换一张图片。', 'error');
    reader.onload = async (event) => {
      if (readToken !== imageReadToken) return;
      const dataUrl = event.target?.result;
      if (typeof dataUrl !== 'string' || !dataUrl) return;

      currentImageUrl = dataUrl;
      currentFileName = file.name;
      heroImg.src = dataUrl;

      try {
        const dimensions = await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(`${img.naturalWidth}×${img.naturalHeight}`);
          img.onerror = reject;
          img.src = dataUrl;
        });
        currentDimensions = dimensions;
      } catch {
        currentDimensions = '自定义图片';
      }

      heroCopyDesc.textContent = `${currentFileName} · ${currentDimensions}`;
      updateLive({ imageChanged: true });
      setStatus('预览已更新，自动保存中。');
    };
    reader.readAsDataURL(file);
  }

  // Open File Upload
  const triggerPick = () => fileUploader.click();
  btnPick.addEventListener('click', triggerPick);
  heroCard.addEventListener('click', triggerPick);

  fileUploader.addEventListener('change', () => {
    const file = fileUploader.files?.[0];
    readImageFile(file);
    fileUploader.value = '';
  });

  // Save changes explicitly
  btnSave.addEventListener('click', async () => {
    if (isPersisting) return;
    clearTimeout(autoSaveTimer);
    const scheduledVersion = changeVersion;
    isPersisting = true;
    syncUI();
    try {
      await persist(imageDirty);
      if (changeVersion === scheduledVersion) isDirty = false;
      syncUI();
      setStatus(changeVersion === scheduledVersion ? '设置已保存。' : '已保存当前版本，较新的修改仍在处理。', 'success');
      console.log('[FrostedWindow] Settings permanently saved to disk.');
    } catch (error) {
      setStatus('保存失败，请重试。', 'error');
      console.warn('[FrostedWindow] Settings save failed:', error);
    } finally {
      isPersisting = false;
      syncUI();
    }
  });

  // Delete wallpaper
  btnDelete.addEventListener('click', async () => {
    clearTimeout(autoSaveTimer);
    changeVersion += 1;
    imageReadToken += 1;
    persist(false);
    await persistChain;
    await clearImage();
    currentImageUrl = DEFAULT_WALLPAPER;
    currentFileName = 'default_scenery.jpg';
    currentDimensions = '1920×1080';
    heroImg.src = currentImageUrl;
    heroCopyDesc.textContent = `${currentFileName} · ${currentDimensions}`;
    imageDirty = false;
    isDirty = false;
    syncUI();
    applySurface(liveKnobs, currentImageUrl);
    setStatus('已恢复默认壁纸，当前参数已保留。', 'success');
  });

  // Open config info / reveal on disk
  btnOpenConfig.addEventListener('click', () => {
    setStatus('设置会保存到 Antigravity 应用存储，并以 IndexedDB 作为回退。', 'success');
  });

  // Toggle Modal Open/Close
  const setModalOpen = (open) => {
    const wasOpen = backdrop.classList.contains('fw-open');
    if (open === wasOpen) return;

    if (open) {
      lastFocusedElement = document.activeElement;
      backdrop.classList.add('fw-open');
      backdrop.setAttribute('aria-hidden', 'false');
      requestAnimationFrame(() => btnClose.focus());
    } else {
      flushPendingChanges();
      backdrop.classList.remove('fw-open');
      backdrop.setAttribute('aria-hidden', 'true');
      if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
        lastFocusedElement.focus();
      }
      lastFocusedElement = null;
    }
    syncUI();
  };

  const toggleModal = () => setModalOpen(!backdrop.classList.contains('fw-open'));
  const handleKeydown = (e) => {
    if (e.altKey && (e.key === 'f' || e.key === 'F')) {
      toggleModal();
      e.preventDefault();
      return;
    }
    if (!backdrop.classList.contains('fw-open')) return;
    if (e.key === 'Escape') {
      setModalOpen(false);
      e.preventDefault();
      return;
    }
    if (e.key !== 'Tab') return;

    const focusable = Array.from(backdrop.querySelectorAll('button, input:not(.fw-hidden)'))
      .filter((element) => !element.disabled && element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      last.focus();
      e.preventDefault();
    } else if (!e.shiftKey && document.activeElement === last) {
      first.focus();
      e.preventDefault();
    }
  };

  quickTrigger.addEventListener('click', toggleModal);
  btnClose.addEventListener('click', () => setModalOpen(false));
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) setModalOpen(false);
  });

  // Shortcuts: Alt+F to toggle, Esc to close, Tab stays within the dialog.
  window.addEventListener('keydown', handleKeydown);
  if (typeof window !== 'undefined') {
    window.__fwOpenFrostedTheme = () => setModalOpen(true);
  }

  // Drag and drop onto hero card
  heroCard.addEventListener('dragover', (e) => {
    e.preventDefault();
    heroCard.setAttribute('data-over', 'true');
  });
  heroCard.addEventListener('dragleave', (e) => {
    if (!e.relatedTarget || !heroCard.contains(e.relatedTarget)) {
      heroCard.removeAttribute('data-over');
    }
  });
  heroCard.addEventListener('drop', (e) => {
    e.preventDefault();
    heroCard.removeAttribute('data-over');
    const file = e.dataTransfer.files?.[0];
    readImageFile(file);
  });

  const cleanup = () => {
    flushPendingChanges();
    clearTimeout(autoSaveTimer);
    clearTimeout(statusTimer);
    window.removeEventListener('keydown', handleKeydown);
    if (window.__fwOpenFrostedTheme) delete window.__fwOpenFrostedTheme;
    quickTrigger.remove();
    backdrop.remove();
    if (window.__fwModalCleanup === cleanup) window.__fwModalCleanup = null;
  };

  if (typeof window !== 'undefined') window.__fwModalCleanup = cleanup;
  return { cleanup, open: () => setModalOpen(true) };
}
