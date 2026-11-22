/**
 * Александр Песковский — 2026
 * 3D Scrollytelling Engine (Three.js + GSAP ScrollTrigger)
 */

import * as THREE from 'three';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { DRACOLoader } from './vendor/DRACOLoader.js';
import { initSubwayAudio, updateSubwayAudio, setSubwayMuted, playNavTick, playHapticChime, playDoorChime, playArrivalChime, startEscalatorAudio, stopEscalatorAudio } from './subwayAudio.js';
import { FreeRoamController } from './freeRoam.js';
import { WORKS, stageSlug } from './projects-data.js';

// =============================================================================
// ДВИЖЕНИЕ КАМЕРЫ: «ИДТИ ПО ПРОХОДУ И ПОВОРАЧИВАТЬСЯ К ЭКРАНАМ»
// Камера описывается позой: позиция + курс + наклон (в градусах).
// Курс: 0 — вдоль -Z, 90 — вперёд по вагону (+X), 180 — к стене с экранами (+Z, сторона A).
// Этапы: 0 — вход (в проходе у двери 1), 1..N — напротив экранов, N+1 — у выходной двери.
// =============================================================================
const SCREEN_X = [-2.675, -0.565, 0.515, 2.675]; // экраны 1–4 на стене A (z = -0.016)
const EYE_Y = 1.40;
const LAST_STAGE = WORKS.length + 1;

if (WORKS.length !== SCREEN_X.length) {
  console.warn(`Работ ${WORKS.length}, а экранов в вагоне ${SCREEN_X.length}: показываются только первые ${SCREEN_X.length}`);
}

const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false;

function stagePose(stage, isMobile) {
  if (stage <= 0) {
    // Вход: в проходе сразу за дверью 1, взгляд вдоль вагона с лёгким наклоном к первому экрану
    return { x: -4.05, y: EYE_Y, z: isMobile ? -1.27 : -1.19, heading: isMobile ? 100 : 104, pitch: -1.5 };
  }
  if (stage >= LAST_STAGE) {
    // Контакты: у выходной двери 2, лицом к платформе
    return { x: 3.765, y: 1.38, z: isMobile ? -0.95 : -0.80, heading: 180, pitch: 0 };
  }
  // Экран: по центру прохода напротив экрана, взгляд прямо на него
  return { x: SCREEN_X[stage - 1], y: EYE_Y, z: isMobile ? -1.45 : -1.192, heading: 180, pitch: 0 };
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const smootherstep = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerpAngle = (a, b, t) => a + ((((b - a) % 360) + 540) % 360 - 180) * t;
const damp = (k, dt) => 1 - Math.exp(-k * dt); // доля сближения за кадр, не зависит от FPS

/**
 * Поза камеры в точке пути s (0..LAST_STAGE, дробная часть — доля пути между этапами).
 * Позиция идёт по проходу с плавным разгоном и остановкой у экрана; голова по ходу движения
 * поворачивается вперёд, а к остановке — обратно к экрану. На коротких отрезках поворот меньше.
 */
function poseOnPath(s, isMobile, out) {
  const sc = Math.min(Math.max(s, 0), LAST_STAGE);
  const i = Math.min(Math.floor(sc), LAST_STAGE - 1);
  const t = sc - i;
  const a = stagePose(i, isMobile);
  const b = stagePose(i + 1, isMobile);
  const e = smootherstep(t);

  out.x = a.x + (b.x - a.x) * e;
  out.y = a.y + (b.y - a.y) * e;
  out.z = a.z + (b.z - a.z) * e;
  out.heading = lerpAngle(a.heading, b.heading, e);
  out.pitch = a.pitch + (b.pitch - a.pitch) * e;

  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const dist = Math.hypot(dx, dz);
  if (!prefersReducedMotion && dist > 0.05) {
    const travelHeading = THREE.MathUtils.radToDeg(Math.atan2(dx, -dz));
    const lookAhead = Math.min(1, dist / 2.4) * 0.85 * smoothstep(0, 0.38, t) * (1 - smoothstep(0.62, 1, t));
    out.heading = lerpAngle(out.heading, travelHeading, lookAhead);
    // Едва заметный шаг при ходьбе
    const steps = Math.max(1, Math.round(dist / 0.7));
    out.y += 0.006 * Math.sin(Math.PI * e) * Math.sin(2 * Math.PI * steps * e);
  }
  return out;
}

// Путь входа в вагон из спуска: через открытую дверь 1 в проход, без шага назад
const entryCurves = {};
function getEntryCurve(isMobile) {
  const key = isMobile ? 'mobile' : 'desktop';
  if (!entryCurves[key]) {
    const end = stagePose(0, isMobile);
    entryCurves[key] = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-3.765, 1.34, 0.60),   // на платформе у двери (конец 2-й части спуска)
      new THREE.Vector3(-3.765, 1.37, -0.20),  // порог
      new THREE.Vector3(-3.90, 1.39, -0.82),   // шаг в проход
      new THREE.Vector3(end.x, end.y, end.z)   // этап 0
    ], false, 'centripetal');
  }
  return entryCurves[key];
}
const ENTRY_START_PITCH = THREE.MathUtils.radToDeg(Math.atan2(1.38 - 1.34, 0.60 + 1.192));
// Доля спуска (по времени), с которой начинается вход в вагон: easedP = 0.86
const ENTRY_P_START = 1 - Math.cbrt(2 * (1 - 0.86)) / 2;

