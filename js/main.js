/**
 * Александр Песковский — 2026
 * Основная точка входа: UI логика и связка с 3D сценой
 */

import { initSubwayScene, scrollToStage, toggleGlobalSound, getVideos, resetScreenZoom, toggleScreenZoom, getActiveStage, toggleFreeRoam, isFreeRoamActive } from './scene3d.js';
import { playNavTick } from './subwayAudio.js';

function startApp() {
  // Expose methods for testing, automation, and external controls
  window.scrollToStage = scrollToStage;
  window.getActiveStage = getActiveStage;
  window.toggleFreeRoam = toggleFreeRoam;
  window.isFreeRoamActive = isFreeRoamActive;

  // 1. Немедленная инициализация 3D сцены метро (кадр 0 рендерится мгновенно)
  initSubwayScene();

  // 2. Инициализация навигации по этапам
  initNavigation();

  // 2.1 Инициализация переключения режимов (Проекты / Free Roam)
  initFreeRoamNavigation();

  // 3. Инициализация контролов плеера для обоих экранов
  initPlayerControls();

  // 4. Горячие клавиши
  initKeyboardShortcuts();

  // 5. Схема линии метро (клик по схеме на станции)
  initMapModal();

  // 6. Снятие устаревшего Service Worker
  initServiceWorker();

  // 7. Обработка прямых ссылок (URL Hash Routing)
  initHashRouting();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}

// =============================================================================
// НАВИГАЦИЯ ПО СЕКЦИЯМ
// =============================================================================
function initNavigation() {
  // Горизонтальные свайпы на смартфонах для быстрого переключения этапов (только в сюжетном режиме)
  let touchStartX = 0, touchStartY = 0;
  window.addEventListener('touchstart', (e) => {
    if (document.body.classList.contains('is-free-roam')) return;
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  }, { passive: true });

  window.addEventListener('touchend', (e) => {
    if (document.body.classList.contains('is-free-roam')) return;
    if (e.changedTouches.length === 1) {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        const cur = getActiveStage();
        if (dx < 0 && cur < 5) {
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
// НАВИГАЦИЯ МЕЖДУ РЕЖИМАМИ (ПРОЕКТЫ / FREE ROAM)
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
// УПРАВЛЕНИЕ ПЛЕЕРАМИ (КНОПКИ, СКРУББЕРЫ, ЗВУК)
// =============================================================================
function initPlayerControls() {
  const { video1, video2, video3, video4 } = getVideos();

  // Кнопки глобального переключения звука
  const globalSoundBtns = document.querySelectorAll('.sound-toggle-btn');
  globalSoundBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleGlobalSound();
    });
  });

  // ЭКРАН 1: Свэг
  setupStagePlayer(1, video1);

  // ЭКРАН 2: Мини свэг
  setupStagePlayer(2, video2);

  // ЭКРАН 3: Ночной тоннель
  setupStagePlayer(3, video3);

  // ЭКРАН 4: Индустрия
  setupStagePlayer(4, video4);
}

function setupStagePlayer(stageIndex, videoEl) {
  const playBtn = document.getElementById(`play-btn-stage${stageIndex}`);
  const timelineWrap = document.getElementById(`timeline-wrap-stage${stageIndex}`);
  const progressEl = document.getElementById(`timeline-progress-stage${stageIndex}`);

  const getVideo = () => {
    const videos = getVideos();
    return stageIndex === 1 ? videos.video1 : (stageIndex === 2 ? videos.video2 : (stageIndex === 3 ? videos.video3 : videos.video4));
  };

  // Play / Pause с надежной обработкой промиса и синхронизацией
  if (playBtn) {
    playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const v = getVideo();
      if (!v) return;

      if (v.paused) {
        v.play().then(() => updatePlayIcon(playBtn, false)).catch(() => {});
      } else {
        v.pause();
        updatePlayIcon(playBtn, true);
      }
    });
  }

  // Привязка событий видео (play, pause) для обновления иконки кнопки
  const v = getVideo();
  if (v) {
    v.addEventListener('play', () => {
      if (playBtn) updatePlayIcon(playBtn, false);
    });
    v.addEventListener('pause', () => {
      if (playBtn) updatePlayIcon(playBtn, true);
    });
  }

  // Скруббер (клик и плавная перемотка пальцем / курсором)
  if (timelineWrap) {
    let isScrubbing = false;

    const handleSeek = (clientX) => {
      const v = getVideo();
      if (!v || !v.duration) return;

      const rect = timelineWrap.getBoundingClientRect();
      const pct = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
      v.currentTime = pct * v.duration;
      if (progressEl) {
        progressEl.style.width = `${pct * 100}%`;
      }
    };

    timelineWrap.addEventListener('click', (e) => {
      e.stopPropagation();
      handleSeek(e.clientX);
    });

    timelineWrap.addEventListener('touchstart', (e) => {
      e.stopPropagation();
      if (e.touches && e.touches[0]) {
        isScrubbing = true;
        handleSeek(e.touches[0].clientX);
      }
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (isScrubbing && e.touches && e.touches[0]) {
        handleSeek(e.touches[0].clientX);
      }
    }, { passive: true });

    window.addEventListener('touchend', () => {
      isScrubbing = false;
    });
  }

}

