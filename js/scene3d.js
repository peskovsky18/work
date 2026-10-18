/**
 * Александр Песковский — 2026
 * 3D Scrollytelling Engine (Three.js + GSAP ScrollTrigger)
 */

import * as THREE from 'three';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { getSubwayMapTexture, getNoLeanDecalTexture, getPlaceholderScreenTexture, getTrackWallSignTexture, getStationPosterTexture } from './subwayMap.js';
import { initSubwayAudio, updateSubwayAudio, playNavTick, playHapticChime } from './subwayAudio.js';
import {
  getPhotoWallTextures,
  getPhotoDoorTextures,
  getPhotoFloorTextures,
  getPhotoSeatYellowTextures,
  getPhotoSeatOrangeTextures,
  getPhotoVentGrilleTexture,
  getPhotoCeilingLightTexture,
  getStationTileTextures,
  getPlatformGraniteTextures
} from './subwayMaterials.js';

// =============================================================================
// КОНФИГУРАЦИЯ СЦЕНЫ И КАМЕРЫ (ДВИЖЕНИЕ СТРОГО ПО ПРЯМОЙ ПО ЦЕНТРАЛЬНОМУ ПРОХОДУ: ВХОД -> ЭКРАНЫ СЛЕВА/СПРАВА -> ВЫХОД)
// =============================================================================
const CAMERA_WAYPOINTS = [
  // 0: Старт из глубокого торца вагона у межвагонной двери (X = -5.50, увеличенный путь по вагону)
  {
    desktop: { pos: new THREE.Vector3(-5.50, 1.40, -1.192), target: new THREE.Vector3(-2.675, 1.40, 0.016) },
    mobile:  { pos: new THREE.Vector3(-5.50, 1.40, -1.192), target: new THREE.Vector3(-2.675, 1.40, 0.016) }
  },
  // 1: Экран 1 («Свэг», видео 1, Стена A)
  {
    desktop: { pos: new THREE.Vector3(-2.675, 1.40, -1.192), target: new THREE.Vector3(-2.675, 1.40, 0.016) },
    mobile:  { pos: new THREE.Vector3(-2.675, 1.40, -1.350), target: new THREE.Vector3(-2.675, 1.40, 0.016) }
  },
  // 2: Экран 2 («Мини свэг», видео 2, Стена A)
  {
    desktop: { pos: new THREE.Vector3(-1.620, 1.40, -1.192), target: new THREE.Vector3(-1.620, 1.40, 0.016) },
    mobile:  { pos: new THREE.Vector3(-1.620, 1.40, -1.350), target: new THREE.Vector3(-1.620, 1.40, 0.016) }
  },
  // 3: Экран 3 (Проект 03, Стена A)
  {
    desktop: { pos: new THREE.Vector3(-0.565, 1.40, -1.192), target: new THREE.Vector3(-0.565, 1.40, 0.016) },
    mobile:  { pos: new THREE.Vector3(-0.565, 1.40, -1.350), target: new THREE.Vector3(-0.565, 1.40, 0.016) }
  },
  // 4: Экран 4 (Проект 04, Стена A)
  {
    desktop: { pos: new THREE.Vector3(0.000, 1.40, -1.192), target: new THREE.Vector3(0.000, 1.40, 0.016) },
    mobile:  { pos: new THREE.Vector3(0.000, 1.40, -1.350), target: new THREE.Vector3(0.000, 1.40, 0.016) }
  },
  // 5: Экран 5 (Проект 05, Стена A)
  {
    desktop: { pos: new THREE.Vector3(0.515, 1.40, -1.192), target: new THREE.Vector3(0.515, 1.40, 0.016) },
    mobile:  { pos: new THREE.Vector3(0.515, 1.40, -1.350), target: new THREE.Vector3(0.515, 1.40, 0.016) }
  },
  // 6: Экран 6 (Проект 06, Стена A)
  {
    desktop: { pos: new THREE.Vector3(1.620, 1.40, -1.192), target: new THREE.Vector3(1.620, 1.40, 0.016) },
    mobile:  { pos: new THREE.Vector3(1.620, 1.40, -1.350), target: new THREE.Vector3(1.620, 1.40, 0.016) }
  },
  // 7: Экран 7 (Проект 07, Стена A)
  {
    desktop: { pos: new THREE.Vector3(2.675, 1.40, -1.192), target: new THREE.Vector3(2.675, 1.40, 0.016) },
    mobile:  { pos: new THREE.Vector3(2.675, 1.40, -1.350), target: new THREE.Vector3(2.675, 1.40, 0.016) }
  },
  // 8: Экран 8 (Проект 08, Стена A)
  {
    desktop: { pos: new THREE.Vector3(3.200, 1.40, -1.192), target: new THREE.Vector3(3.200, 1.40, 0.016) },
    mobile:  { pos: new THREE.Vector3(3.200, 1.40, -1.350), target: new THREE.Vector3(3.200, 1.40, 0.016) }
  },
  // 9: Прибытие на станцию и выход (Контакты)
  {
    desktop: { pos: new THREE.Vector3(3.765, 1.38, -1.192), target: new THREE.Vector3(3.765, 1.40, 1.800) },
    mobile:  { pos: new THREE.Vector3(3.765, 1.38, -1.192), target: new THREE.Vector3(3.765, 1.40, 1.800) }
  }
];

// Глобальное состояние
let scene, camera, renderer, clock;
let subwayModel;
const screenMeshes = [];
let screen1Mesh, screen2Mesh, platformMapMesh;
let video1, video2;
let videoTexture1, videoTexture2;
let screenLight1, screenLight2;
let activeStage = 0;
let isGlobalMuted = true;

