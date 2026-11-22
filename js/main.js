/**
 * Александр Песковский — портфолио
 * Точка входа: этапы с работами из js/projects-data.js, UI плееров и связка с 3D-сценой
 */

import { initSubwayScene, scrollToStage, toggleGlobalSound, getStageVideo, resetScreenZoom, toggleScreenZoom, getActiveStage, toggleFreeRoam, isFreeRoamActive } from './scene3d.js';
import { playNavTick } from './subwayAudio.js';
import { WORKS, CONTACT_STAGE, LEGACY_HASHES, stageSlug } from './projects-data.js';

function startApp() {
  // Доступ для отладки и автоматических проверок
  window.scrollToStage = scrollToStage;
  window.getActiveStage = getActiveStage;
  window.toggleFreeRoam = toggleFreeRoam;
  window.isFreeRoamActive = isFreeRoamActive;

  // 0. Этапы с работами и источники видео создаются из данных до старта сцены
  renderWorks();

  // 1. 3D-сцена (кадр 0 рендерится сразу)
  initSubwayScene();

  initNavigation();
  initFreeRoamNavigation();
  initPlayerControls();
  initWorkViewer();
  initKeyboardShortcuts();
  initServiceWorker();
  initHashRouting();
}

const isViewerOpen = () => document.body.classList.contains('viewer-open');

// =============================================================================
// ЭТАПЫ С РАБОТАМИ (ИЗ js/projects-data.js)
// =============================================================================
const ICON_PLAY = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg>';
const ICON_PAUSE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect></svg>';
const ICON_MUTED = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>';
const ICON_EXPAND = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>';

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else node.setAttribute(key, value);
  });
  children.filter(Boolean).forEach((child) => node.appendChild(child));
  return node;
}

function renderWorks() {
  const story = document.getElementById('scroll-story');
  const contact = document.getElementById('stage-contacts');
  const videoSources = document.getElementById('video-texture-sources');

  WORKS.forEach((work, i) => {
    const stage = i + 1;

    // Скрытый источник превью для текстуры экрана в вагоне
    videoSources.appendChild(el('video', {
      id: `video-stage-${stage}`, src: work.preview, playsinline: '', 'webkit-playsinline': '',
      loop: '', muted: '', preload: stage === 1 ? 'metadata' : 'none', crossorigin: 'anonymous'
    }));

    const titleCapsule = el('div', { class: 'glass-capsule title-capsule' }, [
      el('span', { class: 'hud-category-label', text: work.category }),
      el('span', { class: 'hud-item-title', text: work.title }),
      work.badge ? el('span', { class: 'hud-badge', text: work.badge }) : null
    ]);

    const playerCapsule = el('div', { class: 'glass-capsule player-capsule' }, [
      el('button', { class: 'player-icon-btn play-pause-btn', id: `play-btn-stage${stage}`, type: 'button', 'aria-label': 'Воспроизвести / пауза', title: 'Воспроизвести / пауза', html: ICON_PLAY }),
      el('div', { class: 'timeline-scrubber-wrap', id: `timeline-wrap-stage${stage}`, title: 'Перемотка' }, [
        el('div', { class: 'timeline-bar-bg' }, [el('div', { class: 'timeline-bar-fill', id: `timeline-progress-stage${stage}` })])
      ]),
      el('button', { class: 'player-icon-btn sound-toggle-btn', type: 'button', 'aria-label': 'Переключить звук', title: 'Включить / выключить звук' }, [
        el('span', { class: 'sound-btn-icon', html: ICON_MUTED })
      ]),
      work.full ? el('button', { class: 'watch-full-btn', type: 'button', 'data-work': String(i), 'aria-label': `Смотреть «${work.title}» полностью` }, [
        el('span', { class: 'watch-full-icon', html: ICON_EXPAND }),
        el('span', { class: 'watch-full-label', text: 'Смотреть полностью' })
      ]) : null
    ]);

    const section = el('section', { class: 'story-stage stage-video', id: `stage-${stage}`, 'data-stage-index': String(stage) }, [
      el('div', { class: 'stage-container' }, [
        el('div', { class: 'floating-hud-top' }, [titleCapsule]),
        el('div', { class: 'floating-hud-bottom' }, [playerCapsule])
      ])
    ]);
    story.insertBefore(section, contact);
  });

  contact.id = `stage-${CONTACT_STAGE}`;
  contact.dataset.stageIndex = String(CONTACT_STAGE);
}

