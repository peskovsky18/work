/**
 * Александр Песковский — 2026
 * 3D Scrollytelling Engine (Three.js + GSAP ScrollTrigger)
 */

import * as THREE from 'three';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { DRACOLoader } from './vendor/DRACOLoader.js';
import { getSubwayMapTexture, getNoLeanDecalTexture, getPlaceholderScreenTexture, getTrackWallSignTexture, getStationPosterTexture } from './subwayMap.js';
import { initSubwayAudio, updateSubwayAudio, setSubwayMuted, playNavTick, playHapticChime, playDoorChime, playArrivalChime, startEscalatorAudio, stopEscalatorAudio } from './subwayAudio.js';
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
import { setupSubwayExterior, setupStationCeilingAndArchitecture, createInstantEscalator } from './subwayExterior.js';
import { FreeRoamController } from './freeRoam.js';
import * as BufferGeometryUtils from './vendor/utils/BufferGeometryUtils.js';

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
let screen1Mesh, screen2Mesh, screen3Mesh, screen4Mesh, platformMapMesh;
let video1, video2, video3, video4;
let videoTexture1, videoTexture2, videoTexture3, videoTexture4;
let screenLight1, screenLight2;
let activeStage = 0;
let isGlobalMuted = true;

// Двери вагона
let doorLeft, doorRight, doorLeftD2, doorRightD2;
const DOOR_LEFT_OPEN_X = -2.915;
const DOOR_LEFT_CLOSED_X = -3.465;
const DOOR_RIGHT_OPEN_X = -4.615;
const DOOR_RIGHT_CLOSED_X = -4.065;
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.26;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
  }, false);

  canvas.addEventListener('webglcontextrestored', () => {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
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
    getState: () => ({ isDescentActive, isEscalatorLoaded, isSubwayLoaded, camPos: camera?.position, camTarget: camCurrentTarget })
  };

  // 3.1 Инициализация контроллера режима Free Roam (свободная 3D-прогулка)
  freeRoamController = new FreeRoamController(camera, renderer.domElement, onFreeRoamToggled);
  window.__FREE_ROAM__ = freeRoamController;

  // 4. Мгновенное создание высокополигонального эскалатора (0 мс задержки, спуск начинается сразу)
  escalatorGroup = createInstantEscalator(scene);
  isEscalatorLoaded = true;
  isDescentActive = true;
  descentStartTime = performance.now();

  // 5. Первоначальный кадр рендерится немедленно на Frame 0 — исключает любой черный экран!
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
  const tilePBR = getStationTileTextures();
  const granitePBR = getPlatformGraniteTextures();

  // =========================================================================
  // 1. СТОРОНА B: ПУТЕВАЯ СТЕНА ИЗ БЕЛОЙ ГЛАЗУРОВАННОЙ КЕРАМИЧЕСКОЙ ПЛИТКИ («КАБАНЧИК»)
  // =========================================================================
  const trackWallZ = -3.25; // 85 см от стены вагона (окна на Z = -2.40)
  const trackWallW = 54.0; // Простирается на 54м глубоко в оба тоннеля для непрерывности
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

  // Таблички размещены вдоль всей путевой стены станции
  [-17.4, -13.0, -8.6, -4.2, 0.0, 4.2, 8.6, 13.0, 17.4].forEach(px => {
    const signMesh = new THREE.Mesh(signGeom, signMat);
    signMesh.position.set(px, 1.45, trackWallZ + 0.02);
    stationEnvGroup.add(signMesh);
  });

  // 1.5 Щебеночный балласт под вагоном (расположен глубоко под тележками, Y = -0.50)
  const ballastGeom = new THREE.BoxGeometry(trackWallW, 0.15, 2.40);
  const ballastMat = new THREE.MeshStandardMaterial({
    color: 0x181a1f,
    roughness: 0.95,
    metalness: 0.10
  });
  const ballast = new THREE.Mesh(ballastGeom, ballastMat);
  ballast.position.set(0, -0.50, -1.80);
  stationEnvGroup.add(ballast);

  // 1.5.2 Стальные ходовые рельсы Р-65 и шпалы на щебеночном балласте (объединенные меши)
  const railMat = new THREE.MeshStandardMaterial({
    color: 0xc8cdd6,
    roughness: 0.14,
    metalness: 0.95
  });
  const sleeperMat = new THREE.MeshStandardMaterial({
    color: 0x242220,
    roughness: 0.88,
    metalness: 0.08
  });

  const railGeoms = [];
  [-1.96, -0.44].forEach((railZ) => {
    const rHead = new THREE.BoxGeometry(trackWallW, 0.045, 0.07);
    rHead.translate(0, -0.38, railZ);
    railGeoms.push(rHead);
  });
  stationEnvGroup.add(new THREE.Mesh(BufferGeometryUtils.mergeGeometries(railGeoms), railMat));

  const sleeperGeoms = [];
  for (let sx = -trackWallW / 2 + 0.35; sx < trackWallW / 2; sx += 0.70) {
    const slpG = new THREE.BoxGeometry(0.25, 0.10, 2.20);
    slpG.translate(sx, -0.44, -1.20);
    sleeperGeoms.push(slpG);
  }
  stationEnvGroup.add(new THREE.Mesh(BufferGeometryUtils.mergeGeometries(sleeperGeoms), sleeperMat));

  // =========================================================================
  // 2. СТОРОНА A: СОВРЕМЕННАЯ ПЛАТФОРМА С НЕОНОВЫМИ ПОЛОСАМИ
  // =========================================================================
  const platformW = 46.0;

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

  // 2.3 Архитектурные колонны платформы (полированный белый мрамор с защитными отбойниками из стали)
  const colMat = new THREE.MeshStandardMaterial({
    color: 0xf2f5fa,
    roughness: 0.18,
    metalness: 0.10
  });
  const cuffMat = new THREE.MeshStandardMaterial({
    color: 0xc8ccd4,
    roughness: 0.20,
    metalness: 0.95
  });

  [-19.4, -15.0, -10.6, -6.2, -1.8, 2.6, 7.0, 11.4, 15.8, 20.2].forEach(cx => {
    const colGroup = new THREE.Group();
    // Основной ствол колонны (от Y = 0.0 до потолка Y = 3.45)
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.52, 3.45, 0.52), colMat);
    shaft.position.set(0, 1.725, 0);
    colGroup.add(shaft);

    // Стальной отбойник цоколя
    const baseCuff = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.35, 0.56), cuffMat);
    baseCuff.position.set(0, 0.175, 0);
    colGroup.add(baseCuff);

    // Капитель под кессонным потолком
    const capital = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.12, 0.58), cuffMat);
    capital.position.set(0, 3.39, 0);
    colGroup.add(capital);

    colGroup.position.set(cx, 0.0, 2.60);
    stationEnvGroup.add(colGroup);
  });

  // 2.5 Задняя стена вестибюля платформы с арочным порталом для эскалатора (X = -3.765)
  const backWallMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x181a20),
    roughness: 0.50,
    metalness: 0.20
  });

  // Левая секция стены (X: от -23.0 до -5.85, ширина 17.15)
  const wallLeftW = 17.15;
  const backWallLeft = new THREE.Mesh(new THREE.PlaneGeometry(wallLeftW, 3.4), backWallMat);
  backWallLeft.rotation.y = Math.PI;
  backWallLeft.position.set(-23.0 + wallLeftW / 2, 1.55, 4.80);
  stationEnvGroup.add(backWallLeft);

  // Правая секция стены (X: от -1.65 до +23.0, ширина 24.65)
  const wallRightW = 24.65;
  const backWallRight = new THREE.Mesh(new THREE.PlaneGeometry(wallRightW, 3.4), backWallMat);
  backWallRight.rotation.y = Math.PI;
  backWallRight.position.set(23.0 - wallRightW / 2, 1.55, 4.80);
  stationEnvGroup.add(backWallRight);

  // 2.5.2 Торцевые порталы станции на краях X = -23.0 и X = +23.0 (вход поезда из тоннеля)
  const stationEndWallMat = new THREE.MeshStandardMaterial({
    color: 0x14161a,
    roughness: 0.85,
    metalness: 0.20,
    side: THREE.DoubleSide
  });
  [-23.0, 23.0].forEach((ex) => {
    // 1. Торцевая глухая стена платформы (от Z = 0.15 до 4.80)
    const platEndWall = new THREE.Mesh(new THREE.PlaneGeometry(4.65, 3.6), stationEndWallMat);
    platEndWall.rotation.y = ex < 0 ? Math.PI / 2 : -Math.PI / 2;
    platEndWall.position.set(ex, 1.70, 2.475);
    stationEnvGroup.add(platEndWall);

    // 2. Перемычка портала тоннеля над путями (от Y = 2.75 до 3.50, поезд проходит снизу)
    const lintel = new THREE.Mesh(new THREE.PlaneGeometry(3.10, 0.80), stationEndWallMat);
    lintel.rotation.y = ex < 0 ? Math.PI / 2 : -Math.PI / 2;
    lintel.position.set(ex, 3.10, -1.20);
    stationEnvGroup.add(lintel);

    // 3. Светопоглощающий темный тоннельный короб (вагон заходит на 1.5м вглубь тоннеля)
    const tunnelVoidMat = new THREE.MeshBasicMaterial({ color: 0x020304, side: THREE.BackSide });
    const tunnelVoid = new THREE.Mesh(new THREE.BoxGeometry(4.0, 3.2, 3.4), tunnelVoidMat);
    tunnelVoid.position.set(ex + (ex > 0 ? 2.0 : -2.0), 1.40, -1.20);
    stationEnvGroup.add(tunnelVoid);
  });

  // Обрамление портала эскалатора (пилоны, притолока, паруса и архивольт)
  // монолитно создаются с субмиллиметровой точностью в createInstantEscalator (subwayExterior.js)

  // 2.6 Аутентичные скамейки на платформе станции (натуральные деревянные рейки + чугунный каркас)
  [-13.5, -7.8, 0.0, 4.8, 10.5].forEach(bx => {
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

  // 2.7 Светящиеся рекламные лайтбоксы-постеры на стене платформы (мемы пользователя)
  const texLoader = new THREE.TextureLoader();
  const posterHousingMat = new THREE.MeshStandardMaterial({
    color: 0x111317,
    roughness: 0.25,
    metalness: 0.90
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.18,
    roughness: 0.04,
    reflectivity: 0.85,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04
  });

  // 4 мема от пользователя, с естественными пропорциями, неоновой окантовкой и расстановкой по стене
  const memePosters = [
    { url: 'assets/images/meme_ant.jpg', w: 1.66, h: 1.50, x: -7.5, neon: 0x00e5ff },      // 1. Грустный муравей с узелком (неоновый ледяной циан)
    { url: 'assets/images/meme_monkey.jpg', w: 1.50, h: 1.50, x: -0.7, neon: 0xffaa00 },   // 2. Задумавшаяся обезьяна (теплый неоновый янтарь)
    { url: 'assets/images/meme_dolphins.jpg', w: 1.76, h: 1.35, x: 1.3, neon: 0x00ffd0 }, // 3. Рыбак и дельфины «Хотите верьте хотите нет» (морской бирюзовый)
    { url: 'assets/images/meme_lion.jpg', w: 1.57, h: 1.50, x: 4.5, neon: 0xff6644 }      // 4. Лысый лев схватился за голову (неоновый кораллово-оранжевый)
  ];

  memePosters.forEach((item) => {
    const posterGroup = new THREE.Group();
    const frameW = item.w + 0.10;
    const frameH = item.h + 0.10;
    const housing = new THREE.Mesh(new THREE.BoxGeometry(frameW, frameH, 0.08), posterHousingMat);
    posterGroup.add(housing);

    // Неоновая контурная трубка по периметру рамки
    const neonMat = new THREE.MeshBasicMaterial({ color: item.neon });
    const hw = frameW / 2;
    const hh = frameH / 2;
    const tubeThick = 0.016;
    const tubeDepth = 0.016;
    const neonZ = -0.046;

    const neonTop = new THREE.Mesh(new THREE.BoxGeometry(frameW + tubeThick, tubeThick, tubeDepth), neonMat);
    neonTop.position.set(0, hh, neonZ);
    posterGroup.add(neonTop);

    const neonBottom = new THREE.Mesh(new THREE.BoxGeometry(frameW + tubeThick, tubeThick, tubeDepth), neonMat);
    neonBottom.position.set(0, -hh, neonZ);
    posterGroup.add(neonBottom);

    const neonLeft = new THREE.Mesh(new THREE.BoxGeometry(tubeThick, frameH, tubeDepth), neonMat);
    neonLeft.position.set(-hw, 0, neonZ);
    posterGroup.add(neonLeft);

    const neonRight = new THREE.Mesh(new THREE.BoxGeometry(tubeThick, frameH, tubeDepth), neonMat);
    neonRight.position.set(hw, 0, neonZ);
    posterGroup.add(neonRight);

    // Мягкий рассеянный неоновый свет на стену и платформу
    const posterGlow = new THREE.PointLight(item.neon, 0.40, 2.8);
    posterGlow.position.set(0, 0, -0.22);
    posterGroup.add(posterGlow);

    const tex = texLoader.load(item.url);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;

    const posterFaceGeom = new THREE.PlaneGeometry(item.w, item.h);
    posterFaceGeom.scale(-1, 1, 1);
    const posterMat = new THREE.MeshStandardMaterial({
      map: tex,
      emissive: new THREE.Color(0xffffff),
      emissiveMap: tex,
      emissiveIntensity: 0.92,
      roughness: 0.18,
      metalness: 0.05,
      side: THREE.DoubleSide
    });
    const posterFace = new THREE.Mesh(posterFaceGeom, posterMat);
    posterFace.position.set(0, 0, -0.045);
    posterGroup.add(posterFace);

    const glass = new THREE.Mesh(new THREE.PlaneGeometry(item.w, item.h), glassMat);
    glass.position.set(0, 0, -0.048);
    posterGroup.add(glass);

    posterGroup.position.set(item.x, 1.65, 4.74);
    stationEnvGroup.add(posterGroup);
  });

  // Кессонный потолок станции, скрытое освещение, навигационные лайтбоксы и ограждение конкорса
  setupStationCeilingAndArchitecture(stationEnvGroup);

  scene.add(stationEnvGroup);

  // СИНХРОННАЯ ИНИЦИАЛИЗАЦИЯ СОСТАВА МЕТРО (Frame 0):
  // Полный внешний кузов Car 1 и прицепные вагоны Car 0 и Car 2 сразу размещаются на путях.
  // Исключает появление пустых рельс даже до загрузки внутренней GLTF-модели вагона!
  setupSubwayExterior(scene);
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
  const loader = new GLTFLoader();
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('./js/vendor/draco/');
  loader.setDRACOLoader(dracoLoader);

  const progressBar = document.getElementById('loader-progress-bar');
  const preloader = document.getElementById('scene-preloader');

  loader.load(
    'assets/models/subway.glb',
    (gltf) => {
      subwayModel = gltf.scene;

      // Инициализируем текстуры видео только перед связыванием с материалами
      setupVideoTextures();

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
          } else if (sIdx === 3) {
            screen3Mesh = child;
            if (videoTexture3) {
              child.material = new THREE.MeshStandardMaterial({
                map: videoTexture3, emissive: new THREE.Color(0xffffff), emissiveMap: videoTexture3,
                emissiveIntensity: 0.95, roughness: 0.15, metalness: 0.05, side: THREE.DoubleSide
              });
            }
          } else if (sIdx === 4) {
            screen4Mesh = child;
            if (videoTexture4) {
              child.material = new THREE.MeshStandardMaterial({
                map: videoTexture4, emissive: new THREE.Color(0xffffff), emissiveMap: videoTexture4,
                emissiveIntensity: 0.95, roughness: 0.15, metalness: 0.05, side: THREE.DoubleSide
              });
            }
          } else {
            const numStr = sIdx < 10 ? `0${sIdx}` : `${sIdx}`;
            const projectTitles = {
              5: 'РИТМ',
              6: 'СВЕТОТЕНЬ',
              7: 'ЛИЦА',
              8: 'МОУШН'
            };
            const titleStr = projectTitles[sIdx] || `ПРОЕКТ ${numStr}`;
            const pTex = getPlaceholderScreenTexture(THREE, numStr, titleStr);
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

        // 5. Стекла окон и дверей: кристальная прозрачность
        if (child.name.includes('Glass') || matName === 'Mat_Glass') {
          child.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0xcde8fc),
            transparent: true,
            opacity: 0.16,
            roughness: 0.04,
            metalness: 0.10,
            side: THREE.DoubleSide,
            depthWrite: false
          });
          return;
        }

        // 6. Резиновые уплотнители створок, стекол и межвагонные сильфоны-гармошки
        if (child.name.includes('WindowGasket') || child.name.includes('RubberEdge') || child.name.includes('Bellow') || child.name.includes('Gasket') || matName === 'Mat_Rubber_Black') {
          child.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0x18181b),
            roughness: 0.88,
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
        if (child.name.includes('Wall') || child.name.includes('Bulkhead') || child.name.includes('Lintel') || child.name.includes('Intercar') || child.name.includes('Door_Header_Housing') || (child.name.includes('Plate') && !child.name.includes('Screen'))) {
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

        // 14. Желтые сиденья вагона: аутентичный стеклопластик / эргономичные ковши (PBR фототекстура)
        if (child.name.includes('Yellow') || matName === 'Mat_Fiberglass_Yellow' || matName === 'Mat_Seat_Yellow') {
          child.material = new THREE.MeshPhysicalMaterial({
            map: seatYellowPBR.colorMap,
            normalMap: seatYellowPBR.normalMap,
            normalScale: new THREE.Vector2(0.85, 0.85),
            roughnessMap: seatYellowPBR.roughnessMap,
            roughness: 0.32,
            metalness: 0.04,
            clearcoat: 0.28,
            clearcoatRoughness: 0.15,
            side: THREE.DoubleSide
          });
          return;
        }

        // 15. Оранжевые сиденья вагона: аутентичный стеклопластик / эргономичные ковши (PBR фототекстура)
        if (child.name.includes('Orange') || matName === 'Mat_Fiberglass_Orange' || matName === 'Mat_Seat_Orange') {
          child.material = new THREE.MeshPhysicalMaterial({
            map: seatOrangePBR.colorMap,
            normalMap: seatOrangePBR.normalMap,
            normalScale: new THREE.Vector2(0.85, 0.85),
            roughnessMap: seatOrangePBR.roughnessMap,
            roughness: 0.32,
            metalness: 0.04,
            clearcoat: 0.28,
            clearcoatRoughness: 0.15,
            side: THREE.DoubleSide
          });
          return;
        }

        // 16. Потолочные светильники, призматические рассеиватели и световые табло переходов (3000K)
        if (matName === 'Mat_Fluorescent_Light' || child.name.includes('Diffuser') || child.name.includes('Sign_Indicator') || child.name.includes('Next_Car_Ceiling_Light')) {
          child.material = new THREE.MeshStandardMaterial({
            map: ceilingLightTex,
            emissive: new THREE.Color(0xffc882),
            emissiveMap: ceilingLightTex,
            emissiveIntensity: 2.8,
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
        doorLeft.position.z = 0.026;
        doorRight.position.x = DOOR_RIGHT_OPEN_X;
        doorRight.position.z = 0.026;
      }

      // Позиционирование створок остальных дверных проемов вагона (Двери 2, 3, 4) строго по направляющим стен
      doorLeftD2 = subwayModel.getObjectByName('Door_Left_Photo_D2');
      doorRightD2 = subwayModel.getObjectByName('Door_Right_Photo_D2');
      if (doorLeftD2 && doorRightD2) {
        doorLeftD2.position.set(4.065, 0.99, 0.026);
        doorRightD2.position.set(3.465, 0.99, 0.026);
      }

      const doorLeftD3 = subwayModel.getObjectByName('Door_Left_Photo_D3');
      const doorRightD3 = subwayModel.getObjectByName('Door_Right_Photo_D3');
      if (doorLeftD3 && doorRightD3) {
        doorLeftD3.position.set(-3.465, 0.99, -2.426);
        doorRightD3.position.set(-4.065, 0.99, -2.426);
      }

      const doorLeftD4 = subwayModel.getObjectByName('Door_Left_Photo_D4');
      const doorRightD4 = subwayModel.getObjectByName('Door_Right_Photo_D4');
      if (doorLeftD4 && doorRightD4) {
        doorLeftD4.position.set(4.065, 0.99, -2.426);
        doorRightD4.position.set(3.465, 0.99, -2.426);
      }

      // Гарантируем наличие и точное позиционирование стекол, ручек и уплотнителей для всех створок (Двери 2, 3, 4)
      const ensureDoorFittings = (targetDoor, sourceDoor) => {
        if (!targetDoor || !sourceDoor) return;
        const hasGlass = targetDoor.children.some(c => c.name.includes('Glass'));
        if (!hasGlass) {
          sourceDoor.children.forEach(c => {
            if (c.name.includes('Glass') || c.name.includes('WindowGasket') || c.name.includes('Handle')) {
              const clone = c.clone();
              clone.position.copy(c.position);
              clone.rotation.copy(c.rotation);
              clone.scale.copy(c.scale);
              targetDoor.add(clone);
            }
          });
        }
      };

      ensureDoorFittings(doorLeftD2, doorLeft);
      ensureDoorFittings(doorRightD2, doorRight);
      ensureDoorFittings(doorLeftD3, doorLeft);
      ensureDoorFittings(doorRightD3, doorRight);
      ensureDoorFittings(doorLeftD4, doorLeft);
      ensureDoorFittings(doorRightD4, doorRight);

      // Строго фиксируем компактные физические габариты ручек (4.5см x 18см) и координаты на всех створках дверей
      subwayModel.traverse((child) => {
        if (child.name.includes('Handle') && child.name.includes('Photo')) {
          const isLeft = child.name.includes('Left');
          child.position.set(isLeft ? -0.3833 : 0.3833, -0.12, -0.45);
          child.scale.set(0.075, 0.0909, 0.35);
        }
      });

      // Предупреждающая надпись трафаретом «НЕ ПРИСЛОНЯТЬСЯ» (чистый белый текст) строго в пределах стекла дверей
      const doorDecalTex = getNoLeanDecalTexture(THREE);
      const doorDecalMat = new THREE.MeshBasicMaterial({
        map: doorDecalTex,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      // Стекло створки имеет ширину 0.27м, плашка 0.24x0.06м строго укладывается в стекло с запасом по краям
      const doorDecalGeom = new THREE.PlaneGeometry(0.24, 0.060);

      const attachDoorDecal = (doorObj) => {
        if (!doorObj) return;
        const decalMesh = new THREE.Mesh(doorDecalGeom, doorDecalMat);
        const sx = Math.abs(doorObj.scale.x) || 1;
        const sy = Math.abs(doorObj.scale.y) || 1;
        const sz = Math.abs(doorObj.scale.z) || 1;
        // Отрицательный scale.x разворачивает текст так, чтобы он читался слева направо изнутри вагона
        // Полностью компенсируем неравномерный масштаб створки двери [0.60, 1.98, 0.038]
        decalMesh.scale.set(-1 / sx, 1 / sy, -1 / sz);
        // Центр створки на Y = 0.99, смещение +0.38м поднимает надпись на уровень глаз (Y ~ 1.37м)
        // Смещение Z = -0.016м позиционирует надпись строго на внутренней поверхности стекла внутри салона
        decalMesh.position.set(0, 0.38 / sy, -0.016 / sz);
        decalMesh.renderOrder = 4;
        doorObj.add(decalMesh);
      };

      // Двери 1 (Вход, Wall A)
      attachDoorDecal(doorLeft);
      attachDoorDecal(doorRight);

      // Двери 2 (Выход, Wall A)
      attachDoorDecal(doorLeftD2);
      attachDoorDecal(doorRightD2);

      // Двери 3 (Сторона B)
      attachDoorDecal(doorLeftD3);
      attachDoorDecal(doorRightD3);

      // Двери 4 (Сторона B)
      attachDoorDecal(doorLeftD4);
      attachDoorDecal(doorRightD4);

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
function initScrollTriggers() {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
    console.warn('GSAP или ScrollTrigger не обнаружены');
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

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
  // Отслеживание курсора исключительно для Raycaster (интерактивность экранов и кнопок)
  // Отслеживание курсора для Raycaster и деликатного параллакса взгляда на ПК
  window.addEventListener('mousemove', (e) => {
    mouseVec.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouseVec.y = -(e.clientY / window.innerHeight) * 2 + 1;
    mouseOffset.x = mouseVec.x * 0.08;
    mouseOffset.y = mouseVec.y * 0.04;
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
        const sIdx = screenMeshes.indexOf(hit);
        const stageMap = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 1, 6: 2, 7: 3, 8: 4 };
        const targetStage = stageMap[sIdx] || Math.max(1, Math.min(activeStage, 4));
        zoomToScreen(targetStage);
      }
    }
  };

  window.addEventListener('click', (e) => {
    // Не срабатывать, если клик был по элементам интерфейса
    if (e.target.closest('button, a, input, .glass-capsule, .site-header, .emergency-banner, .project-modal, #vf-exit-btn')) return;
    handleScreenInteract(e.clientX, e.clientY);
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
  const maxStage = CAMERA_WAYPOINTS.length - 2; // Экран 4 (Index 4)
  const targetStage = Math.max(1, Math.min(stage || activeStage, maxStage));
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
        isDescentActive = false;
        if (preloader) {
          preloader.style.opacity = '0';
          preloader.style.display = 'none';
          preloader.classList.add('fade-out');
        }
        document.body.classList.remove('is-preloading');
        stopEscalatorAudio(0.8);
        if (!isGlobalMuted) {
          playArrivalChime();
        }

        // Эскалатор остается видимым сквозь окна вагона для максимального реализма станции
        if (escalatorGroup) {
          escalatorGroup.visible = true;
        }

        // Фиксируем позицию камеры строго на Stage 0 внутри вагона
        const isMob = window.innerWidth < 768;
        const wp0 = CAMERA_WAYPOINTS[0][isMob ? 'mobile' : 'desktop'];
        camCurrentPos.copy(wp0.pos);
        camTargetPos.copy(wp0.pos);
        camCurrentTarget.copy(wp0.target);
        camTargetLookAt.copy(wp0.target);
        camera.position.copy(camCurrentPos);
        camera.lookAt(camCurrentTarget);

        if (video1 && video1.paused) {
          video1.play().catch(() => {});
        }

        initScrollTriggers();
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

    // 2.1 Пневматическое движение створок дверей
    currentDoorCloseRatio += (targetDoorCloseRatio - currentDoorCloseRatio) * 0.08;
    if (doorLeft && doorRight) {
      doorLeft.position.x = THREE.MathUtils.lerp(DOOR_LEFT_OPEN_X, DOOR_LEFT_CLOSED_X, currentDoorCloseRatio);
      doorRight.position.x = THREE.MathUtils.lerp(DOOR_RIGHT_OPEN_X, DOOR_RIGHT_CLOSED_X, currentDoorCloseRatio);
    }
    currentDoor2OpenRatio += (targetDoor2OpenRatio - currentDoor2OpenRatio) * 0.08;
    if (doorLeftD2 && doorRightD2) {
      doorLeftD2.position.x = THREE.MathUtils.lerp(4.065, 4.615, currentDoor2OpenRatio);
      doorRightD2.position.x = THREE.MathUtils.lerp(3.465, 2.915, currentDoor2OpenRatio);
    }

    // Строго заскриптованное кинематографичное движение камеры по скроллу + тонкий параллакс взгляда
    camera.position.set(camCurrentPos.x, camCurrentPos.y, camCurrentPos.z);
    camera.lookAt(
      camCurrentTarget.x + mouseOffsetDamped.x,
      camCurrentTarget.y + mouseOffsetDamped.y,
      camCurrentTarget.z
    );
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

  // 2.3d Обновление кадров видеотекстур на экранах (только в салоне вагона после завершения спуска)
  if (!isDescentActive) {
    if (videoTexture1 && video1 && !video1.paused && video1.readyState >= 2) {
      videoTexture1.needsUpdate = true;
    }
    if (videoTexture2 && video2 && !video2.paused && video2.readyState >= 2) {
      videoTexture2.needsUpdate = true;
    }
    if (videoTexture3 && video3 && !video3.paused && video3.readyState >= 2) {
      videoTexture3.needsUpdate = true;
    }
    if (videoTexture4 && video4 && !video4.paused && video4.readyState >= 2) {
      videoTexture4.needsUpdate = true;
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

  // 3. Raycaster и синхронизация плеера только после завершения спуска в вагон
  if (!isDescentActive) {
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
  }

  // 5. Синхронизация звука поезда со скоростью
  updateSubwayAudio(trainSpeed, isGlobalMuted);

  // 6. Рендер кадра
  renderer.render(scene, camera);
}

function syncScrubberUI() {
  const allVideos = [video1, video2, video3, video4];
  allVideos.forEach((v, idx) => {
    if (v && v.duration) {
      const stageIdx = idx + 1;
      const progressEl = document.getElementById(`timeline-progress-stage${stageIdx}`);
      const timeText = document.getElementById(`time-text-stage${stageIdx}`);
      if (progressEl) {
        const pct = (v.currentTime / v.duration) * 100;
        progressEl.style.width = `${pct}%`;
      }
      if (timeText) {
        timeText.textContent = formatTime(v.currentTime);
      }
    }
  });
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

export function skipDescent() {
  if (!isDescentActive) return;
  isDescentActive = false;
  const preloader = document.getElementById('scene-preloader');
  if (preloader) {
    preloader.style.opacity = '0';
    preloader.style.display = 'none';
    preloader.classList.add('fade-out');
  }
  document.body.classList.remove('is-preloading');
  stopEscalatorAudio(0.3);
  if (!isGlobalMuted) {
    playArrivalChime();
  }
  if (escalatorGroup) {
    escalatorGroup.visible = true;
  }
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
  if (video1 && video1.paused) {
    video1.play().catch(() => {});
  }
  initScrollTriggers();
}
window.skipDescent = skipDescent;

// =============================================================================
// ОБРАБОТЧИКИ И ЭКСПОРТ РЕЖИМА FREE ROAM
// =============================================================================
function onFreeRoamToggled(isActive) {
  const storyTab = document.getElementById('mode-story-tab');
  const freeRoamTab = document.getElementById('mode-freeroam-tab');

  if (isActive) {
    if (storyTab) storyTab.classList.remove('is-active');
    if (freeRoamTab) freeRoamTab.classList.add('is-active');

    // Если прелоадер или спуск был активен, мгновенно завершаем его
    if (isDescentActive) {
      isDescentActive = false;
      const preloader = document.getElementById('scene-preloader');
      if (preloader) {
        preloader.style.opacity = '0';
        preloader.style.display = 'none';
        preloader.classList.add('fade-out');
      }
      document.body.classList.remove('is-preloading');
      stopEscalatorAudio(0.3);
      if (video1 && video1.paused) {
        video1.play().catch(() => {});
      }
    }

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
