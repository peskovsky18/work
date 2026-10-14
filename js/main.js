/**
 * Александр Песковский — 2026
 * Логика плеера в стиле iOS Photos (по скриншоту)
 */

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initContactLinks();
  initCinemaPlayer();
  initCinemaModal();
});

// ==========================================================================
// 1. ТЕМА ОФОРМЛЕНИЯ
// ==========================================================================
function initTheme() {
  const toggleBtn = document.getElementById('theme-toggle');
  const saved = localStorage.getItem('peskovsky-theme-player') || 'light';
  applyTheme(saved);

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'light' ? 'dark' : 'light';
      applyTheme(next);
      localStorage.setItem('peskovsky-theme-player', next);
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
// 3. ПЛЕЕР IOS PHOTOS (В ТОЧНОСТИ ПО СКРИНШОТУ)
// ==========================================================================
let currentTab = 'video'; // 'video' | 'creative'
let activeList = [];
let currentIndex = 0;
let isMuted = false;
let isLiked = false;

function initCinemaPlayer() {
  if (typeof PROJECTS === 'undefined') return;

  // Переключатель двух разделов: «Видео» и «Креатив»
  const tabBtns = document.querySelectorAll('.cat-switch-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      currentTab = btn.dataset.tab;
      currentIndex = 0;
      loadCategory();
    });
  });

  // Стрелки навигации в левой и правой верхней капсуле
  const prevBtn = document.getElementById('btn-cinema-prev');
  const nextBtn = document.getElementById('btn-cinema-next');

  if (prevBtn) prevBtn.addEventListener('click', (e) => { e.stopPropagation(); prevSlide(); });
  if (nextBtn) nextBtn.addEventListener('click', (e) => { e.stopPropagation(); nextSlide(); });

  // Сердечко (лайк) как в iOS
  const heartBtn = document.getElementById('btn-cinema-heart');
  if (heartBtn) {
    heartBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      isLiked = !isLiked;
      heartBtn.classList.toggle('liked', isLiked);
      heartBtn.innerHTML = isLiked 
        ? `<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`
        : `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
    });
  }

  // Кнопка «Поделиться»
  const shareBtn = document.getElementById('btn-cinema-share');
  if (shareBtn) {
    shareBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(window.location.href);
      const originalTitle = document.getElementById('cinema-client').textContent;
      document.getElementById('cinema-client').textContent = 'Ссылка скопирована ✓';
      setTimeout(() => {
        document.getElementById('cinema-client').textContent = originalTitle;
      }, 1500);
    });
  }

  // Кнопка звука
  const soundBtn = document.getElementById('btn-sound-toggle');
  if (soundBtn) {
    soundBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      isMuted = !isMuted;
      soundBtn.innerHTML = isMuted 
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
    });
  }

  // Клик по экрану или кнопке Play открывает видео в кинотеатре
  const viewport = document.getElementById('cinema-viewport');
  const playBtn = document.getElementById('btn-play-pause');
  const expandBtn = document.getElementById('btn-cinema-expand');

  const openActiveVideo = () => {
    const work = activeList[currentIndex];
    if (work) openCinemaModal(work);
  };

  if (viewport) viewport.addEventListener('click', openActiveVideo);
  if (playBtn) playBtn.addEventListener('click', (e) => { e.stopPropagation(); openActiveVideo(); });
  if (expandBtn) expandBtn.addEventListener('click', (e) => { e.stopPropagation(); openActiveVideo(); });

  // Клик по таймлайну (скруббер)
  const timelineWrap = document.getElementById('timeline-wrap');
  const progressEl = document.getElementById('timeline-progress');
  if (timelineWrap && progressEl) {
    timelineWrap.addEventListener('click', (e) => {
      e.stopPropagation();
      const rect = timelineWrap.getBoundingClientRect();
      const percent = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0.05), 0.95);
      progressEl.style.width = `${percent * 100}%`;
    });
  }

  // Свайпы на мобильных устройствах
  if (viewport) {
    let touchStartX = 0;
    viewport.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    viewport.addEventListener('touchend', (e) => {
      const touchEndX = e.changedTouches[0].screenX;
      if (touchStartX - touchEndX > 50) nextSlide();
      if (touchEndX - touchStartX > 50) prevSlide();
    }, { passive: true });
  }

  // Стрелки клавиатуры
  document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('cinema-modal');
    if (modal && modal.classList.contains('active')) return;

    if (e.key === 'ArrowRight') nextSlide();
    if (e.key === 'ArrowLeft') prevSlide();
  });

  // Загрузка локального видеофайла
  const fileInput = document.getElementById('video-file-input');
  if (fileInput) {
    fileInput.addEventListener('change', handleLocalVideoUpload);
  }

  loadCategory();
}

function handleLocalVideoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const fileUrl = URL.createObjectURL(file);
  const clientName = prompt('Имя клиента / проекта:', file.name.replace(/\.[^/.]+$/, '')) || 'Новый проект';

  // Создаем невидимый видео-элемент для захвата стоп-кадра
  const tempVideo = document.createElement('video');
  tempVideo.src = fileUrl;
  tempVideo.muted = true;
  tempVideo.playsInline = true;
  tempVideo.crossOrigin = 'anonymous';

  tempVideo.addEventListener('loadeddata', () => {
    tempVideo.currentTime = Math.min(1, (tempVideo.duration || 2) / 3);
  });

  tempVideo.addEventListener('seeked', () => {
    let thumb = '';
    try {
      const canvas = document.createElement('canvas');
      canvas.width = tempVideo.videoWidth || 640;
      canvas.height = tempVideo.videoHeight || 360;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
      thumb = canvas.toDataURL('image/jpeg', 0.85);
    } catch (err) {
      thumb = 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=1600&auto=format&fit=crop&q=85';
    }

    addNewVideoWork(clientName, fileUrl, thumb);
  });

  tempVideo.addEventListener('error', () => {
    addNewVideoWork(clientName, fileUrl, 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=1600&auto=format&fit=crop&q=85');
  });
}

function addNewVideoWork(clientName, fileUrl, thumb) {
  const newWork = {
    id: Date.now(),
    client: clientName,
    title: clientName,
    category: 'video',
    categoryLabel: 'Видео',
    badge: 'Shot on iPhone',
    year: '2026',
    mediaType: 'video_file',
    mediaUrl: fileUrl,
    thumbnail: thumb
  };

  PROJECTS.unshift(newWork);
  currentTab = 'video';

  document.querySelectorAll('.cat-switch-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === 'video');
  });

  currentIndex = 0;
  loadCategory();
  openCinemaModal(newWork);
}

function loadCategory() {
  activeList = PROJECTS.filter(p => p.category === currentTab);
  renderCinemaSlide();
}

function prevSlide() {
  if (activeList.length <= 1) return;
  currentIndex = (currentIndex - 1 + activeList.length) % activeList.length;
  renderCinemaSlide();
}

function nextSlide() {
  if (activeList.length <= 1) return;
  currentIndex = (currentIndex + 1) % activeList.length;
  renderCinemaSlide();
}

function renderCinemaSlide() {
  const work = activeList[currentIndex];
  if (!work) return;

  const mainImg = document.getElementById('cinema-main-img');
  const clientEl = document.getElementById('cinema-client');
  const badgeEl = document.getElementById('cinema-badge');
  const filmstrip = document.getElementById('cinema-filmstrip');
  const progressEl = document.getElementById('timeline-progress');

  // Главный стоп-кадр с мягким переходом
  if (mainImg) {
    mainImg.style.opacity = '0.35';
    setTimeout(() => {
      mainImg.src = work.thumbnail;
      mainImg.alt = work.client;
      mainImg.style.opacity = '1';
    }, 90);
  }

  // Только: ДЛЯ КОГО РАБОТА и SHOT ON IPHONE
  if (clientEl) clientEl.textContent = work.client;
  if (badgeEl) badgeEl.textContent = work.badge || (work.category === 'video' ? 'Shot on iPhone' : 'Креатив');

  // Случайный реалистичный прогресс таймлайна (как на скриншоте)
  if (progressEl) {
    const percentages = [28, 45, 18, 62, 35, 50];
    progressEl.style.width = `${percentages[currentIndex % percentages.length]}%`;
  }

  // Лента кадров (Filmstrip Scrubber) точно как на скриншоте
  if (filmstrip) {
    filmstrip.innerHTML = activeList.map((item, idx) => `
      <div class="filmstrip-thumb ${idx === currentIndex ? 'active' : ''}" data-idx="${idx}">
        <img src="${escapeHtml(item.thumbnail)}" alt="${escapeHtml(item.client)}">
      </div>
    `).join('');

    filmstrip.querySelectorAll('.filmstrip-thumb').forEach(th => {
      th.addEventListener('click', (e) => {
        e.stopPropagation();
        currentIndex = parseInt(th.dataset.idx, 10);
        renderCinemaSlide();
      });
    });

    // Центрируем выбранную миниатюру
    const activeThumb = filmstrip.children[currentIndex];
    if (activeThumb) {
      activeThumb.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }
}

// ==========================================================================
// 4. МОДАЛЬНЫЙ КИНОТЕАТР (ВОСПРОИЗВЕДЕНИЕ)
// ==========================================================================
function initCinemaModal() {
  const modal = document.getElementById('cinema-modal');
  const closeBtn = document.getElementById('modal-close-btn');

  if (!modal) return;
  if (closeBtn) closeBtn.addEventListener('click', closeCinemaModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeCinemaModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeCinemaModal();
    }
  });
}

function openCinemaModal(work) {
  const modal = document.getElementById('cinema-modal');
  const clientNameEl = document.getElementById('modal-client-name');
  const badgeEl = document.getElementById('modal-badge');
  const videoContainer = document.getElementById('modal-video-container');

  if (clientNameEl) clientNameEl.textContent = work.client;
  if (badgeEl) badgeEl.textContent = work.badge;

  if (videoContainer) {
    const isVideoFile = work.mediaType === 'video_file' || 
                        (work.mediaUrl && work.mediaUrl.match(/\.(mp4|mov|webm|m4v)$/i)) || 
                        (work.mediaUrl && work.mediaUrl.startsWith('blob:'));

    if (isVideoFile) {
      videoContainer.innerHTML = `
        <video 
          class="modal-video-frame" 
          controls 
          autoplay 
          playsinline 
          src="${escapeHtml(work.mediaUrl)}"
          style="width: 100%; aspect-ratio: 16/9; background: #000; display: block;">
          Ваш браузер не поддерживает встроенное видео.
        </video>
      `;
    } else if (work.mediaType === 'youtube') {
      videoContainer.innerHTML = `
        <iframe 
          class="modal-video-frame" 
          src="${escapeHtml(work.mediaUrl)}?autoplay=1&rel=0&modestbranding=1" 
          title="${escapeHtml(work.client)}" 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
          allowfullscreen>
        </iframe>
      `;
    } else {
      videoContainer.innerHTML = `
        <img src="${escapeHtml(work.mediaUrl || work.thumbnail)}" style="width:100%; aspect-ratio:16/9; object-fit:cover; display:block;" alt="${escapeHtml(work.client)}">
      `;
    }
  }

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeCinemaModal() {
  const modal = document.getElementById('cinema-modal');
  if (!modal) return;

  const videoContainer = document.getElementById('modal-video-container');
  if (videoContainer) {
    const video = videoContainer.querySelector('video');
    if (video) video.pause();
    videoContainer.innerHTML = '';
  }

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
