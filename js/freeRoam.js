/**
 * Режим свободной камеры (Free Roam Mode)
 * Ограничен строго проработанными зонами сцены:
 * - Внутри вагона метро (между экранами и сиденьями)
 * - На платформе станции вдоль стены с постерами-мемами
 * 
 * Управление:
 * - Только ходьба по земле на уровне глаз (WASD / стрелки), без полета вверх/вниз
 * - Зажатая ЛКМ / тач-свайп справа для осмотра на 360 градусов
 * - Виртуальный тач-джойстик слева для мобильных устройств
 */

import * as THREE from 'three';

export class FreeRoamController {
  constructor(camera, domElement, onToggleCallback) {
    this.camera = camera;
    this.domElement = domElement || document.body;
    this.onToggleCallback = onToggleCallback;

    this.isActive = false;

    // Фиксированная высота взгляда человека (1.38 м от пола)
    this.EYE_HEIGHT = 1.38;

    // Кинематика камеры
    this.position = new THREE.Vector3(-2.675, this.EYE_HEIGHT, -1.192);
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.targetYaw = 0;
    this.targetPitch = 0;

    // Параметры ходьбы (только горизонтальная плоскость)
    this.walkSpeed = 3.2; // м/с
    this.sprintSpeed = 5.8; // м/с
    this.damping = 0.86;

    // Состояние клавиш
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
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

    this.createHUD();
    this.bindEvents();
  }

  createHUD() {
    this.hudElement = document.createElement('div');
    this.hudElement.id = 'free-roam-hud';
    this.hudElement.className = 'free-roam-hud';
    this.hudElement.style.display = 'none';

    this.hudElement.innerHTML = `
      <div class="free-roam-top-bar">
        <div class="free-roam-top-spacer"></div>
        <button type="button" id="free-roam-close-btn" class="free-roam-close-btn" title="Выйти к проектам (ESC)">
          <span>✕ Выход к проектам (ESC)</span>
        </button>
      </div>

      <div class="free-roam-bottom-hints">
        <div class="free-roam-hint-item desktop-only">
          <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Ходьба • <kbd>ЛКМ</kbd> Обзор 360° • <kbd>Shift</kbd> Бег
        </div>
        <div class="free-roam-hint-item mobile-only">
          Джойстик слева — ходьба • Свайп справа — обзор 360°
        </div>
      </div>

      <!-- Виртуальный тач-джойстик для мобильных устройств -->
      <div id="free-roam-touch-zone" class="free-roam-touch-zone mobile-only">
        <div id="free-roam-joystick-base" class="free-roam-joystick-base">
          <div id="free-roam-joystick-knob" class="free-roam-joystick-knob"></div>
        </div>
      </div>
    `;

    document.body.appendChild(this.hudElement);

    // Обработчик закрытия
    this.hudElement.querySelector('#free-roam-close-btn').addEventListener('click', () => {
      this.toggle(false);
    });
  }