// Двери вагона
let doorLeft, doorRight, doorLeftD2, doorRightD2;
const DOOR_LEFT_OPEN_X = -2.915;
const DOOR_LEFT_CLOSED_X = -3.465;
const DOOR_RIGHT_OPEN_X = -4.615;
const DOOR_RIGHT_CLOSED_X = -4.065;
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
  renderer.toneMappingExposure = 1.26;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
  }, false);

  canvas.addEventListener('webglcontextrestored', () => {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
  }, false);

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

  clock = new THREE.Clock();

  // 4. Освещение вагона и станции
  setupSubwayLighting();

  // 4.1 Архитектурное окружение станции (путевая стена и детальная платформа с постерами и скамейками)
  setupStationEnvironment();

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
let trainSpeed = 0.0;
let tunnelGroup, oppTrainGroup;
const tunnelLights = [];
const ceilingLamps = [];
let windowPassingLight, windowPassingLight2, station1Light, station2Light;

let stationEnvGroup;

function setupSubwayLighting() {
  // 1. Сбалансированный нейтральный дневной свет вагона и станции (5600K) — яркое заливающее освещение
  const ambient = new THREE.AmbientLight(0xf4f8fc, 1.65);
  scene.add(ambient);

  // 2. Двойной ряд потолочных люминесцентных светильников вагона (яркий чистый свет с подсветкой сидений и стен)
  // Ряд A (вдоль стены A и экранов) и Ряд B (вдоль окон B)
  [-4.8, -3.2, -1.6, 0.0, 1.6, 3.2, 4.8].forEach(px => {
    // Центральный проход и стена A
    const lampA = new THREE.PointLight(0xfff8f0, 2.6, 7.2, 1.1);
    lampA.position.set(px, 2.20, -0.75);
    scene.add(lampA);
    ceilingLamps.push(lampA);

    // Стена B
    const lampB = new THREE.PointLight(0xf2f7ff, 2.4, 7.2, 1.1);
    lampB.position.set(px, 2.20, -1.65);
    scene.add(lampB);
    ceilingLamps.push(lampB);
  });

  // 3. Направленный скользящий свет с потолка (Raking Key Lights) — подчеркивает микрорельеф и фактуру шлифованной стали стен и пола
  const rakingLightA = new THREE.DirectionalLight(0xffffff, 1.25);
  rakingLightA.position.set(0, 3.2, -1.2);
  rakingLightA.target.position.set(0, 1.2, 0.0);
  scene.add(rakingLightA);
  scene.add(rakingLightA.target);

  const rakingLightB = new THREE.DirectionalLight(0xf0f6ff, 1.10);
  rakingLightB.position.set(0, 3.2, -1.2);
  rakingLightB.target.position.set(0, 1.2, -2.4);
  scene.add(rakingLightB);
  scene.add(rakingLightB.target);

  // 4. Освещение платформы станции снаружи открытых дверей и окон (Сторона A)
  station1Light = new THREE.PointLight(0xffffff, 2.8, 18.0, 1.1);
  station1Light.position.set(-3.765, 2.4, 2.2);
  scene.add(station1Light);

  // 5. Освещение белой плиточной путевой стены станции снаружи окон (Сторона B)
  station2Light = new THREE.PointLight(0xf8faff, 2.6, 16.0, 1.0);
  station2Light.position.set(0.0, 2.4, -3.0);
  scene.add(station2Light);

  screenLight1 = new THREE.PointLight(0xffffff, 0.75, 3.5, 1.5);
  screenLight1.position.set(-2.675, 1.40, -0.28);
  scene.add(screenLight1);

  screenLight2 = new THREE.PointLight(0xffffff, 0.75, 3.5, 1.5);
  screenLight2.position.set(-2.675, 1.40, -2.10);
  scene.add(screenLight2);

  windowPassingLight = new THREE.PointLight(0xf0f6ff, 0.6, 9.0, 1.2);
  windowPassingLight.position.set(1.595, 1.45, 0.65);
  scene.add(windowPassingLight);

  windowPassingLight2 = new THREE.PointLight(0xf0f6ff, 0.6, 9.0, 1.2);
  windowPassingLight2.position.set(1.595, 1.45, -1.85);
  scene.add(windowPassingLight2);
}

