/**
 * Александр Песковский — 2026
 * 3D Scrollytelling Engine (Three.js + GSAP ScrollTrigger)
 */

import * as THREE from 'three';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { DRACOLoader } from './vendor/DRACOLoader.js';
import { initSubwayAudio, updateSubwayAudio, setSubwayMuted, playNavTick, playHapticChime, playDoorChime, playArrivalChime, startEscalatorAudio, stopEscalatorAudio } from './subwayAudio.js';
import { FreeRoamController } from './freeRoam.js';

// =============================================================================
// КОНФИГУРАЦИЯ СЦЕНЫ И КАМЕРЫ (ДВИЖЕНИЕ СТРОГО ПО ПРЯМОЙ ПО ЦЕНТРАЛЬНОМУ ПРОХОДУ: ВХОД -> ЭКРАНЫ СЛЕВА/СПРАВА -> ВЫХОД)
// =============================================================================
const CAMERA_WAYPOINTS = [
  // 0: Старт из глубокого торца вагона у межвагонной двери (X = -5.50), двери открыты на станции
  {
    desktop: { pos: new THREE.Vector3(-5.50, 1.40, -1.192), target: new THREE.Vector3(-2.675, 1.40, -0.016) },
    mobile:  { pos: new THREE.Vector3(-5.50, 1.40, -1.250), target: new THREE.Vector3(-2.675, 1.40, -0.016) }
  },
  // 1: Проект 1 («Свэг», видео 1, Screen 1 на X = -2.675) — точный центр экрана
  {
    desktop: { pos: new THREE.Vector3(-2.675, 1.40, -1.192), target: new THREE.Vector3(-2.675, 1.40, -0.016) },
    mobile:  { pos: new THREE.Vector3(-2.675, 1.40, -1.450), target: new THREE.Vector3(-2.675, 1.40, -0.016) }
  },
  // 2: Проект 2 («Мини свэг», видео 2, Screen 2 на X = -0.565) — точный центр экрана
  {
    desktop: { pos: new THREE.Vector3(-0.565, 1.40, -1.192), target: new THREE.Vector3(-0.565, 1.40, -0.016) },
    mobile:  { pos: new THREE.Vector3(-0.565, 1.40, -1.450), target: new THREE.Vector3(-0.565, 1.40, -0.016) }
  },
  // 3: Проект 3 («Ночной тоннель», Screen 3 на X = 0.515) — точный центр экрана
  {
    desktop: { pos: new THREE.Vector3(0.515, 1.40, -1.192), target: new THREE.Vector3(0.515, 1.40, -0.016) },
    mobile:  { pos: new THREE.Vector3(0.515, 1.40, -1.450), target: new THREE.Vector3(0.515, 1.40, -0.016) }
  },
  // 4: Проект 4 («Индустрия», Screen 4 на X = 2.675) — точный центр экрана
  {
    desktop: { pos: new THREE.Vector3(2.675, 1.40, -1.192), target: new THREE.Vector3(2.675, 1.40, -0.016) },
    mobile:  { pos: new THREE.Vector3(2.675, 1.40, -1.450), target: new THREE.Vector3(2.675, 1.40, -0.016) }
  },
  // 5: Прибытие на конечную станцию и выход к контактам (X = 3.765, выходная дверь)
  {
    desktop: { pos: new THREE.Vector3(3.765, 1.38, -1.192), target: new THREE.Vector3(3.765, 1.40, 1.800) },
    mobile:  { pos: new THREE.Vector3(3.765, 1.38, -1.350), target: new THREE.Vector3(3.765, 1.40, 1.800) }
  }
];

// Глобальное состояние
let scene, camera, renderer, clock;
let freeRoamController = null;
let subwayModel;
const screenMeshes = [];
let platformMapMesh;
let video1, video2, video3, video4;
let videoTexture1, videoTexture2, videoTexture3, videoTexture4;
let screenLight1, screenLight2;
let activeStage = 0;
let isGlobalMuted = true;

// Двери вагона
let doorLeft, doorRight, doorLeftD2, doorRightD2;
const DOOR_LEFT_OPEN_X = -2.850;
const DOOR_LEFT_CLOSED_X = -3.460;
const DOOR_RIGHT_OPEN_X = -4.680;
const DOOR_RIGHT_CLOSED_X = -4.070;
let targetDoorCloseRatio = 0.0; // 0.0 = открыты, 1.0 = закрыты (Двери 1)
let currentDoorCloseRatio = 0.0;
let targetDoor2OpenRatio = 0.0;  // 0.0 = закрыты, 1.0 = открыты (Двери 2)
let currentDoor2OpenRatio = 0.0;

// Состояние эскалатора (интерактивный 3D-спуск при загрузке)
let escalatorGroup;
let isEscalatorLoaded = false;
let isSubwayLoaded = false;
let isDescentActive = true;
let descentStartTime = 0;
const DESCENT_DURATION = 16000; // 16.0 секунд медитативного кинематографичного спуска в метро (плавно и без спешки)
const escalatorLights = [];


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

// Адаптивная динамическая производительность (Device Profiling & Adaptive Resolution)
let deviceTier = 'high';
let maxAllowedDPR = 1.5;
let minAllowedDPR = 0.75;
let currentDPR = 1.0;

export function getDevicePerformanceProfile() {
  const ua = (navigator.userAgent || '').toLowerCase();
  const isMobile = /android|iphone|ipad|ipod|webos|blackberry|iemobile|opera mini/i.test(ua) || window.innerWidth < 768;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;

  let isBudgetGPU = false;
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl') || probe.getContext('experimental-webgl');
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const ren = (gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '').toLowerCase();
        if (
          ren.includes('mali') ||
          ren.includes('adreno (tm) 3') ||
          ren.includes('adreno (tm) 4') ||
          ren.includes('adreno (tm) 5') ||
          ren.includes('adreno 610') ||
          ren.includes('adreno 612') ||
          ren.includes('intel hd') ||
          ren.includes('intel uhd') ||
          ren.includes('powervr') ||
          ren.includes('apple a10') ||
          ren.includes('apple a11') ||
          ren.includes('apple a12') ||
          ren.includes('apple a13')
        ) {
          isBudgetGPU = true;
        }
      }
    }
  } catch (e) {}

  if (isBudgetGPU || (isMobile && cores <= 4)) {
    return 'low';
  } else if (isMobile || cores <= 6 || mem <= 4) {
    return 'medium';
  }
  return 'high';
}

