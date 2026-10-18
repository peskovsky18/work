/**
 * Александр Песковский — 2026
 * Основная точка входа: UI логика и связка с 3D сценой
 */

import { initSubwayScene, scrollToStage, toggleGlobalSound, getVideos, resetScreenZoom, toggleScreenZoom } from './scene3d.js';
import { playNavTick } from './subwayAudio.js';

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

  // 7. Автозатемнение интерфейса при просмотре видео
  initCinemaIdleDim();

  // 9. Аудиовизуализатор волн в плеере
  initWaveformVisualizers();

  // 10. Регистрация Service Worker для PWA
  initServiceWorker();

  // 11. Интерактивная перемотка по линии маршрута
  initRouteTrackSeek();

  // 12. Обработка прямых ссылок (URL Hash Routing)
  initHashRouting();

  // 13. Кнопки копирования ссылок и шаринга
  initShareButtons();
});

// =============================================================================
// НАВИГАЦИЯ ПО СЕКЦИЯМ
// =============================================================================
function initNavigation() {
  const navPills = document.querySelectorAll('.stage-nav-pill');
  navPills.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      playNavTick();
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
          playNavTick();
          scrollToStage(cur + 1);
        } else if (dx > 0 && cur > 0) {
          playNavTick();
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

    if (e.code === 'Escape') {
      resetScreenZoom();
    } else if (e.code === 'KeyZ') {
      e.preventDefault();
      toggleScreenZoom();
    } else if (e.code === 'KeyM') {
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
        playNavTick();
        scrollToStage(cur + 1);
      }
    } else if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') {
      const activePill = document.querySelector('.stage-nav-pill.active');
      const cur = activePill ? parseInt(activePill.dataset.stage, 10) : 0;
      if (cur > 0) {
        e.preventDefault();
        playNavTick();
        scrollToStage(cur - 1);
      }
    } else if (e.code.startsWith('Digit')) {
      const num = parseInt(e.code.replace('Digit', ''), 10);
      if (num >= 1 && num <= 9) {
        playNavTick();
        scrollToStage(num - 1);
      } else if (num === 0) {
        playNavTick();
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
      { label: 'Камера', val: 'iPhone 4K 60fps • Apple Log' },
      { label: 'Режиссер', val: 'Александр Песковский' },
      { label: 'Грейдинг', val: 'DaVinci Resolve Studio' },
      { label: 'Формат', val: '16:9 • Stereo' }
    ]
  },
  2: {
    badge: 'SHOT ON IPHONE • 2026',
    title: 'Мини свэг',
    desc: 'Короткометражная визуальная зарисовка. Точная ритмика кадров, глубокие тени и акцент на деталях городской эстетики.',
    meta: [
      { label: 'Камера', val: 'iPhone 4K 60fps • Cinematic' },
      { label: 'Режиссер', val: 'Александр Песковский' },
      { label: 'Монтаж', val: 'Александр Песковский' },
      { label: 'Формат', val: '16:9 • 24fps' }
    ]
  },
  3: {
    badge: 'POST-PRODUCTION • 2026',
    title: 'Ночной тоннель',
    desc: 'Экспериментальный короткометражный фильм об ускорении времени в ночном мегаполисе. Ритмичный авторский саунд-дизайн, съемка на сверхчувствительную оптику с динамическим диапазоном Apple Log.',
    meta: [
      { label: 'Статус', val: 'Пост-продакшн' },
      { label: 'Камера', val: 'Sony FX3 / iPhone 15 Pro Max' },
      { label: 'Режиссура & Звук', val: 'Александр Песковский' },
      { label: 'Формат', val: '2.39:1 Anamorphic • 4K HDR' }
    ],
    isPlaceholder: true
  },
  4: {
    badge: 'COMMERCIAL / FASHION • 2026',
    title: 'Индустрия',
    desc: 'Визуальный манифест о симбиозе человека и индустриальных машин. Монохромная контрастная эстетика, глубокие тени и плотный клиповый ритм.',
    meta: [
      { label: 'Статус', val: 'Монтажно-тонировочный период' },
      { label: 'Жанр', val: 'Fashion Film / Visual Statement' },
      { label: 'Цветокоррекция', val: 'ACEScc • Kodak Vision Emulation' },
      { label: 'Формат', val: '16:9 • Apple ProRes 422HQ' }
    ],
    isPlaceholder: true
  },
  5: {
    badge: 'MUSIC VIDEO • 2026',
    title: 'Ритм',
    desc: 'Музыкальное видео с акцентом на кинетическую экспрессивную хореографию в замкнутом урбанистическом пространстве.',
    meta: [
      { label: 'Статус', val: 'Подготовка к релизу' },
      { label: 'Жанр', val: 'Music Video / Kinetic Dance' },
      { label: 'Световая партитура', val: 'Dynamic RGB Strobe System' },
      { label: 'Формат', val: '4K DCI • 24fps' }
    ],
    isPlaceholder: true
  },
  6: {
    badge: 'ART FILM • 2026',
    title: 'Светотень',
    desc: 'Архитектурный визуальный перформанс об игре света и геометрии ночного города. Медитативный темпоритм и макро-детализация фактур.',
    meta: [
      { label: 'Статус', val: 'Фестивальный цикл' },
      { label: 'Жанр', val: 'Art Film / Architecture' },
      { label: 'Оптика', val: 'Prime Cine Lenses 35mm / 50mm' },
      { label: 'Формат', val: '4:3 Classic Academy' }
    ],
    isPlaceholder: true
  },
  7: {
    badge: 'DOCUMENTARY • 2026',
    title: 'Лица',
    desc: 'Серия интимных документальных микро-портретов современных независимых авторов, художников и мейкеров.',
    meta: [
      { label: 'Статус', val: 'Съемки эпизодов' },
      { label: 'Жанр', val: 'Documentary Mini-series' },
      { label: 'Звук', val: 'Binaural Field Recording' },
      { label: 'Формат', val: '16:9 • Natural Light' }
    ],
    isPlaceholder: true
  },
  8: {
    badge: '3D SPATIAL • 2026',
    title: 'Моушн',
    desc: 'Синтез кинематографической съемки, аналоговой оптики и трехмерных пространственных симуляций в реальном времени.',
    meta: [
      { label: 'Статус', val: 'Интерактивный релиз' },
      { label: 'Технологии', val: 'Three.js • Blender • GLSL' },
      { label: 'Концепт & Код', val: 'Александр Песковский' },
      { label: 'Формат', val: 'Realtime WebGL 60fps' }
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
    resetScreenZoom();
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
        playNavTick();
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

// =============================================================================
// АУДИОВИЗУАЛИЗАТОР ПЛЕЕРА (APPLE-STYLE DYNAMIC WAVEFORM)
// =============================================================================
function initWaveformVisualizers() {
  const c1 = document.getElementById('waveform-canvas-stage1');
  const c2 = document.getElementById('waveform-canvas-stage2');
  if (!c1 && !c2) return;

  const ctx1 = c1 ? c1.getContext('2d') : null;
  const ctx2 = c2 ? c2.getContext('2d') : null;

  const BAR_COUNT = 7;
  const bars1 = new Float32Array(BAR_COUNT).fill(2);
  const bars2 = new Float32Array(BAR_COUNT).fill(2);

  const drawBars = (ctx, canvas, bars, isPlaying, isMuted, t) => {
    if (!ctx || !canvas) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const barW = 3;
    const gap = 3;
    const totalW = BAR_COUNT * barW + (BAR_COUNT - 1) * gap;
    const startX = (w - totalW) / 2;

    for (let i = 0; i < BAR_COUNT; i++) {
      let targetH = 2;
      if (isPlaying) {
        const freq = 3.5 + i * 1.8;
        const s = Math.sin(t * freq + i * 0.9);
        const amp = isMuted ? 0.35 : 0.85;
        targetH = 3 + (s * 0.5 + 0.5) * (h - 4) * amp;
      }
      bars[i] += (targetH - bars[i]) * 0.18;
      const curH = Math.max(2, bars[i]);
      const x = startX + i * (barW + gap);
      const y = (h - curH) / 2;

      const grad = ctx.createLinearGradient(0, y, 0, y + curH);
      if (isPlaying && !isMuted) {
        grad.addColorStop(0, '#f5a623');
        grad.addColorStop(1, '#ffffff');
      } else {
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0.25)');
      }

      ctx.fillStyle = grad;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, y, barW, curH, 1.5);
      } else {
        ctx.rect(x, y, barW, curH);
      }
      ctx.fill();
    }
  };

  const anim = () => {
    requestAnimationFrame(anim);
    const { video1, video2 } = getVideos();
    const t = performance.now() * 0.003;

    if (ctx1 && c1) {
      const isPlay1 = video1 && !video1.paused;
      const isMute1 = !video1 || video1.muted || video1.volume === 0;
      drawBars(ctx1, c1, bars1, isPlay1, isMute1, t);
    }
    if (ctx2 && c2) {
      const isPlay2 = video2 && !video2.paused;
      const isMute2 = !video2 || video2.muted || video2.volume === 0;
      drawBars(ctx2, c2, bars2, isPlay2, isMute2, t);
    }
  };

  requestAnimationFrame(anim);
}