function setupStationEnvironment() {
  stationEnvGroup = new THREE.Group();
  const tilePBR = getStationTileTextures();
  const granitePBR = getPlatformGraniteTextures();

  // =========================================================================
  // 1. СТОРОНА B: ПУТЕВАЯ СТЕНА ИЗ БЕЛОЙ ГЛАЗУРОВАННОЙ КЕРАМИЧЕСКОЙ ПЛИТКИ («КАБАНЧИК»)
  // =========================================================================
  const trackWallZ = -3.25; // 85 см от стены вагона (окна на Z = -2.40)
  const trackWallW = 24.0;
  const trackWallH = 3.20;

  // 1.1 Белоснежная глазурованная плитка с объемной 3D-фаской и зеркальным глянцем
  const wallGeom = new THREE.PlaneGeometry(trackWallW, trackWallH, 1, 1);
  const wallMat = new THREE.MeshPhysicalMaterial({
    map: tilePBR.colorMap,
    normalMap: tilePBR.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: tilePBR.roughnessMap,
    roughness: 0.10,
    metalness: 0.04,
    clearcoat: 0.95,
    clearcoatRoughness: 0.06,
    reflectivity: 0.90,
    side: THREE.FrontSide
  });
  const trackWallMesh = new THREE.Mesh(wallGeom, wallMat);
  trackWallMesh.position.set(0, 1.45, trackWallZ);
  stationEnvGroup.add(trackWallMesh);

  // 1.2 Темный полированный гранитный цоколь путевой стены
  const plinthGeom = new THREE.BoxGeometry(trackWallW, 0.40, 0.06);
  const plinthMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x131519),
    roughness: 0.30,
    metalness: 0.40
  });
  const plinthMesh = new THREE.Mesh(plinthGeom, plinthMat);
  plinthMesh.position.set(0, 0.10, trackWallZ + 0.03);
  stationEnvGroup.add(plinthMesh);

  // 1.3 Карнизный ретро-пояс мозаики (вишнево-красный с золотистым кантом)
  const mosaicGeom = new THREE.BoxGeometry(trackWallW, 0.16, 0.04);
  const mosaicMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x981820),
    roughness: 0.25,
    metalness: 0.30
  });
  const mosaicMesh = new THREE.Mesh(mosaicGeom, mosaicMat);
  mosaicMesh.position.set(0, 2.50, trackWallZ + 0.02);
  stationEnvGroup.add(mosaicMesh);

  // 1.4 Аутентичные эмалированные таблички с названием станции («ПЕСКОВСКАЯ»)
  const signTex = getTrackWallSignTexture(THREE);
  const signGeom = new THREE.PlaneGeometry(2.20, 0.50);
  signGeom.scale(-1, 1, 1); // Прямое незеркальное чтение букв при взгляде из вагона в сторону -Z
  const signMat = new THREE.MeshStandardMaterial({
    map: signTex,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: signTex,
    emissiveIntensity: 0.92,
    roughness: 0.25,
    metalness: 0.10,
    side: THREE.DoubleSide
  });

  // Таблички размещены напротив окон поезда (по центру и по краям вагона)
  [-4.2, 0.0, 4.2].forEach(px => {
    const signMesh = new THREE.Mesh(signGeom, signMat);
    signMesh.position.set(px, 1.45, trackWallZ + 0.02);
    stationEnvGroup.add(signMesh);
  });

  // 1.5 Щебеночный балласт и рельсы под вагоном
  const ballastGeom = new THREE.BoxGeometry(trackWallW, 0.15, 2.40);
  const ballastMat = new THREE.MeshStandardMaterial({
    color: 0x181a1f,
    roughness: 0.95,
    metalness: 0.10
  });
  const ballast = new THREE.Mesh(ballastGeom, ballastMat);
  ballast.position.set(0, -0.12, -1.80);
  stationEnvGroup.add(ballast);

  const railGeom = new THREE.BoxGeometry(trackWallW, 0.08, 0.05);
  const railMat = new THREE.MeshStandardMaterial({ color: 0x78808d, metalness: 0.9, roughness: 0.25 });
  [-2.15, -0.75].forEach(rz => {
    const rail = new THREE.Mesh(railGeom, railMat);
    rail.position.set(0, -0.04, rz);
    stationEnvGroup.add(rail);
  });

  // =========================================================================
  // 2. СТОРОНА A: СОВРЕМЕННАЯ ПЛАТФОРМА С НЕОНОВЫМИ ПОЛОСАМИ
  // =========================================================================
  const platformW = 24.0;

  // 2.1 Сплошной гранитный пол платформы (без швов и тайловых артефактов)
  const platFloorGeom = new THREE.BoxGeometry(platformW, 0.15, 4.80);
  const platFloorMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x1a1d24),
    roughness: 0.45,
    metalness: 0.20
  });
  const platFloor = new THREE.Mesh(platFloorGeom, platFloorMat);
  platFloor.position.set(0, -0.08, 2.40);
  stationEnvGroup.add(platFloor);

  // 2.2 Желтая тактильная линия безопасности вдоль края платформы
  const safeLineGeom = new THREE.BoxGeometry(platformW, 0.012, 0.16);
  const safeLineMat = new THREE.MeshStandardMaterial({
    color: 0xf5a623,
    roughness: 0.50,
    metalness: 0.10
  });
  const safeLine = new THREE.Mesh(safeLineGeom, safeLineMat);
  safeLine.position.set(0, 0.002, 0.22);
  stationEnvGroup.add(safeLine);

  // 2.3 Архитектурные колонны платформы (полированный белый мрамор)
  const colGeom = new THREE.BoxGeometry(0.48, 3.10, 0.48);
  const colMat = new THREE.MeshStandardMaterial({
    color: 0xf2f5fa,
    roughness: 0.22,
    metalness: 0.08
  });
  [-6.2, -1.8, 2.6, 7.0].forEach(cx => {
    const col = new THREE.Mesh(colGeom, colMat);
    col.position.set(cx, 1.45, 2.60);
    stationEnvGroup.add(col);
  });

  // 2.4 Линейные яркие нейтрально-белые неоновые полосы на потолке платформы
  const neonMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const neonHousingMat = new THREE.MeshStandardMaterial({ color: 0x1c1f26, roughness: 0.4, metalness: 0.8 });

  [-5.0, 0.0, 5.0].forEach(nx => {
    const stripGeom = new THREE.BoxGeometry(3.6, 0.05, 0.10);
    const strip = new THREE.Mesh(stripGeom, neonMat);
    strip.position.set(nx, 2.45, 1.95);
    stationEnvGroup.add(strip);

    const housingGeom = new THREE.BoxGeometry(3.64, 0.04, 0.14);
    const housing = new THREE.Mesh(housingGeom, neonHousingMat);
    housing.position.set(nx, 2.48, 1.95);
    stationEnvGroup.add(housing);
  });

  // 2.5 Задняя стена вестибюля платформы (сплошная темно-серая архитектурная отделка)
  const backWallGeom = new THREE.PlaneGeometry(platformW, 3.4, 1, 1);
  const backWallMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x181a20),
    roughness: 0.50,
    metalness: 0.20
  });
  const backWall = new THREE.Mesh(backWallGeom, backWallMat);
  backWall.rotation.y = Math.PI;
  backWall.position.set(0, 1.55, 4.80);
  stationEnvGroup.add(backWall);

  // 2.6 Аутентичные скамейки на платформе станции (натуральные деревянные рейки + чугунный каркас)
  [-4.8, 0.0, 4.8].forEach(bx => {
    const benchGroup = new THREE.Group();
    const legMat = new THREE.MeshStandardMaterial({ color: 0x151619, roughness: 0.4, metalness: 0.85 });
    [-0.85, 0.85].forEach(lx => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.50), legMat);
      leg.position.set(lx, 0.22, 0);
      benchGroup.add(leg);

      const armrest = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.06), legMat);
      armrest.position.set(lx, 0.52, -0.22);
      benchGroup.add(armrest);
    });

    const woodMat = new THREE.MeshStandardMaterial({
      color: 0xba7a44,
      roughness: 0.38,
      metalness: 0.05
    });
    // 4 рейки сиденья
    for (let s = 0; s < 4; s++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.028, 0.09), woodMat);
      slat.position.set(0, 0.45, -0.15 + s * 0.11);
      benchGroup.add(slat);
    }
    // 3 рейки спинки
    for (let b = 0; b < 3; b++) {
      const backSlat = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.09, 0.028), woodMat);
      backSlat.position.set(0, 0.56 + b * 0.11, -0.23);
      benchGroup.add(backSlat);
    }

    benchGroup.position.set(bx, 0.0, 2.35);
    stationEnvGroup.add(benchGroup);
  });

  // 2.7 Светящиеся рекламные и культурные лайтбоксы-постеры на стене платформы
  const posterHousingMat = new THREE.MeshStandardMaterial({
    color: 0x111317,
    roughness: 0.25,
    metalness: 0.90
  });
  [-4.2, 0.0, 4.2].forEach((px, idx) => {
    const posterGroup = new THREE.Group();
    const housing = new THREE.Mesh(new THREE.BoxGeometry(1.42, 2.12, 0.08), posterHousingMat);
    posterGroup.add(housing);

    const posterTex = getStationPosterTexture(THREE, idx % 3);
    const posterFaceGeom = new THREE.PlaneGeometry(1.36, 2.04);
    posterFaceGeom.scale(-1, 1, 1);
    const posterMat = new THREE.MeshStandardMaterial({
      map: posterTex,
      emissive: new THREE.Color(0xffffff),
      emissiveMap: posterTex,
      emissiveIntensity: 0.90,
      roughness: 0.15,
      metalness: 0.05,
      side: THREE.DoubleSide
    });
    const posterFace = new THREE.Mesh(posterFaceGeom, posterMat);
    posterFace.position.set(0, 0, -0.045);
    posterGroup.add(posterFace);

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.25,
      roughness: 0.05,
      reflectivity: 0.9,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05
    });
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 2.04), glassMat);
    glass.position.set(0, 0, -0.048);
    posterGroup.add(glass);

    posterGroup.position.set(px, 1.65, 4.74);
    stationEnvGroup.add(posterGroup);
  });

  scene.add(stationEnvGroup);
}


