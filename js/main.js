/**
 * Александр Песковский — 2026
 * Основная точка входа: UI логика и связка с 3D сценой
 */

import { initSubwayScene, scrollToStage, toggleGlobalSound, getVideos } from './scene3d.js';

document.addEventListener('DOMContentLoaded', () => {
  // 1. Инициализация 3D сцены метро
  initSubwayScene();

  // 2. Инициализация навигации по этапам
  initNavigation();

  // 3. Инициализация контролов плеера для обоих экранов
  initPlayerControls();

  // 4. Горячие клавиши
  initKeyboardShortcuts();
});

// =============================================================================
// НАВИГАЦИЯ ПО СЕКЦИЯМ
// =============================================================================
function initNavigation() {
  const navPills = document.querySelectorAll('.stage-nav-pill');
  navPills.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const stage = parseInt(btn.dataset.stage, 10);
      scrollToStage(stage);
    });
  });
}

// =============================================================================
// УПРАВЛЕНИЕ ПЛЕЕРАМИ (КНОПКИ, СКРУББЕРЫ, ЗВУК)
// =============================================================================
function initPlayerControls() {
  const { video1, video2 } = getVideos();

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
}

function setupStagePlayer(stageIndex, videoEl) {
  const playBtn = document.getElementById(`play-btn-stage${stageIndex}`);
  const timelineWrap = document.getElementById(`timeline-wrap-stage${stageIndex}`);
  const progressEl = document.getElementById(`timeline-progress-stage${stageIndex}`);
  const heartBtn = document.getElementById(`heart-btn-stage${stageIndex}`);

  // Play / Pause
  if (playBtn) {
    playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const v = stageIndex === 1 ? getVideos().video1 : getVideos().video2;
      if (!v) return;

      if (v.paused) {
        v.play().catch(() => {});
      } else {
        v.pause();
      }
      updatePlayIcon(playBtn, v.paused);
    });
  }

  // Скруббер (клик и перемотка)
  if (timelineWrap) {
    timelineWrap.addEventListener('click', (e) => {
      e.stopPropagation();
      const v = stageIndex === 1 ? getVideos().video1 : getVideos().video2;
      if (!v || !v.duration) return;

      const rect = timelineWrap.getBoundingClientRect();
      const pct = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
      v.currentTime = pct * v.duration;
      if (progressEl) {
        progressEl.style.width = `${pct * 100}%`;
      }
    });
  }

  // Лайк (сердечко)
  if (heartBtn) {
    heartBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      heartBtn.classList.toggle('liked');
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

    if (e.code === 'KeyM') {
      e.preventDefault();
      toggleGlobalSound();
    } else if (e.code === 'Digit1') {
      scrollToStage(0);
    } else if (e.code === 'Digit2') {
      scrollToStage(1);
    } else if (e.code === 'Digit3') {
      scrollToStage(2);
    } else if (e.code === 'Digit4') {
      scrollToStage(3);
    }
  });
}
