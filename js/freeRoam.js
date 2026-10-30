/**
 * Режим свободной камеры (Free Roam Mode)
 * Позволяет свободно перемещаться по всей 3D-локации:
 * - Внутри вагона метро
 * - По платформе станции
 * - По эскалаторному тоннелю и верхнему входному вестибюлю
 */

import * as THREE from 'three';

export class FreeRoamController {
  constructor(camera, domElement, onToggleCallback) {
    this.camera = camera;
    this.domElement = domElement || document.body;
    this.onToggleCallback = onToggleCallback;

    this.isActive = false;

    // Кинематика камеры
    this.position = new THREE.Vector3(-2.675, 1.40, -1.192);
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.targetYaw = 0;
    this.targetPitch = 0;

    // Параметры движения
    this.walkSpeed = 3.6; // м/с
    this.sprintSpeed = 7.5; // м/с
    this.flySpeed = 3.2; // м/с
    this.damping = 0.86;

    // Состояние клавиш
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      up: false,
      down: false,
      sprint: false
    };

    // Состояние мыши и тач-управления
    this.isMouseDown = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;

    // Тач-джойстик (Mobile)
    this.touchJoystickActive = false;
    this.touchJoystickOrigin = { x: 0, y: 0 };
    this.touchJoystickVector = { x: 0, y: 0 };
    this.touchLookActive = false;
    this.touchLookLast = { x: 0, y: 0 };

    // Пресеты телепортации
    this.PRESETS = {
      car: {
        pos: new THREE.Vector3(-3.50, 1.40, -1.192),
        yaw: -Math.PI / 2,
        pitch: 0
      },
      platform: {
        pos: new THREE.Vector3(-1.60, 1.35, 1.80),
        yaw: 0,
        pitch: -0.05
      },
      escalator: {
        pos: new THREE.Vector3(-3.765, 1.35, 4.60),
        yaw: Math.PI,
        pitch: 0.40
      },
      vestibule: {
        pos: new THREE.Vector3(-3.765, 8.65, 17.60),
        yaw: 0,
        pitch: -0.42
      }
    };