// =============================================================================
// ВИДЕОТЕКСТУРЫ ДЛЯ ЭКРАНОВ ВАГОНА
// =============================================================================
function setupVideoTextures() {
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
    v.preload = 'auto';

    // Пытаемся запустить автостарт
    const playPromise = v.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Ограничение автоплея браузером - ждем жеста пользователя
      });
    }

    v.addEventListener('canplay', () => {
      if (v.paused) v.play().catch(() => {});
    });

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

  // Разблокировка видео при первом любом касании, клике, скролле пользователя (Safari / iOS)
  const unlockVideos = () => {
    if (video1 && video1.paused) video1.play().catch(() => {});
    if (video2 && video2.paused) video2.play().catch(() => {});
  };
  ['click', 'touchstart', 'scroll', 'pointerdown', 'wheel', 'keydown'].forEach((evt) => {
    window.addEventListener(evt, unlockVideos, { passive: true });
  });
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

      // Инициализация фотореалистичных PBR-текстур на основе реальной фотографии вагона
      const wallPBR = getPhotoWallTextures();
      const doorPBR = getPhotoDoorTextures();
      const floorPBR = getPhotoFloorTextures();
      const seatYellowPBR = getPhotoSeatYellowTextures();
      const seatOrangePBR = getPhotoSeatOrangeTextures();
      const ventGrilleTex = getPhotoVentGrilleTexture();
      const ceilingLightTex = getPhotoCeilingLightTexture();
      const tilePBR = getStationTileTextures();
      const granitePBR = getPlatformGraniteTextures();

      // Настройка материалов для фотореалистичного интерьера вагона по фото
      subwayModel.traverse((child) => {
        if (!child.isMesh) return;

        // 1. Интерактивные экраны (1-2 видео на стене A, 3-8 плейсхолдеры)
        if (child.name.startsWith('Screen_') && child.name.endsWith('_Display')) {
          const sIdx = parseInt(child.name.split('_')[1], 10);
          screenMeshes[sIdx] = child;
          if (sIdx === 1) {
            screen1Mesh = child;
            if (videoTexture1) {
              child.material = new THREE.MeshStandardMaterial({
                map: videoTexture1, emissive: new THREE.Color(0xffffff), emissiveMap: videoTexture1,
                emissiveIntensity: 0.95, roughness: 0.15, metalness: 0.05, side: THREE.DoubleSide
              });
            }
          } else if (sIdx === 2) {
            screen2Mesh = child;
            if (videoTexture2) {
              child.material = new THREE.MeshStandardMaterial({
                map: videoTexture2, emissive: new THREE.Color(0xffffff), emissiveMap: videoTexture2,
                emissiveIntensity: 0.95, roughness: 0.15, metalness: 0.05, side: THREE.DoubleSide
              });
            }
          } else {
            const numStr = sIdx < 10 ? `0${sIdx}` : `${sIdx}`;
            const pTex = getPlaceholderScreenTexture(THREE, numStr, `ПРОЕКТ ${numStr}`);
            child.material = new THREE.MeshStandardMaterial({
              map: pTex, emissive: new THREE.Color(0xffffff), emissiveMap: pTex,
              emissiveIntensity: 0.85, roughness: 0.20, metalness: 0.05, side: THREE.DoubleSide
            });
          }
          child.renderOrder = 2;
          return;
        }

        // 2. Рамки экранов
        if (child.name.startsWith('Screen_') && child.name.endsWith('_Housing')) {
          child.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0x111317), roughness: 0.18, metalness: 0.92
          });
          return;
        }

        // 3. Предупреждающие наклейки «Не прислоняться» на стеклах дверей
        if (child.name.includes('Decal_NoLean')) {
          const decalTex = getNoLeanDecalTexture(THREE);
          child.material = new THREE.MeshBasicMaterial({
            map: decalTex, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide
          });
          child.renderOrder = 3;
          return;
        }

        // 4. Лайтбокс со схемой линий метро на стене станции
        if (child.name === 'Platform_Map_Display') {
          platformMapMesh = child;
          const mapTex = getSubwayMapTexture(THREE);
          mapTex.repeat.x = -1;
          mapTex.offset.x = 1;
          child.material = new THREE.MeshStandardMaterial({
            map: mapTex,
            emissive: new THREE.Color(0xffffff),
            emissiveMap: mapTex,
            emissiveIntensity: 0.92,
            roughness: 0.25,
            metalness: 0.05,
            side: THREE.DoubleSide
          });
          return;
        }

        if (child.name === 'Platform_Map_Housing') {
          child.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0x14161a),
            roughness: 0.45,
            metalness: 0.75
          });
          return;
        }

        if (child.name === 'Platform_Map_Header_Trim') {
          child.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0xd21b28),
            emissive: new THREE.Color(0xd21b28),
            emissiveIntensity: 0.25,
            roughness: 0.35,
            metalness: 0.40
          });
          return;
        }

        if (child.name.includes('Platform_Tile_Wall') || child.name.includes('Platform_Mosaic_Band') || child.name.includes('Platform_Floor')) {
          child.visible = false;
          return;
        }

        // Скрыть любые остаточные поручни перед сиденьями и ненужные наклейки
        if (child.name.includes('Handrail') || child.name.includes('Waist') || child.name.includes('Partition_Loop') || child.name.includes('Decal_Red')) {
          child.visible = false;
          return;
        }

        const matName = child.material ? child.material.name : '';

        // 5. Стекла окон и дверей: кристальная прозрачность с физичным френелем
        if (child.name.includes('Glass') || matName === 'Mat_Glass') {
          child.material = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(0x82b4d4),
            transparent: true,
            opacity: 0.28,
            roughness: 0.02,
            metalness: 0.05,
            reflectivity: 0.90,
            clearcoat: 1.0,
            clearcoatRoughness: 0.04,
            ior: 1.52,
            side: THREE.DoubleSide,
            depthWrite: false
          });
          return;
        }

        // 6. Резиновые уплотнители створок и стекол
        if (child.name.includes('WindowGasket') || child.name.includes('RubberEdge') || matName === 'Mat_Rubber_Black') {
          child.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0x1a1a1c),
            roughness: 0.85,
            metalness: 0.05
          });
          return;
        }

        // 7. Пороги дверей вагона
        if (child.name.includes('Threshold')) {
          child.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0xced3dc),
            roughness: 0.25,
            metalness: 0.90,
            side: THREE.DoubleSide
          });
          return;
        }

        // 8. Дверные ручки
        if (child.name.includes('Door') && (child.name.includes('Handle') || child.name.includes('RecessedHandle'))) {
          child.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0xdce0e6),
            roughness: 0.20,
            metalness: 0.95
          });
          return;
        }

        // 9. Створки дверей вагона (единый стиль сатинированной стали со стенами)
        if (child.name.startsWith('Door_Left_Photo') || child.name.startsWith('Door_Right_Photo') || child.name.startsWith('Door_Screen')) {
          child.material = new THREE.MeshStandardMaterial({
            map: wallPBR.colorMap,
            normalMap: wallPBR.normalMap,
            normalScale: new THREE.Vector2(0.55, 0.55),
            roughnessMap: wallPBR.roughnessMap,
            roughness: 0.28,
            metalness: 0.85,
            side: THREE.DoubleSide
          });
          return;
        }

        // 10. Архитектурная отделка окон и резиновых уплотнителей
        if (child.name.includes('Window_Frame') || child.name.includes('Gasket')) {
          child.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0x18191c), // плотный черный резиновый уплотнитель окна
            roughness: 0.85,
            metalness: 0.05,
            side: THREE.DoubleSide
          });
          return;
        }

        if (child.name.includes('Window_Sill_Ledge') || child.name.includes('Frieze') || child.name.includes('Window_Transom_Bar') || child.name.includes('Window_Surround_Bezel')) {
          child.material = new THREE.MeshStandardMaterial({
            map: wallPBR.colorMap,
            normalMap: wallPBR.normalMap,
            normalScale: new THREE.Vector2(0.45, 0.45),
            roughnessMap: wallPBR.roughnessMap,
            roughness: 0.28,
            metalness: 0.85,
            side: THREE.DoubleSide
          });
          return;
        }

        // 11. Стены вагона, торцевые переборки, притолоки дверей и торцевые двери (сатинированная сталь высокого разрешения)
        if (child.name.includes('Wall') || child.name.includes('Bulkhead') || child.name.includes('Lintel') || child.name.includes('Intercar') || (child.name.includes('Plate') && !child.name.includes('Screen'))) {
          child.material = new THREE.MeshStandardMaterial({
            map: wallPBR.colorMap,
            normalMap: wallPBR.normalMap,
            normalScale: new THREE.Vector2(0.55, 0.55),
            roughnessMap: wallPBR.roughnessMap,
            roughness: 0.28,
            metalness: 0.85,
            side: THREE.DoubleSide
          });
          return;
        }

        // 12. Вентиляционные решетки и цоколи сидений
        if (child.name.includes('Grille') || child.name.includes('Vent')) {
          child.material = new THREE.MeshStandardMaterial({
            map: ventGrilleTex,
            roughness: 0.42,
            metalness: 0.80,
            side: THREE.DoubleSide
          });
          return;
        }

        // Цоколи сидений гармонично согласованы с полом и стенами в единый ансамбль
        if (child.name.includes('Plinth') || (child.name.includes('Bench') && !child.name.startsWith('Seat_'))) {
          child.material = new THREE.MeshStandardMaterial({
            map: floorPBR.colorMap,
            normalMap: floorPBR.normalMap,
            normalScale: new THREE.Vector2(0.40, 0.40),
            roughnessMap: floorPBR.roughnessMap,
            roughness: 0.35,
            metalness: 0.22,
            side: THREE.DoubleSide
          });
          return;
        }

        // 13. Высококачественный согласованный пол вагона (транзитный графитовый кварц-терраццо)
        if (child.name === 'Car_Floor' || (child.name.includes('Floor') && !child.name.includes('Platform')) || matName === 'Mat_Subway_Floor' || matName === 'Mat_Dark_Floor') {
          child.material = new THREE.MeshStandardMaterial({
            map: floorPBR.colorMap,
            normalMap: floorPBR.normalMap,
            normalScale: new THREE.Vector2(0.65, 0.65),
            roughnessMap: floorPBR.roughnessMap,
            roughness: 0.35,
            metalness: 0.18,
            side: THREE.DoubleSide
          });
          return;
        }

        // 14. Желтые ковшеобразные стеклопластиковые сиденья (чистый сплошной цвет без мыльных текстур и блоков)
        if (child.name.includes('Yellow') || matName === 'Mat_Fiberglass_Yellow' || matName === 'Mat_Seat_Yellow') {
          child.material = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(0xf5a300), // Насыщенный теплый желтый цвет сидений метро
            roughness: 0.16,
            metalness: 0.02,
            clearcoat: 0.95,
            clearcoatRoughness: 0.08,
            reflectivity: 0.85,
            side: THREE.DoubleSide
          });
          return;
        }

        // 15. Оранжевые ковшеобразные стеклопластиковые сиденья (чистый сплошной цвет без мыльных текстур и блоков)
        if (child.name.includes('Orange') || matName === 'Mat_Fiberglass_Orange' || matName === 'Mat_Seat_Orange') {
          child.material = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(0xe64a19), // Сочный чистый оранжевый цвет сидений метро
            roughness: 0.16,
            metalness: 0.02,
            clearcoat: 0.95,
            clearcoatRoughness: 0.08,
            reflectivity: 0.85,
            side: THREE.DoubleSide
          });
          return;
        }

        // 16. Потолочные светильники / призматические рассеиватели из фото
        if (matName === 'Mat_Fluorescent_Light' || child.name.includes('Diffuser')) {
          child.material = new THREE.MeshStandardMaterial({
            map: ceilingLightTex,
            emissive: new THREE.Color(0xfff8ee),
            emissiveMap: ceilingLightTex,
            emissiveIntensity: 3.2,
            roughness: 0.18
          });
          return;
        }

        // 17. Потолок вагона
        if (child.name.includes('Ceiling')) {
          child.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0xdce0e7),
            normalMap: wallPBR.normalMap,
            normalScale: new THREE.Vector2(0.20, 0.20),
            roughness: 0.42,
            metalness: 0.25,
            side: THREE.DoubleSide
          });
          return;
        }

        // 18. Металлические полированные поручни и вертикальные стойки
        if (child.name.includes('Pole') || child.name.includes('Handle') || child.name.includes('Rail') || child.name.includes('Flange') || child.name.includes('Hanger') || matName === 'Mat_Chrome' || matName === 'Mat_Metal_Pole') {
          child.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0xdde1e8),
            roughness: 0.14,
            metalness: 0.96
          });
          return;
        }

        // 19. Корпуса светильников и алюминиевые стойки
        if (matName === 'Mat_Aluminum' || child.name.includes('Post') || child.name.includes('Housing') || child.name.includes('Frame')) {
          child.material = new THREE.MeshStandardMaterial({
            map: wallPBR.colorMap,
            normalMap: wallPBR.normalMap,
            normalScale: new THREE.Vector2(0.3, 0.3),
            roughness: 0.38,
            metalness: 0.75,
            side: THREE.DoubleSide
          });
          return;
        }
      });

      // Находим створки дверей вагона и устанавливаем их изначально ОТКРЫТЫМИ на Дверях 1
      doorLeft = subwayModel.getObjectByName('Door_Left_Photo') || subwayModel.getObjectByName('Door_ScreenLeft');
      doorRight = subwayModel.getObjectByName('Door_Right_Photo') || subwayModel.getObjectByName('Door_ScreenRight');
      if (doorLeft && doorRight) {
        doorLeft.position.x = DOOR_LEFT_OPEN_X;
        doorLeft.position.z = 0.054;
        doorRight.position.x = DOOR_RIGHT_OPEN_X;
        doorRight.position.z = 0.054;
      }

      // Позиционирование створок остальных дверных проемов вагона (Двери 2, 3, 4) строго снаружи стен
      doorLeftD2 = subwayModel.getObjectByName('Door_Left_Photo_D2');
      doorRightD2 = subwayModel.getObjectByName('Door_Right_Photo_D2');
      if (doorLeftD2 && doorRightD2) {
        doorLeftD2.position.set(4.065, 0.99, 0.054);
        doorRightD2.position.set(3.465, 0.99, 0.054);
      }

      const doorLeftD3 = subwayModel.getObjectByName('Door_Left_Photo_D3');
      const doorRightD3 = subwayModel.getObjectByName('Door_Right_Photo_D3');
      if (doorLeftD3 && doorRightD3) {
        doorLeftD3.position.set(-3.465, 0.99, -2.454);
        doorRightD3.position.set(-4.065, 0.99, -2.454);
      }

      const doorLeftD4 = subwayModel.getObjectByName('Door_Left_Photo_D4');
      const doorRightD4 = subwayModel.getObjectByName('Door_Right_Photo_D4');
      if (doorLeftD4 && doorRightD4) {
        doorLeftD4.position.set(4.065, 0.99, -2.454);
        doorRightD4.position.set(3.465, 0.99, -2.454);
      }

      scene.add(subwayModel);

      // Желтая рельефная тактильная полоса безопасности вдоль края платформы
      const safetyLineGeom = new THREE.BoxGeometry(12, 0.008, 0.16);
      const safetyLineMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0xf5a623),
        roughness: 0.40,
        metalness: 0.05
      });
      const safetyLine = new THREE.Mesh(safetyLineGeom, safetyLineMat);
      safetyLine.position.set(0, 0.004, 0.32);
      scene.add(safetyLine);

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
      if (progressBar) {
        const percent = xhr.total
          ? Math.round((xhr.loaded / xhr.total) * 100)
          : Math.min(Math.round((xhr.loaded / 1800000) * 100), 95);
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
  const NUM_SEGMENTS = CAMERA_WAYPOINTS.length - 1;
  let hasPlayedDepartureGong = false;
  let hasPlayedDoorChime = false;
  let hasPlayedPAChime = false;
  let hasPlayedArrivalChime = false;

  ScrollTrigger.create({
    trigger: '#scroll-story',
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1.0,
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

      // Двери закрываются при начале скролла (0-8%) и открываются при прибытии в контакты (94-100%)
      if (p >= 0.94) {
        targetDoorCloseRatio = Math.max(0.0, 1.0 - (p - 0.94) / 0.06);
      } else {
        targetDoorCloseRatio = Math.min(Math.max(p / 0.08, 0.0), 1.0);
      }

      // Поезд стоит на станции (0.0): нулевая нагрузка на GPU/CPU, стабильные 60 FPS
      trainSpeed = 0.0;


      // Обновление светодиодного индикатора маршрута в шапке
      const trackFill = document.getElementById('route-track-fill');
      const trackDot = document.getElementById('route-track-car-dot');
      if (trackFill) trackFill.style.width = `${p * 100}%`;
      if (trackDot) trackDot.style.left = `${p * 100}%`;

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

  // Автоматический плавный запуск видео в фокусе при подходе камеры
  if (stageIndex === 1) {
    if (video1 && video1.paused) {
      video1.play().catch(() => {});
    }
  } else if (stageIndex === 2) {
    if (video2 && video2.paused) {
      video2.play().catch(() => {});
    }
  }
  updatePlayButtonsUI();

  // Синхронизация хэша в адресной строке
  const slugMap = { 0: 'intro', 1: 'swag', 2: 'mini-swag', 9: 'contacts' };
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

  if (targetVolume > 0 && video.muted) {
    video.muted = false;
  }

  const startVol = video.volume;
  if (Math.abs(startVol - targetVolume) < 0.02) {
    video.volume = targetVolume;
    if (targetVolume === 0) video.muted = true;
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
      if (targetVolume === 0) {
        video.muted = true;
      }
      video._fadeAnimId = null;
    }
  }
  video._fadeAnimId = requestAnimationFrame(step);
}

function syncAudioForActiveStage() {
  if (!video1 || !video2) return;

  if (isGlobalMuted) {
    fadeVideoVolume(video1, 0, 180);
    fadeVideoVolume(video2, 0, 180);
    return;
  }

  // Если звук включен глобально (тише на 33% -> громкость 0.67):
  const MEDIA_VOLUME = 0.67;
  if (activeStage === 1) {
    // В фокусе «Свэг»
    fadeVideoVolume(video1, MEDIA_VOLUME, 300);
    fadeVideoVolume(video2, 0, 220);
  } else if (activeStage === 2) {
    // В фокусе «Мини свэг»
    fadeVideoVolume(video2, MEDIA_VOLUME, 300);
    fadeVideoVolume(video1, 0, 220);
  } else {
    // На заставке или в других отсеках — мягко глушим оба звука
    fadeVideoVolume(video1, 0, 220);
    fadeVideoVolume(video2, 0, 220);
  }

  updateSoundButtonUI();
}

export function toggleGlobalSound() {
  isGlobalMuted = !isGlobalMuted;
  if (!isGlobalMuted) {
    initSubwayAudio();
    playHapticChime();
  }
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
    const slugMap = { 0: 'intro', 1: 'swag', 2: 'mini-swag', 9: 'contacts' };
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
  // Отслеживание курсора исключительно для Raycaster (интерактивность экранов и кнопок)
  window.addEventListener('mousemove', (e) => {
    mouseVec.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouseVec.y = -(e.clientY / window.innerHeight) * 2 + 1;
  }, { passive: true });

  // Запрос разрешения на гироскоп для iOS 13+
  const requestGyro = () => {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().catch(() => {});
    }
  };
  window.addEventListener('click', requestGyro, { once: true });
  window.addEventListener('touchstart', requestGyro, { once: true });

  // Включение тихого фонового эмбиента и стука колес при первом скролле
  const enableSoundOnFirstInteraction = () => {
    if (isGlobalMuted) {
      isGlobalMuted = false;
      initSubwayAudio();
      syncAudioForActiveStage();
      updateSoundButtonUI();
    }
  };
  window.addEventListener('wheel', enableSoundOnFirstInteraction, { passive: true, once: true });
  window.addEventListener('touchmove', enableSoundOnFirstInteraction, { passive: true, once: true });
  window.addEventListener('scroll', enableSoundOnFirstInteraction, { passive: true, once: true });

  // Клик по экрану в 3D пространстве — плавный зум и разворачивание модального окна проекта
  window.addEventListener('click', (e) => {
    // Не срабатывать, если клик был по интерфейсу (кнопкам, модалкам)
    if (e.target.closest('button, a, input, .glass-capsule, .site-header, .emergency-banner, .project-modal')) return;

    if (hoveredScreen) {
      if (hoveredScreen === platformMapMesh) {
        window.dispatchEvent(new CustomEvent('open-map-modal'));
      } else {
        const sIdx = screenMeshes.indexOf(hoveredScreen);
        const stageMap = { 1: 1, 5: 2, 2: 3, 6: 4, 3: 5, 7: 6, 4: 7, 8: 8 };
        const targetStage = stageMap[sIdx] || (hoveredScreen === screen1Mesh ? 1 : (hoveredScreen === screen2Mesh ? 2 : Math.max(1, activeStage)));

        // 1. Плавный кинематографический зум камеры прямо к выбранному экрану
        zoomToScreen(targetStage);

        // 2. Открытие информационного модального окна проекта
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('open-project-modal', { detail: { project: targetStage } }));
        }, 220);
      }
    }
  });

  // Ресайз окна
  window.addEventListener('resize', onWindowResize, { passive: true });

  // Двойной клик для приближения к экрану (Director's Viewfinder / Inspector)
  window.addEventListener('dblclick', (e) => {
    if (e.target.closest('button, a, input, .glass-capsule, .site-header, .emergency-banner, .project-modal, #vf-exit-btn')) return;
    toggleScreenZoom();
  });

  // Двойной тап для мобильных устройств
  let lastTouchEndTime = 0;
  window.addEventListener('touchend', (e) => {
    if (e.target.closest('button, a, input, .glass-capsule, .site-header, .emergency-banner, .project-modal, #vf-exit-btn')) return;
    const now = performance.now();
    if (now - lastTouchEndTime < 350 && now - lastTouchEndTime > 50) {
      toggleScreenZoom();
      lastTouchEndTime = 0;
    } else {
      lastTouchEndTime = now;
    }
  }, { passive: true });

  // Клик по бейджу видоискателя для быстрого выхода
  const vfExitBtn = document.getElementById('vf-exit-btn');
  if (vfExitBtn) {
    vfExitBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      resetScreenZoom();
    });
  }
}