// Глобальное состояние
let scene, camera, renderer, clock;
let freeRoamController = null;
let subwayModel;
const screenMeshes = [];
// Превью-видео и их текстуры по номеру этапа (1..WORKS.length), источник — js/projects-data.js
const stageVideos = [];
const stageVideoTextures = [];
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
const DESCENT_DURATION = 9000; // 9 секунд спуска по эскалатору

// Вернувшиеся посетители попадают в вагон сразу, как только он загрузился
const DESCENT_SEEN_KEY = 'portfolio_descent_seen';
const isReturningVisitor = (() => {
  try { return localStorage.getItem(DESCENT_SEEN_KEY) === '1'; } catch { return false; }
})();
const escalatorLights = [];


// Векторы камеры во время спуска (части 1–2 задаются позицией и точкой взгляда)
const camCurrentPos = new THREE.Vector3();
const camCurrentTarget = new THREE.Vector3();

// Состояние камеры в вагоне
let scrollStage = 0;     // цель из прокрутки: 0..LAST_STAGE
let zoomStage = null;    // экран, к которому приблизились (клик, Z/F)
let camStage = 0;        // сглаженная точка пути
let camStageVel = 0;     // скорость по пути, этапов/с
let camHeading = 0;      // фактический курс камеры, градусы
let camHeadingVel = 0;   // угловая скорость, градусы/с
let camPitch = 0;
let zoomAmount = 0;
let returnBlend = 1;     // < 1 — плавный возврат на путь после Free Room
const returnFromPos = new THREE.Vector3();
const cameraPose = { x: 0, y: 0, z: 0, heading: 0, pitch: 0 };
const cameraEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const cameraTmpPos = new THREE.Vector3();
const cameraTmpDir = new THREE.Vector3();
const PATH_OMEGA = 3.0;      // пружина движения по пути (критическое демпфирование), 1/с
const TURN_OMEGA = 6.0;      // пружина поворота головы, 1/с
const MAX_TURN_SPEED = 60;   // предел угловой скорости, градусы/с

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
  // Порядок загрузки: декодер Draco и эскалатор (нужны для первого кадра),
  // затем станция и вагон — чтобы они не отнимали канал у спуска
  getDracoLoader().preload();
  let restStarted = false;
  const loadRestOfScene = () => {
    if (restStarted) return;
    restStarted = true;
    setupStationEnvironment();
    loadSubwayModel();
  };
  const startDescent = () => {
    isEscalatorLoaded = true;
    descentStartTime = performance.now();
    loadRestOfScene();
  };
  createGLTFLoader().load('assets/models/escalator_system.glb?v=20261122', (gltf) => {
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
  createGLTFLoader().load('assets/models/station.glb?v=20261122', (gltf) => {
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
function getDracoLoader() {
  if (!sharedDracoLoader) {
    sharedDracoLoader = new DRACOLoader();
    sharedDracoLoader.setDecoderPath('./js/vendor/draco/');
    sharedDracoLoader.setDecoderConfig({ type: 'wasm' });
  }
  return sharedDracoLoader;
}

function createGLTFLoader() {
  const loader = new GLTFLoader();
  loader.setDRACOLoader(getDracoLoader());
  return loader;
}


// =============================================================================
// ВИДЕОТЕКСТУРЫ ДЛЯ ЭКРАНОВ ВАГОНА (ОПТИМИЗИРОВАННАЯ ФОНОВАЯ ИНИЦИАЛИЗАЦИЯ)
// =============================================================================
function setupVideoTextures() {
  if (stageVideos.length) return; // предотвращаем повторную инициализацию

  WORKS.forEach((work, i) => {
    const stage = i + 1;
    const v = document.getElementById(`video-stage-${stage}`);
    if (!v) return;
    v.defaultMuted = true;
    v.muted = true;
    v.volume = 0;
    v.playsInline = true;
    v.loop = true;
    // Видео не грузятся заранее: превью этапа качается, когда посетитель до него дошёл
    v.preload = 'none';

    const tex = new THREE.VideoTexture(v);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    stageVideos[stage] = v;
    stageVideoTextures[stage] = tex;
  });

  // Разблокировка видео при первом любом касании, клике, скролле пользователя (Safari / iOS)
  const unlockVideos = () => {
    if (document.body.classList.contains('viewer-open')) return;
    const targetVideo = stageVideos[activeStage] || stageVideos[1];
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
    'assets/models/subway.glb?v=20261122',
    (gltf) => {
      subwayModel = gltf.scene;

      // Геометрия, материалы и двери полностью заданы в assets/models/subway.blend.
      // В рантайме остаётся только подключить видео к экранам и найти створки для анимации.
      setupVideoTextures();

      subwayModel.traverse((child) => {
        if (!child.isMesh) return;
        const match = child.name.match(/^Screen_(\d+)_Display$/);
        if (!match) return;
        const sIdx = parseInt(match[1], 10);
        const tex = stageVideoTextures[sIdx];
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
      if (isReturningVisitor) finishDescent({ audioFade: 0.3, chime: false });

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

  const NUM_SEGMENTS = LAST_STAGE;
  let hasPlayedDepartureGong = false;
  let hasPlayedDoorChime = false;
  let hasPlayedPAChime = false;
  let hasPlayedArrivalChime = false;

  ScrollTrigger.create({
    trigger: '#scroll-story',
    start: 'top top',
    end: 'bottom bottom',
    // Без собственного сглаживания GSAP: камеру сглаживает одна пружина в animate()
    scrub: true,
    onUpdate: (self) => {
      const p = Math.max(0.0, Math.min(1.0, self.progress));

      if (isZoomedToScreen) {
        isZoomedToScreen = false;
        zoomStage = null;
        document.body.classList.remove('screen-zoomed');
      }

      const scaledP = p * NUM_SEGMENTS;
      scrollStage = scaledP;

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
  stageVideos.forEach((v, targetStage) => {
    if (!v) return;
    if (stageIndex === targetStage) {
      if (v.preload !== 'auto') v.preload = 'auto';
      if (v.paused) v.play().catch(() => {});
    } else {
      if (!v.paused) v.pause();
      // Следующий этап начинает подгружаться заранее
      if (targetStage === stageIndex + 1 && v.preload === 'none') {
        v.preload = 'auto';
      }
    }
  });
  updatePlayButtonsUI();

  // Синхронизация хэша в адресной строке
  const hashStr = stageSlug(stageIndex);
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
  const allVideos = stageVideos.filter(Boolean);

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
    const hashStr = stageSlug(stageIndex);
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
    const intersects = raycaster.intersectObjects(screenTargets, false);
    if (intersects.length > 0) {
      const hit = intersects[0].object;
      if (isZoomedToScreen) {
        resetScreenZoom();
      } else {
        const sIdx = screenMeshes.indexOf(hit);
        const targetStage = sIdx >= 1 && sIdx <= WORKS.length ? sIdx : Math.max(1, Math.min(activeStage, WORKS.length));
        zoomToScreen(targetStage);
      }
    } else if (isZoomedToScreen) {
      resetScreenZoom();
    }
  };

  window.addEventListener('click', (e) => {
    // Не срабатывать, если клик был по элементам интерфейса
    if (e.target.closest('button, a, input, .glass-capsule, .site-header, .work-viewer')) return;
    handleScreenInteract(e.clientX, e.clientY);
  });

  // Ресайз окна
  window.addEventListener('resize', onWindowResize, { passive: true });

  // Двойной клик для приближения к экрану
  window.addEventListener('dblclick', (e) => {
    if (e.target.closest('button, a, input, .glass-capsule, .site-header, .work-viewer')) return;
    toggleScreenZoom();
  });

  // Двойной тап для мобильных устройств
  let lastTouchEndTime = 0;
  window.addEventListener('touchend', (e) => {
    if (e.target.closest('button, a, input, .glass-capsule, .site-header, .work-viewer')) return;
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
  const maxStage = WORKS.length; // последний экран с работой
  const targetStage = Math.max(1, Math.min(stage || activeStage, maxStage));
  isZoomedToScreen = true;
  playHapticChime();

  activeStage = targetStage;
  setActiveStage(targetStage);

  // Камера подходит к экрану (по пути, если он не текущий) и приближается к стене
  zoomStage = targetStage;
  document.body.classList.add('screen-zoomed');
  window.dispatchEvent(new CustomEvent('screen-zoom-toggled', { detail: { isZoomed: true, stage: targetStage } }));
}

export function resetScreenZoom() {
  if (isZoomedToScreen) {
    isZoomedToScreen = false;
    zoomStage = null;
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

  const getPlaySvg = (isPaused) => isPaused
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg>`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect></svg>`;

  stageVideos.forEach((v, stage) => {
    const btn = document.getElementById(`play-btn-stage${stage}`);
    if (btn && v) btn.innerHTML = getPlaySvg(v.paused);
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
// КАМЕРА В ВАГОНЕ
// =============================================================================
/** Ставит камеру в позу с поправкой на параллакс мыши/гироскопа (parallax — доля эффекта). */
function applyCameraPose(pose, parallax = 1) {
  const k = prefersReducedMotion ? 0.3 * parallax : parallax;
  const heading = pose.heading + mouseOffsetDamped.x * 55 * k;
  const pitch = pose.pitch + mouseOffsetDamped.y * 55 * k;
  camera.position.set(pose.x, pose.y, pose.z);
  cameraEuler.set(THREE.MathUtils.degToRad(pitch), THREE.MathUtils.degToRad(-heading), 0, 'YXZ');
  camera.quaternion.setFromEuler(cameraEuler);
  // Для отладки (__debug.getState)
  camCurrentPos.copy(camera.position);
  camCurrentTarget.copy(camera.position).add(camera.getWorldDirection(cameraTmpDir));
}

/** Сбрасывает пружины камеры в текущее положение (после спуска и Free Room). */
function syncCameraSprings(stage, heading, pitch) {
  camStage = stage;
  camStageVel = 0;
  camHeading = heading;
  camHeadingVel = 0;
  camPitch = pitch;
}

function updateStoryCamera(dt) {
  const isMobile = window.innerWidth < 768;
  mouseOffsetDamped.x += (mouseOffset.x - mouseOffsetDamped.x) * damp(4, dt);
  mouseOffsetDamped.y += (mouseOffset.y - mouseOffsetDamped.y) * damp(4, dt);

  // 1. Движение по пути: пружина второго порядка — разгон с нуля и мягкая остановка у экрана.
  //    Скорость ограничена; на дальние переходы (ссылка, цифры) предел растёт, чтобы путь занимал ~2–3 с.
  const target = zoomStage !== null ? zoomStage : scrollStage;
  const diff = target - camStage;
  const maxSpeed = Math.max(0.9, Math.abs(diff) / 2.0); // этапов в секунду
  camStageVel += (PATH_OMEGA * PATH_OMEGA * diff - 2 * PATH_OMEGA * camStageVel) * dt;
  camStageVel = THREE.MathUtils.clamp(camStageVel, -maxSpeed, maxSpeed);
  camStage += camStageVel * dt;
  if (Math.abs(target - camStage) < 1e-4 && Math.abs(camStageVel) < 1e-3) {
    camStage = target;
    camStageVel = 0;
  }

  poseOnPath(camStage, isMobile, cameraPose);

  // 2. Поворот головы: курс догоняет целевой через угловую пружину с пределом скорости,
  //    поэтому даже при быстрой прокрутке камера не дёргается
  const headingDiff = (((cameraPose.heading - camHeading) % 360) + 540) % 360 - 180;
  camHeadingVel += (TURN_OMEGA * TURN_OMEGA * headingDiff - 2 * TURN_OMEGA * camHeadingVel) * dt;
  camHeadingVel = THREE.MathUtils.clamp(camHeadingVel, -MAX_TURN_SPEED, MAX_TURN_SPEED);
  camHeading += camHeadingVel * dt;
  camPitch += (cameraPose.pitch - camPitch) * damp(TURN_OMEGA, dt);
  cameraPose.heading = camHeading;
  cameraPose.pitch = camPitch;

  // Приближение к экрану: подходим ближе к стене, когда камера уже напротив него
  zoomAmount += ((zoomStage !== null ? 1 : 0) - zoomAmount) * damp(4, dt);
  if (zoomAmount > 0.001 && zoomStage !== null) {
    const nearScreen = 1 - smoothstep(0.05, 0.6, Math.abs(camStage - zoomStage));
    cameraPose.z += ((isMobile ? -0.80 : -0.52) - cameraPose.z) * zoomAmount * nearScreen;
  } else if (zoomAmount > 0.001) {
    const zoomZ = isMobile ? -0.80 : -0.52;
    const nearestScreen = Math.round(camStage);
    if (nearestScreen >= 1 && nearestScreen <= WORKS.length) {
      const nearScreen = 1 - smoothstep(0.05, 0.6, Math.abs(camStage - nearestScreen));
      cameraPose.z += (zoomZ - cameraPose.z) * zoomAmount * nearScreen;
    }
  }

  // 3. Возврат из Free Room: позиция плавно переходит с места прогулки на путь,
  //    поворот уже ограничен угловой пружиной
  if (returnBlend < 1) {
    returnBlend = Math.min(1, returnBlend + dt / 1.6);
    const w = smootherstep(returnBlend);
    cameraPose.x = returnFromPos.x + (cameraPose.x - returnFromPos.x) * w;
    cameraPose.y = returnFromPos.y + (cameraPose.y - returnFromPos.y) * w;
    cameraPose.z = returnFromPos.z + (cameraPose.z - returnFromPos.z) * w;
  }

  applyCameraPose(cameraPose, 1);
}

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
        // 3. Вход через открытую дверь 1 в проход по плавной дуге; голова поворачивается
        //    вдоль вагона с ровной скоростью, без шага назад
        const u = (easedP - 0.86) / 0.14;
        // Поворот головы идёт по реальному времени (p линейно), а не по замедляющемуся easedP:
        // ~2.8 с с ровной скоростью вместо резкого доворота в начале
        const uTurn = (p - ENTRY_P_START) / (1 - ENTRY_P_START);
        const isMob = window.innerWidth < 768;
        const end = stagePose(0, isMob);
        getEntryCurve(isMob).getPointAt(clamp01(u), cameraTmpPos);
        cameraPose.x = cameraTmpPos.x;
        cameraPose.y = cameraTmpPos.y;
        cameraPose.z = cameraTmpPos.z;
        cameraPose.heading = lerpAngle(0, end.heading, smoothstep(0.04, 1.0, uTurn));
        cameraPose.pitch = ENTRY_START_PITCH + (end.pitch - ENTRY_START_PITCH) * smoothstep(0, 1, uTurn);
      }

      if (easedP > 0.86) {
        applyCameraPose(cameraPose, 0.3);
      } else {
        camera.position.copy(camCurrentPos);
        camera.lookAt(
          camCurrentTarget.x + mouseOffsetDamped.x * 0.3,
          camCurrentTarget.y + mouseOffsetDamped.y * 0.3,
          camCurrentTarget.z
        );
      }

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
    updateStoryCamera(dt);
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
  if (screenLight1 && stageVideos[1]) {
    const base1 = stageVideos[1].paused ? 0.60 : 0.85;
    screenLight1.intensity += (base1 - screenLight1.intensity) * 0.15;
  }
  if (screenLight2 && stageVideos[2]) {
    const base2 = stageVideos[2].paused ? 0.60 : 0.85;
    screenLight2.intensity += (base2 - screenLight2.intensity) * 0.15;
  }

  // 2.3d Интеллектуальное обновление кадров видеотекстур:
  // Обновляем ТОЛЬКО текстуру текущего активного этапа и ТОЛЬКО если кадр действительно сменился!
  if (!isDescentActive) {
    const curV = stageVideos[activeStage];
    const curTex = stageVideoTextures[activeStage];

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
    cachedScrubbers = WORKS.map((_, i) => i + 1).map((idx) => ({
      progressEl: document.getElementById(`timeline-progress-stage${idx}`),
      timeText: document.getElementById(`time-text-stage${idx}`)
    }));
  }

  const v = stageVideos[activeStage] || null;

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
export function getStageVideo(stageIndex) {
  return stageVideos[stageIndex] || null;
}

/**
 * Единая точка завершения спуска на эскалаторе: скрывает прелоадер,
 * ставит камеру на Stage 0 и включает ScrollTrigger (ровно один раз).
 */
function finishDescent({ audioFade = 0.3, placeCamera = true, chime = true } = {}) {
  if (!isDescentActive) return;
  isDescentActive = false;
  try { localStorage.setItem(DESCENT_SEEN_KEY, '1'); } catch { /* приватный режим */ }
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
    // Камера встаёт в позу этапа 0 (ей же заканчивается вход в вагон)
    scrollStage = 0;
    zoomStage = null;
    zoomAmount = 0;
    returnBlend = 1;
    if (camera) {
      poseOnPath(0, window.innerWidth < 768, cameraPose);
      syncCameraSprings(0, cameraPose.heading, cameraPose.pitch);
      applyCameraPose(cameraPose, 0);
    }
  }
  if (stageVideos[1] && stageVideos[1].paused) {
    stageVideos[1].play().catch(() => {});
  }
  initScrollTriggers();
  window.dispatchEvent(new CustomEvent('descent-finished'));
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

    // Плавный возврат с того места, где посетитель гулял, в позу текущего этапа
    returnFromPos.copy(camera.position);
    returnBlend = 0;
    zoomStage = null;
    camera.getWorldDirection(cameraTmpDir);
    syncCameraSprings(
      scrollStage,
      THREE.MathUtils.radToDeg(Math.atan2(cameraTmpDir.x, -cameraTmpDir.z)),
      THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(cameraTmpDir.y, -1, 1)))
    );

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
