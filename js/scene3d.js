/**
 * Александр Песковский — 2026
 * 3D Scrollytelling Engine (Three.js + GSAP ScrollTrigger)
 */

import * as THREE from 'three';
import { GLTFLoader } from './vendor/GLTFLoader.js';

// =============================================================================
// КОНФИГУРАЦИЯ СЦЕНЫ И КАМЕРЫ
// =============================================================================
const CAMERA_WAYPOINTS = [
  // 0: Вход / Общий вид станции и вагона метро
  {
    desktop: { pos: new THREE.Vector3(0.9, 1.42, -3.15), target: new THREE.Vector3(-0.35, 1.45, -0.05) },
    mobile:  { pos: new THREE.Vector3(1.1, 1.42, -3.45), target: new THREE.Vector3(-0.35, 1.45, -0.05) }
  },
  // 1: Фокус на первом экране («Свэг»)
  {
    desktop: { pos: new THREE.Vector3(-0.35, 1.50, -1.05), target: new THREE.Vector3(-0.35, 1.50, -0.046) },
    mobile:  { pos: new THREE.Vector3(-0.35, 1.50, -1.45), target: new THREE.Vector3(-0.35, 1.50, -0.046) }
  },
  // 2: Фокус на втором экране («Мини свэг»)
  {
    desktop: { pos: new THREE.Vector3(-2.475, 1.50, -1.05), target: new THREE.Vector3(-2.475, 1.50, -0.046) },
    mobile:  { pos: new THREE.Vector3(-2.475, 1.50, -1.45), target: new THREE.Vector3(-2.475, 1.50, -0.046) }
  },
  // 3: Финальный кинематографичный откат (Контакты)
  {
    desktop: { pos: new THREE.Vector3(-1.40, 1.45, -2.55), target: new THREE.Vector3(-0.55, 1.40, 0.05) },
    mobile:  { pos: new THREE.Vector3(-1.40, 1.45, -2.95), target: new THREE.Vector3(-0.55, 1.40, 0.05) }
  }
];

// Глобальное состояние
let scene, camera, renderer;
let subwayModel;
let screen1Mesh, screen2Mesh;
let video1, video2;
let videoTexture1, videoTexture2;
let screenLight1, screenLight2;
let activeStage = 0;
let isGlobalMuted = true;

// Двери вагона (изначально открыты, закрываются при скролле)
let doorLeft, doorRight;
const DOOR_LEFT_OPEN_X = 2.05;
const DOOR_LEFT_CLOSED_X = 1.425;
const DOOR_RIGHT_OPEN_X = 0.15;
const DOOR_RIGHT_CLOSED_X = 0.775;
let targetDoorCloseRatio = 0.0; // 0.0 = открыты, 1.0 = закрыты
let currentDoorCloseRatio = 0.0;

// Векторы интерполяции камеры
const camCurrentPos = new THREE.Vector3();
const camCurrentTarget = new THREE.Vector3();
const camTargetPos = new THREE.Vector3();
const camTargetLookAt = new THREE.Vector3();

// Параллакс мыши и касаний
const mouseOffset = { x: 0, y: 0 };
const mouseOffsetDamped = { x: 0, y: 0 };

// Raycaster для интерактивности экранов
const raycaster = new THREE.Raycaster();
const mouseVec = new THREE.Vector2(-999, -999);
let hoveredScreen = null;

// =============================================================================
// ИНИЦИАЛИЗАЦИЯ
// =============================================================================
export function initSubwayScene() {
  const canvas = document.getElementById('webgl-canvas');
  if (!canvas) return;

  // 1. Создание рендерера
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // 2. Сцена
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07080a);
  scene.fog = new THREE.FogExp2(0x07080a, 0.04);

  // 3. Камера
  const isMobile = window.innerWidth < 768;
  const initialConfig = CAMERA_WAYPOINTS[0][isMobile ? 'mobile' : 'desktop'];
  camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 50);
  camera.position.copy(initialConfig.pos);
  camCurrentPos.copy(initialConfig.pos);
  camTargetPos.copy(initialConfig.pos);

  camCurrentTarget.copy(initialConfig.target);
  camTargetLookAt.copy(initialConfig.target);
  camera.lookAt(camCurrentTarget);

  // 4. Освещение вагона и станции
  setupSubwayLighting();

  // 5. Видеоэлементы и текстуры
  setupVideoTextures();

  // 6. Загрузка 3D модели
  loadSubwayModel();

  // 7. Слушатели событий (скролл, ресайз, параллакс)
  setupEventListeners();

  // 8. Запуск цикла рендеринга
  animate();
}