// =============================================================================
// SERVICE WORKER & PWA ПОДДЕРЖКА
// =============================================================================
function initServiceWorker() {
  if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
}

// =============================================================================
// ИНТЕРАКТИВНАЯ ЛИНИЯ МАРШРУТА (ROUTE TRACK TOOLTIP & SEEK)
// =============================================================================
const STAGE_NAMES = [
  '00 // Вход на станцию',
  '01 // Свэг',
  '02 // Мини свэг',
  '03 // Проект 03 • Тоннель',
  '04 // Проект 04 • Крейсерский ход',
  '05 // Проект 08 • Сторона B',
  '06 // Проект 07 • Сторона B',
  '07 // Проект 06 • Сторона B',
  '08 // Проект 05 • Торможение',
  '09 // Станция 2 • Контакты'
];

function initRouteTrackSeek() {
  const track = document.getElementById('header-route-track');
  const tooltip = document.getElementById('route-track-tooltip');
  if (!track || !tooltip) return;

  const handleTrackMove = (e) => {
    const rect = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const stageIdx = Math.min(Math.round(ratio * 9), 9);

    tooltip.textContent = STAGE_NAMES[stageIdx] || '';
    tooltip.style.left = `${ratio * 100}%`;
    tooltip.classList.add('show');
  };

  track.addEventListener('mousemove', handleTrackMove);

  track.addEventListener('mouseleave', () => {
    tooltip.classList.remove('show');
  });

  track.addEventListener('click', (e) => {
    const rect = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const stageIdx = Math.min(Math.round(ratio * 9), 9);
    playNavTick();
    scrollToStage(stageIdx);
  });
}

