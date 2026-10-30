/**
 * Александр Песковский — 2026
 * Высокодетализированный фотореалистичный внешний кузов вагона метро и станционная архитектура
 * ОПТИМИЗИРОВАНО:
 * - Минимальное число PointLight (3 источника вместо 45!)
 * - Мгновенный процедурный эскалатор (0мс задержки, без черного экрана)
 * - Чистый архитектурный тоннель без рекламы (по запросу пользователя)
 * - Объединенные меши (минимум Draw Calls)
 */

import * as THREE from 'three';
import * as BufferGeometryUtils from './vendor/utils/BufferGeometryUtils.js';

// Кэш сгенерированных текстур
const extTextureCache = new Map();

function createCachedTexture(key, drawFn, width = 1024, height = 512, sRGB = true) {
  if (extTextureCache.has(key)) return extTextureCache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  drawFn(ctx, width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  if (sRGB) tex.colorSpace = THREE.SRGBColorSpace;
  extTextureCache.set(key, tex);
  return tex;
}

/**
 * Текстура электронного светодиодного маршрутного табло (LED Dot-Matrix)
 * «2026 • АЛЕКСАНДР ПЕСКОВСКИЙ • ВЫСТАВКА»
 */
export function getDestinationDisplayTexture() {
  return createCachedTexture('dest_display_tex', (ctx, w, h) => {
    ctx.fillStyle = '#08090b';
    ctx.fillRect(0, 0, w, h);

    // Сетка светодиодных пикселей
    ctx.fillStyle = 'rgba(25, 28, 35, 0.45)';
    const dotSize = 3;
    const gap = 4;
    for (let y = 0; y < h; y += gap) {
      for (let x = 0; x < w; x += gap) {
        ctx.fillRect(x, y, dotSize, dotSize);
      }
    }

    ctx.strokeStyle = '#20242e';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, w - 4, h - 4);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ff9922';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffaa33';
    ctx.font = 'bold 38px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';
    ctx.fillText('2026  •  АЛЕКСАНДР ПЕСКОВСКИЙ  •  ВЫСТАВКА', w / 2, h / 2 - 2);

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff4e0';
    ctx.font = 'bold 38px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';
    ctx.fillText('2026  •  АЛЕКСАНДР ПЕСКОВСКИЙ  •  ВЫСТАВКА', w / 2, h / 2 - 2);
  }, 1024, 128);
}

/**
 * Текстура потолочного кессонного акустического покрытия станции
 */
export function getStationCeilingTexture() {
  return createCachedTexture('station_ceiling_tex', (ctx, w, h) => {
    ctx.fillStyle = '#121419';
    ctx.fillRect(0, 0, w, h);

    const cols = 8;
    const rows = 4;
    const cellW = w / cols;
    const cellH = h / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cellW;
        const y = r * cellH;

        ctx.fillStyle = '#171a22';
        ctx.fillRect(x + 4, y + 4, cellW - 8, cellH - 8);

        ctx.fillStyle = '#0e1014';
        for (let py = y + 12; py < y + cellH - 12; py += 12) {
          for (let px = x + 12; px < x + cellW - 12; px += 12) {
            ctx.fillRect(px, py, 3, 3);
          }
        }

        ctx.strokeStyle = '#232834';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 3, y + 3, cellW - 6, cellH - 6);
      }
    }
  }, 1024, 512);
}

/**
 * Текстура навигационного светового табло станции
 */
export function getNavSignTexture() {
  return createCachedTexture('nav_sign_tex', (ctx, w, h) => {
    ctx.fillStyle = '#0a0c10';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#2b313d';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, w - 6, h - 6);

    ctx.beginPath();
    ctx.arc(80, h / 2, 34, 0, Math.PI * 2);
    ctx.fillStyle = '#00c7e6';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('1', 80, h / 2);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';
    ctx.fillText('← ВЫХОД В ГОРОД / ЭСКАЛАТОР', 140, h / 2 - 14);

    ctx.fillStyle = '#9ca5b4';
    ctx.font = '22px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
    ctx.fillText('Way Out • Escalator to City Concourse', 140, h / 2 + 20);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';
    ctx.fillText('ПОЕЗД 2026 →', w - 50, h / 2 - 14);

    ctx.fillStyle = '#f5a623';
    ctx.font = '20px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
    ctx.fillText('Вагоны 1 – 4', w - 50, h / 2 + 20);
  }, 1024, 180);
}

// =============================================================================
// =============================================================================
// 1. МГНОВЕННЫЙ ПРОЦЕДУРНЫЙ ЭСКАЛАТОР ВЫСОКОЙ ДЕТАЛИЗАЦИИ
// =============================================================================
const escTextureCache = new Map();