// =============================================================================
// ОСВЕЩЕНИЕ ВАГОНА МЕТРО (APPLE DARK CINEMATIC)
// =============================================================================
function setupSubwayLighting() {
  // Фоновый глубокий эмбиент
  const ambient = new THREE.AmbientLight(0x121722, 0.85);
  scene.add(ambient);

  // Потолочные люминесцентные лампы в вагоне
  const lamp1 = new THREE.PointLight(0xfff3df, 1.8, 6.0, 1.2);
  lamp1.position.set(0.85, 2.26, -0.35);
  scene.add(lamp1);

  const lamp2 = new THREE.PointLight(0xfff3df, 1.9, 6.0, 1.2);
  lamp2.position.set(-0.95, 2.26, -0.35);
  scene.add(lamp2);

  // Мягкий рассеянный свет платформы за дверями
  const platformLight1 = new THREE.PointLight(0x8ec3f8, 1.2, 7.0, 1.4);
  platformLight1.position.set(-0.95, 2.0, -2.2);
  scene.add(platformLight1);

  const platformLight2 = new THREE.PointLight(0x8ec3f8, 1.2, 7.0, 1.4);
  platformLight2.position.set(1.10, 2.0, -2.2);
  scene.add(platformLight2);

  // Динамические точечные источники света перед экранами (отсвет от видео)
  screenLight1 = new THREE.PointLight(0xffffff, 0.65, 3.0, 1.5);
  screenLight1.position.set(-0.35, 1.50, -0.25);
  scene.add(screenLight1);

  screenLight2 = new THREE.PointLight(0xffffff, 0.65, 3.0, 1.5);
  screenLight2.position.set(-2.475, 1.50, -0.25);
  scene.add(screenLight2);
}

// =============================================================================
// ВИДЕОТЕКСТУРЫ ДЛЯ ЭКРАНОВ ВАГОНА
// =============================================================================
function setupVideoTextures() {
  // Видео 1: Свэг
  video1 = document.getElementById('video-swag');
  if (video1) {
    video1.defaultMuted = true;
    video1.muted = true;
    video1.volume = 0;
    video1.playsInline = true;
    video1.loop = true;

    videoTexture1 = new THREE.VideoTexture(video1);
    videoTexture1.colorSpace = THREE.SRGBColorSpace;
    videoTexture1.minFilter = THREE.LinearFilter;
    videoTexture1.magFilter = THREE.LinearFilter;
    videoTexture1.generateMipmaps = false;

    // Автостарт воспроизведения без звука (безопасно для браузеров)
    video1.play().catch(() => {});
  }

  // Видео 2: Мини свэг
  video2 = document.getElementById('video-mini-swag');
  if (video2) {
    video2.defaultMuted = true;
    video2.muted = true;
    video2.volume = 0;
    video2.playsInline = true;
    video2.loop = true;

    videoTexture2 = new THREE.VideoTexture(video2);
    videoTexture2.colorSpace = THREE.SRGBColorSpace;
    videoTexture2.minFilter = THREE.LinearFilter;
    videoTexture2.magFilter = THREE.LinearFilter;
    videoTexture2.generateMipmaps = false;

    video2.play().catch(() => {});
  }
}