// =============================================================================
// ИНИЦИАЛИЗАЦИЯ
// =============================================================================
export function initSubwayScene() {
  const canvas = document.getElementById('webgl-canvas');
  if (!canvas) return;

  // 1. Создание рендерера с динамическим профилированием под устройство
  deviceTier = getDevicePerformanceProfile();
  const isLowTier = deviceTier === 'low';
  const isMidTier = deviceTier === 'medium';

  maxAllowedDPR = isLowTier ? 1.0 : (isMidTier ? 1.25 : 1.5);
  minAllowedDPR = isLowTier ? 0.70 : 0.85;
  currentDPR = Math.min(window.devicePixelRatio || 1, maxAllowedDPR);

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !isLowTier, // Отключаем MSAA на слабых устройствах (экономит 20-30% GPU)
    alpha: false,
    powerPreference: isLowTier ? 'default' : 'high-performance',
    stencil: false,
    depth: true
  });
  renderer.setPixelRatio(currentDPR);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.26;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
  }, false);

  canvas.addEventListener('webglcontextrestored', () => {
    renderer.setPixelRatio(currentDPR);
    renderer.setSize(window.innerWidth, window.innerHeight);
  }, false);

  // 2. Сцена
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07080a);
  scene.fog = new THREE.FogExp2(0x07080a, 0.04);

  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }
  window.scrollTo(0, 0);

  // 3. Камера
  const isMobile = window.innerWidth < 768;
  const initialFov = isMobile ? 70 : 60;
  camera = new THREE.PerspectiveCamera(initialFov, window.innerWidth / window.innerHeight, 0.1, 70);
  
  // При старте камера находится на верхнем конце эскалатора (вид спуска по референсу)
  const ESC_START_POS = new THREE.Vector3(-3.765, 8.65, 17.60);
  const ESC_START_TARGET = new THREE.Vector3(-3.765, 6.20, 13.00);
  camera.position.copy(ESC_START_POS);
  camCurrentPos.copy(ESC_START_POS);

  // Штатная целевая позиция камеры после завершения спуска — СТРОГО вагон метро (Stage 0)
  const wp0 = CAMERA_WAYPOINTS[0][isMobile ? 'mobile' : 'desktop'];
  camTargetPos.copy(wp0.pos);
  camTargetLookAt.copy(wp0.target);

  camCurrentTarget.copy(ESC_START_TARGET);
  camera.lookAt(camCurrentTarget);

  clock = new THREE.Clock();

  window.__debug = {
    THREE,
    getCamera: () => camera,
    getScene: () => scene,
    getRenderer: () => renderer,
    getState: () => ({ isDescentActive, isEscalatorLoaded, isSubwayLoaded, camPos: camera?.position, camTarget: camCurrentTarget })
  };
  window.__THREE_SCENE__ = scene;
  window.THREE = THREE;

  // 3.1 Инициализация контроллера режима Free Roam (свободная 3D-прогулка)
  freeRoamController = new FreeRoamController(camera, renderer.domElement, onFreeRoamToggled);
  window.__FREE_ROAM__ = freeRoamController;

  // 4. Эскалатор спуска (assets/models/escalator_system.blend). Пока GLB грузится,
  //    камера стоит на верхней площадке; спуск стартует сразу после загрузки.
  isDescentActive = true;
  escalatorGroup = new THREE.Group();
  escalatorGroup.name = 'Escalator';
  const escFillLight = new THREE.PointLight(0xfff4ea, 2.2, 16.0, 1.2);
  escFillLight.position.set(-3.765, 5.2, 11.0);
  escalatorGroup.add(escFillLight);
  scene.add(escalatorGroup);
  const startDescent = () => {
    isEscalatorLoaded = true;
    descentStartTime = performance.now();
  };
  createGLTFLoader().load('assets/models/escalator_system.glb?v=20261121', (gltf) => {
    escalatorGroup.add(gltf.scene);
    startDescent();
  }, undefined, (err) => {
    console.error('Ошибка загрузки escalator_system.glb:', err);
    startDescent();
  });

  // 5. Первый кадр рендерится сразу
  renderer.render(scene, camera);
  startEscalatorAudio();

  // 6. Слушатели событий
  setupEventListeners();

  // 7. Запуск цикла рендеринга
  animate();

  // 8. Прогрессивное фоновое подключение остальных систем без микрофризов
  requestAnimationFrame(() => {
    setupSubwayLighting();
    setupStationEnvironment();

    // Загрузка модели вагона в фоновом потоке без конкуренции за кадр
    setTimeout(() => {
      loadSubwayModel();
    }, 400);
  });
}

// =============================================================================
// ОСВЕЩЕНИЕ ВАГОНА МЕТРО (APPLE DARK CINEMATIC)
// =============================================================================
let trainSpeed = 0.0;
let tunnelGroup, oppTrainGroup;
const tunnelLights = [];
const ceilingLamps = [];
let windowPassingLight, windowPassingLight2, station1Light, station2Light;

let stationEnvGroup;

function setupSubwayLighting() {
  // 1. Теплый архитектурный свет вагона и станции (3000K Warm White)
  const ambient = new THREE.AmbientLight(0xffe4cc, 1.45);
  scene.add(ambient);

  // 2. Оптимизированная центральная LED-световая линия вагона (3 ключевых источника вместо 9)
  [-3.75, 0.0, 3.75].forEach(px => {
    const centralLed = new THREE.PointLight(0xffc882, 3.2, 9.5, 1.1);
    centralLed.position.set(px, 2.22, -1.192);
    scene.add(centralLed);
    ceilingLamps.push(centralLed);
  });

  // 3. Направленный скользящий свет 3000K — подчеркивает текстуру сатинированной стали и жаккарда
  const rakingLightA = new THREE.DirectionalLight(0xffdfc2, 1.25);
  rakingLightA.position.set(0, 3.2, -1.2);
  rakingLightA.target.position.set(0, 1.2, 0.0);
  scene.add(rakingLightA);
  scene.add(rakingLightA.target);

  const rakingLightB = new THREE.DirectionalLight(0xffd9b8, 1.10);
  rakingLightB.position.set(0, 3.2, -1.2);
  rakingLightB.target.position.set(0, 1.2, -2.4);
  scene.add(rakingLightB);
  scene.add(rakingLightB.target);

  // 4. Освещение платформы станции снаружи дверей (3000K)
  station1Light = new THREE.PointLight(0xffe8d2, 2.8, 18.0, 1.1);
  station1Light.position.set(-3.765, 2.4, 2.2);
  scene.add(station1Light);

  const stationExitLight = new THREE.PointLight(0xffe8d2, 2.8, 18.0, 1.1);
  stationExitLight.position.set(3.765, 2.4, 2.2);
  scene.add(stationExitLight);

  // 5. Освещение белой плиточной путевой стены станции снаружи окон (Сторона B)
  station2Light = new THREE.PointLight(0xffedd8, 2.6, 16.0, 1.0);
  station2Light.position.set(0.0, 2.4, -3.0);
  scene.add(station2Light);

  screenLight1 = new THREE.PointLight(0xfff0df, 0.75, 3.5, 1.5);
  screenLight1.position.set(-2.675, 1.40, -0.28);
  scene.add(screenLight1);

  screenLight2 = new THREE.PointLight(0xfff0df, 0.75, 3.5, 1.5);
  screenLight2.position.set(-2.675, 1.40, -2.10);
  scene.add(screenLight2);

  windowPassingLight = new THREE.PointLight(0xffe9d5, 0.6, 9.0, 1.2);
  windowPassingLight.position.set(1.595, 1.45, 0.65);
  scene.add(windowPassingLight);

  windowPassingLight2 = new THREE.PointLight(0xffe9d5, 0.6, 9.0, 1.2);
  windowPassingLight2.position.set(1.595, 1.45, -1.85);
  scene.add(windowPassingLight2);
}