function getEscalatorTextures() {
  if (escTextureCache.has('bundle')) return escTextureCache.get('bundle');

  // 1.1 Текстура проступи ступени (Tread, 512x512): рифленый темный алюминий + сигнальная трехсторонняя желтая рамка
  const stepCvs = document.createElement('canvas');
  stepCvs.width = 512;
  stepCvs.height = 512;
  const sctx = stepCvs.getContext('2d');

  // Базовый темный экструдированный металл
  sctx.fillStyle = '#181b20';
  sctx.fillRect(0, 0, 512, 512);

  // Продольные глубокие ребра протектора ступени
  for (let x = 0; x < 512; x += 8) {
    sctx.fillStyle = '#0a0c0f';
    sctx.fillRect(x, 0, 4, 512);
    const ribGrad = sctx.createLinearGradient(x + 4, 0, x + 8, 0);
    ribGrad.addColorStop(0.0, '#363b46');
    ribGrad.addColorStop(0.5, '#525a68');
    ribGrad.addColorStop(1.0, '#2a2f38');
    sctx.fillStyle = ribGrad;
    sctx.fillRect(x + 4, 0, 4, 512);
  }

  // Яркая сигнальная трехсторонняя желтая полоса безопасности (Transit Yellow #f5b800)
  const yBorder = 28;
  sctx.fillStyle = '#f5b800';
  sctx.fillRect(0, 0, 512, yBorder); // Передняя кромка
  sctx.fillRect(0, 0, yBorder, 512); // Левая кромка
  sctx.fillRect(512 - yBorder, 0, yBorder, 512); // Правая кромка

  // Тонкий внутренний контрастный черный контур
  sctx.strokeStyle = '#0d0f12';
  sctx.lineWidth = 3;
  sctx.strokeRect(yBorder, yBorder, 512 - yBorder * 2, 512);

  const treadTex = new THREE.CanvasTexture(stepCvs);
  treadTex.wrapS = THREE.RepeatWrapping;
  treadTex.wrapT = THREE.RepeatWrapping;
  treadTex.colorSpace = THREE.SRGBColorSpace;

  // 1.2 Текстура вертикального подступенка (Riser, 512x256): темный каннелированный металл БЕЗ желтых полос
  const riserCvs = document.createElement('canvas');
  riserCvs.width = 512;
  riserCvs.height = 256;
  const rctx = riserCvs.getContext('2d');
  rctx.fillStyle = '#14161a';
  rctx.fillRect(0, 0, 512, 256);

  for (let x = 0; x < 512; x += 8) {
    rctx.fillStyle = '#090a0d';
    rctx.fillRect(x, 0, 4, 256);
    const rGrad = rctx.createLinearGradient(x + 4, 0, x + 8, 0);
    rGrad.addColorStop(0.0, '#262a32');
    rGrad.addColorStop(0.5, '#3e4450');
    rGrad.addColorStop(1.0, '#20232a');
    rctx.fillStyle = rGrad;
    rctx.fillRect(x + 4, 0, 4, 256);
  }

  const riserTex = new THREE.CanvasTexture(riserCvs);
  riserTex.wrapS = THREE.RepeatWrapping;
  riserTex.wrapT = THREE.RepeatWrapping;
  riserTex.colorSpace = THREE.SRGBColorSpace;

  // 2. ФОТОРЕАЛИСТИЧНЫЙ АРХИТЕКТУРНЫЙ КЕССОННЫЙ СВОД ТОННЕЛЯ (PBR 2048x1024)
  // Крупные кассетные панели (1.9м x 1.47м) со скрытыми теневыми швами, заклепками и микроперфорацией
  const archW = 2048;
  const archH = 1024;

  // 2.1 Color Map
  const archColorCvs = document.createElement('canvas');
  archColorCvs.width = archW;
  archColorCvs.height = archH;
  const actx = archColorCvs.getContext('2d');

  // Глубокий темный фон для теневых швов стыка (Reveal Shadow Gaps)
  actx.fillStyle = '#111317';
  actx.fillRect(0, 0, archW, archH);

  // 4 панели по длине (каждая 512px) и 3 панели по окружности (каждая ~341px)
  const cols = 4;
  const rows = 3;
  const cellW = archW / cols; // 512px
  const cellH = archH / rows; // 341.33px
  const seamGap = 12; // 12px глубокий архитектурный теневой шов
  const bevelW = 5;   // 5px световая фаска

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const px = c * cellW + seamGap / 2;
      const py = r * cellH + seamGap / 2;
      const pw = cellW - seamGap;
      const ph = cellH - seamGap;

      // Тело металлической анодированной кассеты (благородный титановый оттенок)
      const pGrad = actx.createLinearGradient(px, py, px + pw, py + ph);
      pGrad.addColorStop(0.0, '#e8ecf4');
      pGrad.addColorStop(0.3, '#d8dee8');
      pGrad.addColorStop(0.7, '#caced8');
      pGrad.addColorStop(1.0, '#bcc4d0');
      actx.fillStyle = pGrad;
      actx.fillRect(px, py, pw, ph);

      // Продольная тонкая микро-шлифовка сатинированного металла
      actx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      for (let y = py; y < py + ph; y += 4) {
        actx.fillRect(px, y, pw, 1.5);
      }
      actx.fillStyle = 'rgba(0, 0, 0, 0.06)';
      for (let y = py + 2; y < py + ph; y += 4) {
        actx.fillRect(px, y, pw, 1.5);
      }

      // Верхняя и левая яркая световая фаска (Highlight Edge)
      actx.fillStyle = '#ffffff';
      actx.fillRect(px, py, pw, bevelW);
      actx.fillRect(px, py, bevelW, ph);

      // Нижняя и правая теневая кромка фаски
      actx.fillStyle = 'rgba(20, 24, 32, 0.40)';
      actx.fillRect(px, py + ph - bevelW, pw, bevelW);
      actx.fillRect(px + pw - bevelW, py, bevelW, ph);

      // Поле акустической микроперфорации в центре панели
      const perfMarginX = 36;
      const perfMarginY = 28;
      const perfW = pw - perfMarginX * 2;
      const perfH = ph - perfMarginY * 2;

      actx.fillStyle = 'rgba(0, 0, 0, 0.035)';
      actx.fillRect(px + perfMarginX, py + perfMarginY, perfW, perfH);

      actx.fillStyle = 'rgba(30, 36, 48, 0.28)';
      const dotStep = 16;
      for (let dy = py + perfMarginY + 8; dy < py + perfMarginY + perfH - 6; dy += dotStep) {
        for (let dx = px + perfMarginX + 8; dx < px + perfMarginX + perfW - 6; dx += dotStep) {
          actx.fillRect(dx, dy, 2.5, 2.5);
        }
      }

      // Высокодетализированные нержавеющие шестигранные болты с шайбами по 4 углам панели
      const boltMargin = 22;
      const boltCoords = [
        [px + boltMargin, py + boltMargin],
        [px + pw - boltMargin, py + boltMargin],
        [px + boltMargin, py + ph - boltMargin],
        [px + pw - boltMargin, py + ph - boltMargin]
      ];

      boltCoords.forEach(([bx, by]) => {
        // Шайба
        actx.beginPath();
        actx.arc(bx, by, 9, 0, Math.PI * 2);
        actx.fillStyle = '#7a8290';
        actx.fill();
        actx.strokeStyle = '#4a505c';
        actx.lineWidth = 1.5;
        actx.stroke();

        // Шестигранная головка болта
        actx.beginPath();
        for (let i = 0; i < 6; i++) {
          const ang = (i * Math.PI) / 3;
          const hx = bx + 5.5 * Math.cos(ang);
          const hy = by + 5.5 * Math.sin(ang);
          if (i === 0) actx.moveTo(hx, hy);
          else actx.lineTo(hx, hy);
        }
        actx.closePath();
        actx.fillStyle = '#3a404c';
        actx.fill();

        // Световой блик на грани болта
        actx.beginPath();
        actx.arc(bx - 1.5, by - 1.5, 2.2, 0, Math.PI * 2);
        actx.fillStyle = '#ffffff';
        actx.fill();
      });
    }
  }

  const archColorTex = new THREE.CanvasTexture(archColorCvs);
  archColorTex.wrapS = THREE.RepeatWrapping;
  archColorTex.wrapT = THREE.RepeatWrapping;
  archColorTex.repeat.set(1, 2);
  archColorTex.anisotropy = 16;
  archColorTex.colorSpace = THREE.SRGBColorSpace;

  // 2.2 Normal Map: рельефные фаски, глубокие швы и объемные шляпки болтов
  const archNormCvs = document.createElement('canvas');
  archNormCvs.width = archW;
  archNormCvs.height = archH;
  const nctx = archNormCvs.getContext('2d');
  nctx.fillStyle = 'rgb(128, 128, 255)';
  nctx.fillRect(0, 0, archW, archH);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const px = c * cellW + seamGap / 2;
      const py = r * cellH + seamGap / 2;
      const pw = cellW - seamGap;
      const ph = cellH - seamGap;

      // Теневые швы: глубокое вдавливание
      nctx.fillStyle = 'rgb(128, 128, 180)';
      nctx.fillRect(c * cellW, r * cellH, cellW, seamGap / 2);
      nctx.fillRect(c * cellW, r * cellH, seamGap / 2, cellH);

      // Векторы скосов фасок
      nctx.fillStyle = 'rgb(128, 55, 240)'; // скос вверх
      nctx.fillRect(px, py, pw, bevelW);
      nctx.fillStyle = 'rgb(128, 200, 240)'; // скос вниз
      nctx.fillRect(px, py + ph - bevelW, pw, bevelW);
      nctx.fillStyle = 'rgb(55, 128, 240)'; // скос влево
      nctx.fillRect(px, py, bevelW, ph);
      nctx.fillStyle = 'rgb(200, 128, 240)'; // скос вправо
      nctx.fillRect(px + pw - bevelW, py, bevelW, ph);

      // Плоский центр
      nctx.fillStyle = 'rgb(128, 128, 255)';
      nctx.fillRect(px + bevelW, py + bevelW, pw - bevelW * 2, ph - bevelW * 2);

      // Объемные шляпки болтов
      const boltMargin = 22;
      [
        [px + boltMargin, py + boltMargin],
        [px + pw - boltMargin, py + boltMargin],
        [px + boltMargin, py + ph - boltMargin],
        [px + pw - boltMargin, py + ph - boltMargin]
      ].forEach(([bx, by]) => {
        nctx.fillStyle = 'rgb(128, 180, 255)';
        nctx.beginPath();
        nctx.arc(bx, by, 7, 0, Math.PI * 2);
        nctx.fill();
        nctx.fillStyle = 'rgb(80, 80, 240)';
        nctx.beginPath();
        nctx.arc(bx + 1, by + 1, 4, 0, Math.PI * 2);
        nctx.fill();
      });
    }
  }

  const archNormalTex = new THREE.CanvasTexture(archNormCvs);
  archNormalTex.wrapS = THREE.RepeatWrapping;
  archNormalTex.wrapT = THREE.RepeatWrapping;
  archNormalTex.repeat.set(1, 2);
  archNormalTex.anisotropy = 16;

  // 2.3 Roughness Map: зеркальный глянец болтов, сатинированный металл и матовая перфорация
  const archRoughCvs = document.createElement('canvas');
  archRoughCvs.width = archW;
  archRoughCvs.height = archH;
  const roctx = archRoughCvs.getContext('2d');
  roctx.fillStyle = 'rgb(215, 215, 215)'; // швы матовые (0.84)
  roctx.fillRect(0, 0, archW, archH);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const px = c * cellW + seamGap / 2;
      const py = r * cellH + seamGap / 2;
      const pw = cellW - seamGap;
      const ph = cellH - seamGap;

      // Рамка панели: сатинированный металл (0.26)
      roctx.fillStyle = 'rgb(66, 66, 66)';
      roctx.fillRect(px, py, pw, ph);

      // Перфорированный центр: бархатистый матовый (0.50)
      const perfMarginX = 36;
      const perfMarginY = 28;
      roctx.fillStyle = 'rgb(128, 128, 128)';
      roctx.fillRect(px + perfMarginX, py + perfMarginY, pw - perfMarginX * 2, ph - perfMarginY * 2);

      // Болты: зеркальный хром (0.12)
      const boltMargin = 22;
      [
        [px + boltMargin, py + boltMargin],
        [px + pw - boltMargin, py + boltMargin],
        [px + boltMargin, py + ph - boltMargin],
        [px + pw - boltMargin, py + ph - boltMargin]
      ].forEach(([bx, by]) => {
        roctx.fillStyle = 'rgb(30, 30, 30)';
        roctx.beginPath();
        roctx.arc(bx, by, 8, 0, Math.PI * 2);
        roctx.fill();
      });
    }
  }

  const archRoughTex = new THREE.CanvasTexture(archRoughCvs);
  archRoughTex.wrapS = THREE.RepeatWrapping;
  archRoughTex.wrapT = THREE.RepeatWrapping;
  archRoughTex.repeat.set(1, 2);
  archRoughTex.anisotropy = 16;

  // 3. Текстура сатинированной стали балюстрады (512x256)
  const steelCvs = document.createElement('canvas');
  steelCvs.width = 512;
  steelCvs.height = 256;
  const stctx = steelCvs.getContext('2d');
  const sgrad = stctx.createLinearGradient(0, 0, 512, 0);
  sgrad.addColorStop(0.0, '#c2c7d0');
  sgrad.addColorStop(0.5, '#d6dbe4');
  sgrad.addColorStop(1.0, '#bcc2cc');
  stctx.fillStyle = sgrad;
  stctx.fillRect(0, 0, 512, 256);

  stctx.fillStyle = 'rgba(255, 255, 255, 0.20)';
  for (let y = 0; y < 256; y += 4) stctx.fillRect(0, y, 512, 1);
  stctx.fillStyle = 'rgba(0, 0, 0, 0.10)';
  for (let y = 2; y < 256; y += 4) stctx.fillRect(0, y, 512, 1);

  [128, 256, 384].forEach(px => {
    stctx.strokeStyle = 'rgba(20, 24, 30, 0.28)';
    stctx.lineWidth = 1.5;
    stctx.beginPath();
    stctx.moveTo(px, 0);
    stctx.lineTo(px, 256);
    stctx.stroke();
  });

  const steelTex = new THREE.CanvasTexture(steelCvs);
  steelTex.wrapS = THREE.RepeatWrapping;
  steelTex.wrapT = THREE.RepeatWrapping;
  steelTex.repeat.set(4, 1);
  steelTex.colorSpace = THREE.SRGBColorSpace;

  const bundle = {
    treadTex,
    riserTex,
    archColorTex,
    archNormalTex,
    archRoughTex,
    archTex: archColorTex,
    steelTex
  };
  escTextureCache.set('bundle', bundle);
  return bundle;
}