// =============================================================================
// ЗАГРУЗКА И НАСТРОЙКА 3D МОДЕЛИ ВАГОНА
// =============================================================================
function loadSubwayModel() {
  const loader = new GLTFLoader();
  const progressBar = document.getElementById('loader-progress-bar');
  const preloader = document.getElementById('scene-preloader');

  loader.load(
    'assets/models/subway.glb',
    (gltf) => {
      subwayModel = gltf.scene;

      // Настройка материалов для реалистичного тёмного стиля Apple
      subwayModel.traverse((child) => {
        if (!child.isMesh) return;

        // Поиск экранов
        if (child.name === 'Screen_1_Display') {
          screen1Mesh = child;
          if (videoTexture1) {
            child.material = new THREE.MeshStandardMaterial({
              map: videoTexture1,
              emissive: new THREE.Color(0xffffff),
              emissiveMap: videoTexture1,
              emissiveIntensity: 0.95,
              roughness: 0.15,
              metalness: 0.05
            });
          }
        } else if (child.name === 'Screen_2_Display') {
          screen2Mesh = child;
          if (videoTexture2) {
            child.material = new THREE.MeshStandardMaterial({
              map: videoTexture2,
              emissive: new THREE.Color(0xffffff),
              emissiveMap: videoTexture2,
              emissiveIntensity: 0.95,
              roughness: 0.15,
              metalness: 0.05
            });
          }
        }

        // Стекла окон и дверей
        if (child.name.includes('Glass') || (child.material && child.material.name === 'Mat_Glass')) {
          child.material = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(0x7aa5c2),
            transparent: true,
            opacity: 0.38,
            roughness: 0.08,
            metalness: 0.1,
            reflectivity: 0.9,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1
          });
        }

        // Металлические хромированные поручни
        if (child.name.includes('Pole') || (child.material && child.material.name === 'Mat_Metal_Pole')) {
          child.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0xd8dde4),
            roughness: 0.18,
            metalness: 0.96
          });
        }

        // Потолочные светильники
        if (child.material && child.material.name === 'Mat_Fluorescent_Light') {
          child.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0xfff6e5),
            emissive: new THREE.Color(0xfff1dc),
            emissiveIntensity: 2.2,
            roughness: 0.2
          });
        }

        // Темный пол вагона с приятным легким отражением
        if (child.name.includes('Floor') || (child.material && child.material.name === 'Mat_Dark_Floor')) {
          child.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0x23252a),
            roughness: 0.38,
            metalness: 0.22
          });
        }

        // Желтые и оранжевые ретро-сиденья
        if (child.material && child.material.name === 'Mat_Seat_Yellow') {
          child.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0xf2a91d),
            roughness: 0.45,
            metalness: 0.05
          });
        }
        if (child.material && child.material.name === 'Mat_Seat_Orange') {
          child.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0xdd521b),
            roughness: 0.45,
            metalness: 0.05
          });
        }
      });

      // Находим створки дверей вагона и устанавливаем их изначально ОТКРЫТЫМИ
      doorLeft = subwayModel.getObjectByName('Door_ScreenLeft');
      doorRight = subwayModel.getObjectByName('Door_ScreenRight');
      if (doorLeft && doorRight) {
        doorLeft.position.x = DOOR_LEFT_OPEN_X;
        doorRight.position.x = DOOR_RIGHT_OPEN_X;
      }

      scene.add(subwayModel);

      // Инициализация привязки скролла GSAP ScrollTrigger
      initScrollTriggers();

      // Плавное скрытие прелоадера
      if (preloader) {
        preloader.classList.add('fade-out');
        setTimeout(() => {
          preloader.style.display = 'none';
        }, 600);
      }
    },
    (xhr) => {
      if (progressBar && xhr.total) {
        const percent = Math.round((xhr.loaded / xhr.total) * 100);
        progressBar.style.width = `${percent}%`;
      }
    },
    (err) => {
      console.error('Ошибка загрузки 3D модели метро:', err);
      if (preloader) preloader.style.display = 'none';
    }
  );
}

// =============================================================================
// GSAP SCROLLTRIGGER: УПРАВЛЕНИЕ КАМЕРОЙ ПО СКРОЛЛУ
// =============================================================================
function initScrollTriggers() {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
    console.warn('GSAP или ScrollTrigger не обнаружены');
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  const isMobile = () => window.innerWidth < 768;
  const getWaypoint = (idx) => CAMERA_WAYPOINTS[idx][isMobile() ? 'mobile' : 'desktop'];

  // Основной timeline скроллинга через всю историю
  ScrollTrigger.create({
    trigger: '#scroll-story',
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1.0,
    onUpdate: (self) => {
      const p = self.progress; // 0.0 -> 1.0

      let fromIdx, toIdx, localT;
      if (p <= 0.33) {
        fromIdx = 0;
        toIdx = 1;
        localT = p / 0.33;
      } else if (p <= 0.67) {
        fromIdx = 1;
        toIdx = 2;
        localT = (p - 0.33) / 0.34;
      } else {
        fromIdx = 2;
        toIdx = 3;
        localT = (p - 0.67) / 0.33;
      }

      // Сглаживание перехода (smoothstep / power1 ease)
      const easedT = localT * localT * (3 - 2 * localT);

      const wpFrom = getWaypoint(fromIdx);
      const wpTo = getWaypoint(toIdx);

      camTargetPos.lerpVectors(wpFrom.pos, wpTo.pos, easedT);
      camTargetLookAt.lerpVectors(wpFrom.target, wpTo.target, easedT);

      // Двери вагона плавно закрываются при пролистывании сайта (от 0% до 28% скролла)
      targetDoorCloseRatio = Math.min(Math.max(p / 0.28, 0.0), 1.0);

      // Определение текущего активного этапа
      const currentSectionIndex = Math.min(Math.floor(p * 3.3), 3);
      if (currentSectionIndex !== activeStage) {
        setActiveStage(currentSectionIndex);
      }
    }
  });

  // Отдельные триггеры для анимации появления HUD-оверлеев
  const stages = document.querySelectorAll('.story-stage');
  stages.forEach((stage, idx) => {
    ScrollTrigger.create({
      trigger: stage,
      start: 'top center',
      end: 'bottom center',
      onEnter: () => setActiveStage(idx),
      onEnterBack: () => setActiveStage(idx)
    });
  });
}