function setupStationEnvironment() {
  stationEnvGroup = new THREE.Group();
  stationEnvGroup.name = 'Station';

  // Геометрия и материалы станции заданы в assets/models/station.blend (экспорт station.glb)
  createGLTFLoader().load('assets/models/station.glb?v=20261121', (gltf) => {
    stationEnvGroup.add(gltf.scene);
  }, undefined, (err) => {
    console.error('Ошибка загрузки station.glb:', err);
  });

  // Свет станции остаётся в коде:
  // заполняющие лампы под сводом (выключаются, пока камера в вагоне, см. animate) ...
  [-10.0, 0.0, 10.0].forEach((x, i) => {
    const fill = new THREE.PointLight(0xffe8d2, 2.4, 15.0, 1.2);
    fill.position.set(x, 3.95, 2.4);
    fill.name = `platFill${i + 1}`;
    stationEnvGroup.add(fill);
  });
  // ... и мягкий неоновый ореол лайтбоксов с мемами
  [[-7.5, 0x00e5ff], [-0.55, 0xffaa00], [2.85, 0x00ffd0], [5.2, 0xff6644]].forEach(([x, color]) => {
    const glow = new THREE.PointLight(color, 0.45, 3.2);
    glow.position.set(x, 1.65, 4.53);
    stationEnvGroup.add(glow);
  });

  scene.add(stationEnvGroup);
}

// Общий загрузчик GLB с Draco-декодером
let sharedDracoLoader = null;
function createGLTFLoader() {
  if (!sharedDracoLoader) {
    sharedDracoLoader = new DRACOLoader();
    sharedDracoLoader.setDecoderPath('./js/vendor/draco/');
  }
  const loader = new GLTFLoader();
  loader.setDRACOLoader(sharedDracoLoader);
  return loader;
}


// =============================================================================
// ВИДЕОТЕКСТУРЫ ДЛЯ ЭКРАНОВ ВАГОНА (ОПТИМИЗИРОВАННАЯ ФОНОВАЯ ИНИЦИАЛИЗАЦИЯ)
// =============================================================================
function setupVideoTextures() {
  if (video1) return; // предотвращаем повторную инициализацию

  const initVideo = (id) => {
    const v = document.getElementById(id);
    if (!v) return null;
    v.defaultMuted = true;
    v.muted = true;
    v.volume = 0;
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.setAttribute('webkit-playsinline', '');
    v.loop = true;
    // Только первые 2 экрана кэшируются сразу, остальные подгружают метаданные
    v.preload = (id === 'video-swag' || id === 'video-mini-swag') ? 'auto' : 'metadata';

    const tex = new THREE.VideoTexture(v);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    return { video: v, texture: tex };
  };

  const v1 = initVideo('video-swag');
  if (v1) {
    video1 = v1.video;
    videoTexture1 = v1.texture;
  }

  const v2 = initVideo('video-mini-swag');
  if (v2) {
    video2 = v2.video;
    videoTexture2 = v2.texture;
  }

  const v3 = initVideo('video-tunnel');
  if (v3) {
    video3 = v3.video;
    videoTexture3 = v3.texture;
  }

  const v4 = initVideo('video-industry');
  if (v4) {
    video4 = v4.video;
    videoTexture4 = v4.texture;
  }

  // Разблокировка видео при первом любом касании, клике, скролле пользователя (Safari / iOS)
  const unlockVideos = () => {
    const cur = activeStage;
    const targetVideo = cur === 1 ? video1 : (cur === 2 ? video2 : (cur === 3 ? video3 : (cur === 4 ? video4 : video1)));
    if (targetVideo && targetVideo.paused) {
      targetVideo.play().then(() => updatePlayButtonsUI()).catch(() => {});
    }
  };
  ['click', 'touchstart', 'scroll', 'pointerdown', 'wheel', 'keydown'].forEach((evt) => {
    window.addEventListener(evt, unlockVideos, { passive: true });
  });
}

// =============================================================================
// ЗАГРУЗКА И НАСТРОЙКА 3D МОДЕЛИ ВАГОНА МЕТРО
// =============================================================================
function loadSubwayModel() {
  const loader = createGLTFLoader();

  const progressBar = document.getElementById('loader-progress-bar');
  const preloader = document.getElementById('scene-preloader');

  loader.load(
    'assets/models/subway.glb?v=20261121c',
    (gltf) => {
      subwayModel = gltf.scene;

      // Геометрия, материалы и двери полностью заданы в assets/models/subway.blend.
      // В рантайме остаётся только подключить видео к экранам 1-4 и найти створки для анимации.
      setupVideoTextures();
      const videoTextures = [videoTexture1, videoTexture2, videoTexture3, videoTexture4];

      subwayModel.traverse((child) => {
        if (!child.isMesh) return;
        const match = child.name.match(/^Screen_(\d+)_Display$/);
        if (!match) return;
        const sIdx = parseInt(match[1], 10);
        const tex = videoTextures[sIdx - 1];
        if (!tex) return; // экраны 5-8 — выключенные, материал из модели
        screenMeshes[sIdx] = child;
        child.material = new THREE.MeshStandardMaterial({
          map: tex, emissive: new THREE.Color(0xffffff), emissiveMap: tex,
          emissiveIntensity: 0.95, roughness: 0.15, metalness: 0.05, side: THREE.DoubleSide
        });
        child.renderOrder = 2;
      });

      // Створки дверей 1 (вход) и 2 (выход к контактам) анимируются; изначально двери 1 открыты
      doorLeft = subwayModel.getObjectByName('Door_Left_Photo');
      doorRight = subwayModel.getObjectByName('Door_Right_Photo');
      doorLeftD2 = subwayModel.getObjectByName('Door_Left_Photo_D2');
      doorRightD2 = subwayModel.getObjectByName('Door_Right_Photo_D2');
      if (doorLeft && doorRight) {
        doorLeft.position.x = DOOR_LEFT_OPEN_X;
        doorRight.position.x = DOOR_RIGHT_OPEN_X;
      }

      scene.add(subwayModel);
      isSubwayLoaded = true;

      // Если спуск на эскалаторе уже завершился или отключен, активируем ScrollTrigger и скрываем лоадер
      if (!isDescentActive) {
        document.body.classList.remove('is-preloading');
        initScrollTriggers();
        if (preloader) {
          preloader.classList.add('fade-out');
          setTimeout(() => {
            preloader.style.display = 'none';
          }, 850);
        }
      }
    },
    (xhr) => {
      if (progressBar) {
        const percent = xhr.total
          ? Math.round((xhr.loaded / xhr.total) * 100)
          : Math.min(Math.round((xhr.loaded / 1800000) * 100), 95);
        if (!isDescentActive) {
          progressBar.style.width = `${percent}%`;
          const pNum = document.getElementById('loader-percent-num');
          if (pNum) pNum.textContent = `${percent}%`;
        }
      }
    },
    (err) => {
      console.error('Ошибка загрузки 3D модели метро:', err);
      isSubwayLoaded = true;
      if (preloader) preloader.style.display = 'none';
    }
  );
}