function updatePlayIcon(button, isPaused) {
  if (!button) return;
  button.innerHTML = isPaused
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg>`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect></svg>`;
}

// =============================================================================
// ГОРЯЧИЕ КЛАВИШИ (SPACE - PLAY/PAUSE, M - MUTE)
// =============================================================================
function initKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    // Не перехватывать при вводе в текстовые поля
    if (['input', 'textarea'].includes(document.activeElement?.tagName?.toLowerCase())) return;
    // В режиме Free Room стрелки и цифры управляют ходьбой, а не этапами
    if (isFreeRoamActive()) return;

    if (e.code === 'Escape') {
      resetScreenZoom();
    } else if (e.code === 'KeyZ') {
      e.preventDefault();
      toggleScreenZoom();
    } else if (e.code === 'KeyM') {
      e.preventDefault();
      toggleGlobalSound();
    } else if (e.code === 'KeyF') {
      const cur = getActiveStage();
      if (cur >= 1 && cur <= 4) {
        e.preventDefault();
        toggleScreenZoom();
      }
    } else if (e.code === 'Space') {
      const cur = getActiveStage();
      if (cur >= 1 && cur <= 4) {
        e.preventDefault();
        const videos = getVideos();
        const v = cur === 1 ? videos.video1 : (cur === 2 ? videos.video2 : (cur === 3 ? videos.video3 : videos.video4));
        if (v) {
          if (v.paused) v.play().catch(() => {});
          else v.pause();
        }
      }
    } else if (e.code === 'ArrowRight' || e.code === 'ArrowDown') {
      const cur = getActiveStage();
      if (cur < 5) {
        e.preventDefault();
        playNavTick();
        scrollToStage(cur + 1);
      }
    } else if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') {
      const cur = getActiveStage();
      if (cur > 0) {
        e.preventDefault();
        playNavTick();
        scrollToStage(cur - 1);
      }
    } else if (e.code.startsWith('Digit')) {
      const num = parseInt(e.code.replace('Digit', ''), 10);
      if (num >= 0 && num <= 5) {
        playNavTick();
        scrollToStage(num);
      }
    }
  });
}

// =============================================================================
// СХЕМА ЛИНИИ МЕТРО (ВЫЗЫВАЕТСЯ КЛИКОМ ПО СХЕМЕ НА СТЕНЕ СТАНЦИИ)
// =============================================================================
function initMapModal() {
  const mapModal = document.getElementById('map-modal');
  if (!mapModal) return;
  const mapCloseBtn = document.getElementById('map-modal-close-btn');
  const mapBackdrop = document.getElementById('map-modal-backdrop');

  const closeMap = () => {
    mapModal.classList.remove('open');
    mapModal.setAttribute('aria-hidden', 'true');
  };
  if (mapCloseBtn) mapCloseBtn.addEventListener('click', closeMap);
  if (mapBackdrop) mapBackdrop.addEventListener('click', closeMap);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mapModal.classList.contains('open')) closeMap();
  });

  window.addEventListener('open-map-modal', () => {
    mapModal.classList.add('open');
    mapModal.setAttribute('aria-hidden', 'false');
  });

  mapModal.querySelectorAll('.map-station-node').forEach((node) => {
    node.addEventListener('click', () => {
      const stage = parseInt(node.dataset.gotoStage, 10);
      playNavTick();
      closeMap();
      scrollToStage(stage);
    });
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
// ОБРАБОТКА ПРЯМЫХ ССЫЛОК (URL HASH ROUTING)
// =============================================================================
const HASH_MAP = {
  '#intro': 0, '#stage-0': 0,
  '#swag': 1, '#stage-1': 1, '#project-01': 1,
  '#mini-swag': 2, '#stage-2': 2, '#project-02': 2,
  '#03': 3, '#stage-3': 3, '#project-03': 3, '#tunnel': 3,
  '#04': 4, '#stage-4': 4, '#project-04': 4, '#industry': 4,
  '#contacts': 5, '#stage-5': 5, '#stage-9': 5
};

function initHashRouting() {
  const applyHash = () => {
    const hash = window.location.hash.toLowerCase();
    if (hash && HASH_MAP[hash] !== undefined) {
      const targetStage = HASH_MAP[hash];
      scrollToStage(targetStage);
    }
  };

  // Проверка при первом входе после скрытия прелоадера
  window.addEventListener('load', () => {
    setTimeout(applyHash, 650);
  });

  window.addEventListener('hashchange', applyHash);
}
