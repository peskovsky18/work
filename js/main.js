/**
 * Александр Песковский — Разнорабочий в медиа
 * Логика карусели работ, фильтров и модального окна просмотра
 */

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initProfile();
  initCarousel();
  initModal();
});

// ==========================================================================
// 1. ТЕМА ОФОРМЛЕНИЯ
// ==========================================================================
function initTheme() {
  const toggleBtn = document.getElementById('theme-toggle');
  const savedTheme = localStorage.getItem('peskovsky-portfolio-theme') || 'light';
  applyTheme(savedTheme);

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'light' ? 'dark' : 'light';
      applyTheme(next);
      localStorage.setItem('peskovsky-portfolio-theme', next);
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
// 2. ДАННЫЕ ПРОФИЛЯ И ДВЕ КНОПКИ (EMAIL & INSTAGRAM)
// ==========================================================================
function initProfile() {
  if (typeof PROFILE_DATA === 'undefined') return;

  const nameEl = document.getElementById('brand-name');
  const roleEl = document.getElementById('brand-role');

  if (nameEl) nameEl.textContent = PROFILE_DATA.name;
  if (roleEl) roleEl.textContent = PROFILE_DATA.role;

  // Настройка двух кнопок: Email и Instagram
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
// 3. КАРУСЕЛЬ РАБОТ
// ==========================================================================
let currentFilter = 'all';
let filteredProjects = [];
let currentIndex = 0;

function initCarousel() {
  if (typeof PROJECTS === 'undefined' || PROJECTS.length === 0) return;

  filteredProjects = [...PROJECTS];
  currentIndex = 0;

  // Инициализация фильтров
  const filterTabs = document.querySelectorAll('.filter-tab');
  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      currentFilter = tab.dataset.filter;
      filteredProjects = currentFilter === 'all' 
        ? [...PROJECTS] 
        : PROJECTS.filter(p => p.category === currentFilter);

      currentIndex = 0;
      updateCarousel();
    });
  });

  // Кнопки карусели: влево / вправо
  const prevBtn = document.getElementById('carousel-prev');
  const nextBtn = document.getElementById('carousel-next');

  if (prevBtn) {
    prevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      prevSlide();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      nextSlide();
    });
  }

  // Клик по основному экрану открывает проект
  const viewport = document.getElementById('carousel-viewport');
  if (viewport) {
    viewport.addEventListener('click', () => {
      if (filteredProjects[currentIndex]) {
        openModal(filteredProjects[currentIndex].id);
      }
    });
  }

  // Навигация стрелками на клавиатуре
  document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('project-modal');
    if (modal && modal.classList.contains('active')) return;

    if (e.key === 'ArrowRight') nextSlide();
    if (e.key === 'ArrowLeft') prevSlide();
  });

  // Свайп на мобильных устройствах
  if (viewport) {
    let touchStartX = 0;
    let touchEndX = 0;

    viewport.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    viewport.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      if (touchStartX - touchEndX > 50) nextSlide();
      if (touchEndX - touchStartX > 50) prevSlide();
    }, { passive: true });
  }

  updateCarousel();
}

function prevSlide() {
  if (filteredProjects.length <= 1) return;
  currentIndex = (currentIndex - 1 + filteredProjects.length) % filteredProjects.length;
  updateCarousel();
}

function nextSlide() {
  if (filteredProjects.length <= 1) return;
  currentIndex = (currentIndex + 1) % filteredProjects.length;
  updateCarousel();
}

function updateCarousel() {
  const project = filteredProjects[currentIndex];
  if (!project) return;

  // Элементы
  const imgEl = document.getElementById('carousel-img');
  const counterTop = document.getElementById('carousel-counter-top');
  const catBadge = document.getElementById('carousel-category-badge');
  const yearEl = document.getElementById('carousel-year');
  const titleEl = document.getElementById('carousel-title');
  const roleEl = document.getElementById('carousel-role');
  const thumbsContainer = document.getElementById('carousel-thumbs');

  // Главное изображение
  if (imgEl) {
    imgEl.src = project.thumbnail;
    imgEl.alt = project.title;
  }

  // Счетчик вида: 01 / 08
  const currentNum = String(currentIndex + 1).padStart(2, '0');
  const totalNum = String(filteredProjects.length).padStart(2, '0');
  if (counterTop) counterTop.textContent = `${currentNum} / ${totalNum}`;

  // Метаданные
  if (catBadge) catBadge.textContent = project.categoryLabel;
  if (yearEl) yearEl.textContent = project.year;
  if (titleEl) titleEl.textContent = project.title;
  if (roleEl) {
    const clientStr = project.client ? ` • ${project.client}` : '';
    roleEl.textContent = `${project.role}${clientStr}`;
  }

  // Обновление полосы миниатюр
  if (thumbsContainer) {
    thumbsContainer.innerHTML = filteredProjects.map((p, idx) => `
      <img 
        src="${escapeHtml(p.thumbnail)}" 
        alt="${escapeHtml(p.title)}" 
        class="thumb-item ${idx === currentIndex ? 'active' : ''}" 
        data-index="${idx}"
      >
    `).join('');

    thumbsContainer.querySelectorAll('.thumb-item').forEach(th => {
      th.addEventListener('click', (e) => {
        e.stopPropagation();
        currentIndex = parseInt(th.dataset.index, 10);
        updateCarousel();
      });
    });
  }
}

