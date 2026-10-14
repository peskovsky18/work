/**
 * Александр Песковский — 2026
 * Интерфейс галереи в стиле Apple Photos
 */

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initProfileLinks();
  initPhotosGallery();
  initModal();
});

// ==========================================================================
// 1. ПЕРЕКЛЮЧЕНИЕ ТЕМЫ ОФОРМЛЕНИЯ
// ==========================================================================
function initTheme() {
  const toggleBtn = document.getElementById('theme-toggle');
  const savedTheme = localStorage.getItem('peskovsky-theme-2026') || 'light';
  applyTheme(savedTheme);

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'light' ? 'dark' : 'light';
      applyTheme(next);
      localStorage.setItem('peskovsky-theme-2026', next);
    });
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const toggleBtn = document.getElementById('theme-toggle');
  if (toggleBtn) {
    toggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
  }
}

// ==========================================================================
// 2. ДВЕ КНОПКИ СВЯЗИ (EMAIL И INSTAGRAM)
// ==========================================================================
function initProfileLinks() {
  if (typeof PROFILE_DATA === 'undefined') return;

  const emailBtns = document.querySelectorAll('.action-email-btn');
  const instaBtns = document.querySelectorAll('.action-insta-btn');

  emailBtns.forEach(btn => {
    btn.href = `mailto:${PROFILE_DATA.contacts.email}`;
  });

  instaBtns.forEach(btn => {
    btn.href = PROFILE_DATA.contacts.instagram;
  });
}

// ==========================================================================
// 3. ГАЛЕРЕЯ В СТИЛЕ IOS PHOTOS
// ==========================================================================
let currentFilter = 'all';
let filteredWorks = [];
let currentIndex = 0;

function initPhotosGallery() {
  if (typeof PROJECTS === 'undefined' || PROJECTS.length === 0) return;

  filteredWorks = [...PROJECTS];
  currentIndex = 0;

  // Сегментные фильтры
  const segmentBtns = document.querySelectorAll('.segment-btn');
  segmentBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      segmentBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      currentFilter = btn.dataset.filter;
      filteredWorks = currentFilter === 'all'
        ? [...PROJECTS]
        : PROJECTS.filter(p => p.category === currentFilter);

      currentIndex = 0;
      renderActiveWork();
    });
  });

  // Стрелки навигации
  const prevBtn = document.getElementById('stage-prev');
  const nextBtn = document.getElementById('stage-next');

  if (prevBtn) prevBtn.addEventListener('click', (e) => { e.stopPropagation(); prevWork(); });
  if (nextBtn) nextBtn.addEventListener('click', (e) => { e.stopPropagation(); nextWork(); });

  // Кнопка открытия работы
  const openBtn = document.getElementById('stage-open');
  const viewport = document.getElementById('ios-viewport');

  if (openBtn) {
    openBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (filteredWorks[currentIndex]) openModal(filteredWorks[currentIndex].id);
    });
  }

  if (viewport) {
    viewport.addEventListener('click', () => {
      if (filteredWorks[currentIndex]) openModal(filteredWorks[currentIndex].id);
    });

    // Свайп на сенсорных экранах
    let touchStartX = 0;
    viewport.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    viewport.addEventListener('touchend', (e) => {
      const touchEndX = e.changedTouches[0].screenX;
      if (touchStartX - touchEndX > 50) nextWork();
      if (touchEndX - touchStartX > 50) prevWork();
    }, { passive: true });
  }

  // Кнопка «Инфо»
  const infoBtn = document.getElementById('stage-info');
  if (infoBtn) {
    infoBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const infoCard = document.getElementById('ios-info-card');
      if (infoCard) {
        infoCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }

  // Навигация стрелками клавиатуры
  document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('project-modal');
    if (modal && modal.classList.contains('active')) return;

    if (e.key === 'ArrowRight') nextWork();
    if (e.key === 'ArrowLeft') prevWork();
  });

  renderActiveWork();
}

function prevWork() {
  if (filteredWorks.length <= 1) return;
  currentIndex = (currentIndex - 1 + filteredWorks.length) % filteredWorks.length;
  renderActiveWork();
}

function nextWork() {
  if (filteredWorks.length <= 1) return;
  currentIndex = (currentIndex + 1) % filteredWorks.length;
  renderActiveWork();
}

