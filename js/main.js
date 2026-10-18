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

  // 5. Модальное окно деталей проектов
  initProjectModal();
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
    } else if (e.code.startsWith('Digit')) {
      const num = parseInt(e.code.replace('Digit', ''), 10);
      if (num >= 1 && num <= 9) {
        scrollToStage(num - 1);
      } else if (num === 0) {
        scrollToStage(9);
      }
    }
  });
}

// =============================================================================
// МОДАЛЬНОЕ ОКНО ДЕТАЛЕЙ ПРОЕКТА
// =============================================================================
const PROJECT_DATA = {
  1: {
    badge: 'SHOT ON IPHONE • 2026',
    title: 'Свэг',
    desc: 'Режиссура, съемка и цветокоррекция. Экспериментальный визуальный стиль с аутентичным ритмом монтажа и динамичной операторской работой.',
    meta: [
      { label: 'Камера', val: 'iPhone 4K 60fps' },
      { label: 'Режиссер', val: 'Александр Песковский' },
      { label: 'Формат', val: '16:9 • Apple Log' }
    ]
  },
  2: {
    badge: 'SHOT ON IPHONE • 2026',
    title: 'Мини свэг',
    desc: 'Короткометражная визуальная зарисовка. Точная ритмика кадров, глубокие тени и акцент на деталях городской эстетики.',
    meta: [
      { label: 'Камера', val: 'iPhone 4K 60fps' },
      { label: 'Режиссер', val: 'Александр Песковский' },
      { label: 'Формат', val: '16:9 • Cinematic' }
    ]
  }
};

function initProjectModal() {
  const modal = document.getElementById('project-modal');
  const closeBtn = document.getElementById('modal-close-btn');
  const backdrop = document.getElementById('modal-backdrop');
  if (!modal) return;

  const closeModal = () => modal.classList.remove('open');
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (backdrop) backdrop.addEventListener('click', closeModal);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
  });

  const infoBtns = document.querySelectorAll('.info-btn');
  infoBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const pId = btn.dataset.project;
      const data = PROJECT_DATA[pId];
      if (!data) return;

      document.getElementById('modal-badge').textContent = data.badge;
      document.getElementById('modal-title').textContent = data.title;
      document.getElementById('modal-desc').textContent = data.desc;
      const metaContainer = document.getElementById('modal-meta');
      if (metaContainer) {
        metaContainer.innerHTML = data.meta.map(m => `
          <div class="meta-item">
            <span class="meta-label">${m.label}</span>
            <span class="meta-val">${m.val}</span>
          </div>
        `).join('');
      }
      modal.classList.add('open');
    });
  });
}