// =============================================================================
// GSAP SCROLLTRIGGER: УПРАВЛЕНИЕ КАМЕРОЙ ПО СКРОЛЛУ
// =============================================================================
let scrollTriggersReady = false;

function initScrollTriggers() {
  if (scrollTriggersReady) return;
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
    console.warn('GSAP или ScrollTrigger не обнаружены');
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  scrollTriggersReady = true;

  const isMobile = () => window.innerWidth < 768;
  const getWaypoint = (idx) => CAMERA_WAYPOINTS[idx][isMobile() ? 'mobile' : 'desktop'];
  
  // Стартовое положение целевых векторов для ScrollTrigger — строго Stage 0
  const wp0 = getWaypoint(0);
  camTargetPos.copy(wp0.pos);
  camTargetLookAt.copy(wp0.target);

  const NUM_SEGMENTS = CAMERA_WAYPOINTS.length - 1;
  let hasPlayedDepartureGong = false;
  let hasPlayedDoorChime = false;
  let hasPlayedPAChime = false;
  let hasPlayedArrivalChime = false;

  ScrollTrigger.create({
    trigger: '#scroll-story',
    start: 'top top',
    end: 'bottom bottom',
    scrub: isMobile() ? 0.8 : 1.8,
    onUpdate: (self) => {
      const p = Math.max(0.0, Math.min(1.0, self.progress));

      if (isZoomedToScreen) {
        isZoomedToScreen = false;
        document.body.classList.remove('screen-zoomed');
      }

      const scaledP = p * NUM_SEGMENTS;
      const fromIdx = Math.min(Math.floor(scaledP), NUM_SEGMENTS - 1);
      const toIdx = fromIdx + 1;
      const localT = scaledP - fromIdx;
      const easedT = localT * localT * (3 - 2 * localT);
      const wpFrom = getWaypoint(fromIdx);
      const wpTo = getWaypoint(toIdx);

      // 1. Позиция камеры
      camTargetPos.lerpVectors(wpFrom.pos, wpTo.pos, easedT);

      // Плавная интерполяция точки взгляда камеры по центральному проходу вперед
      camTargetLookAt.lerpVectors(wpFrom.target, wpTo.target, easedT);

      // Двери 1 (Вход): закрываются при начале скролла (0-8%)
      targetDoorCloseRatio = Math.min(Math.max(p / 0.08, 0.0), 1.0);

      // Двери 2 (Выход к контактам): плавно открываются по мере приближения скролла к контактам (82% -> 98%)
      if (p >= 0.82) {
        const normP = Math.min(Math.max((p - 0.82) / 0.16, 0.0), 1.0);
        // Плавная органичная кривая smoothstep
        targetDoor2OpenRatio = normP * normP * (3.0 - 2.0 * normP);
      } else {
        targetDoor2OpenRatio = 0.0;
      }

      // Звуковой сигнал прибытия на станцию при приближении к контактам
      if (p >= 0.85 && !hasPlayedArrivalChime) {
        hasPlayedArrivalChime = true;
        if (!isGlobalMuted) {
          playArrivalChime();
        }
      } else if (p < 0.78) {
        hasPlayedArrivalChime = false;
      }

      // Поезд стоит на станции (0.0): нулевая нагрузка на GPU/CPU, стабильные 60 FPS
      trainSpeed = 0.0;


      const currentSectionIndex = Math.min(Math.round(scaledP), NUM_SEGMENTS);
      if (currentSectionIndex !== activeStage) {
        setActiveStage(currentSectionIndex);
      }
    }
  });

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
  if (activeStage !== stageIndex) {
    if (!isGlobalMuted) {
      playNavTick();
    }
    if (isZoomedToScreen) {
      resetScreenZoom();
    }
  }
  activeStage = stageIndex;

  // Обновление HUD элементов
  const stageElements = document.querySelectorAll('.story-stage');
  stageElements.forEach((el, idx) => {
    el.classList.toggle('active', idx === stageIndex);
  });

  // Управление звуком в зависимости от экрана
  syncAudioForActiveStage();

  // Интеллектуальная ленивая предзагрузка и воспроизведение видео экранов
  const allVideos = [video1, video2, video3, video4];
  allVideos.forEach((v, vIdx) => {
    if (!v) return;
    const targetStage = vIdx + 1;
    if (stageIndex === targetStage) {
      if (v.preload !== 'auto') v.preload = 'auto';
      if (v.paused) v.play().catch(() => {});
    } else {
      if (!v.paused) v.pause();
      // Упреждающая предзагрузка метаданных для соседнего этапа (±1)
      if (Math.abs(stageIndex - targetStage) === 1 && v.preload === 'none') {
        v.preload = 'metadata';
      }
    }
  });
  updatePlayButtonsUI();

  // Синхронизация хэша в адресной строке
  const slugMap = { 0: 'intro', 1: 'swag', 2: 'mini-swag', 3: 'project-03', 4: 'project-04', 5: 'contacts' };
  const hashStr = slugMap[stageIndex] || `stage-${stageIndex}`;
  if (history.replaceState && window.location.hash !== `#${hashStr}`) {
    history.replaceState(null, '', `#${hashStr}`);
  }
}

// =============================================================================
// СИНХРОНИЗАЦИЯ ЗВУКА И ВИДЕО С ПЛАВНЫМ КРОССФЕЙДОМ
// =============================================================================
function fadeVideoVolume(video, targetVolume, duration = 260) {
  if (!video) return;
  if (video._fadeAnimId) {
    cancelAnimationFrame(video._fadeAnimId);
    video._fadeAnimId = null;
  }

  if (targetVolume === 0) {
    video.volume = 0;
    video.muted = true;
    return;
  }

  video.muted = false;
  const startVol = video.volume;
  if (Math.abs(startVol - targetVolume) < 0.02) {
    video.volume = targetVolume;
    return;
  }

  const startTime = performance.now();
  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(1.0, elapsed / duration);
    // Плавный ease-in-out косинусный переход без клиппинга звука
    const ease = 0.5 - 0.5 * Math.cos(progress * Math.PI);
    video.volume = Math.max(0, Math.min(1, startVol + (targetVolume - startVol) * ease));

    if (progress < 1.0) {
      video._fadeAnimId = requestAnimationFrame(step);
    } else {
      video.volume = targetVolume;
      video._fadeAnimId = null;
    }
  }
  video._fadeAnimId = requestAnimationFrame(step);
}

function syncAudioForActiveStage() {
  const allVideos = [video1, video2, video3, video4];

  if (isGlobalMuted) {
    allVideos.forEach((v) => {
      if (!v) return;
      if (v._fadeAnimId) { cancelAnimationFrame(v._fadeAnimId); v._fadeAnimId = null; }
      v.volume = 0;
      v.muted = true;
    });
    setSubwayMuted(true);
    updateSoundButtonUI();
    return;
  }

  // Если звук включен глобально (тише на 33% -> громкость 0.67):
  setSubwayMuted(false);
  const MEDIA_VOLUME = 0.67;
  allVideos.forEach((v, vIdx) => {
    if (!v) return;
    if (activeStage === vIdx + 1) {
      v.muted = false;
      fadeVideoVolume(v, MEDIA_VOLUME, 220);
    } else {
      if (v._fadeAnimId) { cancelAnimationFrame(v._fadeAnimId); v._fadeAnimId = null; }
      v.volume = 0;
      v.muted = true;
    }
  });

  updateSoundButtonUI();
}

