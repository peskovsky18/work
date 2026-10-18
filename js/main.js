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

  // 6. Оповещение стоп-крана
  initEmergencyBanner();

  // 7. Подсказка включения звука
  initSoundHint();

  // 8. Автозатемнение интерфейса при просмотре видео
  initCinemaIdleDim();
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

  // Горизонтальные свайпы на смартфонах для быстрого переключения этапов
  let touchStartX = 0, touchStartY = 0;
  window.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  }, { passive: true });

  window.addEventListener('touchend', (e) => {
    if (e.changedTouches.length === 1) {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        const activePill = document.querySelector('.stage-nav-pill.active');
        const cur = activePill ? parseInt(activePill.dataset.stage, 10) : 0;
        if (dx < 0 && cur < 9) {
          scrollToStage(cur + 1);
        } else if (dx > 0 && cur > 0) {
          scrollToStage(cur - 1);
        }
      }
    }
  }, { passive: true });
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
    } else if (e.code === 'KeyF') {
      const activePill = document.querySelector('.stage-nav-pill.active');
      const cur = activePill ? parseInt(activePill.dataset.stage, 10) : 0;
      if (cur === 1 || cur === 2) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('open-project-modal', { detail: { project: cur } }));
      }
    } else if (e.code === 'Space') {
      const activePill = document.querySelector('.stage-nav-pill.active');
      const cur = activePill ? parseInt(activePill.dataset.stage, 10) : 0;
      if (cur === 1 || cur === 2) {
        e.preventDefault();
        const v = cur === 1 ? getVideos().video1 : getVideos().video2;
        if (v) {
          if (v.paused) v.play().catch(() => {});
          else v.pause();
        }
      }
    } else if (e.code === 'ArrowRight' || e.code === 'ArrowDown') {
      const activePill = document.querySelector('.stage-nav-pill.active');
      const cur = activePill ? parseInt(activePill.dataset.stage, 10) : 0;
      if (cur < 9) {
        e.preventDefault();
        scrollToStage(cur + 1);
      }
    } else if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') {
      const activePill = document.querySelector('.stage-nav-pill.active');
      const cur = activePill ? parseInt(activePill.dataset.stage, 10) : 0;
      if (cur > 0) {
        e.preventDefault();
        scrollToStage(cur - 1);
      }
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
  },
  3: {
    badge: 'PRE-PRODUCTION • 2026',
    title: 'Проект 03 • Ночной тоннель',
    desc: 'Концептуальный короткометражный фильм об ускорении времени в мегаполисе. Ритмичный саунд-дизайн, съемка на сверхчувствительную оптику в Apple Log.',
    meta: [
      { label: 'Статус', val: 'Пре-продакшн' },
      { label: 'Жанр', val: 'Experimental / Noir' },
      { label: 'Формат', val: '2.39:1 • 4K HDR' }
    ],
    isPlaceholder: true
  },
  4: {
    badge: 'DEVELOPMENT • 2026',
    title: 'Проект 04 • Индустрия',
    desc: 'Визуальный манифест о симбиозе человека и индустриальных машин. Монохромная контрастная эстетика и динамичный клиповый монтаж.',
    meta: [
      { label: 'Статус', val: 'Разработка' },
      { label: 'Жанр', val: 'Fashion Film' },
      { label: 'Формат', val: '16:9 • Apple Log' }
    ],
    isPlaceholder: true
  },
  5: {
    badge: 'DEVELOPMENT • 2026',
    title: 'Проект 05 • Ритм',
    desc: 'Музыкальное видео с акцентом на кинетическую хореографию в замкнутом урбанистическом пространстве.',
    meta: [
      { label: 'Статус', val: 'Сценарная разработка' },
      { label: 'Жанр', val: 'Music Video' },
      { label: 'Формат', val: 'Cinematic 4K' }
    ],
    isPlaceholder: true
  },
  6: {
    badge: 'IN PRODUCTION • 2026',
    title: 'Проект 06 • Светотень',
    desc: 'Экспериментальный перформанс об игре света и архитектурных объемов на ночных улицах.',
    meta: [
      { label: 'Статус', val: 'Подготовка к съемкам' },
      { label: 'Жанр', val: 'Art Performance' },
      { label: 'Формат', val: '4K 60fps' }
    ],
    isPlaceholder: true
  },
  7: {
    badge: 'CONCEPT • 2026',
    title: 'Проект 07 • Лица',
    desc: 'Серия документальных микро-портретов современных независимых авторов и создателей.',
    meta: [
      { label: 'Статус', val: 'Кастинг' },
      { label: 'Жанр', val: 'Documentary Mini' },
      { label: 'Формат', val: '16:9 • Natural Light' }
    ],
    isPlaceholder: true
  },
  8: {
    badge: 'CONCEPT • 2026',
    title: 'Проект 08 • Моушн',
    desc: 'Синтез аналоговой оптики, цифровой графики и трехмерных пространственных симуляций.',
    meta: [
      { label: 'Статус', val: 'Концепт-арт' },
      { label: 'Жанр', val: 'Mixed Media' },
      { label: 'Формат', val: '3D Spatial' }
    ],
    isPlaceholder: true
  }
};

