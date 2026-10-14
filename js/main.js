/**
 * ГЛАВНЫЙ ИНТЕРАКТИВНЫЙ СКРИПТ
 * Управление темами, фильтрами, модальным окном и рендером проектов
 */

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  renderProfile();
  initGallery();
  initContactCopy();
});

// ==========================================================================
// 1. УПРАВЛЕНИЕ ТЕМОЙ (Светлая «Скетчбук» / Темная «Темная комната»)
// ==========================================================================
function initTheme() {
  const themeToggle = document.getElementById('theme-toggle');
  const savedTheme = localStorage.getItem('media-portfolio-theme') || 'light';
  
  applyTheme(savedTheme);

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      applyTheme(newTheme);
      localStorage.setItem('media-portfolio-theme', newTheme);
    });
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.innerHTML = theme === 'dark' 
      ? '<span title="Переключить на светлую тему">☀️</span>' 
      : '<span title="Переключить на темную тему">🌙</span>';
  }
}

// ==========================================================================
// 2. ВЫВОД ДАННЫХ ПРОФИЛЯ
// ==========================================================================
function renderProfile() {
  if (typeof PROFILE_DATA === 'undefined') return;

  // Имя и слоган
  const nameEl = document.getElementById('hero-name');
  const aliasEl = document.getElementById('profile-alias');
  const taglineEl = document.getElementById('hero-tagline');
  const bioEl = document.getElementById('hero-bio');
  const statsContainer = document.getElementById('hero-stats');

  if (nameEl) nameEl.textContent = PROFILE_DATA.name;
  if (aliasEl) aliasEl.textContent = PROFILE_DATA.alias;
  if (taglineEl) taglineEl.textContent = PROFILE_DATA.tagline;
  if (bioEl) bioEl.textContent = PROFILE_DATA.bio;

  // Счетчики / Статистика
  if (statsContainer && PROFILE_DATA.stats) {
    statsContainer.innerHTML = PROFILE_DATA.stats.map(stat => `
      <div class="stat-card rough-box-alt">
        <div class="stat-number">${escapeHtml(stat.number)}</div>
        <div class="stat-label">${escapeHtml(stat.label)}</div>
      </div>
    `).join('');
  }

  // Услуги / Что делаю руками
  const servicesContainer = document.getElementById('services-grid');
  if (servicesContainer && PROFILE_DATA.services) {
    servicesContainer.innerHTML = PROFILE_DATA.services.map(s => `
      <div class="service-card rough-box">
        <div class="service-icon-box">
          ${getServiceIconSvg(s.icon)}
        </div>
        <h3 class="service-title">${escapeHtml(s.title)}</h3>
        <p class="service-desc">${escapeHtml(s.desc)}</p>
      </div>
    `).join('');
  }

  // Контакты
  const tgLink = document.getElementById('contact-telegram');
  const emailLink = document.getElementById('contact-email');
  const statusEl = document.getElementById('contact-status');

  if (tgLink) {
    tgLink.href = PROFILE_DATA.contacts.telegram;
    const label = tgLink.querySelector('.contact-label');
    if (label) label.textContent = PROFILE_DATA.contacts.telegramUsername;
  }

  if (emailLink) {
    emailLink.href = `mailto:${PROFILE_DATA.contacts.email}`;
    const label = emailLink.querySelector('.contact-label');
    if (label) label.textContent = PROFILE_DATA.contacts.email;
  }

  if (statusEl) {
    statusEl.textContent = PROFILE_DATA.contacts.status;
  }
}

// ==========================================================================
// 3. ГАЛЕРЕЯ И ФИЛЬТРАЦИЯ
// ==========================================================================
let currentFilter = 'all';
let activeModalProjectId = null;

function initGallery() {
  if (typeof PROJECTS === 'undefined') return;

  updateFilterCounts();
  renderProjectCards(PROJECTS);

  // Обработчики кнопок фильтров
  const filterButtons = document.querySelectorAll('.filter-btn');
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      
      const filtered = currentFilter === 'all' 
        ? PROJECTS 
        : PROJECTS.filter(p => p.category === currentFilter);
        
      renderProjectCards(filtered);
    });
  });

  // Инициализация модалки
  initModal();
}

function updateFilterCounts() {
  const counts = {
    all: PROJECTS.length,
    video: PROJECTS.filter(p => p.category === 'video').length,
    photo: PROJECTS.filter(p => p.category === 'photo').length,
    montage: PROJECTS.filter(p => p.category === 'montage').length,
    web: PROJECTS.filter(p => p.category === 'web').length
  };

  document.querySelectorAll('.filter-btn').forEach(btn => {
    const f = btn.dataset.filter;
    const countSpan = btn.querySelector('.count');
    if (countSpan && counts[f] !== undefined) {
      countSpan.textContent = `(${counts[f]})`;
    }
  });
}