export function createInstantEscalator(scene) {
  const escGroup = new THREE.Group();
  escGroup.name = 'Instant_Escalator_System';

  const textures = getEscalatorTextures();

  const xc = -3.765;
  const R = 1.95;
  const zTop = 18.00;
  const zBot = 4.80; // Стык строго на портале задней стены станции Z = 4.80
  const yTop = 7.62; // Уклон строго 30 градусов: (18.00 - 4.80) * tan(30 deg) = 7.621
  const yBot = 0.00;
  const inclineAngle = Math.PI / 6; // 30 градусов
  const len = Math.sqrt((zTop - zBot) ** 2 + (yTop - yBot) ** 2); // 15.242м
  const cosA = Math.cos(inclineAngle);
  const sinA = Math.sin(inclineAngle);

  // 1.1 Сводчатый арочный тоннель (высокополигональный подковообразный свод Deep Tube)
  const zSegs = 36;
  const archGeom = new THREE.BufferGeometry();
  const verts = [];
  const norms = [];
  const uvs = [];
  const indices = [];

  const radSegs = 32;
  const profile = [];
  // 1. Левая вертикальная стена (от пола yBase - 0.20 до линии пяты свода yBase + 1.15)
  profile.push({ x: -R, y: -0.20, nx: 1, ny: 0, nz: 0 });
  profile.push({ x: -R, y: 0.45, nx: 1, ny: 0, nz: 0 });
  profile.push({ x: -R, y: 1.15, nx: 1, ny: 0, nz: 0 });

  // 2. Арочный полукруглый свод (от theta = PI до theta = 0)
  for (let ir = 1; ir < radSegs; ir++) {
    const theta = Math.PI - (ir / radSegs) * Math.PI;
    const nx = -Math.cos(theta);
    const ny = -Math.sin(theta);
    profile.push({
      x: R * Math.cos(theta),
      y: 1.15 + R * Math.sin(theta),
      nx: nx,
      ny: ny * 0.866,
      nz: ny * 0.50
    });
  }

  // 3. Правая вертикальная стена (от линии пяты свода yBase + 1.15 до пола yBase - 0.20)
  profile.push({ x: R, y: 1.15, nx: -1, ny: 0, nz: 0 });
  profile.push({ x: R, y: 0.45, nx: -1, ny: 0, nz: 0 });
  profile.push({ x: R, y: -0.20, nx: -1, ny: 0, nz: 0 });

  const numPts = profile.length;

  for (let iz = 0; iz <= zSegs; iz++) {
    const s = iz / zSegs;
    const cz = zTop - s * (zTop - zBot);
    const cyBase = yTop - s * (yTop - yBot);

    for (let ip = 0; ip < numPts; ip++) {
      const p = profile[ip];
      verts.push(xc + p.x, cyBase + p.y, cz);
      norms.push(p.nx, p.ny, p.nz);
      // Масштабирование UV: 2 повтора по длине (8 кассетных панелей 1.9м) и 2 по периметру (6 панелей 1.47м)
      uvs.push(s * 2.0, ip / (numPts - 1));
    }
  }

  for (let iz = 0; iz < zSegs; iz++) {
    for (let ip = 0; ip < numPts - 1; ip++) {
      const a = iz * numPts + ip;
      const b = (iz + 1) * numPts + ip;
      const c = (iz + 1) * numPts + (ip + 1);
      const d = iz * numPts + (ip + 1);

      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  archGeom.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  archGeom.setAttribute('normal', new THREE.Float32BufferAttribute(norms, 3));
  archGeom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  archGeom.setIndex(indices);

  const archMat = new THREE.MeshStandardMaterial({
    map: textures.archColorTex,
    normalMap: textures.archNormalTex,
    normalScale: new THREE.Vector2(1.25, 1.25),
    roughnessMap: textures.archRoughTex,
    roughness: 0.35,
    metalness: 0.50,
    side: THREE.DoubleSide
  });
  const archMesh = new THREE.Mesh(archGeom, archMat);
  escGroup.add(archMesh);

  // 1.1.2 Поперечные несущие шпангоуты тоннеля (Architectural Arch Ribs)
  // Мощные металлические ребра жесткости каждые 2.7м с хромированными заклепками
  const ribGeoms = [];
  const boltGeoms = [];
  const ribMat = new THREE.MeshStandardMaterial({
    color: 0x1b1e25,
    roughness: 0.30,
    metalness: 0.85
  });
  const ribBoltMat = new THREE.MeshStandardMaterial({
    color: 0xd8dde6,
    roughness: 0.12,
    metalness: 0.95
  });

  const ribSpacings = [0.12, 0.30, 0.48, 0.66, 0.84];
  const archRibSegs = 28;

  ribSpacings.forEach((s) => {
    const cz = zTop - s * (zTop - zBot);
    const cyBase = yTop - s * (yTop - yBot);

    // Сводчатая часть шпангоута
    for (let a = 0; a < archRibSegs; a++) {
      const th1 = Math.PI - (a / archRibSegs) * Math.PI;
      const th2 = Math.PI - ((a + 1) / archRibSegs) * Math.PI;
      const midTh = (th1 + th2) / 2;
      const segLen = (Math.PI / archRibSegs) * (R - 0.025);
      const seg = new THREE.BoxGeometry(segLen * 1.05, 0.06, 0.14);
      seg.rotateZ(midTh - Math.PI / 2);
      seg.translate(xc + (R - 0.025) * Math.cos(midTh), cyBase + 1.15 + (R - 0.025) * Math.sin(midTh), cz);
      ribGeoms.push(seg);

      if (a % 3 === 0) {
        const b = new THREE.CylinderGeometry(0.014, 0.014, 0.025, 8);
        b.rotateZ(midTh - Math.PI / 2);
        b.translate(xc + (R - 0.055) * Math.cos(midTh), cyBase + 1.15 + (R - 0.055) * Math.sin(midTh), cz);
        boltGeoms.push(b);
      }
    }

    // Вертикальные стойки шпангоута на левой и правой стенах
    [-1, 1].forEach((side) => {
      const px = xc + side * (R - 0.025);
      const post = new THREE.BoxGeometry(0.06, 1.35, 0.14);
      post.translate(px, cyBase + 0.475, cz);
      ribGeoms.push(post);

      [0.2, 0.6, 1.0].forEach((by) => {
        const b = new THREE.CylinderGeometry(0.014, 0.014, 0.025, 8);
        b.rotateZ(Math.PI / 2);
        b.translate(px - side * 0.03, cyBase + by, cz);
        boltGeoms.push(b);
      });
    });
  });

  escGroup.add(new THREE.Mesh(BufferGeometryUtils.mergeGeometries(ribGeoms), ribMat));
  escGroup.add(new THREE.Mesh(BufferGeometryUtils.mergeGeometries(boltGeoms), ribBoltMat));

  // 1.1.3 Скрытая подсветка пяты свода (Architectural Springing Cove Lights)
  // Непрерывные световые карнизы вдоль левой и правой стен, омывающие свод мягким теплым светом
  const coveLightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: new THREE.Color(0xfff0dd),
    emissiveIntensity: 2.8,
    roughness: 0.10
  });
  const coveHousingMat = new THREE.MeshStandardMaterial({
    color: 0x16181e,
    roughness: 0.45,
    metalness: 0.80
  });

  [-1, 1].forEach((side) => {
    const cx = xc + side * (R - 0.04);
    const housingG = new THREE.BoxGeometry(0.08, 0.06, len + 0.20);
    housingG.rotateX(-inclineAngle);
    housingG.translate(cx, (yTop + yBot) / 2 + 1.15, (zTop + zBot) / 2);
    escGroup.add(new THREE.Mesh(housingG, coveHousingMat));

    const coveG = new THREE.BoxGeometry(0.04, 0.03, len + 0.20);
    coveG.rotateX(-inclineAngle);
    coveG.translate(cx, (yTop + yBot) / 2 + 1.18, (zTop + zBot) / 2);
    escGroup.add(new THREE.Mesh(coveG, coveLightMat));
  });

  // 1.2 Центральная непрерывная световая линия по коньку тоннеля (3000K Warm White)
  const lightGeom = new THREE.BoxGeometry(0.16, 0.04, len);
  const lightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: new THREE.Color(0xfff6ee),
    emissiveIntensity: 4.5,
    roughness: 0.08,
    metalness: 0.02
  });
  const lightStrip = new THREE.Mesh(lightGeom, lightMat);
  lightStrip.rotation.x = -inclineAngle;
  lightStrip.position.set(xc, (yTop + yBot) / 2 + 1.15 + R - 0.02, (zTop + zBot) / 2);
  escGroup.add(lightStrip);

  // 1.3 МАТЕРИАЛЫ БАЛЮСТРАДЫ, ДЕК, ПЛИНТУСОВ, СТУПЕНЕЙ И ПОДДОНА
  const balMat = new THREE.MeshStandardMaterial({
    map: textures.steelTex,
    roughness: 0.20,
    metalness: 0.92
  });
  const deckMat = new THREE.MeshStandardMaterial({
    color: 0x323640,
    roughness: 0.25,
    metalness: 0.88
  });
  const trussBedMat = new THREE.MeshStandardMaterial({
    color: 0x111317,
    roughness: 0.90,
    metalness: 0.35
  });
  const handrailMat = new THREE.MeshStandardMaterial({
    color: 0x121316,
    roughness: 0.16,
    metalness: 0.06
  });
  const chromeTrimMat = new THREE.MeshStandardMaterial({
    color: 0xdde2ea,
    roughness: 0.10,
    metalness: 0.96
  });
  const brushMat = new THREE.MeshStandardMaterial({
    color: 0x0f1012,
    roughness: 0.94,
    metalness: 0.05
  });
  const treadMat = new THREE.MeshStandardMaterial({
    map: textures.treadTex,
    roughness: 0.24,
    metalness: 0.85
  });
  const riserMat = new THREE.MeshStandardMaterial({
    map: textures.riserTex,
    roughness: 0.30,
    metalness: 0.85
  });

  // 1.4 СПЛОШНОЙ НЕСУЩИЙ СТАЛЬНОЙ ПОДДОН (ТРАССА ЭСКАЛАТОРА) ПОД СТУПЕНЯМИ
  // Глухая непрозрачная стальная плита на 28 см ниже ступеней: исключает любой просвет
  const trussBedGeoms = [];
  const bedG = new THREE.BoxGeometry(1.18, 0.08, len + 0.60);
  bedG.rotateX(-inclineAngle);
  const bedYOffset = -0.28 * cosA;
  const bedZOffset = -0.28 * sinA;
  bedG.translate(xc, (yTop + yBot) / 2 + bedYOffset, (zTop + zBot) / 2 + bedZOffset);
  trussBedGeoms.push(bedG);

  // 1.5 ВЕРТИКАЛЬНЫЕ ЗАЩИТНЫЕ ПЛИНТУСЫ (ФАРТУКИ) С ЩЕТКАМИ ПО ОБЕИМ СТОРОНАМ СТУПЕНЕЙ
  // Высота 0.72м: от поддона (-0.28) до внутренней деки (+0.40) — абсолютно герметичные вертикальные стенки
  const skirtGeoms = [];
  const brushGeoms = [];
  [-1, 1].forEach((side) => {
    const sx = xc + side * 0.535;

    const skirtG = new THREE.BoxGeometry(0.035, 0.72, len + 0.60);
    skirtG.rotateX(-inclineAngle);
    const skirtYOffset = 0.05 * cosA;
    const skirtZOffset = 0.05 * sinA;
    skirtG.translate(sx, (yTop + yBot) / 2 + skirtYOffset, (zTop + zBot) / 2 + skirtZOffset);
    skirtGeoms.push(skirtG);

    // Защитные щеточные дефлекторы прямо над гребнем ступеней
    const brushG = new THREE.BoxGeometry(0.04, 0.065, len + 0.60);
    brushG.rotateX(-inclineAngle);
    const brushYOffset = 0.035 * cosA;
    const brushZOffset = 0.035 * sinA;
    brushG.translate(xc + side * 0.52, (yTop + yBot) / 2 + brushYOffset, (zTop + zBot) / 2 + brushZOffset);
    brushGeoms.push(brushG);
  });

  // 1.6 ВНУТРЕННИЕ И ВНЕШНИЕ НАКЛОННЫЕ ДЕКИ
  const deckGeoms = [];
  const balGeoms = [];
  const trimGeoms = [];
  const hrGeoms = [];

  const deckYOffset = 0.38 * cosA;
  const deckZOffset = 0.38 * sinA;

  [-1, 1].forEach((side) => {
    const bx = xc + side * 0.96;

    // Внутренняя дека (стык плинтуса 0.535 и балюстрады 0.91)
    const inDeckG = new THREE.BoxGeometry(0.38, 0.03, len + 0.60);
    inDeckG.rotateX(-inclineAngle);
    inDeckG.translate(xc + side * 0.725, (yTop + yBot) / 2 + deckYOffset, (zTop + zBot) / 2 + deckZOffset);
    deckGeoms.push(inDeckG);

    // Балюстрада: наклонная панель от Y = 0.38 до 0.98
    const balG = new THREE.BoxGeometry(0.10, 0.62, len + 0.20);
    balG.rotateX(-inclineAngle);
    const balYOffset = 0.68 * cosA;
    const balZOffset = 0.68 * sinA;
    balG.translate(bx, (yTop + yBot) / 2 + balYOffset, (zTop + zBot) / 2 + balZOffset);
    balGeoms.push(balG);

    // Внешняя наклонная дека (стык балюстрады 1.01 и стены тоннеля 1.95)
    const outDeckG = new THREE.BoxGeometry(0.96, 0.03, len + 0.60);
    outDeckG.rotateX(-inclineAngle);
    outDeckG.translate(xc + side * 1.485, (yTop + yBot) / 2 + deckYOffset, (zTop + zBot) / 2 + deckZOffset);
    deckGeoms.push(outDeckG);

    // Хромированный молдинг под поручнем
    const trimG = new THREE.BoxGeometry(0.14, 0.02, len + 0.25);
    trimG.rotateX(-inclineAngle);
    const trimYOffset = 0.97 * cosA;
    const trimZOffset = 0.97 * sinA;
    trimG.translate(bx, (yTop + yBot) / 2 + trimYOffset, (zTop + zBot) / 2 + trimZOffset);
    trimGeoms.push(trimG);

    // Резиновый поручень
    const hrG = new THREE.BoxGeometry(0.12, 0.055, len + 0.35);
    hrG.rotateX(-inclineAngle);
    const hrYOffset = 1.00 * cosA;
    const hrZOffset = 1.00 * sinA;
    hrG.translate(bx, (yTop + yBot) / 2 + hrYOffset, (zTop + zBot) / 2 + hrZOffset);
    hrGeoms.push(hrG);

    // 1.6.2 ГОРИЗОНТАЛЬНОЕ ПРОДОЛЖЕНИЕ БАЛЮСТРАДЫ НА ПЛАТФОРМЕ (Z = 4.80 ... 3.50)
    const horizBalG = new THREE.BoxGeometry(0.10, 0.96, 1.35);
    horizBalG.translate(bx, 0.48, 4.125);
    balGeoms.push(horizBalG);

    // Монолитная переходная муфта в месте стыка наклона 30° и горизонтали на Z = 4.80
    // Полностью устраняет клиновидный разрыв!
    const elbowBalG = new THREE.BoxGeometry(0.10, 0.96, 0.45);
    elbowBalG.translate(bx, 0.48, 4.80);
    balGeoms.push(elbowBalG);

    const horizTrimG = new THREE.BoxGeometry(0.14, 0.02, 1.35);
    horizTrimG.translate(bx, 0.96, 4.125);
    trimGeoms.push(horizTrimG);

    const elbowTrimG = new THREE.BoxGeometry(0.14, 0.02, 0.45);
    elbowTrimG.translate(bx, 0.96, 4.80);
    trimGeoms.push(elbowTrimG);

    const horizHrG = new THREE.BoxGeometry(0.12, 0.055, 1.35);
    horizHrG.translate(bx, 0.985, 4.125);
    hrGeoms.push(horizHrG);

    const elbowHrG = new THREE.BoxGeometry(0.12, 0.055, 0.45);
    elbowHrG.translate(bx, 0.985, 4.80);
    hrGeoms.push(elbowHrG);

    // Скругленный носок поручня (Newel End) на краю площадки Z = 3.45
    const newelG = new THREE.CylinderGeometry(0.06, 0.06, 0.12, 16);
    newelG.rotateZ(Math.PI / 2);
    newelG.translate(bx, 0.95, 3.45);
    hrGeoms.push(newelG);
  });

  // 1.6.3 МОНОЛИТНАЯ ФРОНТОННАЯ СТЕНА ПОРТАЛА (Z = 4.65 ... 4.83)
  // Идеально герметизирует весь проем станции (X: -5.85 ... -1.65, Y: 0.00 ... 3.45)
  // с миллиметровой точностью по контуру подковообразной арки (никаких дыр и просветов!)
  const portalSurroundMat = new THREE.MeshStandardMaterial({
    color: 0x181a20,
    roughness: 0.40,
    metalness: 0.35
  });

  // Правый монолитный блок стены (от X = -1.64 до контура свода и конька X = xc)
  const rightShape = new THREE.Shape();
  rightShape.moveTo(-1.64, 0.00);
  rightShape.lineTo(-1.64, 3.45);
  rightShape.lineTo(xc, 3.45);
  rightShape.lineTo(xc, 1.15 + R);
  rightShape.absarc(xc, 1.15, R, Math.PI / 2, 0, true);
  rightShape.lineTo(xc + R, 0.00);
  rightShape.closePath();

  const rightBulkheadGeom = new THREE.ExtrudeGeometry(rightShape, { depth: 0.18, bevelEnabled: false });
  rightBulkheadGeom.translate(0, 0, 4.65);
  escGroup.add(new THREE.Mesh(rightBulkheadGeom, portalSurroundMat));

  // Левый монолитный блок стены (от X = -5.86 до контура свода и конька X = xc)
  const leftShape = new THREE.Shape();
  leftShape.moveTo(-5.86, 0.00);
  leftShape.lineTo(xc - R, 0.00);
  leftShape.lineTo(xc - R, 1.15);
  leftShape.absarc(xc, 1.15, R, Math.PI, Math.PI / 2, true);
  leftShape.lineTo(xc, 3.45);
  leftShape.lineTo(-5.86, 3.45);
  leftShape.closePath();

  const leftBulkheadGeom = new THREE.ExtrudeGeometry(leftShape, { depth: 0.18, bevelEnabled: false });
  leftBulkheadGeom.translate(0, 0, 4.65);
  escGroup.add(new THREE.Mesh(leftBulkheadGeom, portalSurroundMat));

  // Архивольт: декоративный радиусный наличник по своду портала
  const archivoltMat = new THREE.MeshStandardMaterial({ color: 0x242832, roughness: 0.25, metalness: 0.70 });
  const archSegs = 28;
  const archivoltGeoms = [];
  for (let a = 0; a < archSegs; a++) {
    const th1 = Math.PI - (a / archSegs) * Math.PI;
    const th2 = Math.PI - ((a + 1) / archSegs) * Math.PI;
    const midTh = (th1 + th2) / 2;
    const segLen = (Math.PI / archSegs) * (R + 0.06);
    const seg = new THREE.BoxGeometry(segLen * 1.05, 0.14, 0.22);
    seg.rotateZ(midTh - Math.PI / 2);
    seg.translate(xc + (R + 0.04) * Math.cos(midTh), 1.15 + (R + 0.04) * Math.sin(midTh), 4.72);
    archivoltGeoms.push(seg);
  }
  escGroup.add(new THREE.Mesh(BufferGeometryUtils.mergeGeometries(archivoltGeoms), archivoltMat));

  // 1.7 НИЖНЯЯ ПЕРЕХОДНАЯ ПЛОЩАДКА И ГРЕБЕНКА (Z = 4.80 ... 3.50)
  // Плавный стык эскалатора с гранитом платформы станции без щелей
  const landingDeckG = new THREE.BoxGeometry(3.90, 0.03, 1.30);
  landingDeckG.translate(xc, 0.005, 4.15);
  deckGeoms.push(landingDeckG);

  // Рифленая зубчатая гребенка из желто-стального металла
  const combPlateMat = new THREE.MeshStandardMaterial({
    color: 0xdeb841,
    roughness: 0.35,
    metalness: 0.70
  });
  const combPlate = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.032, 0.45), combPlateMat);
  combPlate.position.set(xc, 0.016, 4.58);
  escGroup.add(combPlate);

  // 1.8 СТУПЕНИ ЭСКАЛАТОРА (100% ВЗАИМНО-ПЕРЕКРЫВАЮЩИЕСЯ ПРОСТУПИ И ПОДСТУПЕНКИ)
  // Геометрически сплошная лестница с нахлестом 2 см: ЛЮБЫЕ дыры или пустоты исключены!
  const numSteps = 44;
  const dZ = (zTop - zBot) / numSteps; // ~0.300м
  const dY = (yTop - yBot) / numSteps; // ~0.173м
  const stepW = 1.04;

  const treadGeoms = [];
  const riserGeoms = [];

  for (let s = 0; s < numSteps; s++) {
    const zUpper = zTop - s * dZ;
    const zLower = zTop - (s + 1) * dZ;
    const yTread = yTop - s * dY;
    const yNextTread = yTop - (s + 1) * dY;

    // Проступь ступени (Tread): глубина dZ + 0.03m заходит под вышестоящий подступенок
    const tg = new THREE.BoxGeometry(stepW, 0.03, dZ + 0.03);
    tg.translate(xc, yTread - 0.015, (zUpper + zLower) / 2);
    treadGeoms.push(tg);

    // Подступенок (Riser): высота dY + 0.025m заходит вертикально в соседние проступи
    const rg = new THREE.BoxGeometry(stepW, dY + 0.025, 0.03);
    rg.translate(xc, (yTread + yNextTread) / 2, zLower);
    riserGeoms.push(rg);
  }

  // 1.9 КРАСНЫЕ АВАРИЙНЫЕ БЛОКИ С КНОПКАМИ «СТОП»
  const redCubeMat = new THREE.MeshStandardMaterial({ color: 0xd81c14, roughness: 0.22, metalness: 0.15 });
  const btnMetalMat = new THREE.MeshStandardMaterial({ color: 0xdcdfe4, roughness: 0.15, metalness: 0.96 });

  const emCubes = [];
  const emBtns = [];
  [zTop - 2.0, zBot + 0.8].forEach((az) => {
    const s = (zTop - az) / (zTop - zBot);
    const ay = yTop - s * (yTop - yBot);

    [-1, 1].forEach((side) => {
      const cubeG = new THREE.BoxGeometry(0.14, 0.10, 0.16);
      cubeG.rotateX(-inclineAngle);
      cubeG.translate(xc + side * 0.96, ay + 0.98, az);
      emCubes.push(cubeG);

      const btnG = new THREE.CylinderGeometry(0.035, 0.035, 0.025, 16);
      btnG.translate(0, 0.055, 0);
      btnG.rotateX(-inclineAngle);
      btnG.translate(xc + side * 0.96, ay + 0.98, az);
      emBtns.push(btnG);
    });
  });

  // 1.10 ВЕРХНЯЯ СТЕНА ВХОДНОГО ВЕСТИБЮЛЯ (Z = 18.00)
  const topWallGeom = new THREE.PlaneGeometry(R * 2 + 0.5, 4.2);
  const topWall = new THREE.Mesh(topWallGeom, archMat);
  topWall.position.set(xc, yTop + 1.8, zTop);
  topWall.rotation.y = Math.PI;
  escGroup.add(topWall);

  // Сборка объединенных мешей (минимальное число Draw Calls)
  escGroup.add(new THREE.Mesh(BufferGeometryUtils.mergeGeometries(trussBedGeoms), trussBedMat));
  escGroup.add(new THREE.Mesh(BufferGeometryUtils.mergeGeometries(skirtGeoms), balMat));
  escGroup.add(new THREE.Mesh(BufferGeometryUtils.mergeGeometries(deckGeoms), deckMat));
  escGroup.add(new THREE.Mesh(BufferGeometryUtils.mergeGeometries(balGeoms), balMat));
  escGroup.add(new THREE.Mesh(BufferGeometryUtils.mergeGeometries(trimGeoms), chromeTrimMat));
  escGroup.add(new THREE.Mesh(BufferGeometryUtils.mergeGeometries(hrGeoms), handrailMat));
  escGroup.add(new THREE.Mesh(BufferGeometryUtils.mergeGeometries(brushGeoms), brushMat));
  escGroup.add(new THREE.Mesh(BufferGeometryUtils.mergeGeometries(treadGeoms), treadMat));
  escGroup.add(new THREE.Mesh(BufferGeometryUtils.mergeGeometries(riserGeoms), riserMat));
  escGroup.add(new THREE.Mesh(BufferGeometryUtils.mergeGeometries(emCubes), redCubeMat));
  escGroup.add(new THREE.Mesh(BufferGeometryUtils.mergeGeometries(emBtns), btnMetalMat));

  // 1.11 Мягкий заполняющий свет тоннеля
  const escFillLight = new THREE.PointLight(0xfff4ea, 2.2, 16.0, 1.2);
  escFillLight.position.set(xc, 5.2, 11.0);
  escGroup.add(escFillLight);

  scene.add(escGroup);
  return escGroup;
}