  bindEvents() {
    // Клавиатура (только WASD и стрелки, без Space / C / E / Q)
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
      // Естественный угол обзора головы человека (до 48 градусов вверх и вниз)
      this.targetPitch = Math.max(-0.85, Math.min(0.85, this.targetPitch));
    });

    window.addEventListener('mouseup', () => {
      this.isMouseDown = false;
      document.body.classList.remove('is-dragging');
    });

    // Мобильный тач-джойстик
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

    // Свайп для свободного осмотра 360° на мобильных устройствах
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
      this.targetPitch = Math.max(-0.85, Math.min(0.85, this.targetPitch));
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

      // Начинаем Free Roam с текущей позиции камеры, фиксируя уровень глаз
      this.position.copy(this.camera.position);
      this.position.y = this.EYE_HEIGHT;

      // Безопасное проецирование стартовой точки в допустимую область
      if (this.position.z < 0.0) {
        this.position.x = Math.max(-5.40, Math.min(4.30, this.position.x));
        this.position.z = Math.max(-1.65, Math.min(-0.15, this.position.z));
      } else {
        this.position.x = Math.max(-8.30, Math.min(5.30, this.position.x));
        this.position.z = Math.max(0.20, Math.min(4.30, this.position.z));
      }
      this.resolveCollisions(this.position, null);

      // Вычисляем текущие углы взгляда камеры
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      this.targetYaw = Math.atan2(-dir.x, -dir.z);
      this.targetPitch = Math.asin(Math.max(-0.85, Math.min(0.85, dir.y)));
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

  isDoorway(x) {
    // Дверной проем 1: центр -3.765 (створки открыты от -4.30 до -3.20)
    // Дверной проем 2: центр 3.765 (створки открыты от 3.20 до 4.30)
    return (x >= -4.25 && x <= -3.25) || (x >= 3.25 && x <= 4.25);
  }

  resolveCollisions(pos, oldPos) {
    pos.y = this.EYE_HEIGHT;

    const inDoorNow = this.isDoorway(pos.x);
    const inDoorOld = oldPos ? this.isDoorway(oldPos.x) : inDoorNow;

    // 1. Из вагона на платформу (Z переходит через границу стены экранов -0.15)
    if (oldPos && oldPos.z <= -0.15) {
      if (pos.z > -0.15) {
        if (!inDoorNow && !inDoorOld) {
          pos.z = -0.15; // Упираемся в глухую стену с экранами/окнами
          if (this.velocity.z > 0) this.velocity.z = 0;
        } else {
          // В створе дверей: удерживаем внутри проема
          if (pos.x < 0) pos.x = Math.max(-4.20, Math.min(-3.30, pos.x));
          else pos.x = Math.max(3.30, Math.min(4.20, pos.x));
        }
      }
    }

    // 2. С платформы в вагон (Z переходит через внешнюю стену поезда 0.20)
    if (oldPos && oldPos.z >= 0.20) {
      if (pos.z < 0.20) {
        if (!inDoorNow && !inDoorOld) {
          pos.z = 0.20; // Упираемся в кузов вагона снаружи
          if (this.velocity.z < 0) this.velocity.z = 0;
        } else {
          // В створе дверей: удерживаем внутри проема
          if (pos.x < 0) pos.x = Math.max(-4.20, Math.min(-3.30, pos.x));
          else pos.x = Math.max(3.30, Math.min(4.20, pos.x));
        }
      }
    }

    // 3. Внутри дверного коридора Z [-0.15, 0.20] (дверной косяк)
    if (pos.z >= -0.15 && pos.z <= 0.20) {
      if (pos.x < 0) {
        pos.x = Math.max(-4.20, Math.min(-3.30, pos.x));
      } else {
        pos.x = Math.max(3.30, Math.min(4.20, pos.x));
      }
    }

    // 4. Препятствия на платформе: скамейки станции
    if (pos.z >= 0.20) {
      const benches = [-7.8, 0.0, 4.8];
      for (const bx of benches) {
        const hw = 1.05;
        const hz = 0.32;
        const bz = 2.35;
        if (pos.x >= bx - hw && pos.x <= bx + hw && pos.z >= bz - hz && pos.z <= bz + hz) {
          if (oldPos) {
            const dxLeft = Math.abs(pos.x - (bx - hw));
            const dxRight = Math.abs((bx + hw) - pos.x);
            const dzFront = Math.abs(pos.z - (bz - hz));
            const dzBack = Math.abs((bz + hz) - pos.z);
            const minDist = Math.min(dxLeft, dxRight, dzFront, dzBack);
            if (minDist === dzFront) { pos.z = bz - hz; if (this.velocity.z > 0) this.velocity.z = 0; }
            else if (minDist === dzBack) { pos.z = bz + hz; if (this.velocity.z < 0) this.velocity.z = 0; }
            else if (minDist === dxLeft) { pos.x = bx - hw; if (this.velocity.x > 0) this.velocity.x = 0; }
            else { pos.x = bx + hw; if (this.velocity.x < 0) this.velocity.x = 0; }
          }
        }
      }
    }

    // 5. Внешние габариты доступных зон
    if (pos.z < 0.0) {
      // Внутри вагона: торцевые межвагонные переборки и задний ряд сидений
      const minX = -5.40;
      const maxX = 4.30;
      const minZ = -1.65;
      if (pos.x <= minX) { pos.x = minX; if (this.velocity.x < 0) this.velocity.x = 0; }
      if (pos.x >= maxX) { pos.x = maxX; if (this.velocity.x > 0) this.velocity.x = 0; }
      if (pos.z <= minZ) { pos.z = minZ; if (this.velocity.z < 0) this.velocity.z = 0; }
    } else {
      // На платформе станции: ограничение вдоль стены с постерами-мемами
      const minX = -8.30;
      const maxX = 5.30;
      const maxZ = 4.30;
      if (pos.x <= minX) { pos.x = minX; if (this.velocity.x < 0) this.velocity.x = 0; }
      if (pos.x >= maxX) { pos.x = maxX; if (this.velocity.x > 0) this.velocity.x = 0; }
      if (pos.z >= maxZ) { pos.z = maxZ; if (this.velocity.z > 0) this.velocity.z = 0; }
    }
  }

  update(dt) {
    if (!this.isActive) return;

    // Плавное сглаживание углов обзора
    this.yaw += (this.targetYaw - this.yaw) * 0.22;
    this.pitch += (this.targetPitch - this.pitch) * 0.22;

    // Векторы направлений в горизонтальной плоскости XZ
    const forwardX = -Math.sin(this.yaw);
    const forwardZ = -Math.cos(this.yaw);
    const rightX = -forwardZ;
    const rightZ = forwardX;

    const currentSpeed = this.keys.sprint ? this.sprintSpeed : this.walkSpeed;
    const accel = new THREE.Vector3();

    // Клавиатурное перемещение по горизонтальной плоскости (WASD)
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

    // Мобильный тач-джойстик
    if (this.touchJoystickActive) {
      const jx = this.touchJoystickVector.x;
      const jy = this.touchJoystickVector.y;
      accel.x += (forwardX * -jy + rightX * jx) * currentSpeed;
      accel.z += (forwardZ * -jy + rightZ * jx) * currentSpeed;
    }

    // Интеграция скорости с затуханием (инерция)
    this.velocity.x += accel.x * dt * 8.0;
    this.velocity.z += accel.z * dt * 8.0;
    this.velocity.y = 0; // Строго запрещен подъем и спуск

    this.velocity.x *= this.damping;
    this.velocity.z *= this.damping;

    const oldPos = this.position.clone();
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;

    // Строгое физическое разрешение коллизий со стенами и препятствиями
    this.resolveCollisions(this.position, oldPos);

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
