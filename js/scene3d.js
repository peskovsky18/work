/**
 * Александр Песковский — 2026
 * 3D Scrollytelling Engine (Three.js + GSAP ScrollTrigger)
 */

import * as THREE from 'three';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { getSubwayMapTexture, getNoLeanDecalTexture, getPlaceholderScreenTexture } from './subwayMap.js';
import { initSubwayAudio, updateSubwayAudio, playDoorChime, playArrivalChime, playBrakeScreech } from './subwayAudio.js';

// =============================================================================
// КОНФИГУРАЦИЯ СЦЕНЫ И КАМЕРЫ (ДВИЖЕНИЕ ВПРАВО: ДВЕРИ -> СВЭГ -> МИНИ СВЭГ -> 03 -> 04 -> ДРУГАЯ СТОРОНА -> КОНТАКТЫ)
// =============================================================================
const CAMERA_WAYPOINTS = [
  // 0: Старт у открытых дверей на станции 1
  {
    desktop: { pos: new THREE.Vector3(-3.765, 1.35, -2.45), target: new THREE.Vector3(-3.765, 1.38, 0.0) },
    mobile:  { pos: new THREE.Vector3(-3.765, 1.35, -2.75), target: new THREE.Vector3(-3.765, 1.38, 0.0) }
  },
  // 1: Работа 1 «Свэг» (Screen 1)
  {
    desktop: { pos: new THREE.Vector3(-2.675, 1.40, -1.05), target: new THREE.Vector3(-2.675, 1.40, -0.016) },
    mobile:  { pos: new THREE.Vector3(-2.675, 1.40, -1.45), target: new THREE.Vector3(-2.675, 1.40, -0.016) }
  },
  // 2: Работа 2 «Мини свэг» (Screen 2)
  {
    desktop: { pos: new THREE.Vector3(-0.565, 1.40, -1.05), target: new THREE.Vector3(-0.565, 1.40, -0.016) },
    mobile:  { pos: new THREE.Vector3(-0.565, 1.40, -1.45), target: new THREE.Vector3(-0.565, 1.40, -0.016) }
  },
  // 3: Экран 03 (на 3-й работе поезд начинает разгон в тоннель)
  {
    desktop: { pos: new THREE.Vector3(0.515, 1.40, -1.05), target: new THREE.Vector3(0.515, 1.40, -0.016) },
    mobile:  { pos: new THREE.Vector3(0.515, 1.40, -1.45), target: new THREE.Vector3(0.515, 1.40, -0.016) }
  },
  // 4: Экран 04 (крейсерский ход в тоннеле)
  {
    desktop: { pos: new THREE.Vector3(2.675, 1.40, -1.05), target: new THREE.Vector3(2.675, 1.40, -0.016) },
    mobile:  { pos: new THREE.Vector3(2.675, 1.40, -1.45), target: new THREE.Vector3(2.675, 1.40, -0.016) }
  },
  // 5: Экран 08 (разворот на противоположную сторону вагона)
  {
    desktop: { pos: new THREE.Vector3(2.675, 1.40, -1.35), target: new THREE.Vector3(2.675, 1.40, -2.384) },
    mobile:  { pos: new THREE.Vector3(2.675, 1.40, -0.95), target: new THREE.Vector3(2.675, 1.40, -2.384) }
  },
  // 6: Экран 07 (сторона B)
  {
    desktop: { pos: new THREE.Vector3(0.515, 1.40, -1.35), target: new THREE.Vector3(0.515, 1.40, -2.384) },
    mobile:  { pos: new THREE.Vector3(0.515, 1.40, -0.95), target: new THREE.Vector3(0.515, 1.40, -2.384) }
  },
  // 7: Экран 06 (сторона B)
  {
    desktop: { pos: new THREE.Vector3(-0.565, 1.40, -1.35), target: new THREE.Vector3(-0.565, 1.40, -2.384) },
    mobile:  { pos: new THREE.Vector3(-0.565, 1.40, -0.95), target: new THREE.Vector3(-0.565, 1.40, -2.384) }
  },
  // 8: Экран 05 (сторона B)
  {
    desktop: { pos: new THREE.Vector3(-2.675, 1.40, -1.35), target: new THREE.Vector3(-2.675, 1.40, -2.384) },
    mobile:  { pos: new THREE.Vector3(-2.675, 1.40, -0.95), target: new THREE.Vector3(-2.675, 1.40, -2.384) }
  },
  // 9: Контакты и прибытие на новую освещенную станцию
  {
    desktop: { pos: new THREE.Vector3(-3.765, 1.35, -1.15), target: new THREE.Vector3(-3.765, 1.38, 1.80) },
    mobile:  { pos: new THREE.Vector3(-3.765, 1.35, -1.25), target: new THREE.Vector3(-3.765, 1.38, 1.80) }
  }
];