// ==========================================================================
// 4. МОДАЛЬНОЕ ОКНО ПРОЕКТА
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
  const project = PROJECTS.find(p => p.id === projectId);
  if (!project) return;

  const modal = document.getElementById('project-modal');
  const headerCat = document.getElementById('modal-header-cat');
  const mediaContainer = document.getElementById('modal-media-container');
  const titleEl = document.getElementById('modal-title');
  const metaContainer = document.getElementById('modal-meta-container');
  const descEl = document.getElementById('modal-desc');
  const toolsContainer = document.getElementById('modal-tools-container');

  if (headerCat) headerCat.textContent = project.categoryLabel;
  if (titleEl) titleEl.textContent = project.title;
  if (descEl) descEl.textContent = project.description;

  // Рендер плеера или фото
  if (mediaContainer) {
    mediaContainer.innerHTML = renderModalMedia(project);
    initModalGalleryEvents();
  }

  // Метаданные
  if (metaContainer) {
    metaContainer.innerHTML = `
      <div class="modal-meta-item">
        <strong>Заказчик</strong>
        <span>${escapeHtml(project.client || '—')}</span>
      </div>
      <div class="modal-meta-item">
        <strong>Роль</strong>
        <span>${escapeHtml(project.role)}</span>
      </div>
      <div class="modal-meta-item">
        <strong>Год</strong>
        <span>${escapeHtml(project.year)}</span>
      </div>
      ${project.externalLink ? `
      <div class="modal-meta-item">
        <strong>Ссылка</strong>
        <a href="${escapeHtml(project.externalLink)}" target="_blank" rel="noopener" style="color: var(--text-color); font-weight: bold; text-decoration: underline;">Смотреть онлайн ↗</a>
      </div>
      ` : ''}
    `;
  }

  // Сетап и инструменты
  if (toolsContainer) {
    if (project.tools && project.tools.length > 0) {
      toolsContainer.innerHTML = `
        <div class="modal-tools-list">
          ${project.tools.map(t => `<span class="tag-badge">${escapeHtml(t)}</span>`).join('')}
        </div>
      `;
    } else {
      toolsContainer.innerHTML = '';
    }
  }

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function renderModalMedia(project) {
  // Видео с YouTube
  if (project.mediaType === 'youtube') {
    return `
      <div class="modal-media-wrapper">
        <iframe 
          class="modal-video-frame" 
          src="${escapeHtml(project.mediaUrl)}?autoplay=1&rel=0&modestbranding=1" 
          title="${escapeHtml(project.title)}" 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
          allowfullscreen>
        </iframe>
      </div>
    `;
  }

  // Серия фотографий
  if (project.gallery && project.gallery.length > 1) {
    return `
      <div class="modal-media-wrapper">
        <img id="modal-main-img" class="modal-image-view" src="${escapeHtml(project.gallery[0])}" alt="${escapeHtml(project.title)}">
      </div>
      <div class="modal-gallery-thumbs">
        ${project.gallery.map((img, idx) => `
          <img src="${escapeHtml(img)}" class="modal-thumb ${idx === 0 ? 'active' : ''}" data-src="${escapeHtml(img)}" alt="Кадр ${idx + 1}">
        `).join('')}
      </div>
    `;
  }

  // Одиночное фото или скриншот
  return `
    <div class="modal-media-wrapper">
      <img class="modal-image-view" src="${escapeHtml(project.mediaUrl || project.thumbnail)}" alt="${escapeHtml(project.title)}">
    </div>
  `;
}

function initModalGalleryEvents() {
  const thumbs = document.querySelectorAll('.modal-thumb');
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