function initProjectModal() {
  const modal = document.getElementById('project-modal');
  const closeBtn = document.getElementById('modal-close-btn');
  const backdrop = document.getElementById('modal-backdrop');
  const modalVideo = document.getElementById('modal-video-player');
  const videoBox = modal ? modal.querySelector('.modal-video-box') : null;
  const placeholderBox = document.getElementById('modal-placeholder-box');
  if (!modal) return;

  const closeModal = () => {
    modal.classList.remove('open');
    if (modalVideo) {
      modalVideo.pause();
      modalVideo.src = '';
    }
  };
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (backdrop) backdrop.addEventListener('click', closeModal);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
  });

  const openProjectModal = (pId) => {
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

    if (data.isPlaceholder) {
      if (videoBox) videoBox.style.display = 'none';
      if (placeholderBox) placeholderBox.style.display = 'block';
      if (modalVideo) {
        modalVideo.pause();
        modalVideo.src = '';
      }
    } else {
      if (videoBox) videoBox.style.display = 'block';
      if (placeholderBox) placeholderBox.style.display = 'none';
      if (modalVideo) {
        const pidStr = String(pId);
        const stageVideo = pidStr === '1' ? getVideos().video1 : getVideos().video2;
        const vSrc = pidStr === '1' ? 'assets/videos/ir8kYNcLb8sn6EK.MP4' : 'assets/videos/mppRNz4EpVE8gnQ.MP4';
        modalVideo.src = vSrc;
        if (stageVideo && stageVideo.currentTime) {
          modalVideo.currentTime = stageVideo.currentTime;
        }
        modalVideo.play().catch(() => {});
      }
    }

    modal.classList.add('open');
  };

  const triggerBtns = document.querySelectorAll('.info-btn, .cinema-expand-btn');
  triggerBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openProjectModal(btn.dataset.project);
    });
  });

  window.addEventListener('open-project-modal', (e) => {
    if (e.detail && e.detail.project) {
      openProjectModal(e.detail.project);
    }
  });

  // Интерактивная карта метро (вызывается кликом по схеме на стене станции)
  const mapModal = document.getElementById('map-modal');
  const mapCloseBtn = document.getElementById('map-modal-close-btn');
  const mapBackdrop = document.getElementById('map-modal-backdrop');
  if (mapModal) {
    const closeMap = () => mapModal.classList.remove('open');
    if (mapCloseBtn) mapCloseBtn.addEventListener('click', closeMap);
    if (mapBackdrop) mapBackdrop.addEventListener('click', closeMap);

    window.addEventListener('open-map-modal', () => {
      mapModal.classList.add('open');
    });

    const stationNodes = document.querySelectorAll('.map-station-node');
    stationNodes.forEach((node) => {
      node.addEventListener('click', () => {
        const stage = parseInt(node.dataset.gotoStage, 10);
        closeMap();
        scrollToStage(stage);
      });
    });
  }
}

// =============================================================================
// ЭКСТРЕННОЕ ОПОВЕЩЕНИЕ: СТОП-КРАН
// =============================================================================
function initEmergencyBanner() {
  const banner = document.getElementById('emergency-alert-banner');
  if (!banner) return;

  window.addEventListener('emergency-brake-triggered', () => {
    banner.classList.add('active');
    banner.setAttribute('aria-hidden', 'false');
  });

  window.addEventListener('emergency-brake-reset', () => {
    banner.classList.remove('active');
    banner.setAttribute('aria-hidden', 'true');
  });
}

// =============================================================================
// ПОДСКАЗКА ВКЛЮЧЕНИЯ ЗВУКА
// =============================================================================
function initSoundHint() {
  const toast = document.getElementById('sound-hint-toast');
  const closeBtn = document.getElementById('sound-hint-close');
  if (!toast) return;

  let dismissed = false;
  const dismiss = () => {
    dismissed = true;
    toast.classList.remove('show');
    toast.setAttribute('aria-hidden', 'true');
  };

  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dismiss();
    });
  }

  toast.addEventListener('click', () => {
    toggleGlobalSound();
    dismiss();
  });

  // Показать подсказку через 3.5 секунды, если звук всё еще выключен
  setTimeout(() => {
    const soundBtn = document.getElementById('header-sound-btn');
    if (!dismissed && soundBtn && !soundBtn.classList.contains('sound-on')) {
      toast.classList.add('show');
      toast.setAttribute('aria-hidden', 'false');
      setTimeout(dismiss, 7000);
    }
  }, 3500);

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM') dismiss();
  });
}

// =============================================================================
// АВТОЗАТЕМНЕНИЕ ИНТЕРФЕЙСА ПРИ ПРОСМОТРЕ ВИДЕО
// =============================================================================
function initCinemaIdleDim() {
  let idleTimer = null;
  const resetIdle = () => {
    if (document.body.classList.contains('cinema-dimmed')) {
      document.body.classList.remove('cinema-dimmed');
    }
    if (idleTimer) clearTimeout(idleTimer);

    const activePill = document.querySelector('.stage-nav-pill.active');
    const cur = activePill ? parseInt(activePill.dataset.stage, 10) : 0;
    if (cur === 1 || cur === 2) {
      idleTimer = setTimeout(() => {
        document.body.classList.add('cinema-dimmed');
      }, 3500);
    }
  };

  ['mousemove', 'touchstart', 'scroll', 'keydown', 'click'].forEach((evt) => {
    window.addEventListener(evt, resetIdle, { passive: true });
  });
}
