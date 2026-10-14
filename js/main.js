/**
 * Александр Песковский — 2026
 * Логика плеера в стиле iOS Photos (по скриншоту)
 */

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initContactLinks();
  initCinemaPlayer();
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
  const mainVideo = document.getElementById('cinema-main-video');
  const viewport = document.getElementById('cinema-viewport');
  const playBtn = document.getElementById('btn-play-pause');
  const timelineWrap = document.getElementById('timeline-wrap');
  const progressEl = document.getElementById('timeline-progress');

  const updatePlayBtnIcon = (isPlaying) => {
    if (!playBtn) return;
    playBtn.innerHTML = isPlaying
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg>`;
  };

  const updateSoundBtnIcon = () => {
    if (!soundBtn || !mainVideo) return;
    soundBtn.innerHTML = mainVideo.muted
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
  };

  const togglePlayback = () => {
    if (!mainVideo) return;
    if (mainVideo.paused) {
      mainVideo.play().then(() => updatePlayBtnIcon(true)).catch(() => {});
    } else {
      mainVideo.pause();
      updatePlayBtnIcon(false);
    }
  };

  if (viewport) {
    viewport.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePlayback();
    });
  }

  if (playBtn) {
    playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePlayback();
    });
  }

  if (soundBtn) {
    soundBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (mainVideo) {
        mainVideo.muted = !mainVideo.muted;
        isMuted = mainVideo.muted;
        updateSoundBtnIcon();
      }
    });
  }

  if (mainVideo) {
    mainVideo.addEventListener('play', () => updatePlayBtnIcon(true));
    mainVideo.addEventListener('pause', () => updatePlayBtnIcon(false));
    mainVideo.addEventListener('timeupdate', () => {
      if (progressEl && mainVideo.duration) {
        const percent = (mainVideo.currentTime / mainVideo.duration) * 100;
        progressEl.style.width = `${percent}%`;
      }
    });
  }

  // Клик по таймлайну (скруббер)
  if (timelineWrap && progressEl) {
    timelineWrap.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!mainVideo || !mainVideo.duration) return;
      const rect = timelineWrap.getBoundingClientRect();
      const percent = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
      mainVideo.currentTime = percent * mainVideo.duration;
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

  // Загрузка локального медиафайла (через все кнопки загрузки на странице)
  const fileInputs = document.querySelectorAll('.media-file-input, #video-file-input');
  fileInputs.forEach(input => {
    input.addEventListener('change', handleMediaUpload);
  });

  loadCategory();
}

function handleMediaUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const fileUrl = URL.createObjectURL(file);
  const isVideo = file.type.startsWith('video') || file.name.match(/\.(mp4|mov|webm|m4v)$/i);
  const clientName = file.name.replace(/\.[^/.]+$/, '').trim() || 'Новый проект';

  // Создаем работу МГНОВЕННО
  const newWork = {
    id: Date.now(),
    client: clientName,
    title: clientName,
    category: isVideo ? 'video' : 'creative',
    categoryLabel: isVideo ? 'Видео' : 'Креатив',
    badge: isVideo ? 'Shot on iPhone' : 'Медиа',
    year: '2026',
    mediaType: isVideo ? 'video_file' : 'image',
    mediaUrl: fileUrl,
    thumbnail: isVideo ? 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop&q=80' : fileUrl
  };

  PROJECTS.unshift(newWork);
  currentTab = newWork.category;

  document.querySelectorAll('.cat-switch-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === currentTab);
  });

  currentIndex = 0;
  loadCategory();

  // Если это видео, пытаемся захватить стоп-кадр асинхронно
  if (isVideo) {
    const tempVideo = document.createElement('video');
    tempVideo.src = fileUrl;
    tempVideo.muted = true;
    tempVideo.playsInline = true;
    tempVideo.crossOrigin = 'anonymous';

    const captureThumb = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 480;
        canvas.height = 270;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        if (dataUrl && dataUrl.length > 500) {
          newWork.thumbnail = dataUrl;
          renderCinemaSlide();
        }
      } catch (err) {}
    };

    tempVideo.addEventListener('loadeddata', () => {
      tempVideo.currentTime = Math.min(0.5, (tempVideo.duration || 1) / 3);
    });
    tempVideo.addEventListener('seeked', captureThumb);
  }

  // Сбрасываем input для возможности повторной загрузки
  e.target.value = '';
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
  const mainImg = document.getElementById('cinema-main-img');
  const mainVideo = document.getElementById('cinema-main-video');
  const clientEl = document.getElementById('cinema-client');
  const badgeEl = document.getElementById('cinema-badge');
  const filmstrip = document.getElementById('cinema-filmstrip');
  const progressEl = document.getElementById('timeline-progress');

  if (!activeList || activeList.length === 0) {
    if (mainVideo) {
      mainVideo.pause();
      mainVideo.style.display = 'none';
    }
    if (mainImg) {
      mainImg.style.display = 'block';
      mainImg.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450"><rect width="800" height="450" fill="%230c0c0e"/><g fill="none" stroke="%23ffffff" stroke-width="1.5" opacity="0.3"><circle cx="400" cy="205" r="36"/><line x1="400" y1="187" x2="400" y2="223"/><line x1="382" y1="205" x2="418" y2="205"/></g><text x="400" y="275" fill="%23ffffff" font-family="-apple-system,sans-serif" font-size="14" font-weight="600" opacity="0.45" text-anchor="middle">Загрузите видео или фото</text></svg>';
      mainImg.style.opacity = '1';
    }
    if (clientEl) clientEl.textContent = 'Нет работ';
    if (badgeEl) badgeEl.textContent = currentTab === 'video' ? 'Shot on iPhone' : 'Креатив';
    if (progressEl) progressEl.style.width = '0%';
    if (filmstrip) {
      filmstrip.innerHTML = `
        <label class="filmstrip-thumb" style="display:flex; align-items:center; justify-content:center; border:1px dashed rgba(255,255,255,0.3); opacity:0.8; cursor:pointer;" title="Загрузить медиа">
          <input type="file" class="media-file-input" accept="video/*,image/*" style="display: none;">
          <span style="font-size:18px; color:#fff;">+</span>
        </label>
      `;
      const input = filmstrip.querySelector('.media-file-input');
      if (input) input.addEventListener('change', handleMediaUpload);
    }
    return;
  }

  const work = activeList[currentIndex];
  if (!work) return;

  // Если это видеофайл — воспроизводим прямо на экране
  if (work.mediaType === 'video_file' || (work.mediaUrl && work.mediaUrl.startsWith('blob:'))) {
    if (mainImg) mainImg.style.display = 'none';
    if (mainVideo) {
      mainVideo.style.display = 'block';
      mainVideo.loop = true;
      mainVideo.playsInline = true;
      mainVideo.muted = isMuted;
      if (work.thumbnail) mainVideo.poster = work.thumbnail;
      if (mainVideo.src !== work.mediaUrl) {
        mainVideo.src = work.mediaUrl;
        mainVideo.preload = 'auto';
        mainVideo.play().catch(() => {});
      }
    }
  } else {
    if (mainVideo) {
      mainVideo.pause();
      mainVideo.style.display = 'none';
    }
    if (mainImg) {
      mainImg.style.display = 'block';
      mainImg.style.opacity = '0.35';
      setTimeout(() => {
        mainImg.src = work.thumbnail || work.mediaUrl;
        mainImg.alt = work.client;
        mainImg.style.opacity = '1';
      }, 90);
    }
  }

  // Только: ДЛЯ КОГО РАБОТА и SHOT ON IPHONE
  if (clientEl) clientEl.textContent = work.client;
  if (badgeEl) badgeEl.textContent = work.badge || (work.category === 'video' ? 'Shot on iPhone' : 'Креатив');

  // Сброс прогресса таймлайна для нового видео
  if (progressEl) {
    progressEl.style.width = '0%';
  }

  // Лента кадров (Filmstrip Scrubber) точно как на скриншоте
  if (filmstrip) {
    filmstrip.innerHTML = activeList.map((item, idx) => {
      const isVideoThumb = item.thumbnail && item.thumbnail.match(/\.(mp4|mov|webm)$/i);
      const thumbContent = isVideoThumb
        ? `<video src="${escapeHtml(item.thumbnail)}#t=0.5" muted playsinline preload="metadata" style="width:100%; height:100%; object-fit:cover; pointer-events:none;"></video>`
        : `<img src="${escapeHtml(item.thumbnail)}" alt="${escapeHtml(item.client)}">`;
      return `
        <div class="filmstrip-thumb ${idx === currentIndex ? 'active' : ''}" data-idx="${idx}">
          ${thumbContent}
        </div>
      `;
    }).join('');

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

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