    this.createHUD();
    this.bindEvents();
  }

  createHUD() {
    // Контейнер оверлея Free Roam
    this.hudElement = document.createElement('div');
    this.hudElement.id = 'free-roam-hud';
    this.hudElement.className = 'free-roam-hud';
    this.hudElement.style.display = 'none';

    this.hudElement.innerHTML = `
      <div class="free-roam-top-bar">
        <div class="free-roam-badge">
          <span class="free-roam-pulse"></span>
          <span>FREE ROAM // 3D-ПРОГУЛКА</span>
        </div>

        <div class="free-roam-teleports">
          <button type="button" class="free-roam-tp-btn" data-tp="car">🚃 Вагон</button>
          <button type="button" class="free-roam-tp-btn" data-tp="platform">🚉 Платформа</button>
          <button type="button" class="free-roam-tp-btn" data-tp="escalator">⚡ Эскалатор</button>
          <button type="button" class="free-roam-tp-btn" data-tp="vestibule">🏛️ Вестибюль</button>
        </div>

        <button type="button" id="free-roam-close-btn" class="free-roam-close-btn" title="Выйти из свободного режима (ESC)">
          <span>✕ Выход</span>
        </button>
      </div>

      <div class="free-roam-bottom-hints">
        <div class="free-roam-hint-item desktop-only">
          <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Перемещение
        </div>
        <div class="free-roam-hint-item desktop-only">
          <kbd>ЛКМ</kbd> Осмотр 360°
        </div>
        <div class="free-roam-hint-item desktop-only">
          <kbd>Пробел</kbd> Вверх • <kbd>C</kbd> Вниз
        </div>
        <div class="free-roam-hint-item desktop-only">
          <kbd>Shift</kbd> Ускорение
        </div>
        <div class="free-roam-hint-item mobile-only">
          Джойстик слева — ходьба • Свайп справа — обзор 360°
        </div>
      </div>

      <!-- Виртуальный тач-джойстик для мобильных -->
      <div id="free-roam-touch-zone" class="free-roam-touch-zone mobile-only">
        <div id="free-roam-joystick-base" class="free-roam-joystick-base">
          <div id="free-roam-joystick-knob" class="free-roam-joystick-knob"></div>
        </div>
      </div>
    `;

    document.body.appendChild(this.hudElement);

    // Обработчики кнопок HUD
    this.hudElement.querySelector('#free-roam-close-btn').addEventListener('click', () => {
      this.toggle(false);
    });

    this.hudElement.querySelectorAll('.free-roam-tp-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const tpKey = e.currentTarget.dataset.tp;
        this.teleportTo(tpKey);
      });
    });
  }

  bindEvents() {
    // Клавиатура
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isActive) {
        this.toggle(false);
        return;
      }
      if (!this.isActive) return;

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.keys.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.keys.backward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.keys.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.keys.right = true;
          break;
        case 'Space':
        case 'KeyE':
          this.keys.up = true;
          e.preventDefault();
          break;
        case 'KeyC':
        case 'KeyQ':
          this.keys.down = true;
          e.preventDefault();
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.keys.sprint = true;
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      if (!this.isActive) return;

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.keys.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.keys.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.keys.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.keys.right = false;
          break;
        case 'Space':
        case 'KeyE':
          this.keys.up = false;
          break;
        case 'KeyC':
        case 'KeyQ':
          this.keys.down = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.keys.sprint = false;
          break;
      }
    });

    // Мышь: зажатие ЛКМ для поворота
    window.addEventListener('mousedown', (e) => {
      if (!this.isActive) return;
      if (e.target.closest('.free-roam-top-bar') || e.target.closest('#free-roam-touch-zone') || e.target.closest('.site-header')) return;

      this.isMouseDown = true;
      document.body.classList.add('is-dragging');
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isActive || !this.isMouseDown) return;

      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;

      const sensitivity = 0.0028;
      this.targetYaw -= dx * sensitivity;
      this.targetPitch -= dy * sensitivity;
      this.targetPitch = Math.max(-1.45, Math.min(1.45, this.targetPitch));
    });

    window.addEventListener('mouseup', () => {
      this.isMouseDown = false;
      document.body.classList.remove('is-dragging');
    });

    // Мобильный тач
    const touchZone = this.hudElement.querySelector('#free-roam-touch-zone');
    const knob = this.hudElement.querySelector('#free-roam-joystick-knob');
    const base = this.hudElement.querySelector('#free-roam-joystick-base');

    if (touchZone && knob && base) {
      touchZone.addEventListener('touchstart', (e) => {
        const touch = e.changedTouches[0];
        this.touchJoystickActive = true;
        const rect = base.getBoundingClientRect();
        this.touchJoystickOrigin = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2
        };
        e.preventDefault();
      }, { passive: false });

      touchZone.addEventListener('touchmove', (e) => {
        if (!this.touchJoystickActive) return;
        const touch = e.changedTouches[0];
        const dx = touch.clientX - this.touchJoystickOrigin.x;
        const dy = touch.clientY - this.touchJoystickOrigin.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxR = 40;
        const clampedDist = Math.min(dist, maxR);
        const angle = Math.atan2(dy, dx);

        const kx = Math.cos(angle) * clampedDist;
        const ky = Math.sin(angle) * clampedDist;
        knob.style.transform = `translate(${kx}px, ${ky}px)`;

        this.touchJoystickVector = {
          x: kx / maxR,
          y: ky / maxR
        };
        e.preventDefault();
      }, { passive: false });

      const resetJoystick = () => {
        this.touchJoystickActive = false;
        this.touchJoystickVector = { x: 0, y: 0 };
        knob.style.transform = 'translate(0px, 0px)';
      };

      touchZone.addEventListener('touchend', resetJoystick);
      touchZone.addEventListener('touchcancel', resetJoystick);
    }

    // Свайп для осмотра на мобильных устройствах
    window.addEventListener('touchstart', (e) => {
      if (!this.isActive) return;
      if (e.target.closest('.free-roam-top-bar') || e.target.closest('#free-roam-touch-zone') || e.target.closest('.site-header')) return;
      const t = e.touches[0];
      if (t.clientX > window.innerWidth * 0.40) {
        this.touchLookActive = true;
        this.touchLookLast = { x: t.clientX, y: t.clientY };
      }
    });

    window.addEventListener('touchmove', (e) => {
      if (!this.isActive || !this.touchLookActive) return;
      const t = e.touches[0];
      const dx = t.clientX - this.touchLookLast.x;
      const dy = t.clientY - this.touchLookLast.y;
      this.touchLookLast = { x: t.clientX, y: t.clientY };

      const sens = 0.0042;
      this.targetYaw -= dx * sens;
      this.targetPitch -= dy * sens;
      this.targetPitch = Math.max(-1.45, Math.min(1.45, this.targetPitch));
    });

    window.addEventListener('touchend', () => {
      this.touchLookActive = false;
    });
  }

  toggle(forceState) {
    const nextState = forceState !== undefined ? forceState : !this.isActive;
    if (this.isActive === nextState) return;
    this.isActive = nextState;

    if (this.isActive) {
      document.body.classList.add('is-free-roam');
      this.hudElement.style.display = 'flex';

      // Начинаем Free Roam с текущей позиции камеры
      this.position.copy(this.camera.position);

      // Вычисляем текущие углы взгляда камеры
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      this.targetYaw = Math.atan2(-dir.x, -dir.z);
      this.targetPitch = Math.asin(Math.max(-1, Math.min(1, dir.y)));
      this.yaw = this.targetYaw;
      this.pitch = this.targetPitch;
      this.velocity.set(0, 0, 0);

      // Сброс клавиш
      Object.keys(this.keys).forEach((k) => (this.keys[k] = false));
    } else {
      document.body.classList.remove('is-free-roam');
      this.hudElement.style.display = 'none';
      this.velocity.set(0, 0, 0);
    }

    if (this.onToggleCallback) {
      this.onToggleCallback(this.isActive);
    }
  }

  teleportTo(key) {
    const preset = this.PRESETS[key];
    if (!preset) return;
    this.position.copy(preset.pos);
    this.targetYaw = preset.yaw;
    this.targetPitch = preset.pitch;
    this.velocity.set(0, 0, 0);
  }

  update(dt) {
    if (!this.isActive) return;

    // Плавное сглаживание углов обзора
    this.yaw += (this.targetYaw - this.yaw) * 0.22;
    this.pitch += (this.targetPitch - this.pitch) * 0.22;

    // Векторы направлений в горизонтальной плоскости
    const forwardX = -Math.sin(this.yaw);
    const forwardZ = -Math.cos(this.yaw);
    const rightX = -forwardZ;
    const rightZ = forwardX;

    const currentSpeed = this.keys.sprint ? this.sprintSpeed : this.walkSpeed;
    const accel = new THREE.Vector3();

    // Клавиатурное перемещение
    if (this.keys.forward) {
      accel.x += forwardX * currentSpeed;
      accel.z += forwardZ * currentSpeed;
    }
    if (this.keys.backward) {
      accel.x -= forwardX * currentSpeed;
      accel.z -= forwardZ * currentSpeed;
    }
    if (this.keys.left) {
      accel.x -= rightX * currentSpeed;
      accel.z -= rightZ * currentSpeed;
    }
    if (this.keys.right) {
      accel.x += rightX * currentSpeed;
      accel.z += rightZ * currentSpeed;
    }
    if (this.keys.up) {
      accel.y += this.flySpeed;
    }
    if (this.keys.down) {
      accel.y -= this.flySpeed;
    }

    // Мобильный тач-джойстик
    if (this.touchJoystickActive) {
      const jx = this.touchJoystickVector.x;
      const jy = this.touchJoystickVector.y;
      accel.x += (forwardX * -jy + rightX * jx) * currentSpeed;
      accel.z += (forwardZ * -jy + rightZ * jx) * currentSpeed;
    }

    // Интеграция скорости с затуханием (инерция)
    this.velocity.x += accel.x * dt * 8.0;
    this.velocity.y += accel.y * dt * 8.0;
    this.velocity.z += accel.z * dt * 8.0;

    this.velocity.x *= this.damping;
    this.velocity.y *= this.damping;
    this.velocity.z *= this.damping;

    this.position.addScaledVector(this.velocity, dt);

    // Ограничительный объем сцены (Bounding Box станции и вагона)
    this.position.x = Math.max(-17.5, Math.min(17.5, this.position.x));
    this.position.y = Math.max(0.35, Math.min(9.40, this.position.y));
    this.position.z = Math.max(-4.50, Math.min(19.20, this.position.z));

    // Применение позиции к камере
    this.camera.position.copy(this.position);

    // Применение направления взгляда
    const cosPitch = Math.cos(this.pitch);
    const lookTarget = new THREE.Vector3(
      this.position.x - Math.sin(this.yaw) * cosPitch,
      this.position.y + Math.sin(this.pitch),
      this.position.z - Math.cos(this.yaw) * cosPitch
    );
    this.camera.lookAt(lookTarget);
  }
}