// Глобальное состояние
let scene, camera, renderer, clock;
let subwayModel;
const screenMeshes = [];
let screen1Mesh, screen2Mesh, platformMapMesh, emergencyBrakeMesh;
let isEmergencyBraking = false;
let video1, video2;
let videoTexture1, videoTexture2;
let screenLight1, screenLight2;
let activeStage = 0;
let isGlobalMuted = true;

// Двери вагона
let doorLeft, doorRight;
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

  clock = new THREE.Clock();

  // 4. Освещение вагона и станции
  setupSubwayLighting();

  // 4.1 Система тоннеля (Tunnel Run)
  setupTunnelSystem();

  // 4.2 Атмосферные микрочастицы в лучах света вагона
  setupDustParticles();

  // 4.3 Интерактивный стоп-кран в вагоне
  setupEmergencyBrake();

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
let windowPassingLight, windowPassingLight2, station1Light, station2Light;

function setupSubwayLighting() {
  const ambient = new THREE.AmbientLight(0x141824, 0.9);
  scene.add(ambient);

  [-3.0, -1.0, 1.0, 3.0].forEach(px => {
    const lamp = new THREE.PointLight(0xfff3df, 1.5, 6.0, 1.2);
    lamp.position.set(px, 2.15, -1.20);
    scene.add(lamp);
  });

  station1Light = new THREE.PointLight(0x8ec3f8, 1.4, 8.0, 1.3);
  station1Light.position.set(-3.765, 1.8, 1.5);
  scene.add(station1Light);

  station2Light = new THREE.PointLight(0xffdfb0, 0.0, 9.0, 1.3);
  station2Light.position.set(0.0, 1.9, 1.6);
  scene.add(station2Light);

  screenLight1 = new THREE.PointLight(0xffffff, 0.65, 3.0, 1.5);
  screenLight1.position.set(-2.675, 1.40, -0.28);
  scene.add(screenLight1);

  screenLight2 = new THREE.PointLight(0xffffff, 0.65, 3.0, 1.5);
  screenLight2.position.set(-0.565, 1.40, -0.28);
  scene.add(screenLight2);

  windowPassingLight = new THREE.PointLight(0xbedbff, 0.0, 8.0, 1.3);
  windowPassingLight.position.set(1.595, 1.45, 0.65);
  scene.add(windowPassingLight);

  windowPassingLight2 = new THREE.PointLight(0xbedbff, 0.0, 8.0, 1.3);
  windowPassingLight2.position.set(1.595, 1.45, -1.85);
  scene.add(windowPassingLight2);
}