function renderActiveWork() {
  const work = filteredWorks[currentIndex];
  if (!work) return;

  const imgEl = document.getElementById('ios-main-image');
  const counterEl = document.getElementById('gallery-counter');
  const catBadge = document.getElementById('work-category-badge');
  const titleEl = document.getElementById('work-title');
  const roleEl = document.getElementById('work-role');
  const descEl = document.getElementById('work-desc');
  const specsContainer = document.getElementById('work-specs');
  const filmstrip = document.getElementById('filmstrip-track');

  // Главное изображение
  if (imgEl) {
    imgEl.style.opacity = '0.4';
    setTimeout(() => {
      imgEl.src = work.thumbnail;
      imgEl.alt = work.title;
      imgEl.style.opacity = '1';
    }, 120);
  }

  // Счетчик кадров в галерее: 01 / 08 • 2026
  if (counterEl) {
    const cur = String(currentIndex + 1).padStart(2, '0');
    const tot = String(filteredWorks.length).padStart(2, '0');
    counterEl.textContent = `${cur} / ${tot} • 2026`;
  }

  // Инфо о проекте
  if (catBadge) catBadge.textContent = work.categoryLabel;
  if (titleEl) titleEl.textContent = work.title;
  if (roleEl) {
    const clientText = work.client ? ` • ${work.client}` : '';
    roleEl.textContent = `${work.role}${clientText}`;
  }
  if (descEl) descEl.textContent = work.description;

  // Архитектурные технические спеки
  if (specsContainer) {
    if (work.specs) {
      specsContainer.innerHTML = Object.entries(work.specs).map(([key, val]) => `
        <div class="spec-cell">
          <strong>${formatSpecLabel(key)}</strong>
          <span>${escapeHtml(val)}</span>
        </div>
      `).join('');
      specsContainer.style.display = 'grid';
    } else {
      specsContainer.style.display = 'none';
    }
  }

  // Лента кадров (Filmstrip Scrubber в стиле iOS)
  if (filmstrip) {
    filmstrip.innerHTML = filteredWorks.map((item, idx) => `
      <div class="filmstrip-item ${idx === currentIndex ? 'active' : ''}" data-idx="${idx}">
        <img src="${escapeHtml(item.thumbnail)}" alt="${escapeHtml(item.title)}">
      </div>
    `).join('');

    filmstrip.querySelectorAll('.filmstrip-item').forEach(thumb => {
      thumb.addEventListener('click', (e) => {
        e.stopPropagation();
        currentIndex = parseInt(thumb.dataset.idx, 10);
        renderActiveWork();
      });
    });

    // Центрируем активный кадр в полосе
    const activeItem = filmstrip.children[currentIndex];
    if (activeItem) {
      activeItem.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }
}

function formatSpecLabel(key) {
  const map = {
    camera: "Камера",
    format: "Формат",
    lens: "Оптика",
    post: "Пост-продакшн",
    film: "Пленка",
    software: "Софт",
    timeline: "Таймлайн",
    source: "Исходники",
    color: "Цветокор",
    role: "Направление",
    stack: "Стек",
    typography: "Шрифт",
    grid: "Сетка",
    audio: "Звук",
    profile: "Профиль",
    lighting: "Свет",
    raw: "Проявка",
    cameras: "Камеры",
    grade: "Грейдинг",
    vfx: "VFX & Клинап",
    identity: "Айдентика",
    deliverables: "Результат",
    year: "Год"
  };
  return map[key] || key;
}

// ==========================================================================
// 4. МОДАЛЬНЫЙ ПРОСМОТР РАБОТ
// ==========================================================================
function initModal() {
  const modal = document.getElementById('project-modal');
  const closeBtn = document.getElementById('modal-close-btn');

  if (!modal) return;
  if (closeBtn) closeBtn.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeModal();
    }
  });
}

function openModal(projectId) {
  const work = PROJECTS.find(p => p.id === projectId);
  if (!work) return;

  const modal = document.getElementById('project-modal');
  const headerCat = document.getElementById('modal-header-cat');
  const mediaContainer = document.getElementById('modal-media-container');
  const titleEl = document.getElementById('modal-title');
  const descEl = document.getElementById('modal-desc');

  if (headerCat) headerCat.textContent = `${work.categoryLabel} • 2026`;
  if (titleEl) titleEl.textContent = work.title;
  if (descEl) descEl.textContent = work.description;

  if (mediaContainer) {
    mediaContainer.innerHTML = renderModalMedia(work);
    initModalGalleryEvents();
  }

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function renderModalMedia(work) {
  if (work.mediaType === 'youtube') {
    return `
      <div class="modal-video-wrapper">
        <iframe 
          class="modal-video-frame" 
          src="${escapeHtml(work.mediaUrl)}?autoplay=1&rel=0&modestbranding=1" 
          title="${escapeHtml(work.title)}" 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
          allowfullscreen>
        </iframe>
      </div>
    `;
  }

  if (work.gallery && work.gallery.length > 1) {
    return `
      <div style="width: 100%; border-radius: 12px; overflow: hidden; background: #000;">
        <img id="modal-main-img" class="modal-photo-view" src="${escapeHtml(work.gallery[0])}" alt="${escapeHtml(work.title)}">
      </div>
      <div class="modal-series-strip">
        ${work.gallery.map((img, idx) => `
          <img src="${escapeHtml(img)}" class="modal-series-thumb ${idx === 0 ? 'active' : ''}" data-src="${escapeHtml(img)}" alt="Кадр ${idx + 1}">
        `).join('')}
      </div>
    `;
  }

  return `
    <div style="width: 100%; border-radius: 12px; overflow: hidden; background: #000;">
      <img class="modal-photo-view" src="${escapeHtml(work.mediaUrl || work.thumbnail)}" alt="${escapeHtml(work.title)}">
    </div>
  `;
}

function initModalGalleryEvents() {
  const thumbs = document.querySelectorAll('.modal-series-thumb');
  const mainImg = document.getElementById('modal-main-img');
  if (!mainImg || thumbs.length === 0) return;

  thumbs.forEach(thumb => {
    thumb.addEventListener('click', () => {
      thumbs.forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');
      mainImg.src = thumb.dataset.src;
    });
  });
}

function closeModal() {
  const modal = document.getElementById('project-modal');
  if (!modal) return;

  const mediaContainer = document.getElementById('modal-media-container');
  if (mediaContainer) mediaContainer.innerHTML = '';

  modal.classList.remove('active');
  document.body.style.overflow = '';
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