// =============================================================================
// ПЕРЕКЛЮЧЕНИЕ АКТИВНОГО ЭТАПА (HUD + АУДИО)
// =============================================================================
function setActiveStage(stageIndex) {
  activeStage = stageIndex;

  // Обновление навигационных кнопок в шапке
  const navBtns = document.querySelectorAll('.stage-nav-pill');
  navBtns.forEach((btn) => {
    const target = parseInt(btn.dataset.stage, 10);
    btn.classList.toggle('active', target === stageIndex);
  });

  // Обновление HUD элементов
  const stageElements = document.querySelectorAll('.story-stage');
  stageElements.forEach((el, idx) => {
    el.classList.toggle('active', idx === stageIndex);
  });

  // Управление звуком в зависимости от экрана
  syncAudioForActiveStage();
}

// =============================================================================
// СИНХРОНИЗАЦИЯ ЗВУКА И ВИДЕО
// =============================================================================
function syncAudioForActiveStage() {
  if (!video1 || !video2) return;

  if (isGlobalMuted) {
    video1.muted = true;
    video1.volume = 0;
    video2.muted = true;
    video2.volume = 0;
    return;
  }

  // Если звук включен глобально (тише на 33% -> громкость 0.67):
  const MEDIA_VOLUME = 0.67;
  if (activeStage === 1) {
    // В фокусе «Свэг»
    video1.muted = false;
    video1.volume = MEDIA_VOLUME;
    video2.muted = true;
    video2.volume = 0;
  } else if (activeStage === 2) {
    // В фокусе «Мини свэг»
    video2.muted = false;
    video2.volume = MEDIA_VOLUME;
    video1.muted = true;
    video1.volume = 0;
  } else {
    // На заставке или в контактах — мягко глушим оба звука
    video1.muted = true;
    video1.volume = 0;
    video2.muted = true;
    video2.volume = 0;
  }

  updateSoundButtonUI();
}

export function toggleGlobalSound() {
  isGlobalMuted = !isGlobalMuted;
  syncAudioForActiveStage();
  updateSoundButtonUI();
  return !isGlobalMuted;
}

function updateSoundButtonUI() {
  const soundBtns = document.querySelectorAll('.sound-toggle-btn');
  soundBtns.forEach((btn) => {
    btn.classList.toggle('sound-on', !isGlobalMuted);
    const label = btn.querySelector('.sound-btn-label');
    const icon = btn.querySelector('.sound-btn-icon');
    if (label) {
      label.textContent = isGlobalMuted ? 'Без звука' : 'Звук вкл';
    }
    if (icon) {
      icon.innerHTML = isGlobalMuted
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
    }
  });
}

// Плавный скролл к выбранному этапу
export function scrollToStage(stageIndex) {
  const stageEls = document.querySelectorAll('.story-stage');
  if (stageEls[stageIndex]) {
    stageEls[stageIndex].scrollIntoView({ behavior: 'smooth' });
  }
}

// =============================================================================
// ПАРАЛЛАКС И ОБРАБОТЧИКИ СОБЫТИЙ
// =============================================================================
function setupEventListeners() {
  // Движение мыши для кинематографичного параллакса
  window.addEventListener('mousemove', (e) => {
    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const ny = -(e.clientY / window.innerHeight) * 2 + 1;

    mouseOffset.x = nx * 0.08;
    mouseOffset.y = ny * 0.05;

    // Вектор луча для Raycaster
    mouseVec.x = nx;
    mouseVec.y = ny;
  }, { passive: true });

  // Тач-параллакс для телефонов
  window.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      const nx = (touch.clientX / window.innerWidth) * 2 - 1;
      const ny = -(touch.clientY / window.innerHeight) * 2 + 1;
      mouseOffset.x = nx * 0.04;
      mouseOffset.y = ny * 0.03;
    }
  }, { passive: true });

  // Клик по экрану в 3D пространстве
  window.addEventListener('click', (e) => {
    // Не срабатывать, если клик был по интерфейсу (кнопкам)
    if (e.target.closest('button, a, input, .glass-capsule, .site-header')) return;

    if (hoveredScreen) {
      if (hoveredScreen === screen1Mesh) {
        scrollToStage(1);
        toggleVideoPlay(video1);
      } else if (hoveredScreen === screen2Mesh) {
        scrollToStage(2);
        toggleVideoPlay(video2);
      }
    }
  });

  // Ресайз окна
  window.addEventListener('resize', onWindowResize, { passive: true });
}

