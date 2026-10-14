/**
 * Александр Песковский — 2026
 * Логика интерфейса iOS Photos: только 2 раздела («Видео» и «Креатив»)
 */

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initContactLinks();
  initIOSPhotos();
  initModal();
});

// ==========================================================================
// 1. ТЕМА ОФОРМЛЕНИЯ
// ==========================================================================
function initTheme() {
  const toggleBtn = document.getElementById('theme-toggle');
  const saved = localStorage.getItem('peskovsky-theme-ios') || 'light';
  applyTheme(saved);

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'light' ? 'dark' : 'light';
      applyTheme(next);
      localStorage.setItem('peskovsky-theme-ios', next);
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
function initContactLinks() {
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
// 3. ИНТЕРФЕЙС IOS PHOTOS: 2 РАЗДЕЛА («ВИДЕО» И «КРЕАТИВ»)
// ==========================================================================
let currentTab = 'video'; // 'video' | 'creative'
let currentCategoryWorks = [];
let activeWorkIndex = 0;

function initIOSPhotos() {
  if (typeof PROJECTS === 'undefined') return;

  // Инициализация парящего таб-бара (Видео / Креатив)
  const tabPills = document.querySelectorAll('.ios-tab-pill');
  tabPills.forEach(pill => {
    pill.addEventListener('click', () => {
      tabPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      currentTab = pill.dataset.tab;
      activeWorkIndex = 0;
      loadCategoryWorks();
    });
  });

  // Стрелки перелистывания внутри кадра
  const prevBtn = document.getElementById('ios-prev-arrow');
  const nextBtn = document.getElementById('ios-next-arrow');

  if (prevBtn) {
    prevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigateWork(-1);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigateWork(1);
    });
  }

  // Клик по карточке открывает просмотр видео или проект
  const mainCard = document.getElementById('ios-main-card');
  if (mainCard) {
    mainCard.addEventListener('click', () => {
      const work = currentCategoryWorks[activeWorkIndex];
      if (work) openModal(work.id);
    });

    // Свайп на смартфонах
    let startX = 0;
    mainCard.addEventListener('touchstart', (e) => {
      startX = e.changedTouches[0].screenX;
    }, { passive: true });

    mainCard.addEventListener('touchend', (e) => {
      const endX = e.changedTouches[0].screenX;
      if (startX - endX > 45) navigateWork(1);
      if (endX - startX > 45) navigateWork(-1);
    }, { passive: true });
  }

  // Клавиатурные стрелки
  document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('project-modal');
    if (modal && modal.classList.contains('active')) return;

    if (e.key === 'ArrowRight') navigateWork(1);
    if (e.key === 'ArrowLeft') navigateWork(-1);
  });

  loadCategoryWorks();
}

function loadCategoryWorks() {
  currentCategoryWorks = PROJECTS.filter(p => p.category === currentTab);
  renderWork();
}

function navigateWork(direction) {
  if (currentCategoryWorks.length <= 1) return;
  activeWorkIndex = (activeWorkIndex + direction + currentCategoryWorks.length) % currentCategoryWorks.length;
  renderWork();
}