function renderProjectCards(items) {
  const grid = document.getElementById('projects-grid');
  if (!grid) return;

  if (items.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 48px;" class="rough-box">
        <p class="scribble-note" style="font-size: 1.8rem;">В этом разделе пока тихо...</p>
        <p style="color: var(--text-muted); margin-top: 8px;">Разнорабочий уже готовит новые материалы.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = items.map(project => `
    <article class="project-card rough-box" data-id="${project.id}">
      <div class="tape"></div>
      <div class="card-media">
        <img src="${escapeHtml(project.thumbnail)}" alt="${escapeHtml(project.title)}" loading="lazy">
        <div class="card-action-overlay">
          <div class="play-doodle-btn">
            ${getActionIconSvg(project.category)}
          </div>
        </div>
      </div>
      <div class="card-body">
        <div class="card-meta-top">
          <span class="card-category">${escapeHtml(project.categoryLabel)}</span>
          <span class="card-year">${escapeHtml(project.year)}</span>
        </div>
        <h3 class="card-title">${escapeHtml(project.title)}</h3>
        <p class="card-role">${escapeHtml(project.role)}</p>
        <div class="card-tags">
          ${project.tags.map(tag => `<span class="tag-badge">#${escapeHtml(tag)}</span>`).join('')}
        </div>
      </div>
    </article>
  `).join('');

  // Навешиваем клик на карточки
  grid.querySelectorAll('.project-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = parseInt(card.dataset.id, 10);
      openModal(id);
    });
  });
}

// ==========================================================================
// 4. МОДАЛЬНОЕ ОКНО ПРОЕКТА (Плеер, Галерея, Детали)
// ==========================================================================
function initModal() {
  const modal = document.getElementById('project-modal');
  const closeBtn = document.getElementById('modal-close-btn');

  if (!modal) return;

  // Закрытие по крестику
  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }

  // Закрытие по клику вне модалки
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  // Закрытие по Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeModal();
    }
  });
}

function openModal(projectId) {
  const project = PROJECTS.find(p => p.id === projectId);
  if (!project) return;

  activeModalProjectId = projectId;
  const modal = document.getElementById('project-modal');
  const headerCat = document.getElementById('modal-header-cat');
  const mediaContainer = document.getElementById('modal-media-container');
  const titleEl = document.getElementById('modal-title');
  const metaContainer = document.getElementById('modal-meta-container');
  const descEl = document.getElementById('modal-desc');
  const toolsContainer = document.getElementById('modal-tools-container');

  // Категория в хедере
  if (headerCat) headerCat.textContent = project.categoryLabel;
  if (titleEl) titleEl.textContent = project.title;
  if (descEl) descEl.textContent = project.description;

  // Рендер Медиа-плеера / Картинки
  if (mediaContainer) {
    mediaContainer.innerHTML = renderModalMedia(project);
    initGalleryThumbs(project);
  }

  // Мета-информация
  if (metaContainer) {
    metaContainer.innerHTML = `
      <div class="modal-meta-item">
        <strong>Заказчик / Проект</strong>
        <span>${escapeHtml(project.client || '—')}</span>
      </div>
      <div class="modal-meta-item">
        <strong>Моя роль</strong>
        <span>${escapeHtml(project.role)}</span>
      </div>
      <div class="modal-meta-item">
        <strong>Год реализации</strong>
        <span>${escapeHtml(project.year)}</span>
      </div>
      ${project.externalLink ? `
      <div class="modal-meta-item">
        <strong>Ссылка</strong>
        <a href="${escapeHtml(project.externalLink)}" target="_blank" rel="noopener" style="color: var(--text-color); font-weight: bold; text-decoration: underline;">Открыть проект ↗</a>
      </div>
      ` : ''}
    `;
  }

  // Инструменты / Сетап
  if (toolsContainer) {
    if (project.tools && project.tools.length > 0) {
      toolsContainer.innerHTML = `
        <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 6px;">
          Инструменты и сетап:
        </div>
        <div class="modal-tools-list">
          ${project.tools.map(t => `<span class="tag-badge" style="background: var(--code-bg);">${escapeHtml(t)}</span>`).join('')}
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
  // 1. YouTube / Vimeo Video
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

  // 2. Локальный видеофайл MP4
  if (project.mediaType === 'video_file') {
    return `
      <div class="modal-media-wrapper">
        <video class="modal-video-frame" controls autoplay playsinline>
          <source src="${escapeHtml(project.mediaUrl)}" type="video/mp4">
          Ваш браузер не поддерживает видео.
        </video>
      </div>
    `;
  }

  // 3. Фотогалерея с серией кадров
  if (project.gallery && project.gallery.length > 1) {
    const mainImg = project.gallery[0];
    return `
      <div class="modal-media-wrapper">
        <img id="modal-main-img" class="modal-image-view" src="${escapeHtml(mainImg)}" alt="${escapeHtml(project.title)}">
      </div>
      <div class="modal-gallery-thumbs" id="modal-gallery-thumbs">
        ${project.gallery.map((img, idx) => `
          <img src="${escapeHtml(img)}" class="modal-thumb ${idx === 0 ? 'active' : ''}" data-src="${escapeHtml(img)}" alt="Кадр ${idx + 1}">
        `).join('')}
      </div>
    `;
  }

  // 4. Одиночное изображение / Веб-скриншот
  return `
    <div class="modal-media-wrapper">
      <img class="modal-image-view" src="${escapeHtml(project.mediaUrl || project.thumbnail)}" alt="${escapeHtml(project.title)}">
    </div>
  `;
}

function initGalleryThumbs(project) {
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

  // Очищаем медиа-контейнер, чтобы видео остановилось
  const mediaContainer = document.getElementById('modal-media-container');
  if (mediaContainer) {
    mediaContainer.innerHTML = '';
  }

  modal.classList.remove('active');
  document.body.style.overflow = '';
  activeModalProjectId = null;
}

// ==========================================================================
// 5. КОПИРОВАНИЕ КОНТАКТОВ В БУФЕР ОБМЕНА
// ==========================================================================
function initContactCopy() {
  const copyButtons = document.querySelectorAll('.copy-trigger');
  copyButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const textToCopy = btn.dataset.copyText;
      if (textToCopy) {
        navigator.clipboard.writeText(textToCopy).then(() => {
          showToast(`Скопировано: ${textToCopy}`);
        }).catch(() => {
          showToast('Не удалось скопировать');
        });
      }
    });
  });
}