function toggleVideoPlay(video) {
  if (!video) return;
  if (video.paused) {
    video.play().catch(() => {});
  } else {
    video.pause();
  }
  updatePlayButtonsUI();
}

function updatePlayButtonsUI() {
  const playBtn1 = document.getElementById('play-btn-stage1');
  const playBtn2 = document.getElementById('play-btn-stage2');

  const getPlaySvg = (isPaused) => isPaused
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg>`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect></svg>`;

  if (playBtn1 && video1) playBtn1.innerHTML = getPlaySvg(video1.paused);
  if (playBtn2 && video2) playBtn2.innerHTML = getPlaySvg(video2.paused);
}

function onWindowResize() {
  if (!camera || !renderer) return;

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Обновление ScrollTrigger при ресайзе
  if (typeof ScrollTrigger !== 'undefined') {
    ScrollTrigger.refresh();
  }
}

// =============================================================================
// ЦИКЛ РЕНДЕРИНГА (ANIMATE LOOP)
// =============================================================================
function animate() {
  requestAnimationFrame(animate);

  // 1. Плавная интерполяция позиции камеры (lerp)
  camCurrentPos.lerp(camTargetPos, 0.08);
  camCurrentTarget.lerp(camTargetLookAt, 0.08);

  // 2. Демпфирование мышиного параллакса
  mouseOffsetDamped.x += (mouseOffset.x - mouseOffsetDamped.x) * 0.06;
  mouseOffsetDamped.y += (mouseOffset.y - mouseOffsetDamped.y) * 0.06;

  // 2.1 Плавное пневматическое закрытие/открытие створок дверей вагона
  currentDoorCloseRatio += (targetDoorCloseRatio - currentDoorCloseRatio) * 0.08;
  if (doorLeft && doorRight) {
    doorLeft.position.x = THREE.MathUtils.lerp(DOOR_LEFT_OPEN_X, DOOR_LEFT_CLOSED_X, currentDoorCloseRatio);
    doorRight.position.x = THREE.MathUtils.lerp(DOOR_RIGHT_OPEN_X, DOOR_RIGHT_CLOSED_X, currentDoorCloseRatio);
  }

  // Применение позиции с учетом кинематографичного покачивания
  camera.position.set(
    camCurrentPos.x + mouseOffsetDamped.x,
    camCurrentPos.y + mouseOffsetDamped.y,
    camCurrentPos.z
  );
  camera.lookAt(camCurrentTarget.x + mouseOffsetDamped.x * 0.5, camCurrentTarget.y, camCurrentTarget.z);

  // 3. Raycaster для определения наведения на экраны в 3D
  if (screen1Mesh && screen2Mesh) {
    raycaster.setFromCamera(mouseVec, camera);
    const intersects = raycaster.intersectObjects([screen1Mesh, screen2Mesh], false);

    if (intersects.length > 0) {
      hoveredScreen = intersects[0].object;
      document.body.style.cursor = 'pointer';
    } else {
      hoveredScreen = null;
      document.body.style.cursor = '';
    }
  }

  // 4. Синхронизация полосы прогресса видео
  syncScrubberUI();

  // 5. Рендер кадра
  renderer.render(scene, camera);
}

function syncScrubberUI() {
  // Видео 1
  if (video1 && video1.duration) {
    const progressEl1 = document.getElementById('timeline-progress-stage1');
    const timeText1 = document.getElementById('time-text-stage1');
    if (progressEl1) {
      const pct = (video1.currentTime / video1.duration) * 100;
      progressEl1.style.width = `${pct}%`;
    }
    if (timeText1) {
      timeText1.textContent = formatTime(video1.currentTime);
    }
  }

  // Видео 2
  if (video2 && video2.duration) {
    const progressEl2 = document.getElementById('timeline-progress-stage2');
    const timeText2 = document.getElementById('time-text-stage2');
    if (progressEl2) {
      const pct = (video2.currentTime / video2.duration) * 100;
      progressEl2.style.width = `${pct}%`;
    }
    if (timeText2) {
      timeText2.textContent = formatTime(video2.currentTime);
    }
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// Экспорт для управления воспроизведением из внешнего UI
export function getVideos() {
  return { video1, video2 };
}