let isZoomedToScreen = false;

export function zoomToScreen(stage) {
  const targetStage = Math.max(1, Math.min(stage || activeStage, 8));
  isZoomedToScreen = true;
  playHapticChime();

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

// Адаптивная динамическая производительность (Adaptive DPR & Performance)
const frameTimes = [];
let lastPixelRatioAdjustTime = 0;
let currentDPR = Math.min(window.devicePixelRatio || 1, 2);

// =============================================================================
// ЦИКЛ РЕНДЕРИНГА (ANIMATE LOOP)
// =============================================================================
function animate() {
  requestAnimationFrame(animate);

  const dt = clock ? Math.min(clock.getDelta(), 0.1) : 0.016;
  const time = clock ? clock.getElapsedTime() : performance.now() * 0.001;

  // Динамический замер FPS для адаптации DPR (поддержание стабильных 60 FPS)
  frameTimes.push(dt);
  if (frameTimes.length > 40) {
    frameTimes.shift();
    const nowMs = performance.now();
    if (nowMs - lastPixelRatioAdjustTime > 2500) {
      let sum = 0;
      for (let i = 0; i < frameTimes.length; i++) sum += frameTimes[i];
      const avgDt = sum / frameTimes.length;
      const avgFps = 1 / Math.max(avgDt, 0.001);
      const maxAllowedDPR = Math.min(window.devicePixelRatio || 1, 2);

      if (avgFps < 40 && currentDPR > 1.0) {
        currentDPR = Math.max(1.0, currentDPR - 0.25);
        renderer.setPixelRatio(currentDPR);
        lastPixelRatioAdjustTime = nowMs;
      } else if (avgFps > 57 && currentDPR < maxAllowedDPR) {
        currentDPR = Math.min(maxAllowedDPR, currentDPR + 0.25);
        renderer.setPixelRatio(currentDPR);
        lastPixelRatioAdjustTime = nowMs;
      }
    }
  }

  // 1. Плавная интерполяция позиции камеры (lerp)
  camCurrentPos.lerp(camTargetPos, 0.08);
  camCurrentTarget.lerp(camTargetLookAt, 0.08);

  // 2. Демпфирование мышиного параллакса
  mouseOffsetDamped.x += (mouseOffset.x - mouseOffsetDamped.x) * 0.06;
  mouseOffsetDamped.y += (mouseOffset.y - mouseOffsetDamped.y) * 0.06;

  // 2.1 Пневматическое движение створок дверей
  currentDoorCloseRatio += (targetDoorCloseRatio - currentDoorCloseRatio) * 0.08;
  if (doorLeft && doorRight) {
    doorLeft.position.x = THREE.MathUtils.lerp(DOOR_LEFT_OPEN_X, DOOR_LEFT_CLOSED_X, currentDoorCloseRatio);
    doorRight.position.x = THREE.MathUtils.lerp(DOOR_RIGHT_OPEN_X, DOOR_RIGHT_CLOSED_X, currentDoorCloseRatio);
  }
  if (doorLeftD2 && doorRightD2) {
    const d2Open = activeStage === 9 ? (1.0 - currentDoorCloseRatio) : 0.0;
    doorLeftD2.position.x = THREE.MathUtils.lerp(4.065, 4.615, d2Open);
    doorRightD2.position.x = THREE.MathUtils.lerp(3.465, 2.915, d2Open);
  }

  // 2.2 Процедурное покачивание вагона и микровибрация при движении в тоннеле
  const vibY = (Math.sin(time * 16.0) * 0.002 + Math.sin(time * 4.0) * 0.006) * trainSpeed;
  const vibX = (Math.cos(time * 12.0) * 0.0015 + Math.sin(time * 2.5) * 0.004) * trainSpeed;
  // Строго заскриптованное кинематографичное движение камеры по скроллу (без фри-камеры и тряски)
  camera.position.set(camCurrentPos.x, camCurrentPos.y, camCurrentPos.z);
  camera.lookAt(camCurrentTarget.x, camCurrentTarget.y, camCurrentTarget.z);

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

  // 3. Raycaster для определения наведения на экраны и схему метро
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

  // 4. Синхронизация полосы прогресса видео
  syncScrubberUI();

  // 5. Синхронизация звука поезда со скоростью
  updateSubwayAudio(trainSpeed, isGlobalMuted);

  // 6. Рендер кадра
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