function renderWork() {
  const work = currentCategoryWorks[activeWorkIndex];
  if (!work) return;

  // Элементы экрана iOS
  const titleHeader = document.getElementById('ios-photos-title');
  const countHeader = document.getElementById('ios-photos-count');
  const imgEl = document.getElementById('ios-card-img');
  const badgeEl = document.getElementById('shot-badge');
  const workCatBadge = document.getElementById('work-cat-badge');
  const workYear = document.getElementById('work-year');
  const workTitle = document.getElementById('work-title');
  const workRole = document.getElementById('work-role');
  const specsBox = document.getElementById('work-specs-box');
  const filmstrip = document.getElementById('ios-filmstrip');

  // Заголовок раздела
  if (titleHeader) {
    titleHeader.textContent = currentTab === 'video' ? 'Видео' : 'Креатив';
  }

  // Счетчик: 1 из 4
  if (countHeader) {
    countHeader.textContent = `${activeWorkIndex + 1} из ${currentCategoryWorks.length} • 2026`;
  }

  // Изображение с микро-переходом
  if (imgEl) {
    imgEl.style.opacity = '0.3';
    setTimeout(() => {
      imgEl.src = work.thumbnail;
      imgEl.alt = work.title;
      imgEl.style.opacity = '1';
    }, 80);
  }

  // Подпись «Снято на iPhone» или креативный статус
  if (badgeEl) {
    badgeEl.textContent = work.iphoneBadge || (work.shotOnIphone ? 'Снято на iPhone' : 'Креатив');
  }

  // Метаданные работы
  if (workCatBadge) workCatBadge.textContent = work.categoryLabel;
  if (workYear) workYear.textContent = work.year;
  if (workTitle) workTitle.textContent = work.title;
  if (workRole) {
    const clientStr = work.client ? ` • ${work.client}` : '';
    workRole.textContent = `${work.role}${clientStr}`;
  }

  // Архитектурные спеки
  if (specsBox) {
    if (work.specs) {
      specsBox.innerHTML = Object.entries(work.specs).map(([key, val]) => `
        <div class="ios-spec-item">
          <strong>${formatSpecLabel(key)}</strong>
          <span>${escapeHtml(val)}</span>
        </div>
      `).join('');
      specsBox.style.display = 'grid';
    } else {
      specsBox.style.display = 'none';
    }
  }

  // Лента миниатюр (Filmstrip)
  if (filmstrip) {
    filmstrip.innerHTML = currentCategoryWorks.map((item, idx) => `
      <img 
        src="${escapeHtml(item.thumbnail)}" 
        alt="${escapeHtml(item.title)}" 
        class="ios-filmstrip-thumb ${idx === activeWorkIndex ? 'active' : ''}" 
        data-index="${idx}"
      >
    `).join('');

    filmstrip.querySelectorAll('.ios-filmstrip-thumb').forEach(th => {
      th.addEventListener('click', (e) => {
        e.stopPropagation();
        activeWorkIndex = parseInt(th.dataset.index, 10);
        renderWork();
      });
    });

    // Центрируем активный кадр
    const activeThumb = filmstrip.children[activeWorkIndex];
    if (activeThumb) {
      activeThumb.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }
}

function formatSpecLabel(key) {
  const map = {
    gear: "Камера",
    format: "Формат",
    post: "Пост-продакшн",
    year: "Год",
    direction: "Направление",
    stack: "Стек",
    typography: "Шрифт",
    deliverable: "Результат",
    style: "Стиль",
    medium: "Формат"
  };
  return map[key] || key;
}

// ==========================================================================
// 4. МОДАЛЬНЫЙ ПРОСМОТР ВИДЕО И РАБОТ
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
    if (e.key === 'Escape' && modal.classList.contains('active')) closeModal();
  });
}

function openModal(projectId) {
  const work = PROJECTS.find(p => p.id === projectId);
  if (!work) return;

  const modal = document.getElementById('project-modal');
  const catEl = document.getElementById('modal-header-cat');
  const mediaContainer = document.getElementById('modal-media-container');
  const titleEl = document.getElementById('modal-title');
  const descEl = document.getElementById('modal-desc');

  if (catEl) catEl.textContent = `${work.categoryLabel} • 2026`;
  if (titleEl) titleEl.textContent = work.title;
  if (descEl) descEl.textContent = work.description;

  if (mediaContainer) {
    if (work.mediaType === 'youtube') {
      mediaContainer.innerHTML = `
        <div class="modal-video-wrap">
          <iframe 
            src="${escapeHtml(work.mediaUrl)}?autoplay=1&rel=0&modestbranding=1" 
            title="${escapeHtml(work.title)}" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowfullscreen>
          </iframe>
        </div>
      `;
    } else {
      mediaContainer.innerHTML = `
        <div class="modal-video-wrap">
          <img src="${escapeHtml(work.mediaUrl || work.thumbnail)}" style="width:100%; height:100%; object-fit:contain;" alt="${escapeHtml(work.title)}">
        </div>
      `;
    }
  }

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
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