function setupTunnelSystem() {
  tunnelGroup = new THREE.Group();
  const tMat = new THREE.MeshStandardMaterial({ color: 0x0c0e12, roughness: 0.92, metalness: 0.25 });
  const geom = new THREE.CylinderGeometry(3.6, 3.6, 60, 32, 1, true, -Math.PI * 0.45, Math.PI * 0.90);
  
  const w1 = new THREE.Mesh(geom, tMat); w1.rotation.z = Math.PI * 0.5; w1.position.set(0, 1.2, 2.5); tunnelGroup.add(w1);
  const w2 = new THREE.Mesh(geom, tMat); w2.rotation.z = -Math.PI * 0.5; w2.position.set(0, 1.2, -4.9); tunnelGroup.add(w2);

  // Продольные кабели высокого напряжения по стенам тоннеля
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x111215, roughness: 0.95 });
  const cableGeom = new THREE.CylinderGeometry(0.016, 0.016, 60, 8);
  cableGeom.rotateZ(Math.PI * 0.5);
  [-0.12, 0.0, 0.12].forEach(dy => {
    const c1 = new THREE.Mesh(cableGeom, cableMat);
    c1.position.set(0, 1.45 + dy, 1.02);
    tunnelGroup.add(c1);
    const c2 = new THREE.Mesh(cableGeom, cableMat);
    c2.position.set(0, 1.45 + dy, -3.42);
    tunnelGroup.add(c2);
  });

  // Проносящиеся сигнальные огни и световые полосы на обеих сторонах тоннеля
  const colors = [0xe8f4ff, 0x22ee66, 0xff3322, 0xffaa11, 0xe8f4ff, 0xffaa11];
  for (let i = 0; i < 16; i++) {
    const col = colors[i % colors.length];
    const isStrip = (i % 3 === 0);
    const sideZ = (i % 2 === 0) ? 0.98 : -3.38;
    const lGeom = isStrip ? new THREE.BoxGeometry(2.4, 0.05, 0.04) : new THREE.BoxGeometry(0.5, 0.08, 0.08);
    const bMesh = new THREE.Mesh(lGeom, new THREE.MeshBasicMaterial({ color: col }));
    bMesh.position.set(-28 + i * 3.8, 1.5 + (i % 3) * 0.25, sideZ);
    const bLight = new THREE.PointLight(col, 0.75, 4.2, 1.8);
    bLight.position.copy(bMesh.position);
    tunnelLights.push({ mesh: bMesh, light: bLight, sideZ });
    tunnelGroup.add(bMesh); tunnelGroup.add(bLight);
  }

  // Встречный поезд на соседнем пути в тоннеле (проносится в окнах)
  oppTrainGroup = new THREE.Group();
  const oppBodyMat = new THREE.MeshStandardMaterial({ color: 0x0a0c10, roughness: 0.85, metalness: 0.6 });
  const oppCar = new THREE.Mesh(new THREE.BoxGeometry(24, 2.7, 2.2), oppBodyMat);
  oppCar.position.set(0, 1.45, 0);
  oppTrainGroup.add(oppCar);

  const oppWinMat = new THREE.MeshBasicMaterial({ color: 0xffdf88 });
  const oppWinGeom = new THREE.BoxGeometry(1.2, 0.65, 0.04);
  for (let wx = -9.0; wx <= 9.0; wx += 2.2) {
    const wMesh = new THREE.Mesh(oppWinGeom, oppWinMat);
    wMesh.position.set(wx, 1.5, -1.12);
    oppTrainGroup.add(wMesh);
  }
  oppTrainGroup.position.set(-80, 0, 2.3);
  tunnelGroup.add(oppTrainGroup);

  scene.add(tunnelGroup);
}

// Атмосферные летающие микрочастицы (пылинки) в лучах освещения вагона
let dustParticles, dustPositions;
const DUST_COUNT = 160;

function setupDustParticles() {
  const geom = new THREE.BufferGeometry();
  dustPositions = new Float32Array(DUST_COUNT * 3);
  for (let i = 0; i < DUST_COUNT; i++) {
    dustPositions[i * 3]     = (Math.random() - 0.5) * 8.2;
    dustPositions[i * 3 + 1] = 0.35 + Math.random() * 1.9;
    dustPositions[i * 3 + 2] = -0.15 - Math.random() * 2.1;
  }
  geom.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xfff4d8,
    size: 0.024,
    transparent: true,
    opacity: 0.35,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  dustParticles = new THREE.Points(geom, mat);
  scene.add(dustParticles);
}

// Интерактивный стоп-кран в вагоне (пасхалка)
function setupEmergencyBrake() {
  const brakeGroup = new THREE.Group();
  const redBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.10, 0.16, 0.05),
    new THREE.MeshStandardMaterial({ color: 0xd61818, roughness: 0.30, metalness: 0.35 })
  );
  brakeGroup.add(redBox);

  const lever = new THREE.Mesh(
    new THREE.CylinderGeometry(0.009, 0.009, 0.12, 8),
    new THREE.MeshStandardMaterial({ color: 0xf0f3f6, roughness: 0.12, metalness: 0.98 })
  );
  lever.position.set(0, -0.012, 0.035);
  lever.rotation.z = Math.PI * 0.25;
  brakeGroup.add(lever);

  brakeGroup.position.set(-3.25, 1.62, -0.06);
  emergencyBrakeMesh = redBox;
  redBox.userData = { isBrake: true, group: brakeGroup, lever };
  scene.add(brakeGroup);
}