// =============================================================================
// 2. ВНЕШНИЙ КУЗОВ ВАГОНА МЕТРО (Сплошной металлический кокон)
// =============================================================================
export function setupSubwayExterior(scene, subwayModel) {
  const exteriorGroup = new THREE.Group();
  exteriorGroup.name = 'Subway_Car_Exterior';

  const carPaintMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xc2c7d0),
    roughness: 0.20,
    metalness: 0.92,
    clearcoat: 0.85,
    clearcoatRoughness: 0.08,
    reflectivity: 0.88,
    side: THREE.DoubleSide
  });

  const roofMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0x22262d),
    roughness: 0.32,
    metalness: 0.85,
    clearcoat: 0.60,
    clearcoatRoughness: 0.12,
    side: THREE.DoubleSide
  });

  const liveryRedMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xd81c24),
    roughness: 0.15,
    metalness: 0.10,
    side: THREE.DoubleSide
  });

  const rubberMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x111317),
    roughness: 0.85,
    metalness: 0.05,
    side: THREE.DoubleSide
  });

  const extGlassMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xcde8fc),
    transparent: true,
    opacity: 0.16,
    roughness: 0.04,
    metalness: 0.12,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  // A. Арочная крыша
  const roofCurvePoints = 20;
  const roofXSegs = 32;
  const minX = -6.08;
  const maxX = 6.08;
  const minZ = -2.435;
  const maxZ = 0.035;
  const centerZ = (minZ + maxZ) / 2;
  const halfSpanZ = (maxZ - minZ) / 2;

  const roofGeom = new THREE.BufferGeometry();
  const roofVerts = [];
  const roofNorms = [];
  const roofUvs = [];
  const roofIndices = [];

  for (let ix = 0; ix <= roofXSegs; ix++) {
    const u = ix / roofXSegs;
    const px = minX + u * (maxX - minX);

    for (let iz = 0; iz <= roofCurvePoints; iz++) {
      const v = iz / roofCurvePoints;
      const pz = minZ + v * (maxZ - minZ);
      const distFromCenter = (pz - centerZ) / halfSpanZ;
      const py = 2.27 + (1.0 - distFromCenter * distFromCenter) * 0.35;

      roofVerts.push(px, py, pz);
      const slopeZ = -0.70 * (pz - centerZ) / (halfSpanZ * halfSpanZ);
      const norm = new THREE.Vector3(0, 1, -slopeZ).normalize();
      roofNorms.push(norm.x, norm.y, norm.z);
      roofUvs.push(u * 12, v * 2);
    }
  }

  const stride = roofCurvePoints + 1;
  for (let ix = 0; ix < roofXSegs; ix++) {
    for (let iz = 0; iz < roofCurvePoints; iz++) {
      const a = ix * stride + iz;
      const b = (ix + 1) * stride + iz;
      const c = (ix + 1) * stride + (iz + 1);
      const d = ix * stride + (iz + 1);
      roofIndices.push(a, b, d);
      roofIndices.push(b, c, d);
    }
  }

  roofGeom.setAttribute('position', new THREE.Float32BufferAttribute(roofVerts, 3));
  roofGeom.setAttribute('normal', new THREE.Float32BufferAttribute(roofNorms, 3));
  roofGeom.setAttribute('uv', new THREE.Float32BufferAttribute(roofUvs, 2));
  roofGeom.setIndex(roofIndices);

  const roofMesh = new THREE.Mesh(roofGeom, roofMat);
  exteriorGroup.add(roofMesh);

  // Гофры крыши
  [-0.8, -0.4, 0.0, 0.4, 0.8].forEach((offsetRatio) => {
    const ribZ = centerZ + offsetRatio * (halfSpanZ - 0.12);
    const distNorm = (ribZ - centerZ) / halfSpanZ;
    const ribY = 2.27 + (1.0 - distNorm * distNorm) * 0.35 + 0.015;
    const rib = new THREE.Mesh(new THREE.BoxGeometry(maxX - minX - 0.20, 0.024, 0.038), roofMat);
    rib.position.set(0, ribY, ribZ);
    exteriorGroup.add(rib);
  });

  // HVAC Блоки на крыше
  [-2.6, 2.6].forEach((hvacX) => {
    const hvac = new THREE.Mesh(
      new THREE.BoxGeometry(2.30, 0.22, 1.40),
      new THREE.MeshStandardMaterial({ color: 0x1b1e24, roughness: 0.40, metalness: 0.80 })
    );
    hvac.position.set(hvacX, 2.66, centerZ);
    exteriorGroup.add(hvac);
  });

  // B. Внешний борт (Сторона A)
  const wallAZ = 0.036;
  const addWallSection = (x1, x2, y1, y2, mat = carPaintMat) => {
    const w = x2 - x1;
    const h = y2 - y1;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.024), mat);
    mesh.position.set((x1 + x2) / 2, (y1 + y2) / 2, wallAZ);
    exteriorGroup.add(mesh);
  };

  addWallSection(-6.08, 6.08, 2.14, 2.28);
  addWallSection(-6.08, 6.08, 2.06, 2.14, liveryRedMat);
  addWallSection(-6.08, -4.405, 0.0, 2.06);
  addWallSection(-3.125, -2.18, 0.0, 2.06);
  addWallSection(-1.06, 1.06, 0.0, 2.06);
  addWallSection(2.18, 3.125, 0.0, 2.06);
  addWallSection(4.405, 6.08, 0.0, 2.06);
  addWallSection(-2.18, -1.06, 0.0, 0.95);
  addWallSection(1.06, 2.18, 0.0, 0.95);
  addWallSection(-2.18, -1.06, 1.78, 2.06);
  addWallSection(1.06, 2.18, 1.78, 2.06);

  // Внешние стекла с тонкой полой резиновой окантовкой по периметру (объединенные меши)
  const extGasketGeoms = [];
  const extGlassGeoms = [];
  [-1.62, 1.62].forEach((winX) => {
    const winW = 1.08;
    const winH = 0.81;
    const gThick = 0.03;

    // Резиновый уплотнитель по периметру (четыре тонкие планки, центр окна полностью открыт!)
    const gTop = new THREE.BoxGeometry(winW + gThick * 2, gThick, 0.02);
    gTop.translate(winX, 1.365 + winH / 2, wallAZ);
    extGasketGeoms.push(gTop);

    const gBot = new THREE.BoxGeometry(winW + gThick * 2, gThick, 0.02);
    gBot.translate(winX, 1.365 - winH / 2, wallAZ);
    extGasketGeoms.push(gBot);

    const gL = new THREE.BoxGeometry(gThick, winH, 0.02);
    gL.translate(winX - winW / 2, 1.365, wallAZ);
    extGasketGeoms.push(gL);

    const gR = new THREE.BoxGeometry(gThick, winH, 0.02);
    gR.translate(winX + winW / 2, 1.365, wallAZ);
    extGasketGeoms.push(gR);

    // Кристально прозрачное стекло окна
    const extG = new THREE.PlaneGeometry(winW, winH);
    extG.translate(winX, 1.365, wallAZ + 0.005);
    extGlassGeoms.push(extG);
  });
  exteriorGroup.add(new THREE.Mesh(BufferGeometryUtils.mergeGeometries(extGasketGeoms), rubberMat));
  exteriorGroup.add(new THREE.Mesh(BufferGeometryUtils.mergeGeometries(extGlassGeoms), extGlassMat));

  // Светодиодное маршрутное табло
  const destTex = getDestinationDisplayTexture();
  const destMat = new THREE.MeshStandardMaterial({
    map: destTex,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: destTex,
    emissiveIntensity: 1.4,
    roughness: 0.20,
    metalness: 0.10,
    side: THREE.DoubleSide
  });

  [-3.765, 3.765].forEach((doorX) => {
    const bezel = new THREE.Mesh(
      new THREE.BoxGeometry(1.24, 0.16, 0.03),
      new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.35, metalness: 0.90 })
    );
    bezel.position.set(doorX, 2.21, wallAZ + 0.012);
    exteriorGroup.add(bezel);

    const destMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.18, 0.13), destMat);
    destMesh.position.set(doorX, 2.21, wallAZ + 0.028);
    exteriorGroup.add(destMesh);
  });

  // C. Внешний борт (Сторона B)
  const wallBMesh = new THREE.Mesh(new THREE.BoxGeometry(maxX - minX, 2.28, 0.024), carPaintMat);
  wallBMesh.position.set(0, 1.14, minZ);
  exteriorGroup.add(wallBMesh);

  const liveryB = new THREE.Mesh(new THREE.BoxGeometry(maxX - minX, 0.08, 0.026), liveryRedMat);
  liveryB.position.set(0, 2.10, minZ);
  exteriorGroup.add(liveryB);

  // D. Торцы и межвагонные гармошки
  [-1, 1].forEach((dir) => {
    const endX = dir * 6.08;
    const endWallMat = new THREE.MeshStandardMaterial({ color: 0x22262d, roughness: 0.35, metalness: 0.85 });

    const endPostGeom = new THREE.BoxGeometry(0.04, 2.28, (maxZ - minZ - 0.90) / 2);
    const endPost1 = new THREE.Mesh(endPostGeom, endWallMat);
    endPost1.position.set(endX, 1.14, maxZ - (maxZ - minZ - 0.90) / 4);
    exteriorGroup.add(endPost1);

    const endPost2 = new THREE.Mesh(endPostGeom, endWallMat);
    endPost2.position.set(endX, 1.14, minZ + (maxZ - minZ - 0.90) / 4);
    exteriorGroup.add(endPost2);

    const endHeader = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.38, 0.90), endWallMat);
    endHeader.position.set(endX, 2.09, centerZ);
    exteriorGroup.add(endHeader);

    // Гармошка
    const bellowFolds = 8;
    const foldW = 1.20 / bellowFolds;
    for (let f = 0; f < bellowFolds; f++) {
      const bx = endX + dir * (f * foldW + foldW / 2);
      const scaleAdj = (f % 2 === 0) ? 1.05 : 0.95;
      const fold = new THREE.Mesh(new THREE.BoxGeometry(foldW * 0.85, 2.20 * scaleAdj, 1.00 * scaleAdj), rubberMat);
      fold.position.set(bx, 1.10, centerZ);
      exteriorGroup.add(fold);
    }
  });

  // E. Подвагонный фартук и рельсы
  const underSkirt = new THREE.Mesh(
    new THREE.BoxGeometry(maxX - minX - 0.40, 0.32, maxZ - minZ - 0.10),
    new THREE.MeshStandardMaterial({ color: 0x121418, roughness: 0.85, metalness: 0.40 })
  );
  underSkirt.position.set(0, -0.22, centerZ);
  exteriorGroup.add(underSkirt);

  // F. Сцепка Шарфенберга (Coupler) между вагонами под гармошками
  [-1, 1].forEach((dir) => {
    const coupler = new THREE.Mesh(
      new THREE.BoxGeometry(1.20, 0.16, 0.22),
      new THREE.MeshStandardMaterial({ color: 0x2b2f38, roughness: 0.40, metalness: 0.90 })
    );
    coupler.position.set(dir * 6.68, -0.24, centerZ);
    exteriorGroup.add(coupler);
  });

  // G. ПРИЦЕПНЫЕ ВАГОНЫ СОСТАВА МЕТРО (Второй вагон впереди X = +15.89 и хвостовой вагон X = -15.89)
  // Состав из 3 вагонов длиной 49.0м полностью перекрывает всю станцию (46м) и уходит в тоннели на обоих концах.
  // Пустые рельсы исключены на 100%!
  const coupledMats = {
    carPaintMat,
    roofMat,
    liveryRedMat,
    rubberMat,
    extGlassMat,
    destMat
  };
  createCoupledCar(15.89, 1, exteriorGroup, coupledMats);
  createCoupledCar(-15.89, -1, exteriorGroup, coupledMats);

  scene.add(exteriorGroup);
  return exteriorGroup;
}

