/**
 * 3D-автомат: загрузка claw_machine.glb, свет, камера и все движения (карта -> терминал, клешня, приз).
 * Координаты three: Y вверх, фронт автомата смотрит в +Z (в Blender это -Y).
 * Имена объектов задаёт claw/build_claw_machine.py.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/DRACOLoader.js';

const gsap = window.gsap;

/** Пружина без перелёта (SmoothDamp): плавно догоняет цель, сглаживая резкие старты и остановки. */
function smoothDamp(cur, target, vel, key, smoothTime, dt) {
  const omega = 2 / smoothTime;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = cur - target;
  const temp = (vel[key] + omega * change) * dt;
  vel[key] = (vel[key] - omega * temp) * exp;
  return target + (change + temp) * exp;
}
const CAM_KEYS = ['px', 'py', 'pz', 'tx', 'ty', 'tz'];
// клешня на тросе раскачивается от разгона и торможения каретки
const SWING = { gain: 0.32, damp: 2.4, calm: 9, max: 0.18 };
const PIXEL_FONT = '"JetBrains Mono", monospace';

// ------------------------------------------------------------------ окружение для отражений
function makeEnvironment(renderer) {
  const env = new THREE.Scene();
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(12, 8, 12),
    new THREE.MeshBasicMaterial({ color: 0x15161b, side: THREE.BackSide })
  );
  room.position.y = 3;
  env.add(room);
  const panel = (w, h, color, intensity, pos, look) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide })
    );
    m.position.set(...pos);
    m.lookAt(...look);
    env.add(m);
  };
  panel(4, 2.5, 0xfff3e6, 3.2, [-3.5, 4, 4], [0, 1, 0]);    // ключевой софтбокс
  panel(3, 3, 0xdfe8ff, 1.6, [4.5, 2.5, 2.5], [0, 1, 0]);    // заполняющий
  panel(6, 0.6, 0xffffff, 2.5, [0, 6.8, 0], [0, 0, 0]);       // полоса сверху
  panel(2, 4, 0xb06cff, 1.2, [-5, 2, -3], [0, 1, 0]);        // фиолетовый контровой
  panel(2, 4, 0xff3fb4, 0.9, [5, 2, -4], [0, 1, 0]);         // розовый контровой
  // светлая полоса за зрителем: хром клешни и рамок отражает её, а не тёмную комнату
  panel(7, 1.2, 0xe8ecff, 0.55, [0, 1.6, 5.8], [0, 1.2, 0]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.035).texture;
  pmrem.dispose();
  return tex;
}

// Пол: радиальный градиент в шейдере (текстура 512 px на 14 м давала ступени).
// Без экранного шума: под сдвигающейся камерой он рябил.
function floorMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */`
      varying vec2 vP;
      void main() {
        vP = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      varying vec2 vP;
      void main() {
        float r = length(vP) / 7.0;
        vec3 center = vec3(0.227, 0.184, 0.322);
        vec3 mid = vec3(0.110, 0.102, 0.141);
        vec3 edge = vec3(0.055, 0.059, 0.075);
        vec3 c = mix(center, mid, smoothstep(0.0, 0.3, r));
        c = mix(c, edge, smoothstep(0.3, 0.95, r));
        c *= mix(0.45, 1.0, smoothstep(0.045, 0.11, r)); // мягкая тень под автоматом
        gl_FragColor = vec4(c, 1.0);
      }`
  });
}

// Светодиодные ленты: бегущие точки пурпурный/фиолетовый/синий/розовый (в Blender тот же рисунок по позиции)
function ledMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uBoost: { value: 1 } },
    vertexShader: /* glsl */`
      varying float vY;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vY = w.y;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform float uBoost;
      varying float vY;
      // плавный переход пурпурный -> фиолетовый -> синий -> розовый (ступенчатые цвета мерцали)
      vec3 pal(float t) {
        vec3 c0 = vec3(1.0, 0.17, 0.84);
        vec3 c1 = vec3(0.54, 0.23, 1.0);
        vec3 c2 = vec3(0.18, 0.42, 1.0);
        vec3 c3 = vec3(1.0, 0.31, 0.64);
        float x = fract(t) * 4.0;
        float f = smoothstep(0.0, 1.0, fract(x));
        if (x < 1.0) return mix(c0, c1, f);
        if (x < 2.0) return mix(c1, c2, f);
        if (x < 3.0) return mix(c2, c3, f);
        return mix(c3, c0, f);
      }
      void main() {
        // ровное свечение без точек; цвет зависит только от высоты: ленты на одной высоте одного цвета,
        // на углах цвета сходятся, градиент медленно ползёт вверх
        float s = vY * 0.42 - uTime * 0.05;
        gl_FragColor = vec4(pal(s) * uBoost, 1.0);
      }`
  });
}

const WIN_TIME = 3.2;   // сколько секунд автомат празднует
const ROUND_SPEED = 1.8; // во сколько раз быстрее идёт партия с клешнёй

// ------------------------------------------------------------------ текстуры-холсты (экран терминала, постеры)
function canvasTexture(w, h, draw, pixel = false) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = !pixel;
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = false; // как у текстур из GLB
  t.anisotropy = 4;
  // вблизи чёткие пиксели, издалека мипмапы (без них мелкая текстура искрит при движении камеры)
  if (pixel) t.magFilter = THREE.NearestFilter;
  return t;
}

