/**
 * Газета на кресле в вагоне: креативы и вайбкод-проекты.
 *
 * Модель — assets/models/newspaper.glb (tools/blender/build_newspaper.py). Газета лежит
 * сложенной на сиденье под экраном 4 и прогибается по нему (ключ формы Drape).
 * На этапе «Газета» герой поднимает её к глазам, бумага выпрямляется, и левая половина
 * (News_Left) поворачивается вокруг сгиба — открывается разворот: креативы слева,
 * проекты справа. При уходе с этапа газета закрывается и ложится обратно на кресло.
 *
 * Места под работы — плоскости News_Slot_F1, News_Slot_C1..C3, News_Slot_P1..P3
 * (getSlots). Пока на них серые блоки макета с текстуры страниц.
 */
import * as THREE from 'three';

const SPREAD_W = 0.56;        // ширина разворота, м (две полосы по 0.28)
const PAGE_H = 0.38;          // высота полосы, м
const OPEN_SECONDS = 1.7;     // подъём + раскрытие
const CLOSE_SECONDS = 1.1;
const LIFT_SHARE = 0.56;      // доля времени на подъём, остальное — раскрытие
const FIT_W = 0.9;            // разворот занимает до 90% ширины кадра…
const FIT_H = 0.72;           // …и до 72% высоты (сверху остаётся место для шапки и названия)
const SHIFT_DOWN = 0.08;      // сдвиг вниз в долях половины высоты кадра
const TILT = THREE.MathUtils.degToRad(-8); // верх газеты чуть отклонён от глаз, как в руках

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smootherstep = (t) => t * t * t * (t * (t * 6 - 15) + 10);

const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const qBase = new THREE.Quaternion().setFromAxisAngle(AXIS_X, Math.PI / 2);
const qTilt = new THREE.Quaternion().setFromAxisAngle(AXIS_X, TILT);
const tmpQ = new THREE.Quaternion();
const tmpV = new THREE.Vector3();
const fwd = new THREE.Vector3();
const right = new THREE.Vector3();
const up = new THREE.Vector3();
const readPos = new THREE.Vector3();
const readQuat = new THREE.Quaternion();

export class Newspaper {
  constructor(gltfScene, scene) {
    this.group = gltfScene;
    this.paper = gltfScene.getObjectByName('Newspaper');
    this.left = gltfScene.getObjectByName('News_Left');
    if (!this.paper || !this.left) throw new Error('В newspaper.glb нет узлов Newspaper / News_Left');

    this.seatPos = this.paper.position.clone();
    this.seatQuat = this.paper.quaternion.clone();
    this.leftClosedY = this.left.position.y;

    this.meshes = [];
    this.slots = {};
    gltfScene.traverse((o) => {
      if (!o.isMesh) return;
      this.meshes.push(o);
      const m = o.name.match(/^News_Slot_(\w+)$/);
      if (m) this.slots[m[1]] = o;
    });

    // Свет «для чтения» у глаз: есть всегда (число источников не меняется — шейдеры
    // не пересобираются), горит только пока газета в руках
    this.light = new THREE.PointLight(0xfff1e0, 0, 2.2, 1.6);
    scene.add(this.light);

    this.progress = 0;   // 0 — на кресле, 1 — раскрыта перед глазами
    this.applied = -1;
    scene.add(gltfScene);
  }

  getSlots() {
    return this.slots;
  }

  get isOpen() {
    return this.progress >= 1;
  }

  /** Расстояние от глаз, на котором разворот помещается в кадр. */
  fitDistance(camera) {
    const vHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const hHalf = vHalf * camera.aspect;
    return Math.max(0.3, (SPREAD_W / 2) / (hHalf * FIT_W), (PAGE_H / 2) / (vHalf * FIT_H));
  }

  update(dt, camera, wantOpen) {
    const target = wantOpen ? 1 : 0;
    if (this.progress !== target) {
      const step = dt / (wantOpen ? OPEN_SECONDS : CLOSE_SECONDS);
      this.progress = wantOpen ? Math.min(1, this.progress + step) : Math.max(0, this.progress - step);
    }
    // На кресле газета неподвижна: позу считаем, только пока она в движении или в руках
    if (this.progress === 0 && this.applied === 0) return;

    const lift = smootherstep(clamp01(this.progress / LIFT_SHARE));
    const open = smootherstep(clamp01((this.progress - LIFT_SHARE) / (1 - LIFT_SHARE)));

    if (lift > 0) {
      camera.getWorldDirection(fwd);
      right.set(1, 0, 0).applyQuaternion(camera.quaternion);
      up.set(0, 1, 0).applyQuaternion(camera.quaternion);
      const dist = this.fitDistance(camera);
      const vHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
      // Сложенная газета занимает правую половину разворота — пока она закрыта, держим её по центру
      readPos.copy(camera.position)
        .addScaledVector(fwd, dist)
        .addScaledVector(up, -vHalf * dist * SHIFT_DOWN)
        .addScaledVector(right, -(SPREAD_W / 4) * (1 - open));
      // Лицевая сторона полосы (+Y модели) — к глазам, верх полосы (−Z модели) — вверх кадра
      readQuat.copy(camera.quaternion).multiply(qBase).multiply(qTilt);

      this.paper.position.lerpVectors(this.seatPos, readPos, lift)
        .addScaledVector(WORLD_UP, Math.sin(Math.PI * lift) * 0.12);
      this.paper.quaternion.slerpQuaternions(this.seatQuat, readQuat, lift);

      tmpV.copy(camera.position).addScaledVector(up, 0.35).addScaledVector(fwd, 0.15);
      this.light.position.copy(tmpV);
    } else {
      this.paper.position.copy(this.seatPos);
      this.paper.quaternion.copy(this.seatQuat);
    }
    this.light.intensity = 0.9 * lift;

    // Бумага выпрямляется в первой половине подъёма
    const drape = 1 - smootherstep(clamp01(lift / 0.45));
    for (const m of this.meshes) {
      if (m.morphTargetInfluences) m.morphTargetInfluences[0] = drape;
    }

    // Левая половина: −180° (лежит на правой) → 0° (разворот)
    tmpQ.setFromAxisAngle(AXIS_Z, -Math.PI * (1 - open));
    this.left.quaternion.copy(tmpQ);
    this.left.position.y = this.leftClosedY * (1 - open);

    this.applied = this.progress;
  }
}