export function toggleGlobalSound() {
  isGlobalMuted = !isGlobalMuted;
  if (!isGlobalMuted) {
    initSubwayAudio();
    setSubwayMuted(false);
    playHapticChime();
  } else {
    setSubwayMuted(true);
  }
  syncAudioForActiveStage();
  updateSoundButtonUI();
  return !isGlobalMuted;
}

export function getActiveStage() {
  return activeStage;
}

function updateSoundButtonUI() {
  const soundBtns = document.querySelectorAll('.sound-toggle-btn');
  soundBtns.forEach((btn) => {
    btn.classList.toggle('sound-on', !isGlobalMuted);
    btn.classList.toggle('sound-muted', isGlobalMuted);
    btn.setAttribute('aria-label', isGlobalMuted ? 'Включить звук' : 'Выключить звук');
    btn.setAttribute('title', isGlobalMuted ? 'Включить звук' : 'Выключить звук');
    const label = btn.querySelector('.sound-btn-label');
    const icon = btn.querySelector('.sound-btn-icon');
    if (label) {
      label.innerHTML = isGlobalMuted
        ? 'Без звука'
        : `<span class="audio-equalizer"><span class="eq-bar bar-1"></span><span class="eq-bar bar-2"></span><span class="eq-bar bar-3"></span></span> Звук вкл`;
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
    const slugMap = { 0: 'intro', 1: 'swag', 2: 'mini-swag', 3: 'project-03', 4: 'project-04', 5: 'contacts' };
    const hashStr = slugMap[stageIndex] || `stage-${stageIndex}`;
    if (history.replaceState) {
      history.replaceState(null, '', `#${hashStr}`);
    }
  }
}

// =============================================================================
// ОБРАБОТЧИКИ СОБЫТИЙ (ТОЛЬКО ЗАСКРИПТОВАННОЕ ДВИЖЕНИЕ КАМЕРЫ ПО СКРОЛЛУ)
// =============================================================================
function setupEventListeners() {
  // Отслеживание курсора для Raycaster и деликатного параллакса взгляда на ПК (с троттлингом для 60 FPS)
  let lastRaycast = 0;
  window.addEventListener('mousemove', (e) => {
    mouseVec.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouseVec.y = -(e.clientY / window.innerHeight) * 2 + 1;
    mouseOffset.x = mouseVec.x * 0.08;
    mouseOffset.y = mouseVec.y * 0.04;

    const now = performance.now();
    if (now - lastRaycast > 60 && !isDescentActive && camera) {
      lastRaycast = now;
      const validScreens = screenMeshes.filter(Boolean);
      if (platformMapMesh) validScreens.push(platformMapMesh);
      if (validScreens.length > 0) {
        raycaster.setFromCamera(mouseVec, camera);
        const intersects = raycaster.intersectObjects(validScreens, false);
        if (intersects.length > 0) {
          hoveredScreen = intersects[0].object;
          document.body.style.cursor = 'pointer';
        } else {
          hoveredScreen = null;
          document.body.style.cursor = '';
        }
      }
    }
  }, { passive: true });

  // Гироскоп на смартфонах для эффекта присутствия (DeviceOrientation)
  let initialBeta = null;
  let initialGamma = null;

  const handleOrientation = (e) => {
    if (e.beta === null || e.gamma === null) return;
    if (initialBeta === null) {
      initialBeta = e.beta;
      initialGamma = e.gamma;
    }
    // Отклонение относительно естественного угла удержания смартфона
    const deltaGamma = THREE.MathUtils.clamp((e.gamma - initialGamma) / 28.0, -1.0, 1.0);
    const deltaBeta = THREE.MathUtils.clamp((e.beta - initialBeta) / 22.0, -1.0, 1.0);

    mouseOffset.x = deltaGamma * 0.16;
    mouseOffset.y = -deltaBeta * 0.09;
  };

  // Запрос разрешения на гироскоп для iOS 13+ и регистрация слушателя
  const requestGyro = () => {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().then((res) => {
        if (res === 'granted') {
          window.addEventListener('deviceorientation', handleOrientation, { passive: true });
        }
      }).catch(() => {});
    } else if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleOrientation, { passive: true });
    }
  };
  window.addEventListener('click', requestGyro, { once: true });
  window.addEventListener('touchstart', requestGyro, { once: true });

  // Клик и тап по экрану в 3D пространстве — плавный зум и интерактивность
  const handleScreenInteract = (clientX, clientY) => {
    if (!camera) return;
    const clickVec = new THREE.Vector2(
      (clientX / window.innerWidth) * 2 - 1,
      -(clientY / window.innerHeight) * 2 + 1
    );
    raycaster.setFromCamera(clickVec, camera);
    const screenTargets = screenMeshes.filter(Boolean);
    if (platformMapMesh) screenTargets.push(platformMapMesh);
    const intersects = raycaster.intersectObjects(screenTargets, false);
    if (intersects.length > 0) {
      const hit = intersects[0].object;
      if (hit === platformMapMesh) {
        window.dispatchEvent(new CustomEvent('open-map-modal'));
      } else {
        if (isZoomedToScreen) {
          resetScreenZoom();
        } else {
          const sIdx = screenMeshes.indexOf(hit);
          const targetStage = sIdx >= 1 && sIdx <= 4 ? sIdx : Math.max(1, Math.min(activeStage, 4));
          zoomToScreen(targetStage);
        }
      }
    } else if (isZoomedToScreen) {
      resetScreenZoom();
    }
  };

  window.addEventListener('click', (e) => {
    // Не срабатывать, если клик был по элементам интерфейса
    if (e.target.closest('button, a, input, .glass-capsule, .site-header, .project-modal')) return;
    handleScreenInteract(e.clientX, e.clientY);
  });

  // Ресайз окна
  window.addEventListener('resize', onWindowResize, { passive: true });

  // Двойной клик для приближения к экрану
  window.addEventListener('dblclick', (e) => {
    if (e.target.closest('button, a, input, .glass-capsule, .site-header, .project-modal')) return;
    toggleScreenZoom();
  });

  // Двойной тап для мобильных устройств
  let lastTouchEndTime = 0;
  window.addEventListener('touchend', (e) => {
    if (e.target.closest('button, a, input, .glass-capsule, .site-header, .project-modal')) return;
    const now = performance.now();
    if (now - lastTouchEndTime < 350 && now - lastTouchEndTime > 50) {
      toggleScreenZoom();
      lastTouchEndTime = 0;
    } else {
      lastTouchEndTime = now;
    }
  }, { passive: true });

  // Клавиша Escape для выхода из зума
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isZoomedToScreen) {
      resetScreenZoom();
    }
  });
}