function triggerEmergencyBrake() {
  if (isEmergencyBraking) return;
  isEmergencyBraking = true;
  playBrakeScreech();

  if (emergencyBrakeMesh && emergencyBrakeMesh.userData.lever) {
    emergencyBrakeMesh.userData.lever.rotation.z = -Math.PI * 0.25;
  }

  window.dispatchEvent(new CustomEvent('emergency-brake-triggered'));
  trainSpeed = 0.0;

  setTimeout(() => {
    if (emergencyBrakeMesh && emergencyBrakeMesh.userData.lever) {
      emergencyBrakeMesh.userData.lever.rotation.z = Math.PI * 0.25;
    }
    isEmergencyBraking = false;
    window.dispatchEvent(new CustomEvent('emergency-brake-reset'));
  }, 4500);
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

      // Настройка материалов для реалистичного тёмного стиля Apple
      subwayModel.traverse((child) => {
        if (!child.isMesh) return;

        // 1. Интерактивные экраны (1-2 видео, 3-8 плейсхолдеры)
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

        // 5. Архитектурная отделка окна и стен вагона
        if (child.name === 'Window_Sill_Ledge') {
          child.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0xa4acb8), // сатинированный подоконник
            roughness: 0.28,
            metalness: 0.76
          });
          return;
        }

        if (child.name === 'Window_Backing_Wall' || child.name.startsWith('Window_Reveal_')) {
          child.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0xb2b8c2), // шлифованная сталь за обкладкой окна (закрывает углы)
            roughness: 0.30,
            metalness: 0.82
          });
          return;
        }

        if (child.name === 'Subway_Wall_Crown_Frieze') {
          child.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0xb2b8c2), // карнизный фриз под потолком
            roughness: 0.28,
            metalness: 0.82
          });
          return;
        }

        if (child.name === 'Wall_Window_Right_Pier') {
          child.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0xb2b8c2),
            roughness: 0.30,
            metalness: 0.82
          });
          return;
        }

        const matName = child.material ? child.material.name : '';

        // Стекла окон и дверей
        if (child.name.includes('Glass') || matName === 'Mat_Glass') {
          child.material = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(0x7aa5c2),
            transparent: true,
            opacity: 0.38,
            roughness: 0.04,
            metalness: 0.1,
            reflectivity: 0.95,
            clearcoat: 1.0,
            clearcoatRoughness: 0.08,
            side: THREE.DoubleSide,
            depthWrite: false
          });
        }

        // Металлические хромированные поручни, ручки и кольца
        if (child.name.includes('Pole') || child.name.includes('Handle') || child.name.includes('Rail') || matName === 'Mat_Chrome' || matName === 'Mat_Metal_Pole') {
          child.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0xdce0e6),
            roughness: 0.15,
            metalness: 0.96
          });
        }

        // Шлифованная сталь (панели стен, тисненые пластины)
        if (matName === 'Mat_Brushed_Steel' || (child.name.includes('Plate') && !child.name.includes('Screen'))) {
          child.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0xb2b8c2),
            roughness: 0.30,
            metalness: 0.82
          });
        }

        // Алюминиевые элементы (стойки дверей, карнизы)
        if (matName === 'Mat_Aluminum' || child.name.includes('Post') || child.name.includes('Housing')) {
          child.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0xc2c7cf),
            roughness: 0.38,
            metalness: 0.70
          });
        }

        // Потолочные светильники / рассеиватели
        if (matName === 'Mat_Fluorescent_Light' || child.name.includes('Diffuser')) {
          child.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0xfff6e5),
            emissive: new THREE.Color(0xfff1dc),
            emissiveIntensity: 2.3,
            roughness: 0.2
          });
        }

        // Темный пол вагона с приятным легким отражением
        if (child.name.includes('Floor') || matName === 'Mat_Subway_Floor' || matName === 'Mat_Dark_Floor') {
          child.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0x181a20),
            roughness: 0.24,
            metalness: 0.42
          });
        }

        // Желтые ретро-сиденья
        if (matName === 'Mat_Fiberglass_Yellow' || matName === 'Mat_Seat_Yellow' || child.name.includes('Seat_Yellow')) {
          child.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0xf2a91d),
            roughness: 0.38,
            metalness: 0.06
          });
        }

        // Оранжевые ретро-сиденья
        if (matName === 'Mat_Fiberglass_Orange' || matName === 'Mat_Seat_Orange' || child.name.includes('Seat_Orange')) {
          child.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0xdc5018),
            roughness: 0.38,
            metalness: 0.06
          });
        }
      });

      // Находим створки дверей вагона и устанавливаем их изначально ОТКРЫТЫМИ на Дверях 1
      doorLeft = subwayModel.getObjectByName('Door_Left_Photo') || subwayModel.getObjectByName('Door_ScreenLeft');
      doorRight = subwayModel.getObjectByName('Door_Right_Photo') || subwayModel.getObjectByName('Door_ScreenRight');
      if (doorLeft && doorRight) {
        doorLeft.position.x = DOOR_LEFT_OPEN_X;
        doorRight.position.x = DOOR_RIGHT_OPEN_X;
      }

      // Позиционирование створок остальных дверных проемов вагона (Двери 2, 3, 4)
      const doorLeftD2 = subwayModel.getObjectByName('Door_Left_Photo_D2');
      const doorRightD2 = subwayModel.getObjectByName('Door_Right_Photo_D2');
      if (doorLeftD2 && doorRightD2) {
        doorLeftD2.position.set(4.065, 0.99, 0.015);
        doorRightD2.position.set(3.465, 0.99, 0.015);
      }

      const doorLeftD3 = subwayModel.getObjectByName('Door_Left_Photo_D3');
      const doorRightD3 = subwayModel.getObjectByName('Door_Right_Photo_D3');
      if (doorLeftD3 && doorRightD3) {
        doorLeftD3.position.set(-3.465, 0.99, -2.38);
        doorRightD3.position.set(-4.065, 0.99, -2.38);
      }

      const doorLeftD4 = subwayModel.getObjectByName('Door_Left_Photo_D4');
      const doorRightD4 = subwayModel.getObjectByName('Door_Right_Photo_D4');
      if (doorLeftD4 && doorRightD4) {
        doorLeftD4.position.set(4.065, 0.99, -2.38);
        doorRightD4.position.set(3.465, 0.99, -2.38);
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
  const NUM_SEGMENTS = CAMERA_WAYPOINTS.length - 1;
  let hasPlayedDoorChime = false;
  let hasPlayedArrivalChime = false;

  ScrollTrigger.create({
    trigger: '#scroll-story',
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1.0,
    onUpdate: (self) => {
      const p = Math.max(0.0, Math.min(1.0, self.progress));

      const scaledP = p * NUM_SEGMENTS;
      const fromIdx = Math.min(Math.floor(scaledP), NUM_SEGMENTS - 1);
      const toIdx = fromIdx + 1;
      const localT = scaledP - fromIdx;
      const easedT = localT * localT * (3 - 2 * localT);

      const wpFrom = getWaypoint(fromIdx);
      const wpTo = getWaypoint(toIdx);

      camTargetPos.lerpVectors(wpFrom.pos, wpTo.pos, easedT);
      camTargetLookAt.lerpVectors(wpFrom.target, wpTo.target, easedT);

      // Звуковые сигналы закрытия дверей и прибытия на станцию
      if (p < 0.01) {
        hasPlayedDoorChime = false;
      } else if (p > 0.02 && !hasPlayedDoorChime && !isGlobalMuted) {
        playDoorChime();
        hasPlayedDoorChime = true;
      }

      if (p < 0.88) {
        hasPlayedArrivalChime = false;
      } else if (p > 0.94 && !hasPlayedArrivalChime && !isGlobalMuted) {
        playArrivalChime();
        hasPlayedArrivalChime = true;
      }

      // Двери закрываются при отправлении со ст.1 и открываются при прибытии на ст.2
      if (p >= 0.94) {
        targetDoorCloseRatio = Math.max(0.0, 1.0 - (p - 0.94) / 0.06);
      } else {
        targetDoorCloseRatio = Math.min(Math.max(p / 0.08, 0.0), 1.0);
      }

      // Профиль скорости поезда (разгон на 3-й работе, торможение к контактам)
      if (p < 0.22) {
        trainSpeed = 0.0;
      } else if (p < 0.35) {
        trainSpeed = (p - 0.22) / 0.13;
      } else if (p < 0.88) {
        trainSpeed = 1.0;
      } else {
        trainSpeed = Math.max(0.0, 1.0 - (p - 0.88) / 0.08);
      }

      // Свет станции 1 затухает при отправлении, свет станции 2 разгорается при прибытии
      if (station1Light) station1Light.intensity = Math.max(0.0, 1.4 * (1.0 - p / 0.18));
      if (station2Light) station2Light.intensity = Math.max(0.0, 1.6 * ((p - 0.86) / 0.14));

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
  if (!isGlobalMuted) {
    initSubwayAudio();
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

  // Гироскоп на смартфонах (наклон телефона для кинематографичного обзора)
  window.addEventListener('deviceorientation', (e) => {
    if (e.gamma !== null && e.beta !== null) {
      const gx = Math.min(Math.max(e.gamma, -25), 25) / 25;
      const gy = Math.min(Math.max(e.beta - 45, -25), 25) / 25;
      mouseOffset.x = gx * 0.06;
      mouseOffset.y = -gy * 0.04;
    }
  }, { passive: true });

  // Клик по экрану в 3D пространстве
  window.addEventListener('click', (e) => {
    // Не срабатывать, если клик был по интерфейсу (кнопкам)
    if (e.target.closest('button, a, input, .glass-capsule, .site-header, .emergency-banner')) return;

    if (hoveredScreen) {
      if (hoveredScreen === emergencyBrakeMesh || (hoveredScreen.userData && hoveredScreen.userData.isBrake)) {
        triggerEmergencyBrake();
      } else if (hoveredScreen === platformMapMesh) {
        window.dispatchEvent(new CustomEvent('open-map-modal'));
      } else if (hoveredScreen === screen1Mesh) {
        scrollToStage(1);
        toggleVideoPlay(video1);
      } else if (hoveredScreen === screen2Mesh) {
        scrollToStage(2);
        toggleVideoPlay(video2);
      } else {
        const sIdx = screenMeshes.indexOf(hoveredScreen);
        const stageMap = { 3: 3, 4: 4, 8: 5, 7: 6, 6: 7, 5: 8 };
        if (stageMap[sIdx] !== undefined) {
          scrollToStage(stageMap[sIdx]);
        }
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

  const dt = clock ? Math.min(clock.getDelta(), 0.1) : 0.016;
  const time = clock ? clock.getElapsedTime() : performance.now() * 0.001;

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

  // 2.2 Процедурное покачивание вагона и микровибрация при движении в тоннеле
  const vibY = (Math.sin(time * 16.0) * 0.002 + Math.sin(time * 4.0) * 0.006) * trainSpeed;
  const vibX = (Math.cos(time * 12.0) * 0.0015 + Math.sin(time * 2.5) * 0.004) * trainSpeed;
  const vibRoll = Math.sin(time * 3.0) * 0.003 * trainSpeed;
  const emShake = isEmergencyBraking ? (Math.random() - 0.5) * 0.025 : 0;

  camera.position.set(
    camCurrentPos.x + mouseOffsetDamped.x + vibX + emShake,
    camCurrentPos.y + mouseOffsetDamped.y + vibY + emShake,
    camCurrentPos.z
  );
  camera.lookAt(camCurrentTarget.x + mouseOffsetDamped.x * 0.5, camCurrentTarget.y, camCurrentTarget.z);
  camera.rotation.z += vibRoll;

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

  // 2.4 Движение встречного поезда в тоннеле за окнами
  if (oppTrainGroup && trainSpeed > 0.25) {
    oppTrainGroup.position.x += (trainSpeed * 22.0 + 36.0) * dt;
    if (oppTrainGroup.position.x > 50.0) {
      oppTrainGroup.position.x = -130.0 - Math.random() * 80.0;
    }
  }

  // 2.5 Дрейф атмосферных микрочастиц в воздухе вагона
  if (dustParticles && dustPositions) {
    const posAttr = dustParticles.geometry.attributes.position;
    const pArr = posAttr.array;
    const airDraft = trainSpeed * 1.5 * dt;
    for (let i = 0; i < DUST_COUNT; i++) {
      const idx = i * 3;
      pArr[idx + 1] += Math.sin(time * 1.6 + pArr[idx]) * 0.0006;
      pArr[idx] -= airDraft;
      if (pArr[idx] < -4.1) pArr[idx] += 8.2;
    }
    posAttr.needsUpdate = true;
  }

  // 3. Raycaster для определения наведения на экраны и схему метро
  const validScreens = screenMeshes.filter(Boolean);
  if (platformMapMesh) validScreens.push(platformMapMesh);
  if (emergencyBrakeMesh) validScreens.push(emergencyBrakeMesh);
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