/**
 * Создание высокодетализированного прицепного вагона метро
 * (Все элементы сгруппированы и объединены через mergeGeometries для 60 FPS)
 */
function createCoupledCar(xCenter, dir, exteriorGroup, materials) {
  const {
    carPaintMat,
    roofMat,
    liveryRedMat,
    rubberMat,
    extGlassMat,
    destMat
  } = materials;

  const halfL = 8.61; // Длина вагона 17.22м — заходит глубоко в тоннельный портал X = ±23.0
  const minX = -halfL;
  const maxX = halfL;
  const minZ = -2.435;
  const maxZ = 0.035;
  const centerZ = (minZ + maxZ) / 2;
  const halfSpanZ = (maxZ - minZ) / 2;
  const wallAZ = 0.036;

  // 1. Арочная крыша
  const roofCurvePoints = 16;
  const roofXSegs = 28;
  const roofGeom = new THREE.BufferGeometry();
  const roofVerts = [];
  const roofNorms = [];
  const roofUvs = [];
  const roofIndices = [];

  for (let ix = 0; ix <= roofXSegs; ix++) {
    const u = ix / roofXSegs;
    const px = xCenter + minX + u * (maxX - minX);

    for (let iz = 0; iz <= roofCurvePoints; iz++) {
      const v = iz / roofCurvePoints;
      const pz = minZ + v * (maxZ - minZ);
      const distFromCenter = (pz - centerZ) / halfSpanZ;
      const py = 2.27 + (1.0 - distFromCenter * distFromCenter) * 0.35;

      roofVerts.push(px, py, pz);
      const slopeZ = -0.70 * (pz - centerZ) / (halfSpanZ * halfSpanZ);
      const norm = new THREE.Vector3(0, 1, -slopeZ).normalize();
      roofNorms.push(norm.x, norm.y, norm.z);
      roofUvs.push(u * 16, v * 2);
    }
  }

  const stride = roofCurvePoints + 1;
  for (let ix = 0; ix < roofXSegs; ix++) {
    for (let iz = 0; iz < roofCurvePoints; iz++) {
      const a = ix * stride + iz;
      const b = (ix + 1) * stride + iz;
      const c = (ix + 1) * stride + (iz + 1);
      const d = ix * stride + (iz + 1);
      roofIndices.push(a, b, d);
      roofIndices.push(b, c, d);
    }
  }

  roofGeom.setAttribute('position', new THREE.Float32BufferAttribute(roofVerts, 3));
  roofGeom.setAttribute('normal', new THREE.Float32BufferAttribute(roofNorms, 3));
  roofGeom.setAttribute('uv', new THREE.Float32BufferAttribute(roofUvs, 2));
  roofGeom.setIndex(roofIndices);
  exteriorGroup.add(new THREE.Mesh(roofGeom, roofMat));

  // Гофры крыши (5 продольных ребер)
  const ribGeoms = [];
  [-0.8, -0.4, 0.0, 0.4, 0.8].forEach((offsetRatio) => {
    const ribZ = centerZ + offsetRatio * (halfSpanZ - 0.12);
    const distNorm = (ribZ - centerZ) / halfSpanZ;
    const ribY = 2.27 + (1.0 - distNorm * distNorm) * 0.35 + 0.015;
    const ribG = new THREE.BoxGeometry(maxX - minX - 0.20, 0.024, 0.038);
    ribG.translate(xCenter, ribY, ribZ);
    ribGeoms.push(ribG);
  });
  exteriorGroup.add(new THREE.Mesh(BufferGeometryUtils.mergeGeometries(ribGeoms), roofMat));

  // Климатические блоки HVAC на крыше (3 блока)
  [-5.2, 0.0, 5.2].forEach((hvacOffsetX) => {
    const hvac = new THREE.Mesh(
      new THREE.BoxGeometry(2.30, 0.22, 1.40),
      new THREE.MeshStandardMaterial({ color: 0x1b1e24, roughness: 0.40, metalness: 0.80 })
    );
    hvac.position.set(xCenter + hvacOffsetX, 2.66, centerZ);
    exteriorGroup.add(hvac);
  });

  // 2. Металлические панели кузова (Сторона A — платформа)
  const bodyWallGeoms = [];
  const addWall = (x1, x2, y1, y2) => {
    const w = x2 - x1;
    const h = y2 - y1;
    const g = new THREE.BoxGeometry(w, h, 0.024);
    g.translate(xCenter + (x1 + x2) / 2, (y1 + y2) / 2, wallAZ);
    bodyWallGeoms.push(g);
  };

  // Верхняя полоса кузова над дверями
  addWall(minX, maxX, 2.14, 2.28);

  // 3 набора закрытых двухстворчатых дверей вдоль вагона
  const doorOffsets = dir > 0 ? [-5.0, 0.0, 5.0] : [5.0, 0.0, -5.0];
  const doorHalfW = 0.53;

  doorOffsets.forEach((doorX) => {
    [-0.275, 0.275].forEach((leafOffset) => {
      const leafG = new THREE.BoxGeometry(doorHalfW, 2.04, 0.028);
      leafG.translate(xCenter + doorX + leafOffset, 1.02, wallAZ - 0.005);
      bodyWallGeoms.push(leafG);
    });
  });

  // Простенки между дверями и окнами
  // Окна расположены между дверьми:
  const winOffsets = [
    (doorOffsets[0] + doorOffsets[1]) / 2,
    (doorOffsets[1] + doorOffsets[2]) / 2
  ];
  const winW = 1.20;
  const winH = 0.81;

  // Стены ниже и выше окон
  winOffsets.forEach((wx) => {
    addWall(wx - winW / 2, wx + winW / 2, 0.0, 0.95);
    addWall(wx - winW / 2, wx + winW / 2, 1.78, 2.06);
  });

  // Глухие участки между дверьми и окнами
  addWall(minX, Math.min(doorOffsets[0], doorOffsets[2]) - doorHalfW, 0.0, 2.06);
  addWall(Math.max(doorOffsets[0], doorOffsets[2]) + doorHalfW, maxX, 0.0, 2.06);

  // Перемычки между окнами и соседними дверями
  winOffsets.forEach((wx, i) => {
    const dLeft = Math.min(doorOffsets[i], doorOffsets[i + 1]);
    const dRight = Math.max(doorOffsets[i], doorOffsets[i + 1]);
    addWall(dLeft + doorHalfW, wx - winW / 2, 0.0, 2.06);
    addWall(wx + winW / 2, dRight - doorHalfW, 0.0, 2.06);
  });

  // Сторона B (путевая стена) — сплошной борт
  const wallBG = new THREE.BoxGeometry(maxX - minX, 2.28, 0.024);
  wallBG.translate(xCenter, 1.14, minZ);
  bodyWallGeoms.push(wallBG);

  // Внутренний торец вагона у межвагонного перехода (стыковка с гармошкой)
  const innerEndX = xCenter - dir * halfL;
  const endPostGeom = new THREE.BoxGeometry(0.04, 2.28, (maxZ - minZ - 0.90) / 2);
  const endPost1 = endPostGeom.clone();
  endPost1.translate(innerEndX, 1.14, maxZ - (maxZ - minZ - 0.90) / 4);
  bodyWallGeoms.push(endPost1);

  const endPost2 = endPostGeom.clone();
  endPost2.translate(innerEndX, 1.14, minZ + (maxZ - minZ - 0.90) / 4);
  bodyWallGeoms.push(endPost2);

  // Внешний торец вагона (глухой торец, заходящий в глубину тоннеля X = ±24.5)
  const outerEndX = xCenter + dir * halfL;
  const outerEndCapG = new THREE.BoxGeometry(0.04, 2.28, maxZ - minZ);
  outerEndCapG.translate(outerEndX, 1.14, centerZ);
  bodyWallGeoms.push(outerEndCapG);

  exteriorGroup.add(new THREE.Mesh(BufferGeometryUtils.mergeGeometries(bodyWallGeoms), carPaintMat));

  // Красная сигнальная полоса ливреи (Y = 2.06 - 2.14) на обоих бортах
  const liveryGeoms = [];
  const livA = new THREE.BoxGeometry(maxX - minX, 0.08, 0.026);
  livA.translate(xCenter, 2.10, wallAZ + 0.002);
  liveryGeoms.push(livA);

  const livB = new THREE.BoxGeometry(maxX - minX, 0.08, 0.026);
  livB.translate(xCenter, 2.10, minZ - 0.002);
  liveryGeoms.push(livB);

  exteriorGroup.add(new THREE.Mesh(BufferGeometryUtils.mergeGeometries(liveryGeoms), liveryRedMat));

  // Окна, резиновые уплотнители и хромированные ручки дверей
  const gasketGeoms = [];
  const glassGeoms = [];
  const chromeHandleGeoms = [];

  // Дверные стекла и ручки
  doorOffsets.forEach((doorX) => {
    [-0.275, 0.275].forEach((leafOffset) => {
      const dGlassG = new THREE.PlaneGeometry(0.24, 0.88);
      dGlassG.translate(xCenter + doorX + leafOffset, 1.34, wallAZ + 0.012);
      glassGeoms.push(dGlassG);

      const dGaskG = new THREE.BoxGeometry(0.27, 0.91, 0.01);
      dGaskG.translate(xCenter + doorX + leafOffset, 1.34, wallAZ + 0.010);
      gasketGeoms.push(dGaskG);

      const hSign = leafOffset < 0 ? 1 : -1;
      const hG = new THREE.CylinderGeometry(0.012, 0.012, 0.42, 8);
      hG.translate(xCenter + doorX + leafOffset + hSign * 0.22, 1.05, wallAZ + 0.022);
      chromeHandleGeoms.push(hG);
    });

    // Светодиодное маршрутное табло над дверью
    const bezel = new THREE.Mesh(
      new THREE.BoxGeometry(1.24, 0.16, 0.03),
      new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.35, metalness: 0.90 })
    );
    bezel.position.set(xCenter + doorX, 2.21, wallAZ + 0.012);
    exteriorGroup.add(bezel);

    const destMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.18, 0.13), destMat);
    destMesh.position.set(xCenter + doorX, 2.21, wallAZ + 0.028);
    exteriorGroup.add(destMesh);
  });

  // Панорамные боковые окна
  winOffsets.forEach((wx) => {
    const gThick = 0.03;

    const gTop = new THREE.BoxGeometry(winW + gThick * 2, gThick, 0.02);
    gTop.translate(xCenter + wx, 1.365 + winH / 2, wallAZ);
    gasketGeoms.push(gTop);

    const gBot = new THREE.BoxGeometry(winW + gThick * 2, gThick, 0.02);
    gBot.translate(xCenter + wx, 1.365 - winH / 2, wallAZ);
    gasketGeoms.push(gBot);

    const gL = new THREE.BoxGeometry(gThick, winH, 0.02);
    gL.translate(xCenter + wx - winW / 2, 1.365, wallAZ);
    gasketGeoms.push(gL);

    const gR = new THREE.BoxGeometry(gThick, winH, 0.02);
    gR.translate(xCenter + wx + winW / 2, 1.365, wallAZ);
    gasketGeoms.push(gR);

    const extG = new THREE.PlaneGeometry(winW, winH);
    extG.translate(xCenter + wx, 1.365, wallAZ + 0.005);
    glassGeoms.push(extG);
  });

  exteriorGroup.add(new THREE.Mesh(BufferGeometryUtils.mergeGeometries(gasketGeoms), rubberMat));
  exteriorGroup.add(new THREE.Mesh(BufferGeometryUtils.mergeGeometries(glassGeoms), extGlassMat));
  if (chromeHandleGeoms.length > 0) {
    exteriorGroup.add(new THREE.Mesh(
      BufferGeometryUtils.mergeGeometries(chromeHandleGeoms),
      new THREE.MeshStandardMaterial({ color: 0xdce0e6, roughness: 0.15, metalness: 0.95 })
    ));
  }

  // 3. Подсвеченный теплый интерьер вагона (видим сквозь кристальные стёкла)
  const interiorBox = new THREE.Mesh(
    new THREE.BoxGeometry(maxX - minX - 0.20, 2.15, maxZ - minZ - 0.20),
    new THREE.MeshStandardMaterial({
      color: 0x1f232b,
      roughness: 0.60,
      metalness: 0.20,
      side: THREE.BackSide
    })
  );
  interiorBox.position.set(xCenter, 1.10, centerZ);
  exteriorGroup.add(interiorBox);

  // Теплая непрерывная световая LED-линия салона (3000K)
  const intLampG = new THREE.BoxGeometry(maxX - minX - 1.0, 0.04, 0.22);
  intLampG.translate(xCenter, 2.18, centerZ);
  exteriorGroup.add(new THREE.Mesh(
    intLampG,
    new THREE.MeshStandardMaterial({
      color: 0xffeedd,
      emissive: new THREE.Color(0xffd296),
      emissiveIntensity: 2.8,
      roughness: 0.18
    })
  ));

  // Сиденья внутри вагона (оранжевые жаккардовые блоки)
  const seatGeoms = [];
  [-5.8, -2.5, 2.5, 5.8].forEach((sx) => {
    [-1, 1].forEach((sideZ) => {
      const seatZ = sideZ > 0 ? maxZ - 0.42 : minZ + 0.42;
      const sBench = new THREE.BoxGeometry(1.60, 0.42, 0.52);
      sBench.translate(xCenter + sx, 0.45, seatZ);
      seatGeoms.push(sBench);
    });
  });
  exteriorGroup.add(new THREE.Mesh(
    BufferGeometryUtils.mergeGeometries(seatGeoms),
    new THREE.MeshStandardMaterial({ color: 0xde7928, roughness: 0.70 })
  ));

  // 4. Подвагонный фартук, тележки и колеса на рельсах
  const underSkirtG = new THREE.BoxGeometry(maxX - minX - 0.40, 0.32, maxZ - minZ - 0.10);
  underSkirtG.translate(xCenter, -0.22, centerZ);
  exteriorGroup.add(new THREE.Mesh(
    underSkirtG,
    new THREE.MeshStandardMaterial({ color: 0x121418, roughness: 0.85, metalness: 0.40 })
  ));

  // Тележки (Wheel Bogies): по 2 колесные пары на тележку, стоящие строго на рельсах Y = -0.38
  const bogieGeoms = [];
  [-5.2, 5.2].forEach((bogieX) => {
    const frameG = new THREE.BoxGeometry(2.40, 0.16, 1.80);
    frameG.translate(xCenter + bogieX, -0.28, centerZ);
    bogieGeoms.push(frameG);

    [-0.85, 0.85].forEach((wheelOffset) => {
      [-0.76, 0.76].forEach((wheelZOffset) => {
        const wheelG = new THREE.CylinderGeometry(0.24, 0.24, 0.08, 16);
        wheelG.rotateX(Math.PI / 2);
        wheelG.translate(xCenter + bogieX + wheelOffset, -0.32, centerZ + wheelZOffset);
        bogieGeoms.push(wheelG);
      });
      const axleG = new THREE.CylinderGeometry(0.04, 0.04, 1.55, 12);
      axleG.rotateX(Math.PI / 2);
      axleG.translate(xCenter + bogieX + wheelOffset, -0.32, centerZ);
      bogieGeoms.push(axleG);
    });
  });

  exteriorGroup.add(new THREE.Mesh(
    BufferGeometryUtils.mergeGeometries(bogieGeoms),
    new THREE.MeshStandardMaterial({ color: 0x1a1c22, roughness: 0.65, metalness: 0.85 })
  ));
}