// =============================================================================
// НАВИГАЦИЯ ПО ЭТАПАМ
// =============================================================================
function initNavigation() {
  // Горизонтальные свайпы на смартфонах (только в сюжетном режиме)
  let touchStartX = 0, touchStartY = 0;
  window.addEventListener('touchstart', (e) => {
    if (document.body.classList.contains('is-free-roam') || isViewerOpen()) return;
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  }, { passive: true });

  window.addEventListener('touchend', (e) => {
    if (document.body.classList.contains('is-free-roam') || isViewerOpen()) return;
    if (e.changedTouches.length === 1) {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        const cur = getActiveStage();
        if (dx < 0 && cur < CONTACT_STAGE) {
          playNavTick();
          scrollToStage(cur + 1);
        } else if (dx > 0 && cur > 0) {
          playNavTick();
          scrollToStage(cur - 1);
        }
      }
    }
  }, { passive: true });

  // Кнопка быстрого пропуска спуска в прелоадере
  const skipBtn = document.getElementById('preloader-skip-btn');
  if (skipBtn) {
    skipBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.skipDescent) window.skipDescent();
    });
  }
}

// =============================================================================
// РЕЖИМЫ: ПРОЕКТЫ / FREE ROOM
// =============================================================================
function initFreeRoamNavigation() {
  const storyTab = document.getElementById('mode-story-tab');
  const freeRoamTab = document.getElementById('mode-freeroam-tab');

  if (storyTab) {
    storyTab.addEventListener('click', (e) => {
      e.preventDefault();
      playNavTick();
      toggleFreeRoam(false);
    });
  }

  if (freeRoamTab) {
    freeRoamTab.addEventListener('click', (e) => {
      e.preventDefault();
      playNavTick();
      toggleFreeRoam(true);
    });
  }
}

// =============================================================================
// ПЛЕЕРЫ ЭКРАНОВ (КНОПКИ, СКРУББЕРЫ, ЗВУК)
// =============================================================================
function initPlayerControls() {
  document.querySelectorAll('.sound-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleGlobalSound();
    });
  });

  // Один общий обработчик перемотки пальцем для всех скрубберов
  let scrubbing = null;
  window.addEventListener('touchmove', (e) => {
    if (scrubbing && e.touches && e.touches[0]) scrubbing(e.touches[0].clientX);
  }, { passive: true });
  window.addEventListener('touchend', () => { scrubbing = null; });

  WORKS.forEach((_, i) => {
    const stage = i + 1;
    const video = document.getElementById(`video-stage-${stage}`);
    const playBtn = document.getElementById(`play-btn-stage${stage}`);
    const timelineWrap = document.getElementById(`timeline-wrap-stage${stage}`);
    const progressEl = document.getElementById(`timeline-progress-stage${stage}`);

    playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (video.paused) video.play().catch(() => {});
      else video.pause();
    });
    video.addEventListener('play', () => { playBtn.innerHTML = ICON_PAUSE; });
    video.addEventListener('pause', () => { playBtn.innerHTML = ICON_PLAY; });

    const seek = (clientX) => {
      if (!video.duration) return;
      const rect = timelineWrap.getBoundingClientRect();
      const pct = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
      video.currentTime = pct * video.duration;
      progressEl.style.width = `${pct * 100}%`;
    };
    timelineWrap.addEventListener('click', (e) => {
      e.stopPropagation();
      seek(e.clientX);
    });
    timelineWrap.addEventListener('touchstart', (e) => {
      e.stopPropagation();
      if (e.touches && e.touches[0]) {
        scrubbing = seek;
        seek(e.touches[0].clientX);
      }
    }, { passive: false });
  });
}

// =============================================================================
// ПОЛНОЭКРАННЫЙ ПРОСМОТР ПОЛНОЙ ВЕРСИИ РАБОТЫ
// =============================================================================
function initWorkViewer() {
  const viewer = document.getElementById('work-viewer');
  const video = document.getElementById('work-viewer-video');
  const titleEl = document.getElementById('work-viewer-title');
  const categoryEl = document.getElementById('work-viewer-category');
  const metaEl = document.getElementById('work-viewer-meta');
  const closeBtn = viewer.querySelector('.work-viewer-close');
  let returnFocus = null;
  let pausedPreview = null;

  const open = (index, trigger) => {
    const work = WORKS[index];
    if (!work || !work.full) return;
    returnFocus = trigger || null;

    titleEl.textContent = work.title;
    categoryEl.textContent = work.category;
    const meta = [work.year, work.role, work.client, work.badge].filter(Boolean).join(' · ');
    metaEl.textContent = meta;
    metaEl.hidden = !meta;

    if (video.dataset.src !== work.full) {
      video.dataset.src = work.full;
      video.src = work.full;
      if (work.poster) video.poster = work.poster;
      else video.removeAttribute('poster');
    }

    // Превью на экране вагона ставим на паузу, пока смотрят полную версию
    pausedPreview = getStageVideo(index + 1);
    if (pausedPreview && !pausedPreview.paused) pausedPreview.pause();
    else pausedPreview = null;

    viewer.hidden = false;
    viewer.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('viewer-open');
    document.body.classList.add('viewer-open');
    requestAnimationFrame(() => viewer.classList.add('open'));
    video.muted = false;
    video.play().catch(() => {});
    closeBtn.focus({ preventScroll: true });
  };

  const close = () => {
    if (!isViewerOpen()) return;
    video.pause();
    viewer.classList.remove('open');
    viewer.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('viewer-open');
    document.body.classList.remove('viewer-open');
    setTimeout(() => { if (!isViewerOpen()) viewer.hidden = true; }, 300);
    if (pausedPreview) pausedPreview.play().catch(() => {});
    pausedPreview = null;
    if (returnFocus) returnFocus.focus({ preventScroll: true });
  };

  document.querySelectorAll('.watch-full-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      open(parseInt(btn.dataset.work, 10), btn);
    });
  });
  viewer.querySelectorAll('[data-viewer-close]').forEach((node) => node.addEventListener('click', close));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isViewerOpen()) {
      e.preventDefault();
      close();
    }
  });
}