let isZoomedToScreen = false;

export function zoomToScreen(stage) {
  const maxStage = CAMERA_WAYPOINTS.length - 2; // Экран 4 (Index 4)
  const targetStage = Math.max(1, Math.min(stage || activeStage, maxStage));
  isZoomedToScreen = true;
  playHapticChime();

  activeStage = targetStage;
  updateActiveStage(targetStage);

  const isMobile = window.innerWidth < 768;
  const currentWp = CAMERA_WAYPOINTS[targetStage][isMobile ? 'mobile' : 'desktop'];
  const targetZ = isMobile ? -0.80 : -0.52;
  camTargetPos.set(currentWp.pos.x, currentWp.pos.y, targetZ);
  camTargetLookAt.set(currentWp.target.x, currentWp.target.y, currentWp.target.z);
  document.body.classList.add('screen-zoomed');
  window.dispatchEvent(new CustomEvent('screen-zoom-toggled', { detail: { isZoomed: true, stage: targetStage } }));
}

export function resetScreenZoom() {
  if (isZoomedToScreen) {
    isZoomedToScreen = false;
    const isMobile = window.innerWidth < 768;
    const currentWp = CAMERA_WAYPOINTS[activeStage][isMobile ? 'mobile' : 'desktop'];
    camTargetPos.copy(currentWp.pos);
    camTargetLookAt.copy(currentWp.target);
    document.body.classList.remove('screen-zoomed');
    window.dispatchEvent(new CustomEvent('screen-zoom-toggled', { detail: { isZoomed: false } }));
  }
}

export function toggleScreenZoom() {
  if (isZoomedToScreen) {
    resetScreenZoom();
  } else {
    zoomToScreen(activeStage);
  }
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
  const playBtns = [
    document.getElementById('play-btn-stage1'),
    document.getElementById('play-btn-stage2'),
    document.getElementById('play-btn-stage3'),
    document.getElementById('play-btn-stage4')
  ];
  const videos = [video1, video2, video3, video4];

  const getPlaySvg = (isPaused) => isPaused
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg>`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect></svg>`;

  playBtns.forEach((btn, idx) => {
    if (btn && videos[idx]) btn.innerHTML = getPlaySvg(videos[idx].paused);
  });
}

function updateCameraFov() {
  if (!camera) return;
  const aspect = window.innerWidth / window.innerHeight;
  camera.aspect = aspect;
  if (aspect < 1.0) {
    // В портретном режиме (смартфоны) вычисляем вертикальный угол так, чтобы по горизонтали
    // сохранялся комфортный угол обзора (~68°), и экран вагона шириной 1.6м помещался целиком без обрезки
    const targetHFov = 68.0;
    const hRad = THREE.MathUtils.degToRad(targetHFov);
    const vRad = 2 * Math.atan(Math.tan(hRad / 2) / aspect);
    camera.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(vRad), 46, 84);
  } else {
    // В десктопном и альбомном режимах — 46°
    camera.fov = 46;
  }
  camera.updateProjectionMatrix();
}

function onWindowResize() {
  if (!camera || !renderer) return;

  updateCameraFov();

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(currentDPR);

  // Обновление ScrollTrigger при ресайзе
  if (typeof ScrollTrigger !== 'undefined') {
    ScrollTrigger.refresh();
  }
}

// Адаптивная динамическая производительность (Adaptive DPR & Performance)
const frameTimes = [];
let lastPixelRatioAdjustTime = 0;