function showToast(message) {
  let toast = document.getElementById('toast-msg');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-msg';
    toast.className = 'toast-msg';
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}

// ==========================================================================
// ХЕЛПЕРЫ И SVG-ИКОНКИ
// ==========================================================================
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getActionIconSvg(category) {
  switch(category) {
    case 'video':
      return `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>`;
    case 'montage':
      return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><line x1="20" y1="4" x2="8.12" y2="15.88"></line><line x1="14.47" y1="14.48" x2="20" y2="20"></line><line x1="8.12" y1="8.12" x2="12" y2="12"></line></svg>`;
    case 'photo':
      return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"></circle><line x1="14.31" y1="8" x2="20.05" y2="17.94"></line><line x1="9.69" y1="8" x2="21.17" y2="8"></line><line x1="7.38" y1="12" x2="13.12" y2="2.06"></line><line x1="9.69" y1="16" x2="3.95" y2="6.06"></line><line x1="14.31" y1="16" x2="2.83" y2="16"></line><line x1="16.62" y1="12" x2="10.88" y2="21.94"></line></svg>`;
    case 'web':
      return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>`;
    default:
      return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
  }
}

function getServiceIconSvg(icon) {
  switch(icon) {
    case 'camera':
      return `<svg class="doodle-icon" viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>`;
    case 'scissors':
      return `<svg class="doodle-icon" viewBox="0 0 24 24"><circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><line x1="20" y1="4" x2="8.12" y2="15.88"></line><line x1="14.47" y1="14.48" x2="20" y2="20"></line><line x1="8.12" y1="8.12" x2="12" y2="12"></line></svg>`;
    case 'aperture':
      return `<svg class="doodle-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="14.31" y1="8" x2="20.05" y2="17.94"></line><line x1="9.69" y1="8" x2="21.17" y2="8"></line><line x1="7.38" y1="12" x2="13.12" y2="2.06"></line><line x1="9.69" y1="16" x2="3.95" y2="6.06"></line><line x1="14.31" y1="16" x2="2.83" y2="16"></line><line x1="16.62" y1="12" x2="10.88" y2="21.94"></line></svg>`;
    case 'compass':
      return `<svg class="doodle-icon" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
    default:
      return `<svg class="doodle-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle></svg>`;
  }
}