// =============================================================================
// ГОРЯЧИЕ КЛАВИШИ
// =============================================================================
function initKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    if (['input', 'textarea'].includes(document.activeElement?.tagName?.toLowerCase())) return;
    // Пока открыт полный плеер, клавиши управляют им (стандартные контролы видео)
    if (isViewerOpen()) return;
    // В режиме Free Room стрелки и цифры управляют ходьбой, а не этапами
    if (isFreeRoamActive()) return;

    const cur = getActiveStage();
    const onWork = cur >= 1 && cur <= WORKS.length;

    if (e.code === 'Escape') {
      resetScreenZoom();
    } else if (e.code === 'KeyZ') {
      e.preventDefault();
      toggleScreenZoom();
    } else if (e.code === 'KeyM') {
      e.preventDefault();
      toggleGlobalSound();
    } else if (e.code === 'KeyF' && onWork) {
      e.preventDefault();
      toggleScreenZoom();
    } else if (e.code === 'Enter' && onWork && WORKS[cur - 1].full) {
      e.preventDefault();
      document.querySelector(`.watch-full-btn[data-work="${cur - 1}"]`)?.click();
    } else if (e.code === 'Space' && onWork) {
      e.preventDefault();
      const v = getStageVideo(cur);
      if (v) {
        if (v.paused) v.play().catch(() => {});
        else v.pause();
      }
    } else if ((e.code === 'ArrowRight' || e.code === 'ArrowDown') && cur < CONTACT_STAGE) {
      e.preventDefault();
      playNavTick();
      scrollToStage(cur + 1);
    } else if ((e.code === 'ArrowLeft' || e.code === 'ArrowUp') && cur > 0) {
      e.preventDefault();
      playNavTick();
      scrollToStage(cur - 1);
    } else if (e.code.startsWith('Digit')) {
      const num = parseInt(e.code.replace('Digit', ''), 10);
      if (num >= 0 && num <= CONTACT_STAGE) {
        playNavTick();
        scrollToStage(num);
      }
    }
  });
}

// =============================================================================
// ОЧИСТКА УСТАРЕВШЕГО SERVICE WORKER
// =============================================================================
function initServiceWorker() {
  // Service Worker больше не используется: снимаем старые регистрации и кэши у вернувшихся посетителей
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((reg) => reg.unregister())).catch(() => {});
  }
  if ('caches' in window) {
    caches.keys().then((keys) => keys.forEach((key) => caches.delete(key))).catch(() => {});
  }
}

// =============================================================================
// ПРЯМЫЕ ССЫЛКИ НА ЭТАПЫ (#slug)
// =============================================================================
function buildHashMap() {
  const map = {};
  for (let stage = 0; stage <= CONTACT_STAGE; stage++) {
    map[`#${stageSlug(stage)}`] = stage;
    map[`#stage-${stage}`] = stage;
  }
  Object.entries(LEGACY_HASHES).forEach(([slug, stage]) => {
    if (!(`#${slug}` in map)) map[`#${slug}`] = stage;
  });
  return map;
}

function initHashRouting() {
  const hashMap = buildHashMap();
  const applyHash = () => {
    const hash = window.location.hash.toLowerCase();
    if (hash && hashMap[hash] !== undefined) scrollToStage(hashMap[hash]);
  };

  // При первом входе переходим к этапу из ссылки, когда закончился спуск и включилась прокрутка
  window.addEventListener('descent-finished', () => requestAnimationFrame(applyHash), { once: true });

  window.addEventListener('hashchange', applyHash);
}

// Запуск после объявления всех констант модуля
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}