// =============================================================================
// ЦИКЛ РЕНДЕРИНГА (ANIMATE LOOP)
// =============================================================================
function animate() {
  requestAnimationFrame(animate);

  const dt = clock ? Math.min(clock.getDelta(), 0.1) : 0.016;
  const time = clock ? clock.getElapsedTime() : performance.now() * 0.001;

  // Динамический адаптивный FPS Governor (поддержание стабильных 60 FPS на слабых устройствах)
  frameTimes.push(dt);
  if (frameTimes.length > 40) {
    frameTimes.shift();
    const nowMs = performance.now();
    if (nowMs - lastPixelRatioAdjustTime > 1800) {
      let sum = 0;
      for (let i = 0; i < frameTimes.length; i++) sum += frameTimes[i];
      const avgDt = sum / frameTimes.length;
      const avgFps = 1 / Math.max(avgDt, 0.001);

      if (avgFps < 48 && currentDPR > minAllowedDPR) {
        currentDPR = Math.max(minAllowedDPR, Math.round((currentDPR - 0.15) * 100) / 100);
        renderer.setPixelRatio(currentDPR);
        lastPixelRatioAdjustTime = nowMs;
      } else if (avgFps > 58 && currentDPR < maxAllowedDPR) {
        currentDPR = Math.min(maxAllowedDPR, Math.round((currentDPR + 0.10) * 100) / 100);
        renderer.setPixelRatio(currentDPR);
        lastPixelRatioAdjustTime = nowMs;
      }
    }
  }

  // =========================================================================
  // РЕЖИМ СВОБОДНОЙ КАМЕРЫ (FREE ROAM) ИЛИ СПУСК НА ЭСКАЛАТОРЕ / ШТАТНЫЙ СКРОЛЛ
  // =========================================================================
  if (freeRoamController && freeRoamController.isActive) {
    freeRoamController.update(dt);
  } else if (isDescentActive) {
    if (isEscalatorLoaded) {
      const elapsed = performance.now() - descentStartTime;
      const rawP = Math.min(1.0, elapsed / DESCENT_DURATION);
      const maxP = isSubwayLoaded ? 1.0 : 0.82; // если вагон еще подгружается, плавно замедляемся у нижней площадки
      const p = Math.min(rawP, maxP);

      // Плавный кубический smoothstep
      const easedP = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;

      // Обновляем прогресс-бар и процент в HUD
      const hudPercent = Math.min(100, Math.round(easedP * 100));
      const pBar = document.getElementById('loader-progress-bar');
      const pNum = document.getElementById('loader-percent-num');
      if (pBar) pBar.style.width = `${hudPercent}%`;
      if (pNum) pNum.textContent = `${hudPercent}%`;

      // Плавное бесшовное угасание оверлея прелоадера при приближении к дверям вагона (исключает перекрытие заголовков)
      const preloader = document.getElementById('scene-preloader');
      if (preloader) {
        if (easedP > 0.82) {
          const fadeFrac = Math.max(0, (1.0 - easedP) / 0.18);
          preloader.style.opacity = fadeFrac.toFixed(3);
        } else {
          preloader.style.opacity = '1';
        }
      }

      if (easedP <= 0.72) {
        // 1. Поездка вниз по наклону эскалатора (30 градусов) со ступенями и легкой вибрацией
        const s = easedP / 0.72;
        const stepVibe = Math.sin(time * 16.0) * 0.0006;
        camCurrentPos.x = -3.765;
        camCurrentPos.y = THREE.MathUtils.lerp(8.65, 1.34, s) + stepVibe;
        camCurrentPos.z = THREE.MathUtils.lerp(17.60, 4.80, s);

        camCurrentTarget.x = -3.765;
        camCurrentTarget.y = THREE.MathUtils.lerp(6.20, 1.38, s);
        camCurrentTarget.z = THREE.MathUtils.lerp(13.00, -1.192, s);
      } else if (easedP <= 0.86) {
        // 2. Сошествие с гребенки на гранит платформы к открытым дверям вагона
        const s = (easedP - 0.72) / 0.14;
        camCurrentPos.x = -3.765;
        camCurrentPos.y = 1.34;
        camCurrentPos.z = THREE.MathUtils.lerp(4.80, 0.60, s);

        camCurrentTarget.x = -3.765;
        camCurrentTarget.y = 1.38;
        camCurrentTarget.z = -1.192; // взгляд прямо в салон через открытую дверь 1
      } else {
        // 3. Бесшовный пролет через открытую дверь 1 в вагон и разворот на позицию Stage 0
        const s = (easedP - 0.86) / 0.14;
        const sCurve = s * s * (3.0 - 2.0 * s);
        camCurrentPos.x = THREE.MathUtils.lerp(-3.765, -5.50, sCurve);
        camCurrentPos.y = THREE.MathUtils.lerp(1.34, 1.40, sCurve);
        camCurrentPos.z = THREE.MathUtils.lerp(0.60, -1.192, sCurve);

        camCurrentTarget.x = THREE.MathUtils.lerp(-3.765, -2.675, sCurve);
        camCurrentTarget.y = 1.40;
        camCurrentTarget.z = THREE.MathUtils.lerp(-1.192, -0.016, sCurve);
      }

      camera.position.copy(camCurrentPos);
      camera.lookAt(
        camCurrentTarget.x + mouseOffsetDamped.x * 0.3,
        camCurrentTarget.y + mouseOffsetDamped.y * 0.3,
        camCurrentTarget.z
      );

      // Завершение спуска и вход в вагон
      if (easedP >= 0.999 && isSubwayLoaded) {
        finishDescent({ audioFade: 0.8 });
      }
    } else {
      // Пока модель эскалатора подгружается (<100мс), держим камеру строго на старте спуска
      camCurrentPos.set(-3.765, 8.65, 17.60);
      camCurrentTarget.set(-3.765, 6.20, 13.00);
      camera.position.copy(camCurrentPos);
      camera.lookAt(camCurrentTarget);
    }
  } else {
    // 1. Медленная, медитативная интерполяция позиции камеры (cinematic dolly lerp)
    camCurrentPos.lerp(camTargetPos, 0.042);
    camCurrentTarget.lerp(camTargetLookAt, 0.042);

    // 2. Демпфирование мышиного параллакса
    mouseOffsetDamped.x += (mouseOffset.x - mouseOffsetDamped.x) * 0.06;
    mouseOffsetDamped.y += (mouseOffset.y - mouseOffsetDamped.y) * 0.06;

    // Строго заскриптованное кинематографичное движение камеры по скроллу + тонкий параллакс взгляда
    camera.position.set(camCurrentPos.x, camCurrentPos.y, camCurrentPos.z);
    camera.lookAt(
      camCurrentTarget.x + mouseOffsetDamped.x,
      camCurrentTarget.y + mouseOffsetDamped.y,
      camCurrentTarget.z
    );
  }

  // 2.1 Пневматическое движение створок дверей (работает как в скролле, так и в Free Roam)
  currentDoorCloseRatio += (targetDoorCloseRatio - currentDoorCloseRatio) * 0.08;
  if (doorLeft && doorRight) {
    doorLeft.position.x = THREE.MathUtils.lerp(DOOR_LEFT_OPEN_X, DOOR_LEFT_CLOSED_X, currentDoorCloseRatio);
    doorRight.position.x = THREE.MathUtils.lerp(DOOR_RIGHT_OPEN_X, DOOR_RIGHT_CLOSED_X, currentDoorCloseRatio);
  }
  currentDoor2OpenRatio += (targetDoor2OpenRatio - currentDoor2OpenRatio) * 0.08;
  if (doorLeftD2 && doorRightD2) {
    doorLeftD2.position.x = THREE.MathUtils.lerp(4.070, 4.680, currentDoor2OpenRatio);
    doorRightD2.position.x = THREE.MathUtils.lerp(3.460, 2.850, currentDoor2OpenRatio);
  }

  // 2.3 Движение тоннельных огней и отблески в окнах на обеих сторонах
  if (trainSpeed > 0.01) {
    const rushSpeed = trainSpeed * 34.0 * dt;
    let windowFlashSide1 = 0.0;
    let windowFlashSide2 = 0.0;
    for (let i = 0; i < tunnelLights.length; i++) {
      const item = tunnelLights[i];
      item.mesh.position.x -= rushSpeed;
      if (item.mesh.position.x < -30.0) {
        item.mesh.position.x += 60.0;
      }
      item.light.position.x = item.mesh.position.x;

      const isNearWin = Math.abs(item.mesh.position.x - 1.595) < 1.4 || Math.abs(item.mesh.position.x - (-1.595)) < 1.4;
      if (isNearWin) {
        if (item.sideZ > -1.0) {
          windowFlashSide1 = Math.max(windowFlashSide1, 1.25);
        } else {
          windowFlashSide2 = Math.max(windowFlashSide2, 1.25);
        }
      }
    }
    if (windowPassingLight) {
      windowPassingLight.intensity += (windowFlashSide1 * trainSpeed - windowPassingLight.intensity) * 0.18;
    }
    if (windowPassingLight2) {
      windowPassingLight2.intensity += (windowFlashSide2 * trainSpeed - windowPassingLight2.intensity) * 0.18;
    }
  } else {
    if (windowPassingLight) windowPassingLight.intensity += (0.0 - windowPassingLight.intensity) * 0.1;
    if (windowPassingLight2) windowPassingLight2.intensity += (0.0 - windowPassingLight2.intensity) * 0.1;
  }

  // 2.3b Кинематографическая виньетка в тоннеле
  if (trainSpeed > 0.15) {
    if (!document.body.classList.contains('tunnel-speed-active')) {
      document.body.classList.add('tunnel-speed-active');
    }
  } else {
    if (document.body.classList.contains('tunnel-speed-active')) {
      document.body.classList.remove('tunnel-speed-active');
    }
  }

  // 2.3c Мягкое акцентное свечение экранов при воспроизведении видео
  if (screenLight1 && video1) {
    const base1 = video1.paused ? 0.60 : 0.85;
    screenLight1.intensity += (base1 - screenLight1.intensity) * 0.15;
  }
  if (screenLight2 && video2) {
    const base2 = video2.paused ? 0.60 : 0.85;
    screenLight2.intensity += (base2 - screenLight2.intensity) * 0.15;
  }

  // 2.3d Интеллектуальное обновление кадров видеотекстур:
  // Обновляем ТОЛЬКО текстуру текущего активного этапа и ТОЛЬКО если кадр действительно сменился!
  if (!isDescentActive) {
    let curV = null;
    let curTex = null;
    if (activeStage === 1) { curV = video1; curTex = videoTexture1; }
    else if (activeStage === 2) { curV = video2; curTex = videoTexture2; }
    else if (activeStage === 3) { curV = video3; curTex = videoTexture3; }
    else if (activeStage === 4) { curV = video4; curTex = videoTexture4; }

    if (curV && curTex && !curV.paused && curV.readyState >= 2) {
      if (curV._lastUploadedTime !== curV.currentTime) {
        curV._lastUploadedTime = curV.currentTime;
        curTex.needsUpdate = true;
      }
    }
  }

  // 2.3e Динамическое отключение объектов и света платформы вне зоны видимости (экономит >200 draw calls)
  const isInsideCar = !isDescentActive && (!freeRoamController || !freeRoamController.isActive);
  if (escalatorGroup && escalatorGroup.visible !== !isInsideCar) {
    escalatorGroup.visible = !isInsideCar;
  }
  if (stationEnvGroup) {
    if (isInsideCar && stationEnvGroup._fillsVisible !== false) {
      stationEnvGroup.traverse((c) => {
        if (c.isPointLight && c.name && c.name.startsWith('platFill')) c.visible = false;
      });
      stationEnvGroup._fillsVisible = false;
    } else if (!isInsideCar && stationEnvGroup._fillsVisible === false) {
      stationEnvGroup.traverse((c) => {
        if (c.isPointLight && c.name && c.name.startsWith('platFill')) c.visible = true;
      });
      stationEnvGroup._fillsVisible = true;
    }
  }

  // 2.4 Движение встречного поезда в тоннеле за окнами
  if (oppTrainGroup && trainSpeed > 0.25) {
    oppTrainGroup.position.x += (trainSpeed * 22.0 + 36.0) * dt;
    if (oppTrainGroup.position.x > -14.0 && oppTrainGroup.position.x < 14.0 && !isGlobalMuted) {
      playPassingTrainWhoosh();
    }
    if (oppTrainGroup.position.x > 50.0) {
      oppTrainGroup.position.x = -130.0 - Math.random() * 80.0;
    }
  }

  // 3. Синхронизация полосы прогресса видео (троттлинг 10 FPS, без DOM layout thrashing)
  if (!isDescentActive) {
    syncScrubberUI();
  }

  // 5. Синхронизация звука поезда со скоростью
  updateSubwayAudio(trainSpeed, isGlobalMuted);

  // 6. Рендер кадра
  renderer.render(scene, camera);
}