function drawContactless(g, cx, cy, s, color) {
  g.fillStyle = color;
  // ступенчатые дуги из квадратов: пиксельный значок бесконтактной оплаты
  for (let i = 0; i < 3; i++) {
    const r = s * (0.4 + i * 0.3);
    for (let a = -45; a <= 45; a += 7) {
      const rad = (a * Math.PI) / 180;
      g.fillRect(Math.round(cx + Math.cos(rad) * r), Math.round(cy + Math.sin(rad) * r), 6, 6);
    }
  }
}

function terminalScreen(state, category) {
  return canvasTexture(160, 200, (g, w, h) => {
    g.fillStyle = '#07080b';
    g.fillRect(0, 0, w, h);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (state === 'win') {
      // звёзды-квадраты вокруг надписи
      [[22, 30, '#ffd23f'], [130, 26, '#ff2bd6'], [28, 168, '#3ee0b0'], [128, 172, '#ffd23f'], [80, 18, '#4aa8ff']]
        .forEach(([x, y, c]) => { g.fillStyle = c; g.fillRect(x - 6, y, 12, 4); g.fillRect(x - 2, y - 4, 4, 12); });
      g.fillStyle = '#ffd23f';
      g.font = `800 30px ${PIXEL_FONT}`;
      g.fillText('ПОБЕДА', w / 2, 84);
      g.fillStyle = '#ff2bd6';
      g.fillText('!!!', w / 2, 116);
      g.fillStyle = '#ffffff';
      g.font = `800 14px ${PIXEL_FONT}`;
      g.fillText('шар в лотке', w / 2, 156);
    } else if (state === 'approved') {
      g.fillStyle = '#2bff88';
      g.fillRect(56, 44, 48, 48);
      g.fillStyle = '#07080b';
      // галочка квадратами
      [[64, 66], [70, 72], [76, 78], [82, 72], [88, 66], [94, 60]].forEach(([x, y]) => g.fillRect(x, y, 6, 6));
      g.fillStyle = '#ffffff';
      g.font = `800 20px ${PIXEL_FONT}`;
      g.fillText('ОПЛАЧЕНО', w / 2, 122);
      g.fillStyle = '#ffb000';
      g.font = `800 15px ${PIXEL_FONT}`;
      g.fillText(category ? category.title : '', w / 2, 146);
    } else if (state === 'reading') {
      drawContactless(g, 58, 70, 40, '#ffffff');
      g.fillStyle = '#ffffff';
      g.font = `800 21px ${PIXEL_FONT}`;
      g.fillText('ЧТЕНИЕ…', w / 2, 140);
    } else {
      drawContactless(g, 58, 70, 40, '#ffb000');
      g.fillStyle = '#ffffff';
      g.font = `800 21px ${PIXEL_FONT}`;
      g.fillText('ОПЛАТА', w / 2, 124);
      g.fillText('КАРТОЙ', w / 2, 148);
      g.fillStyle = '#ffb000';
      g.font = `800 13px ${PIXEL_FONT}`;
      g.fillText('выбери карту', w / 2, 176);
    }
  }, true);
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function posterTexture(work, aspect, category) {
  const w = 512, h = Math.round(512 / aspect);
  const img = work && work.poster ? await loadImage(work.poster) : null;
  return canvasTexture(w, h, (g) => {
    if (img) {
      const s = Math.max(w / img.width, h / img.height);
      g.drawImage(img, (w - img.width * s) / 2, (h - img.height * s) / 2, img.width * s, img.height * s);
      return;
    }
    g.fillStyle = '#1b0b3a';
    g.fillRect(0, 0, w, h);
    g.fillStyle = category ? category.colors[0] : '#ffb000';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `800 ${Math.round(h * 0.24)}px ${PIXEL_FONT}`;
    g.fillText(work ? work.title.toUpperCase() : 'СКОРО', w / 2, h / 2);
  }, !img);
}

// ------------------------------------------------------------------ сам автомат
export class Machine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0e0f13);
    this.scene.fog = new THREE.Fog(0x0e0f13, 5, 11);
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 30);
    this.view = { px: 0, py: 1.3, pz: 5, tx: 0, ty: 1, tz: 0 };
    // камера не прыгает за this.view, а догоняет её пружиной
    this.cam = null;
    this.camVel = { px: 0, py: 0, pz: 0, tx: 0, ty: 0, tz: 0 };
    this.pointer = { x: 0, y: 0, sx: 0, sy: 0 };
    this.clock = new THREE.Clock();
    this.winT = null;
    this.taken = new Set();
    this.shot = 'intro';
    this.ledMaterial = ledMaterial();

    window.addEventListener('resize', () => this.resize());
    window.addEventListener('pointermove', (e) => {
      this.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    });
  }

  async load(buffer) {
    this.scene.environment = makeEnvironment(this.renderer);
    const draco = new DRACOLoader().setDecoderPath('../js/vendor/draco/');
    const loader = new GLTFLoader().setDRACOLoader(draco);
    const gltf = await new Promise((resolve, reject) => loader.parse(buffer, './', resolve, reject));
    this.root = gltf.scene;
    // пол и стена студии из Blender лежат там же, где наш пол, и дерутся с ним за пиксели (рябь)
    this.root.getObjectsByProperty('name', 'Studio_Floor').concat(this.root.getObjectsByProperty('name', 'Studio_Wall'))
      .forEach((o) => o.removeFromParent());
    this.scene.add(this.root);
    this.setupLights();
    this.fixMaterials();
    this.collect();
    this.resize();
    this.setScreen('idle');
    this.applyShot('intro', 0);
    this.renderer.setAnimationLoop(() => this.tick());
    // прогрев шейдеров до показа
    this.renderer.compile(this.scene, this.camera);
  }

  setupLights() {
    const floor = new THREE.Mesh(new THREE.CircleGeometry(7, 96), floorMaterial());
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);
    this.scene.add(new THREE.HemisphereLight(0xcfd6ff, 0x1a1420, 0.5));
    const key = new THREE.DirectionalLight(0xfff1e0, 1.6);
    key.position.set(-2.5, 4, 3.5);
    this.scene.add(key);
    // свет внутри стеклянной камеры, как лампа в потолке автомата
    const inside = new THREE.PointLight(0xfff4e6, 2.2, 2.2, 1.6);
    inside.position.set(0, 1.78, 0);
    this.scene.add(inside);
    this.inside = inside;
  }

  fixMaterials() {
    this.bulbs = {};
    this.glow = new Map();   // что вспыхивает при победе: материал -> { исходная яркость, усиление }
    const glass = (opacity, color = 0xffffff) => new THREE.MeshPhysicalMaterial({
      color, metalness: 0, roughness: 0.04, transparent: true, opacity, depthWrite: false,
      envMapIntensity: 1.4, clearcoat: 1, clearcoatRoughness: 0.03
    });
    const swap = {
      Glass: glass(0.1),
      Acrylic: glass(0.16, 0xeef6ff),
      Smoked_Acrylic: glass(0.7, 0x2a2f3a)
    };
    this.root.traverse((o) => {
      if (!o.isMesh) return;
      const name = o.material.name;
      if (name === 'LED_Strip') {
        o.material = this.ledMaterial;
      } else if (name === 'Bulb_A' || name === 'Bulb_B') {
        this.bulbs[name] = { mat: o.material, base: o.material.emissiveIntensity || 1 };
      } else if (name === 'Marquee_Panel' || name === 'Marquee_Front') {
        this.glow.set(o.material, { base: o.material.emissiveIntensity || 1, gain: 0.8 });
      } else if (name === 'Print_Front' || name === 'Print_Side' || name === 'Prize_Label' || name === 'Lightbox_Glow') {
        // печать на корпусе при победе подсвечивается изнутри: её видно, когда камера смотрит на дверцу
        this.glow.set(o.material, { base: o.material.emissiveIntensity || 1, gain: 1.6 });
      }
      else if (swap[name]) o.material = swap[name];
      else if (name === 'Cap_Clear' || name === 'Cap_Clear_Bottom') {
        // капсулы с работами непрозрачные, как остальные: постер видно только когда шар раскроется
        o.material = new THREE.MeshPhysicalMaterial({ color: 0xf5f3ee, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08 });
        o.material.name = name;
      } else if (name.startsWith('Glass')) o.renderOrder = 3;
      if (name === 'Chrome' || name === 'Aluminum') o.material.envMapIntensity = 1.5;
      if (name === 'Chrome') o.material.roughness = 0.16;
      if (name === 'Gloss_Black') {
        // корпус терминала полуматовый: иначе фиолетовая подсветка ложится пятном поверх индикаторов
        o.material.roughness = 0.45;
        o.material.clearcoat = 0.25;
        o.material.clearcoatRoughness = 0.5;
      }
    });
  }

  collect() {
    const get = (n) => this.root.getObjectByName(n);
    this.crossbar = get('Gantry_Crossbar');
    this.carriage = get('Claw_Carriage');
    this.claw = get('Claw');
    this.cable = get('Claw_Cable');
    this.coil = get('Claw_Coil');
    // подвес: трос, пружина и клешня висят на общей точке у верха троса и качаются вместе
    this.root.updateMatrixWorld(true);
    this.swing = new THREE.Group();
    this.swing.name = 'Claw_Swing';
    this.swing.position.copy(this.cable.position);
    this.carriage.add(this.swing);
    this.swing.updateMatrixWorld(true);
    for (const o of [this.cable, this.coil, this.claw]) if (o) this.swing.attach(o);
    this.pend = { x: 0, vx: 0, z: 0, vz: 0, prev: null, vel: new THREE.Vector3(), acc: new THREE.Vector3(), damp: SWING.damp };
    this.prongs = [0, 1, 2].map((i) => get(`Claw_Prong_${i}`)).filter(Boolean);
    this.screen = get('Terminal_Screen');
    this.markChute = get('Mark_Chute');
    this.markDoor = get('Mark_PrizeDoor');
    this.cards = {};
    for (const id of ['video', 'creative', 'vibecode']) {
      const card = get(`Card_${id}`);
      if (card) this.cards[id] = { obj: card, pos: card.position.clone(), quat: card.quaternion.clone() };
    }
    this.root.updateMatrixWorld(true);
    this.rest = {
      crossZ: this.crossbar.position.z,
      carX: this.carriage.position.x,
      clawY: this.claw.position.y,
      cableTopY: this.cable.getWorldPosition(new THREE.Vector3()).y,
      clawWorldY: this.claw.getWorldPosition(new THREE.Vector3()).y
    };
    this.cableLen = this.rest.cableTopY - (this.rest.clawWorldY + 0.025);
    this.prongBase = this.prongs.map((p) => {
      const radial = p.position.clone().setY(0).normalize();
      return { q: p.quaternion.clone(), axis: new THREE.Vector3(0, 1, 0).cross(radial).normalize() };
    });
    this.grip = { v: 0 };
    // меши пальцев и низ корпуса клешни (без пальцев) относительно её начала: по ним подгоняем захват под шар
    this.prongMeshes = [];
    this.prongs.forEach((p) => p.traverse((o) => { if (o.isMesh) this.prongMeshes.push(o); }));
    const clawInv = this.claw.matrixWorld.clone().invert();
    const v = new THREE.Vector3();
    this.clawBodyLow = 0;
    this.claw.traverse((o) => {
      if (!o.isMesh || this.prongMeshes.includes(o)) return;
      const pos = o.geometry.attributes.position;
      const mtx = clawInv.clone().multiply(o.matrixWorld);
      for (let i = 0; i < pos.count; i++) this.clawBodyLow = Math.min(this.clawBodyLow, v.fromBufferAttribute(pos, i).applyMatrix4(mtx).y);
    });

    // капсулы: прозрачные с постерами и цветные наполнители
    this.capsules = [];
    this.root.traverse((o) => {
      if (!/^Capsule_(U_\d+|Project_)/.test(o.name)) return;
      if (o.parent && /^Capsule_/.test(o.parent.name)) return; // части многоматериального меша
      const meshes = o.isMesh ? [o] : o.children.filter((c) => c.isMesh && !c.name.startsWith('Poster'));
      const poster = o.children.find((c) => c.name.startsWith('Poster'));
      const isProject = o.name.startsWith('Capsule_Project_');
      const tint = meshes.filter((m) => !/^(Cap_White|Cap_Clear)/.test(m.material.name));
      o.updateMatrixWorld(true);
      // настоящий радиус по вершинам: Box3 повёрнутого шара завышает его на треть
      const center = o.getWorldPosition(new THREE.Vector3());
      const w = new THREE.Vector3();
      let radius = 0;
      for (const mesh of meshes) {
        const pos = mesh.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) radius = Math.max(radius, w.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).distanceTo(center));
      }
      this.capsules.push({
        obj: o, isProject, poster, tint,
        top: meshes.find((m) => m.material.name === 'Cap_Clear' || (!isProject && tint.includes(m))),
        bottom: meshes.find((m) => m.material.name === 'Cap_Clear_Bottom' || m.material.name === 'Cap_White'),
        home: { pos: o.position.clone(), quat: o.quaternion.clone(), parent: o.parent },
        radius
      });
    });
    this.projectSlots = this.capsules.filter((c) => c.isProject);
    for (const slot of this.projectSlots) {
      if (!slot.poster) continue;
      slot.poster.geometry.computeBoundingBox();
      const s = slot.poster.geometry.boundingBox.getSize(new THREE.Vector3());
      const dims = [s.x, s.y, s.z].sort((a, b) => b - a);
      slot.aspect = dims[0] / dims[1];
    }
  }

  // ---------------------------------------------------------------- камера
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // под новый размер окна пересчитываем кадр, но не трогаем идущие переходы камеры внутри раунда
    if (this.root) { Object.assign(this.view, this.shotView(this.shot)); this.cam = null; }
  }

  shotView(name) {
    const portrait = this.camera.aspect < 0.8;
    const shots = {
      // на входе снизу окно с картами: автомат выше центра
      intro: { t: [0.05, portrait ? 0.62 : 0.78, 0.1], d: [0.28, 0.16, 1], w: 1.55, h: portrait ? 3.6 : 3.0 },
      // внизу кнопки: кадр чуть шире и автомат выше, чтобы они не закрывали цоколь
      idle: { t: [0.05, 0.92, 0.1], d: [0.3, 0.14, 1], w: 1.5, h: 2.8 },
      pay: { t: [0.22, 0.98, 0.55], d: [0.42, 0.42, 1], w: 0.75, h: 0.55 },
      glass: { t: [0.0, 1.22, 0.1], d: [0.08, 0.22, 1], w: 1.05, h: 1.15 },
      door: { t: [-0.11, 0.42, 0.55], d: [0.2, 0.3, 1], w: 0.95, h: 0.75 },
      prize: { t: [-0.05, 0.7, 1.15], d: [0.1, 0.18, 1], w: 0.36, h: 0.36 }
    };
    const s = shots[name];
    const vfov = THREE.MathUtils.degToRad(this.camera.fov);
    const dist = Math.max(s.h / 2 / Math.tan(vfov / 2), s.w / 2 / (Math.tan(vfov / 2) * this.camera.aspect));
    const dir = new THREE.Vector3(...s.d).normalize();
    const p = new THREE.Vector3(...s.t).addScaledVector(dir, dist);
    return { px: p.x, py: p.y, pz: p.z, tx: s.t[0], ty: s.t[1], tz: s.t[2] };
  }

  /**
   * Переход камеры как часть таймлайна: срабатывает в свой момент и не отменяет соседние переходы.
   * applyShot сразу убивает все твины камеры, поэтому внутри одной партии его звать нельзя:
   * выживал только последний кадр, и следующая партия начиналась с камерой на призе.
   */
  shotTo(tl, name, duration, at, ease = 'power2.inOut') {
    return tl.to(this.view, { ...this.shotView(name), duration, ease, onStart: () => { this.shot = name; } }, at);
  }

  applyShot(name, duration = 1.4, ease = 'power2.inOut') {
    this.shot = name;
    const v = this.shotView(name);
    gsap.killTweensOf(this.view);
    if (!duration) { Object.assign(this.view, v); this.cam = null; }
    return gsap.to(this.view, { ...v, duration, ease });
  }

  tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    // победа: 0..1, быстро вспыхивает и плавно гаснет за WIN_TIME секунд
    let win = 0;
    if (this.winT !== null) {
      this.winT += dt;
      const k = this.winT / WIN_TIME;
      win = k >= 1 ? 0 : Math.min(1, this.winT * 8) * (1 - k * k);
      if (k >= 1) {
        this.winT = null;
        this.setScreen('approved', this.category);
      }
    }
    // во время победы огни на лентах бегут в несколько раз быстрее
    const time = (this.ledMaterial.uniforms.uTime.value += dt * (1 + 7 * win));
    this.ledMaterial.uniforms.uBoost.value = 1 + 1.3 * win;
    // лампочки вывески: обычно мягко переливаются через одну, при победе бегут быстрой волной
    if (this.bulbs.Bulb_A && this.bulbs.Bulb_B) {
      const calm = 0.5 + 0.5 * Math.sin(time * 2.2);
      const chase = Math.floor(this.clock.elapsedTime * 9) % 2;
      const a = win > 0 ? chase : calm;
      const boost = 1 + 0.8 * win;
      this.bulbs.Bulb_A.mat.emissiveIntensity = this.bulbs.Bulb_A.base * (0.45 + 0.55 * a) * boost;
      this.bulbs.Bulb_B.mat.emissiveIntensity = this.bulbs.Bulb_B.base * (1 - 0.55 * a) * boost;
    }
    for (const [mat, g] of this.glow) mat.emissiveIntensity = g.base * (1 + g.gain * win);
    if (this.inside) {
      // свет в камере при победе вспыхивает и перебирает цвета вывески
      this.inside.intensity = 2.2 * (1 + 2.6 * win);
      if (win > 0) this.inside.color.setHSL((0.83 + this.winT * 0.9) % 1, 0.9, 0.62);
      else this.inside.color.setHex(0xfff4e6);
    }
    this.updateSwing(dt);
    const p = this.pointer;
    // доезжаем до мыши и останавливаемся: бесконечный сдвиг на доли пикселя давал рябь на полу
    const pk = 1 - Math.exp(-dt * 3.5);
    p.sx = Math.abs(p.x - p.sx) < 0.002 ? p.x : p.sx + (p.x - p.sx) * pk;
    p.sy = Math.abs(p.y - p.sy) < 0.002 ? p.y : p.sy + (p.y - p.sy) * pk;
    const v = this.view;
    if (!this.cam) {
      this.cam = { ...v };
      for (const k of CAM_KEYS) this.camVel[k] = 0;
    }
    const c = this.cam;
    for (const k of CAM_KEYS) c[k] = Math.abs(v[k] - c[k]) < 1e-5 && Math.abs(this.camVel[k]) < 1e-4 ? v[k] : smoothDamp(c[k], v[k], this.camVel, k, 0.2, dt);
    // лёгкий параллакс от мыши, чтобы сцена жила
    this.camera.position.set(c.px + p.sx * 0.12, c.py - p.sy * 0.06, c.pz);
    this.camera.lookAt(c.tx, c.ty, c.tz);
    this.renderer.render(this.scene, this.camera);
  }

  /** Маятник: каретка разгоняется — клешня отстаёт, тормозит — клешня уходит вперёд и затухает. */
  updateSwing(dt) {
    const pd = this.pend;
    if (!this.swing || !pd || dt <= 0) return;
    this.carriage.updateWorldMatrix(true, false);
    const pos = new THREE.Vector3().setFromMatrixPosition(this.carriage.matrixWorld);
    // первый кадр или рывок (вкладка была скрыта, кадр затянулся): скорость не считаем, иначе клешню дёрнет
    if (!pd.prev || dt >= 0.05) { pd.prev = pos.clone(); pd.vel.set(0, 0, 0); return; }
    const vel = pos.clone().sub(pd.prev).divideScalar(dt);
    pd.prev.copy(pos);
    const acc = vel.clone().sub(pd.vel).divideScalar(dt);
    pd.vel.copy(vel);
    // ускорение в осях каретки, со сглаживанием: кадры приходят неровно
    const qInv = this.carriage.getWorldQuaternion(new THREE.Quaternion()).invert();
    acc.applyQuaternion(qInv).clampLength(0, 8);
    pd.acc.lerp(acc, 1 - Math.exp(-dt * 18));
    this.claw.updateWorldMatrix(false, false);
    const L = Math.max(0.15, this.swing.getWorldPosition(new THREE.Vector3()).y - this.claw.getWorldPosition(new THREE.Vector3()).y + 0.06);
    const steps = 4;
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const ax = -(9.8 / L) * Math.sin(pd.x) - pd.damp * pd.vx - SWING.gain * pd.acc.x / L;
      const az = -(9.8 / L) * Math.sin(pd.z) - pd.damp * pd.vz - SWING.gain * pd.acc.z / L;
      pd.vx += ax * h; pd.vz += az * h;
      pd.x = THREE.MathUtils.clamp(pd.x + pd.vx * h, -SWING.max, SWING.max);
      pd.z = THREE.MathUtils.clamp(pd.z + pd.vz * h, -SWING.max, SWING.max);
    }
    // отклонение по X — поворот вокруг Z, по Z — вокруг X с обратным знаком
    this.swing.rotation.set(-pd.z, 0, pd.x);
  }

  /** Пока клешня опускается и хватает, качание гасится быстрее: она встаёт ровно над шаром. */
  calmSwing(on) {
    if (this.pend) this.pend.damp = on ? SWING.calm : SWING.damp;
  }

  // ---------------------------------------------------------------- экран терминала
  setScreen(state, category) {
    if (!this.screen) return;
    const old = this.screen.material.map;
    const mat = this.screen.material;
    mat.map = terminalScreen(state, category);
    mat.emissiveMap = mat.map;
    mat.emissive = new THREE.Color(0xffffff);
    mat.emissiveIntensity = 1.6;
    mat.needsUpdate = true;
    if (old && old.isCanvasTexture) old.dispose();
  }

  // ---------------------------------------------------------------- карта
  /** Оплата: карта поднимается из подставки, прикладывается к терминалу, экран — «ОПЛАЧЕНО». */
  pay(category, onApproved) {
    const card = this.cards[category.id];
    const tl = gsap.timeline();
    tl.add(this.applyShot('pay', 1.1), 0);
    if (!card) {
      tl.call(() => { this.setScreen('approved', category); onApproved && onApproved(); }, null, 1.2);
      return tl;
    }
    const o = card.obj;
    this.screen.updateMatrixWorld(true);
    const target = this.screen.getWorldPosition(new THREE.Vector3());
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(this.screen.getWorldQuaternion(new THREE.Quaternion()));
    const parentInv = o.parent.matrixWorld.clone().invert();
    const near = target.clone().addScaledVector(normal, 0.05).applyMatrix4(parentInv);
    const touch = target.clone().addScaledVector(normal, 0.018).applyMatrix4(parentInv);
    const lift = card.pos.clone().add(new THREE.Vector3(0, 0.09, 0.03));
    const qTarget = this.screen.quaternion.clone();
    const q = { t: 0 };
    tl.to(o.position, { x: lift.x, y: lift.y, z: lift.z, duration: 0.5, ease: 'power3.out' }, 0.3)
      .to(q, {
        t: 1, duration: 0.75, ease: 'power3.inOut',
        onUpdate: () => o.quaternion.slerpQuaternions(card.quat, qTarget, q.t)
      }, 0.75)
      .to(o.position, { x: near.x, y: near.y, z: near.z, duration: 0.75, ease: 'power3.inOut' }, 0.75)
      .call(() => this.setScreen('reading'), null, 1.45)
      // прикладывается к терминалу и задерживается, как настоящая бесконтактная оплата
      .to(o.position, { x: touch.x, y: touch.y, z: touch.z, duration: 0.3, ease: 'power2.out' }, 1.5)
      .to(o.position, { x: near.x, y: near.y, z: near.z, duration: 0.35, ease: 'power2.inOut' }, 2.05)
      .call(() => { this.setScreen('approved', category); onApproved && onApproved(); }, null, 2.3)
      .to(q, {
        t: 0, duration: 0.8, ease: 'power3.inOut',
        onUpdate: () => o.quaternion.slerpQuaternions(card.quat, qTarget, q.t)
      }, 2.8)
      .to(o.position, { x: card.pos.x, y: card.pos.y, z: card.pos.z, duration: 0.8, ease: 'power3.inOut' }, 2.8);
    return tl;
  }

  resetCards() {
    for (const c of Object.values(this.cards)) {
      gsap.killTweensOf(c.obj.position);
      c.obj.position.copy(c.pos);
      c.obj.quaternion.copy(c.quat);
    }
  }

  // ---------------------------------------------------------------- наполнение под карту
  /** В автомате остаются только шары выбранной карты: наполнители перекрашиваются, в прозрачных — её работы. */
  async fill(category, works) {
    this.category = category;
    const mats = category.colors.map((hex) => new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(hex), roughness: 0.22, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08
    }));
    const white = new THREE.MeshPhysicalMaterial({ color: 0xf5f3ee, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08 });
    // вернуть вынутые шары на место
    for (const cap of this.capsules) {
      if (cap.obj.parent !== cap.home.parent) cap.home.parent.attach(cap.obj);
      cap.obj.position.copy(cap.home.pos);
      cap.obj.quaternion.copy(cap.home.quat);
      cap.obj.visible = true;
      if (cap.top) cap.top.position.set(0, 0, 0);
      if (cap.bottom) cap.bottom.position.set(0, 0, 0);
      if (cap.poster) { cap.poster.scale.setScalar(1); cap.poster.position.set(0, 0, 0); }
      cap.work = null;
    }
    this.taken.clear();
    // постеры в прозрачных капсулах
    const textures = await Promise.all(this.projectSlots.map((slot, i) => {
      const work = works.length ? works[i % works.length] : null;
      slot.work = work || 'soon';
      return posterTexture(work, slot.aspect || 2, category);
    }));
    this.projectSlots.forEach((slot, i) => {
      if (!slot.poster) return;
      const m = slot.poster.material;
      if (m.map && m.map.isCanvasTexture) m.map.dispose();
      m.map = textures[i];
      m.emissiveMap = textures[i];
      m.emissive = new THREE.Color(0xffffff);
      m.emissiveIntensity = 0.45;
      m.needsUpdate = true;
      // снаружи капсула с работой не отличается от остальных: цветной верх, белый низ и шов
      if (slot.top) slot.top.material = mats[i % mats.length];
      if (slot.bottom) slot.bottom.material = white;
      slot.tint.forEach((t) => { t.material = white; });
    });
    // перекраска наполнителей «волной»: шар схлопывается и появляется в новом цвете
    const fillers = this.capsules.filter((c) => !c.isProject);
    const tl = gsap.timeline();
    fillers.forEach((cap, i) => {
      const s = cap.obj.scale;
      const at = 0.15 + Math.random() * 0.7;
      tl.to(s, { x: 0.05, y: 0.05, z: 0.05, duration: 0.2, ease: 'power3.in' }, at)
        .call(() => cap.tint.forEach((t) => { t.material = mats[i % mats.length]; }), null, at + 0.18)
        .to(s, { x: 1, y: 1, z: 1, duration: 0.5, ease: 'back.out(1.6)' }, at + 0.2);
    });
    this.category = category;
    this.works = works;
    return tl;
  }

  /** Какой шар достанет клешня: сначала прозрачные с непросмотренными работами, потом верхние цветные. */
  pickCapsule(seen) {
    const left = this.capsules.filter((c) => !this.taken.has(c));
    const project = left.find((c) => c.isProject && c.work !== 'soon' && !seen.has(c.work.slug))
      || (!this.works.length && left.find((c) => c.isProject));
    if (project) return project;
    const tops = left.filter((c) => !c.isProject)
      .map((c) => ({ c, y: c.obj.getWorldPosition(new THREE.Vector3()).y }))
      .sort((a, b) => b.y - a.y)
      .slice(0, 8);
    const pick = tops[Math.floor(Math.random() * tops.length)];
    if (!pick) return null;
    const unseen = this.works.filter((w) => !seen.has(w.slug));
    const pool = unseen.length ? unseen : this.works;
    pick.c.work = pool.length ? pool[Math.floor(Math.random() * pool.length)] : 'soon';
    return pick.c;
  }

  // ---------------------------------------------------------------- клешня
  setGrip(v) {
    this.prongs.forEach((p, i) => {
      const b = this.prongBase[i];
      p.quaternion.copy(b.q).premultiply(new THREE.Quaternion().setFromAxisAngle(b.axis, v));
    });
  }

  /**
   * Подгоняет захват под конкретный шар: клешня опускается так, чтобы корпус почти лёг на шар,
   * а пальцы закрываются ровно до поверхности, не проваливаясь внутрь.
   */
  fitGrip(cap) {
    const gap = 0.004;
    const above = cap.radius - this.clawBodyLow + gap;
    // центр шара в системе клешни, когда она висит над ним на высоте above
    this.claw.updateMatrixWorld(true);
    const clawPos = this.claw.getWorldPosition(new THREE.Vector3());
    const clawInv = this.claw.matrixWorld.clone().invert();
    const center = clawPos.clone().setY(clawPos.y - above).applyMatrix4(clawInv);
    const w = new THREE.Vector3();
    const reach = (v) => {
      this.setGrip(v);
      this.claw.updateMatrixWorld(true);
      let min = Infinity;
      for (const o of this.prongMeshes) {
        const pos = o.geometry.attributes.position;
        const mtx = clawInv.clone().multiply(o.matrixWorld);
        for (let i = 0; i < pos.count; i++) min = Math.min(min, w.fromBufferAttribute(pos, i).applyMatrix4(mtx).distanceTo(center));
      }
      return min - cap.radius; // > 0: палец снаружи шара
    };
    const before = this.grip.v;
    let open = -0.9;
    let closed = open;
    for (let v = open; v <= 0.6; v += 0.01) {
      if (reach(v) < gap * 0.5) break;
      closed = v;
    }
    open = Math.max(-0.9, closed - 0.45);
    this.setGrip(before);
    return { above, open, closed };
  }

  updateCable() {
    this.claw.updateMatrixWorld(true);
    const clawY = this.claw.getWorldPosition(new THREE.Vector3()).y;
    const topY = this.cable.getWorldPosition(new THREE.Vector3()).y;
    const k = Math.max(0.2, (topY - (clawY + 0.025)) / this.cableLen);
    this.cable.scale.y = k;
    if (this.coil) this.coil.scale.y = k;
  }

  /** Автомат «загорается победой»: огни бегут, вывеска и камера вспыхивают, на терминале «ПОБЕДА». */
  celebrate() {
    this.winT = 0;
    this.setScreen('win');
  }

  /** Целая партия: клешня едет к шару, хватает, несёт в приёмник, шар выкатывается из дверцы и раскрывается. */
  play(cap, status) {
    const tl = gsap.timeline();
    const world = cap.obj.getWorldPosition(new THREE.Vector3());
    const crossParent = this.crossbar.parent.matrixWorld.clone().invert();
    const carParent = this.carriage.parent.matrixWorld.clone().invert();
    const toCross = (p) => p.clone().applyMatrix4(crossParent);
    const toCar = (p) => p.clone().applyMatrix4(carParent);
    const crossTarget = toCross(world).z;
    this.crossbar.updateMatrixWorld(true);
    const carTarget = toCar(world).x;
    const fit = this.fitGrip(cap);
    const clawDown = this.rest.clawY - (this.rest.clawWorldY - (world.y + fit.above));
    const chute = this.markChute.getWorldPosition(new THREE.Vector3());
    const door = this.markDoor.getWorldPosition(new THREE.Vector3());
    const travel = Math.max(0.9, Math.hypot(crossTarget - this.crossbar.position.z, carTarget - this.carriage.position.x) * 2.2);
    const grip = this.grip;
    const onGrip = () => this.setGrip(grip.v);
    const onClaw = () => this.updateCable();

    // переходы прошлой партии и возврата к общему плану больше не нужны: камерой управляет эта партия
    gsap.killTweensOf(this.view);
    this.shotTo(tl, 'glass', 1.2, 0);
    tl.call(() => status('Клешня ищет шар…'), null, 0.1)
      .to(this.crossbar.position, { z: crossTarget, duration: travel, ease: 'sine.inOut' }, 0.4)
      .to(this.carriage.position, { x: carTarget, duration: travel, ease: 'sine.inOut' }, 0.4)
      .to(grip, { v: fit.open, duration: 0.5, ease: 'power2.inOut', onUpdate: onGrip }, 0.4 + travel - 0.25)
      .call(() => this.calmSwing(true), null, 0.4 + travel - 0.1)
      // опускается с разгоном и мягко притормаживает у шара, а не врезается в него
      .to(this.claw.position, { y: clawDown, duration: 1.15, ease: 'power2.inOut', onUpdate: onClaw }, 0.4 + travel + 0.1);
    let t = 0.4 + travel + 1.25;
    tl.to(grip, { v: fit.closed, duration: 0.5, ease: 'power2.inOut', onUpdate: onGrip }, t)
      .call(() => { this.claw.attach(cap.obj); this.taken.add(cap); status('Есть! Везу в лоток…'); }, null, t + 0.45)
      .to(this.claw.position, { y: this.rest.clawY, duration: 1.15, ease: 'power2.inOut', onUpdate: onClaw }, t + 0.55)
      .call(() => this.calmSwing(false), null, t + 1.2);
    t += 1.7;
    const crossChute = toCross(chute).z;
    const carChute = toCar(new THREE.Vector3(chute.x, world.y, crossChute)).x;
    tl.to(this.crossbar.position, { z: crossChute, duration: 1.25, ease: 'sine.inOut' }, t)
      .to(this.carriage.position, { x: carChute, duration: 1.25, ease: 'sine.inOut' }, t);
    t += 1.25;
    const drop = { y: 0 };
    tl.to(grip, { v: -0.15, duration: 0.35, ease: 'power2.out', onUpdate: onGrip }, t)
      .call(() => {
        this.root.attach(cap.obj);
        drop.y = cap.obj.position.y;
        status('Шар падает в лоток…');
      }, null, t + 0.12)
      .to(drop, {
        y: '-=1.15', duration: 0.6, ease: 'power2.in',
        onUpdate: () => { cap.obj.position.y = drop.y; }
      }, t + 0.15)
      .call(() => { cap.obj.visible = false; this.celebrate(); }, null, t + 0.75);
    this.shotTo(tl, 'door', 1.0, t + 0.3);
    t += 1.35;
    // шар выкатывается из дверцы к зрителю
    const out = this.root.worldToLocal(door.clone());
    const present = this.root.worldToLocal(new THREE.Vector3(-0.05, 0.7, 1.15));
    tl.call(() => {
      cap.obj.position.copy(out);
      cap.obj.quaternion.identity();
      cap.obj.visible = true;
      status('Твой шар!');
    }, null, t)
      .to(cap.obj.position, { x: present.x, z: present.z, duration: 1.0, ease: 'power3.out' }, t)
      .to(cap.obj.position, { y: present.y, duration: 1.0, ease: 'back.out(1.15)' }, t)
      // докатывается осью к зрителю: постер внутри смотрит в камеру
      .to(cap.obj.rotation, { x: Math.PI * 2.5, duration: 1.0, ease: 'power3.out' }, t);
    this.shotTo(tl, 'prize', 0.9, t + 0.1);
    // вернуть клешню домой, пока смотрим на приз
    tl.to(this.crossbar.position, { z: this.rest.crossZ, duration: 1.5, ease: 'sine.inOut' }, t)
      .to(this.carriage.position, { x: this.rest.carX, duration: 1.5, ease: 'sine.inOut' }, t)
      .to(grip, { v: 0, duration: 0.4, ease: 'power2.inOut', onUpdate: onGrip }, t + 1);
    t += 1.1;
    // раскрыть капсулу: половинки разъезжаются
    if (cap.top && cap.bottom) {
      // локальная +Y шара смотрит в камеру, -Z вверх: верх уходит вверх, низ вниз
      tl.to(cap.top.position, { y: 0.04, z: -0.12, duration: 0.8, ease: 'back.out(1.35)' }, t)
        .to(cap.bottom.position, { y: -0.04, z: 0.12, duration: 0.8, ease: 'back.out(1.35)' }, t);
      if (cap.poster) {
        // постер выплывает чуть позже половинок
        tl.to(cap.poster.scale, { x: 1.9, y: 1.9, z: 1.9, duration: 0.8, ease: 'expo.out' }, t + 0.08)
          .to(cap.poster.position, { y: '+=0.03', duration: 0.8, ease: 'power3.out' }, t + 0.08);
      }
    }
    tl.to({}, { duration: 0.5 });
    // вся партия целиком быстрее: движения и камера сохраняют ритм, но шар достаётся за ~6 секунд вместо ~11
    tl.timeScale(ROUND_SPEED);
    return tl;
  }

  /** После просмотра: убрать приз и вернуть общий план. */
  backToIdle() {
    for (const cap of this.taken) cap.obj.visible = false;
    return this.applyShot('idle', 1.2);
  }
}