// =============================================================================
// 3. СТАНЦИОННАЯ АРХИТЕКТУРА И ПОТОЛОК (Оптимизированное освещение: 3 источника)
// =============================================================================
export function setupStationCeilingAndArchitecture(stationEnvGroup) {
  const ceilingW = 46.0;
  const ceilingDepth = 5.38; // от Z = -0.60 (над путями) до Z = 4.78 (строго до задней стены станции Z = 4.80)
  const ceilingZ = 2.09;
  const ceilingY = 3.45;

  const ceilingTex = getStationCeilingTexture();
  ceilingTex.wrapS = THREE.RepeatWrapping;
  ceilingTex.wrapT = THREE.RepeatWrapping;
  ceilingTex.repeat.set(10, 2);

  const ceilingMat = new THREE.MeshStandardMaterial({
    map: ceilingTex,
    roughness: 0.55,
    metalness: 0.25,
    side: THREE.DoubleSide
  });

  const ceilingMesh = new THREE.Mesh(new THREE.PlaneGeometry(ceilingW, ceilingDepth), ceilingMat);
  ceilingMesh.rotation.x = Math.PI / 2;
  ceilingMesh.position.set(0, ceilingY, ceilingZ);
  stationEnvGroup.add(ceilingMesh);

  // Световые линии на потолке платформы (внутри Z от 0.0 до 4.6)
  [0.8, 2.4, 4.0].forEach((lz) => {
    const lightBar = new THREE.Mesh(
      new THREE.BoxGeometry(ceilingW - 2.0, 0.04, 0.16),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: new THREE.Color(0xffeedd),
        emissiveIntensity: 3.2,
        roughness: 0.10
      })
    );
    lightBar.position.set(0, ceilingY - 0.02, lz);
    stationEnvGroup.add(lightBar);
  });

  // ОПТИМИЗАЦИЯ: 3 мягких источника на платформе вдоль всей длины состава
  const platFill1 = new THREE.PointLight(0xffe8d2, 2.2, 22.0, 1.2);
  platFill1.position.set(-10.0, ceilingY - 0.35, 2.4);
  stationEnvGroup.add(platFill1);

  const platFill2 = new THREE.PointLight(0xffe8d2, 2.2, 22.0, 1.2);
  platFill2.position.set(0.0, ceilingY - 0.35, 2.4);
  stationEnvGroup.add(platFill2);

  const platFill3 = new THREE.PointLight(0xffe8d2, 2.2, 22.0, 1.2);
  platFill3.position.set(10.0, ceilingY - 0.35, 2.4);
  stationEnvGroup.add(platFill3);

  // Навигационные световые табло
  const navTex = getNavSignTexture();
  const navMat = new THREE.MeshStandardMaterial({
    map: navTex,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: navTex,
    emissiveIntensity: 1.1,
    roughness: 0.20,
    metalness: 0.15,
    side: THREE.DoubleSide
  });

  [-10.5, -4.5, 4.5, 10.5].forEach((nx) => {
    const signGroup = new THREE.Group();
    const housing = new THREE.Mesh(
      new THREE.BoxGeometry(2.40, 0.42, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.35, metalness: 0.90 })
    );
    signGroup.add(housing);

    const plate = new THREE.Mesh(new THREE.PlaneGeometry(2.32, 0.36), navMat);
    plate.position.set(0, 0, 0.065);
    signGroup.add(plate);

    const plateBack = new THREE.Mesh(new THREE.PlaneGeometry(2.32, 0.36), navMat);
    plateBack.rotation.y = Math.PI;
    plateBack.position.set(0, 0, -0.065);
    signGroup.add(plateBack);

    [-1.0, 1.0].forEach((tx) => {
      const wire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.008, 0.55),
        new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.95, roughness: 0.15 })
      );
      wire.position.set(tx, 0.48, 0);
      signGroup.add(wire);
    });

    signGroup.position.set(nx, ceilingY - 0.50, 2.20);
    stationEnvGroup.add(signGroup);
  });

  // Ограждающие стены конкорса эскалатора (стык между порталом Z=4.80 и эскалатором Z=3.60)
  const concourseMat = new THREE.MeshStandardMaterial({ color: 0x181a20, roughness: 0.45, metalness: 0.20 });

  const leftEncl = new THREE.Mesh(new THREE.BoxGeometry(0.20, 3.45, 1.25), concourseMat);
  leftEncl.position.set(-5.85, 1.72, 4.20);
  stationEnvGroup.add(leftEncl);

  const rightEncl = new THREE.Mesh(new THREE.BoxGeometry(0.20, 3.45, 1.25), concourseMat);
  rightEncl.position.set(-1.65, 1.72, 4.20);
  stationEnvGroup.add(rightEncl);
}