let cachedScrubbers = null;
let lastScrubberUpdateTime = 0;

function syncScrubberUI() {
  if (activeStage < 1 || activeStage > 4) return;
  const now = performance.now();
  if (now - lastScrubberUpdateTime < 95) return;
  lastScrubberUpdateTime = now;

  if (!cachedScrubbers) {
    cachedScrubbers = [1, 2, 3, 4].map((idx) => ({
      progressEl: document.getElementById(`timeline-progress-stage${idx}`),
      timeText: document.getElementById(`time-text-stage${idx}`)
    }));
  }

  const v = (activeStage === 1) ? video1 :
            (activeStage === 2) ? video2 :
            (activeStage === 3) ? video3 :
            (activeStage === 4) ? video4 : null;

  if (v && v.duration) {
    const item = cachedScrubbers[activeStage - 1];
    if (item && item.progressEl) {
      const pct = (v.currentTime / v.duration) * 100;
      item.progressEl.style.width = `${pct}%`;
    }
    if (item && item.timeText) {
      item.timeText.textContent = formatTime(v.currentTime);
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
  return { video1, video2, video3, video4 };
}

/**
 * Единая точка завершения спуска на эскалаторе: скрывает прелоадер,
 * ставит камеру на Stage 0 и включает ScrollTrigger (ровно один раз).
 */
function finishDescent({ audioFade = 0.3, placeCamera = true, chime = true } = {}) {
  if (!isDescentActive) return;
  isDescentActive = false;
  const preloader = document.getElementById('scene-preloader');
  if (preloader) {
    preloader.style.opacity = '0';
    preloader.style.display = 'none';
    preloader.classList.add('fade-out');
  }
  document.body.classList.remove('is-preloading');
  stopEscalatorAudio(audioFade);
  if (chime && !isGlobalMuted) {
    playArrivalChime();
  }
  // Эскалатор остается видимым сквозь окна вагона
  if (escalatorGroup) {
    escalatorGroup.visible = true;
  }
  if (placeCamera) {
    const isMob = window.innerWidth < 768;
    const wp0 = CAMERA_WAYPOINTS[0][isMob ? 'mobile' : 'desktop'];
    camCurrentPos.copy(wp0.pos);
    camTargetPos.copy(wp0.pos);
    camCurrentTarget.copy(wp0.target);
    camTargetLookAt.copy(wp0.target);
    if (camera) {
      camera.position.copy(camCurrentPos);
      camera.lookAt(camCurrentTarget);
    }
  }
  if (video1 && video1.paused) {
    video1.play().catch(() => {});
  }
  initScrollTriggers();
}

export function skipDescent() {
  finishDescent({ audioFade: 0.3 });
}
window.skipDescent = skipDescent;
window.setDoorCloseRatio = (r) => { targetDoorCloseRatio = r; currentDoorCloseRatio = r; };

// =============================================================================
// ОБРАБОТЧИКИ И ЭКСПОРТ РЕЖИМА FREE ROAM
// =============================================================================
function onFreeRoamToggled(isActive) {
  const storyTab = document.getElementById('mode-story-tab');
  const freeRoamTab = document.getElementById('mode-freeroam-tab');

  if (isActive) {
    if (storyTab) storyTab.classList.remove('is-active');
    if (freeRoamTab) freeRoamTab.classList.add('is-active');

    // Если спуск был активен, завершаем его (камерой дальше управляет Free Room)
    finishDescent({ audioFade: 0.3, placeCamera: false, chime: false });

    if (escalatorGroup) {
      escalatorGroup.visible = true;
    }
  } else {
    if (storyTab) storyTab.classList.add('is-active');
    if (freeRoamTab) freeRoamTab.classList.remove('is-active');

    // Плавный возврат камеры к точке текущего этапа скролла
    const isMob = window.innerWidth < 768;
    const wp = CAMERA_WAYPOINTS[activeStage] ? CAMERA_WAYPOINTS[activeStage][isMob ? 'mobile' : 'desktop'] : CAMERA_WAYPOINTS[0].desktop;
    camCurrentPos.copy(camera.position);
    camTargetPos.copy(wp.pos);
    camCurrentTarget.copy(camera.position).add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(4));
    camTargetLookAt.copy(wp.target);

    // Триггеры могли быть созданы, пока сюжетный трек был скрыт: пересчитываем позиции
    if (scrollTriggersReady && typeof ScrollTrigger !== 'undefined') {
      ScrollTrigger.refresh();
    }
  }
}

export function toggleFreeRoam(forceState) {
  if (freeRoamController) {
    freeRoamController.toggle(forceState);
  }
}

export function isFreeRoamActive() {
  return freeRoamController ? freeRoamController.isActive : false;
}
window.toggleFreeRoam = toggleFreeRoam;