// =============================================================================
// ВСПЛЫВАЮЩИЙ ТОАСТ УВЕДОМЛЕНИЙ
// =============================================================================
let toastTimer = null;
export function showAppToast(msg) {
  const toast = document.getElementById('app-toast');
  const textEl = document.getElementById('app-toast-text');
  if (!toast) return;
  if (textEl) textEl.textContent = msg;

  toast.classList.add('show');
  toast.setAttribute('aria-hidden', 'false');

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    toast.setAttribute('aria-hidden', 'true');
  }, 2400);
}

// =============================================================================
// ОБРАБОТКА ПРЯМЫХ ССЫЛОК (URL HASH ROUTING)
// =============================================================================
const HASH_MAP = {
  '#intro': 0, '#stage-0': 0,
  '#swag': 1, '#stage-1': 1,
  '#mini-swag': 2, '#stage-2': 2,
  '#03': 3, '#stage-3': 3,
  '#04': 4, '#stage-4': 4,
  '#08': 5, '#stage-5': 5,
  '#07': 6, '#stage-6': 6,
  '#06': 7, '#stage-7': 7,
  '#05': 8, '#stage-8': 8,
  '#contacts': 9, '#stage-9': 9
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

// =============================================================================
// КНОПКИ ШАРИНГА И КОПИРОВАНИЯ ССЫЛОК
// =============================================================================
function initShareButtons() {
  const copyUrl = (stageIdx) => {
    const base = window.location.origin + window.location.pathname;
    const stageName = stageIdx === 1 ? 'swag' : stageIdx === 2 ? 'mini-swag' : `stage-${stageIdx}`;
    const url = `${base}#${stageName}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        showAppToast('Ссылка скопирована в буфер 🔗');
        playNavTick();
      }).catch(() => {
        showAppToast(url);
      });
    } else {
      showAppToast(url);
    }
  };

  document.querySelectorAll('.share-link-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const s = parseInt(btn.dataset.stage, 10) || 1;
      copyUrl(s);
    });
  });

  const modalShareBtn = document.getElementById('modal-share-btn');
  if (modalShareBtn) {
    modalShareBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const activePill = document.querySelector('.stage-nav-pill.active');
      const cur = activePill ? parseInt(activePill.dataset.stage, 10) : 1;
      copyUrl(cur);
    });
  }
}



