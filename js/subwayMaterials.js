/**
 * Александр Песковский — 2026
 * Фотореалистичные процедурные PBR-материалы вагона и станции метро высокого разрешения:
 * - Стены и пол вагона: единый гармоничный архитектурный ансамбль современного поезда метро
 *   (сатинированная шлифованная сталь + согласованный графитовый композитный пол с кварцевой крошкой)
 * - Путевая стена станции: белоснежная глазурованная керамическая плитка («кабанчик» / Subway Tiles)
 * - Потолочные светильники: призматические светорассеиватели
 */

import * as THREE from 'three';

const textureLoader = new THREE.TextureLoader();
const textureCache = new Map();

/**
 * Загрузка PBR-карты из внешнего файла WebP/PNG с настройкой фильтрации
 */
function loadPBRTexture(path, repeatX = 1, repeatY = 1, sRGB = true) {
  const cacheKey = `${path}_${repeatX}_${repeatY}_${sRGB}`;
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey);

  const tex = textureLoader.load(path);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 16;
  if (sRGB) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  textureCache.set(cacheKey, tex);
  return tex;
}

/**
 * Вспомогательная функция создания текстуры с максимальной трилинейной и анизотропной фильтрацией 16x
 */
function createHighResTexture(canvas, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.generateMipmaps = true;
  tex.anisotropy = 16;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createNormalTexture(canvas, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.generateMipmaps = true;
  tex.anisotropy = 16;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

// =============================================================================
// 1. АРХИТЕКТУРНЫЕ СТЕНЫ ВАГОНА: САbdТИНИРОВАННАЯ ШЛИФОВАННАЯ СТАЛЬ (2048x1024)
// =============================================================================
export function getPhotoWallTextures() {
  if (textureCache.has('wall_steel_pbr')) return textureCache.get('wall_steel_pbr');

  const width = 512;
  const height = 256;

  // 1.1 Color Map: благородная сатинированная сталь с продольной микро-шлифовкой
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = width;
  colorCanvas.height = height;
  const cctx = colorCanvas.getContext('2d');

  const grad = cctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0.0, '#e4e9f0');
  grad.addColorStop(0.2, '#d6dce4');
  grad.addColorStop(0.5, '#cbd2db');
  grad.addColorStop(0.8, '#c2c8d2');
  grad.addColorStop(1.0, '#b6bdc8');
  cctx.fillStyle = grad;
  cctx.fillRect(0, 0, width, height);

  const imgData = cctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // Псевдослучайный детерминированный генератор
  let seed = 1234567;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let y = 0; y < height; y++) {
    const rowGrain = (rnd() - 0.5) * 14;
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const grain = rowGrain + (rnd() - 0.5) * 5;
      data[idx]     = Math.max(0, Math.min(255, data[idx] + grain));
      data[idx + 1] = Math.max(0, Math.min(255, data[idx + 1] + grain));
      data[idx + 2] = Math.max(0, Math.min(255, data[idx + 2] + grain + 2));
    }
  }
  cctx.putImageData(imgData, 0, 0);

  // Тонкие архитектурные стыки панелей вагона
  cctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
  cctx.lineWidth = 1.5;
  [128, 256, 384].forEach(px => {
    cctx.beginPath();
    cctx.moveTo(px, 0);
    cctx.lineTo(px, height);
    cctx.stroke();
  });
  cctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  cctx.lineWidth = 1;
  [129, 257, 385].forEach(px => {
    cctx.beginPath();
    cctx.moveTo(px, 0);
    cctx.lineTo(px, height);
    cctx.stroke();
  });

  // 1.2 Normal Map: анизотропные микро-борозды проката
  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = width;
  normalCanvas.height = height;
  const nctx = normalCanvas.getContext('2d');
  nctx.fillStyle = 'rgb(128, 128, 255)';
  nctx.fillRect(0, 0, width, height);

  const nImgData = nctx.getImageData(0, 0, width, height);
  const ndata = nImgData.data;
  seed = 7654321;
  for (let y = 0; y < height; y++) {
    const dy = (rnd() - 0.5) * 18;
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const dx = (rnd() - 0.5) * 6;
      ndata[idx]     = Math.max(0, Math.min(255, 128 + dx));
      ndata[idx + 1] = Math.max(0, Math.min(255, 128 + dy));
      ndata[idx + 2] = 250;
    }
  }
  nctx.putImageData(nImgData, 0, 0);

  // 1.3 Roughness Map: шелковистый сатиновый отклик (0.26 - 0.32)
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = width;
  roughCanvas.height = height;
  const rctx = roughCanvas.getContext('2d');
  rctx.fillStyle = 'rgb(72, 72, 72)';
  rctx.fillRect(0, 0, width, height);

  const result = {
    colorMap: createHighResTexture(colorCanvas, 4, 2),
    normalMap: createNormalTexture(normalCanvas, 4, 2),
    roughnessMap: createNormalTexture(roughCanvas, 4, 2)
  };
  textureCache.set('wall_steel_pbr', result);
  return result;
}

export function getPhotoDoorTextures() {
  return getPhotoWallTextures();
}

// =============================================================================
// 2. СОГЛАСОВАННЫЙ ПОЛ ВАГОНА: ТРАНЗИТНЫЙ ГРАФИТОВЫЙ КВАРЦ-ТЕРРАЦЦО (2048x1024)
//    (Единый дизайн-код со стенами: идеальная гармония оттенков и текстур)
// =============================================================================
export function getPhotoFloorTextures() {
  if (textureCache.has('floor_transit_pbr')) return textureCache.get('floor_transit_pbr');

  const width = 1024;
  const height = 1024;

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = width;
  colorCanvas.height = height;
  const cctx = colorCanvas.getContext('2d');

  // Благородный глубокий темно-графитовый оттенок пола вагона метро
  cctx.fillStyle = '#1c1f26';
  cctx.fillRect(0, 0, width, height);

  // Мягкие, сглаженные вкрапления кварцевого терраццо (без микропиксельного шума)
  let seed = 445566;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // Рисуем сглаженные естественные песчинки терраццо
  const grainCount = 3800;
  for (let i = 0; i < grainCount; i++) {
    const gx = rnd() * width;
    const gy = rnd() * height;
    const rad = 1.0 + rnd() * 2.2;
    const rType = rnd();

    if (rType > 0.85) {
      // Светло-серый кварц
      cctx.fillStyle = `rgba(180, 185, 195, ${0.15 + rnd() * 0.25})`;
    } else if (rType > 0.40) {
      // Приглушенный серо-бежевый агрегат
      cctx.fillStyle = `rgba(110, 115, 128, ${0.12 + rnd() * 0.18})`;
    } else {
      // Темный базальтовый элемент
      cctx.fillStyle = `rgba(14, 16, 20, ${0.20 + rnd() * 0.30})`;
    }

    cctx.beginPath();
    cctx.arc(gx, gy, rad, 0, Math.PI * 2);
    cctx.fill();
  }

  // Мягкий, равномерный рельеф (без шума и резких перепадов нормалей)
  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = width;
  normalCanvas.height = height;
  const nctx = normalCanvas.getContext('2d');
  nctx.fillStyle = 'rgb(128, 128, 255)';
  nctx.fillRect(0, 0, width, height);

  // Полуматовый отклик (шероховатость 0.40)
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = width;
  roughCanvas.height = height;
  const rctx = roughCanvas.getContext('2d');
  rctx.fillStyle = 'rgb(102, 102, 102)';
  rctx.fillRect(0, 0, width, height);

  const result = {
    colorMap: createHighResTexture(colorCanvas, 8, 2),
    normalMap: createNormalTexture(normalCanvas, 8, 2),
    roughnessMap: createNormalTexture(roughCanvas, 8, 2)
  };
  textureCache.set('floor_transit_pbr', result);
  return result;
}

// =============================================================================
// ДЕТАЛИЗИРОВАННАЯ ТРАНЗИТНАЯ ЖАККАРДОВАЯ ОБИВКА СИДЕНИЙ ВАГОНА МЕТРО (1024x1024)
// (Аутентичный микро-жаккард со сложным переплетением нитей, декоративной строчкой,
//  эргономичными швами, нормалями рельефа ткани и мягким велюровым откликом)
// =============================================================================
function createSeatFabricPBR(type, palette) {
  const cacheKey = `seat_fabric_${type}_pbr`;
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey);

  const size = 256;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cctx = colorCanvas.getContext('2d');

  // Базовый цвет ткани
  cctx.fillStyle = palette.base;
  cctx.fillRect(0, 0, size, size);

  const imgData = cctx.getImageData(0, 0, size, size);
  const data = imgData.data;

  // Псевдослучайный генератор
  let seed = palette.seed;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // Нормали
  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = size;
  normalCanvas.height = size;
  const nctx = normalCanvas.getContext('2d');
  const nImgData = nctx.createImageData(size, size);
  const ndata = nImgData.data;

  // Шероховатость
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rctx = roughCanvas.getContext('2d');
  const rImgData = rctx.createImageData(size, size);
  const rdata = rImgData.data;

  // Парсинг базовых цветов палитры (rgb)
  const warpRGB = palette.warpRGB; // Нити основы (продольные)
  const weftRGB = palette.weftRGB; // Нити утка (поперечные)
  const accentRGB = palette.accentRGB; // Геометрический жаккардовый акцент

  // Генерация жаккардовой структуры ткани
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;

      // 1. Микро-структура переплетения нитей (двойная саржа 4x4)
      const cellX = x % 8;
      const cellY = y % 8;
      const isWarp = ((cellX + cellY) % 4) < 2; // Чередование основы и утка

      // 2. Геометрический жаккардовый микро-узор метро (ромбовидная сетка 32x32 пикселей)
      const diamondX = (x % 32) - 16;
      const diamondY = (y % 32) - 16;
      const distDiamond = Math.abs(diamondX) + Math.abs(diamondY);
      const isJacquardMotif = distDiamond < 8;
      const isJacquardBorder = distDiamond >= 8 && distDiamond <= 10;

      // Выбор цвета нити
      let r, g, b;
      let heightVal = 128; // для вычисления нормалей

      if (isJacquardBorder) {
        // Контур микро-узора
        r = accentRGB[0];
        g = accentRGB[1];
        b = accentRGB[2];
        heightVal = 145;
      } else if (isJacquardMotif) {
        // Внутреннее заполнение мотива со сдвинутым блеском
        const factor = isWarp ? 1.08 : 0.94;
        r = warpRGB[0] * factor;
        g = warpRGB[1] * factor;
        b = warpRGB[2] * factor;
        heightVal = isWarp ? 140 : 120;
      } else {
        // Фоновое полотно
        if (isWarp) {
          r = warpRGB[0];
          g = warpRGB[1];
          b = warpRGB[2];
          heightVal = 135;
        } else {
          r = weftRGB[0];
          g = weftRGB[1];
          b = weftRGB[2];
          heightVal = 122;
        }
      }

      // Естественная вариация ворса ткани и микроволокон
      const fiberNoise = (rnd() - 0.5) * 14;
      r = Math.max(0, Math.min(255, r + fiberNoise));
      g = Math.max(0, Math.min(255, g + fiberNoise));
      b = Math.max(0, Math.min(255, b + fiberNoise));

      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;

      // Нормаль: рельеф нитей ткани
      const nx = isWarp ? (cellX - 3.5) * 4 : 0;
      const ny = !isWarp ? (cellY - 3.5) * 4 : 0;
      ndata[idx] = Math.max(0, Math.min(255, 128 + nx));
      ndata[idx + 1] = Math.max(0, Math.min(255, 128 + ny));
      ndata[idx + 2] = Math.max(0, Math.min(255, heightVal + 90));
      ndata[idx + 3] = 255;

      // Шероховатость: благородная матовая ткань обивки (0.72 - 0.82)
      const roughBase = isJacquardMotif ? 175 : 192;
      const rVal = Math.max(0, Math.min(255, roughBase + (rnd() - 0.5) * 12));
      rdata[idx] = rVal;
      rdata[idx + 1] = rVal;
      rdata[idx + 2] = rVal;
      rdata[idx + 3] = 255;
    }
  }

  cctx.putImageData(imgData, 0, 0);
  nctx.putImageData(nImgData, 0, 0);
  rctx.putImageData(rImgData, 0, 0);

  // Добавляем поверх элегантную декоративную строчку (двойной шов мебельной обивки)
  cctx.save();
  cctx.strokeStyle = palette.stitch;
  cctx.lineWidth = 1.5;
  cctx.setLineDash([4, 4]);
  // Вертикальные швы кроя обивки (каждые 64 пикселей)
  [32, 96, 160, 224].forEach(sx => {
    cctx.beginPath();
    cctx.moveTo(sx, 0);
    cctx.lineTo(sx, size);
    cctx.stroke();
  });
  cctx.restore();

  // Добавляем рельеф швов и валиков на карту нормалей
  nctx.save();
  nctx.strokeStyle = 'rgb(90, 90, 245)';
  nctx.lineWidth = 2;
  nctx.setLineDash([4, 4]);
  [32, 96, 160, 224].forEach(sx => {
    nctx.beginPath();
    nctx.moveTo(sx, 0);
    nctx.lineTo(sx, size);
    nctx.stroke();
  });
  nctx.restore();

  // Карта рассеянного затенения (Ambient Occlusion) для объемного рельефа подушек и швов
  const aoCanvas = document.createElement('canvas');
  aoCanvas.width = size;
  aoCanvas.height = size;
  const aoCtx = aoCanvas.getContext('2d');

  // Базовый цвет карты AO (полный свет на вершинах подушки)
  aoCtx.fillStyle = '#ffffff';
  aoCtx.fillRect(0, 0, size, size);

  // Мягкое затенение продольных линий утяжки и швов
  [32, 96, 160, 224].forEach(sx => {
    const grad = aoCtx.createLinearGradient(sx - 7, 0, sx + 7, 0);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.45)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    aoCtx.fillStyle = grad;
    aoCtx.fillRect(sx - 7, 0, 14, size);
  });

  // Затенение по краям подушки (межкресельный зазор)
  const leftGrad = aoCtx.createLinearGradient(0, 0, 9, 0);
  leftGrad.addColorStop(0, 'rgba(0, 0, 0, 0.60)');
  leftGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  aoCtx.fillStyle = leftGrad;
  aoCtx.fillRect(0, 0, 9, size);

  const rightGrad = aoCtx.createLinearGradient(size - 9, 0, size, 0);
  rightGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  rightGrad.addColorStop(1, 'rgba(0, 0, 0, 0.60)');
  aoCtx.fillStyle = rightGrad;
  aoCtx.fillRect(size - 9, 0, 9, size);

  const result = {
    colorMap: createHighResTexture(colorCanvas, 3, 3),
    normalMap: createNormalTexture(normalCanvas, 3, 3),
    roughnessMap: createNormalTexture(roughCanvas, 3, 3),
    aoMap: createNormalTexture(aoCanvas, 3, 3)
  };
  textureCache.set(cacheKey, result);
  return result;
}

// =============================================================================
// 2. СТЕКЛОПЛАСТИК СИДЕНИЙ ВАГОНА (RETRO MOLDED FIBERGLASS RESIN PBR)
// =============================================================================
export function getFiberglassTextures() {
  if (textureCache.has('fiberglass_resin_norm')) return textureCache.get('fiberglass_resin_norm');

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Базовый цвет карты нормалей в tangent space: (128, 128, 255) строго перпендикулярно грани (Z = +1)
  ctx.fillStyle = '#8080ff';
  ctx.fillRect(0, 0, size, size);

  // Тончайшая микроволокнистая текстура стекломата под слоем прозрачной смолы
  ctx.lineWidth = 1.0;
  let seed = 42891;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 400; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const len = 6 + rnd() * 16;
    const angle = rnd() * Math.PI * 2;
    const dx = Math.cos(angle) * len;
    const dy = Math.sin(angle) * len;
    const nx = Math.round(128 + Math.cos(angle) * 8);
    const ny = Math.round(128 + Math.sin(angle) * 8);
    ctx.strokeStyle = `rgb(${nx}, ${ny}, 255)`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dx, y + dy);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  textureCache.set('fiberglass_resin_norm', tex);
  return tex;
}

export function getPhotoSeatYellowTextures() {
  return { normalMap: getFiberglassTextures() };
}

export function getPhotoSeatOrangeTextures() {
  return { normalMap: getFiberglassTextures() };
}

// =============================================================================
// 3. ПЕРФОРИРОВАННАЯ ВЕНТИЛЯЦИОННАЯ РЕШЕТКА ПОД СИДЕНЬЯМИ
// =============================================================================
export function getPhotoVentGrilleTexture() {
  if (textureCache.has('vent_grille_pbr')) return textureCache.get('vent_grille_pbr');

  const width = 1024;
  const height = 512;
  const cvs = document.createElement('canvas');
  cvs.width = width;
  cvs.height = height;
  const ctx = cvs.getContext('2d');

  ctx.fillStyle = '#22252c';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#0f1115';
  const holeR = 4;
  const stepX = 16;
  const stepY = 16;

  for (let y = 10; y < height - 10; y += stepY) {
    const shift = (Math.floor(y / stepY) % 2) * (stepX / 2);
    for (let x = 10; x < width - 10; x += stepX) {
      ctx.beginPath();
      ctx.arc(x + shift, y, holeR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = createHighResTexture(cvs, 2, 1);
  textureCache.set('vent_grille_pbr', tex);
  return tex;
}

// =============================================================================
// 4. ПРИЗМАТИЧЕСКИЙ РАССЕИВАТЕЛЬ ПОТОЛОЧНЫХ СВЕТИЛЬНИКОВ
// =============================================================================
export function getPhotoCeilingLightTexture() {
  if (textureCache.has('ceiling_diffuser_pbr')) return textureCache.get('ceiling_diffuser_pbr');

  const width = 1024;
  const height = 256;
  const cvs = document.createElement('canvas');
  cvs.width = width;
  cvs.height = height;
  const ctx = cvs.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Микропризматическая сетка рассеивателя
  ctx.strokeStyle = 'rgba(215, 225, 240, 0.45)';
  ctx.lineWidth = 1;
  const pStep = 8;
  for (let x = 0; x < width; x += pStep) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += pStep) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  const tex = createHighResTexture(cvs, 1, 1);
  textureCache.set('ceiling_diffuser_pbr', tex);
  return tex;
}

// =============================================================================
// 5. БЕЛОСНЕЖНАЯ КЕРАМИЧЕСКАЯ ПЛИТКА СТАНЦИИ («КАБАНЧИК» / SUBWAY TILES) (2048x1024)
//    (Глянцевая глазурь, объемные 3D-фаски и тонкая аккуратная цементная затирка)
// =============================================================================
export function getStationTileTextures() {
  if (textureCache.has('station_tiles_white_pbr')) return textureCache.get('station_tiles_white_pbr');

  const width = 2048;
  const height = 1024;
  const cols = 16; // Вдвое меньший размер плитки для изящной парижской эстетики
  const rows = 16;
  const tileW = width / cols;
  const tileH = height / rows;
  const bevel = 5.0;
  const grout = 2.4;

  // 5.1 Color Map: сияющая белая глазурованная плитка с синей затиркой швов (Paris Metro Liège)
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = width;
  colorCanvas.height = height;
  const cctx = colorCanvas.getContext('2d');
  // Насыщенная кобальтово-синяя затирка швов
  cctx.fillStyle = '#1d4ed8';
  cctx.fillRect(0, 0, width, height);

  // 5.2 Normal Map: рельефные 3D-фаски плиток
  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = width;
  normalCanvas.height = height;
  const nctx = normalCanvas.getContext('2d');
  nctx.fillStyle = 'rgb(128, 128, 255)';
  nctx.fillRect(0, 0, width, height);

  // 5.3 Roughness Map: глянцевая глазурь (0.08) и матовые швы (0.85)
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = width;
  roughCanvas.height = height;
  const rctx = roughCanvas.getContext('2d');
  rctx.fillStyle = 'rgb(215, 215, 215)'; // матовые швы
  rctx.fillRect(0, 0, width, height);

  for (let r = 0; r < rows; r++) {
    const isOdd = r % 2 === 1;
    const xOffset = isOdd ? -tileW / 2 : 0;
    const startCol = isOdd ? -1 : 0;
    const endCol = isOdd ? cols + 1 : cols;

    for (let c = startCol; c <= endCol; c++) {
      const tx = c * tileW + xOffset + grout;
      const ty = r * tileH + grout;
      const tw = tileW - grout * 2;
      const th = tileH - grout * 2;

      // Тело белой плитки с мягким светотеневым градиентом керамики
      const grad = cctx.createLinearGradient(tx, ty, tx + tw, ty + th);
      grad.addColorStop(0.0, '#ffffff');
      grad.addColorStop(0.35, '#fbfcfe');
      grad.addColorStop(0.75, '#f5f7fb');
      grad.addColorStop(1.0, '#edf2f9');
      cctx.fillStyle = grad;
      cctx.fillRect(tx, ty, tw, th);

      // Верхняя и левая световые фаски (Highlight)
      cctx.fillStyle = '#ffffff';
      cctx.fillRect(tx, ty, tw, bevel * 0.75);
      cctx.fillRect(tx, ty, bevel * 0.75, th);

      // Нижняя и правая теневые фаски с синеватым отсветом шва
      cctx.fillStyle = 'rgba(29, 78, 216, 0.28)';
      cctx.fillRect(tx, ty + th - bevel * 0.85, tw, bevel * 0.85);
      cctx.fillRect(tx + tw - bevel * 0.85, ty, bevel * 0.85, th);

      // Глянцевая глазурь
      rctx.fillStyle = 'rgb(18, 18, 18)'; // 0.07 roughness (зеркальный глянец)
      rctx.fillRect(tx + bevel, ty + bevel, tw - bevel * 2, th - bevel * 2);
      rctx.fillStyle = 'rgb(38, 38, 38)'; // 0.15 roughness на фаске
      rctx.fillRect(tx, ty, tw, bevel);
      rctx.fillRect(tx, ty + th - bevel, tw, bevel);
      rctx.fillRect(tx, ty, bevel, th);
      rctx.fillRect(tx + tw - bevel, ty, bevel, th);

      // 3D векторные нормали скосов фаски
      nctx.fillStyle = 'rgb(128, 55, 240)'; // скос вверх
      nctx.fillRect(tx, ty, tw, bevel);
      nctx.fillStyle = 'rgb(128, 200, 240)'; // скос вниз
      nctx.fillRect(tx, ty + th - bevel, tw, bevel);
      nctx.fillStyle = 'rgb(55, 128, 240)'; // скос влево
      nctx.fillRect(tx, ty, bevel, th);
      nctx.fillStyle = 'rgb(200, 128, 240)'; // скос вправо
      nctx.fillRect(tx + tw - bevel, ty, bevel, th);
      nctx.fillStyle = 'rgb(128, 128, 255)'; // центр плитки
      nctx.fillRect(tx + bevel, ty + bevel, tw - bevel * 2, th - bevel * 2);
    }
  }

  const result = {
    colorMap: createHighResTexture(colorCanvas, 8, 4),
    normalMap: createNormalTexture(normalCanvas, 8, 4),
    roughnessMap: createNormalTexture(roughCanvas, 8, 4)
  };

  textureCache.set('station_tiles_white_pbr', result);
  return result;
}

// =============================================================================
// 6. ПАРИЖСКАЯ ПЛАТФОРМА: 3-ЗОННЫЙ ФОТОРЕАЛИСТИЧНЫЙ PBR-ПОЛ (RATP STANDARDS)
// 1. Белая плитка (бордюрный край платформы)
// 2. Фактурная плитка для слепых (рельефные полусферические тактильные пупырышки)
// 3. Темносерая плитка (основное полотно станции)
// =============================================================================

/**
 * 6.1 Белая бордюрная плитка края платформы (0.42м вдоль поезда)
 */
export function getPlatformWhiteCurbTextures() {
  if (textureCache.has('plat_white_curb_pbr')) return textureCache.get('plat_white_curb_pbr');

  const width = 512;
  const height = 512;

  // 1. Color Map
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = width;
  colorCanvas.height = height;
  const cctx = colorCanvas.getContext('2d');

  // Базовый цвет белого матового керамогранита платформы
  cctx.fillStyle = '#f2f4f8';
  cctx.fillRect(0, 0, width, height);

  // 4 прямоугольные плитки по длине X (каждая 128px = 0.20м)
  const cols = 4;
  const tileW = width / cols;
  const seamW = 4;

  for (let c = 0; c < cols; c++) {
    const x = c * tileW;
    const grad = cctx.createLinearGradient(x, 0, x + tileW, 0);
    grad.addColorStop(0.0, '#edf1f7');
    grad.addColorStop(0.5, '#f6f8fb');
    grad.addColorStop(1.0, '#e8ecf3');
    cctx.fillStyle = grad;
    cctx.fillRect(x + seamW / 2, 0, tileW - seamW, height);

    // Световая фаска слева
    cctx.fillStyle = '#ffffff';
    cctx.fillRect(x + seamW / 2, 0, 2, height);

    // Теневая фаска справа
    cctx.fillStyle = 'rgba(180, 190, 205, 0.45)';
    cctx.fillRect(x + tileW - seamW / 2 - 2, 0, 2, height);
  }

  // Межплиточные швы (затирка швов)
  cctx.fillStyle = '#9aa5b5';
  for (let c = 0; c <= cols; c++) {
    const x = c * tileW;
    cctx.fillRect(Math.max(0, x - seamW / 2), 0, seamW, height);
  }

  // Тонкая противоскользящая фактура камня
  const imgData = cctx.getImageData(0, 0, width, height);
  const d = imgData.data;
  let seed = 123891;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < d.length; i += 4) {
    const noise = (rnd() - 0.5) * 12;
    d[i] = Math.max(0, Math.min(255, d[i] + noise));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + noise));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + noise));
  }
  cctx.putImageData(imgData, 0, 0);

  // 2. Normal Map
  const normCanvas = document.createElement('canvas');
  normCanvas.width = width;
  normCanvas.height = height;
  const nctx = normCanvas.getContext('2d');
  nctx.fillStyle = 'rgb(128, 128, 255)';
  nctx.fillRect(0, 0, width, height);

  for (let c = 0; c <= cols; c++) {
    const x = c * tileW;
    nctx.fillStyle = 'rgb(180, 128, 235)'; // шов с левым наклоном
    nctx.fillRect(Math.max(0, x - seamW / 2), 0, seamW / 2, height);
    nctx.fillStyle = 'rgb(75, 128, 235)';  // шов с правым наклоном
    nctx.fillRect(Math.max(0, x), 0, seamW / 2, height);
  }

  // 3. Roughness Map (матовый противоскользящий керамогранит)
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = width;
  roughCanvas.height = height;
  const rctx = roughCanvas.getContext('2d');
  rctx.fillStyle = '#60646c'; // roughness ~0.38
  rctx.fillRect(0, 0, width, height);
  rctx.fillStyle = '#b0b5be'; // швы шероховатые ~0.70
  for (let c = 0; c <= cols; c++) {
    rctx.fillRect(Math.max(0, c * tileW - seamW / 2), 0, seamW, height);
  }

  const result = {
    colorMap: createHighResTexture(colorCanvas, 65, 1),
    normalMap: createNormalTexture(normCanvas, 65, 1),
    roughnessMap: createNormalTexture(roughCanvas, 65, 1)
  };
  textureCache.set('plat_white_curb_pbr', result);
  return result;
}

/**
 * 6.2 Фактурная тактильная плитка для слепых с рельефными полусферическими пупырышками
 * (RATP NF P98-351 Bande d'éveil de vigilance podotactile)
 */
export function getPlatformTactileTextures() {
  if (textureCache.has('plat_tactile_pbr')) return textureCache.get('plat_tactile_pbr');

  const width = 512;
  const height = 512;

  // 1. Color Map
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = width;
  colorCanvas.height = height;
  const cctx = colorCanvas.getContext('2d');

  // Аутентичный оттенок парижской тактильной плитки: теплый песочно-кремовый / светло-бежевый
  cctx.fillStyle = '#e5dfd2';
  cctx.fillRect(0, 0, width, height);

  // Тонкий внешний контур стыков плит (42см x 42см)
  cctx.strokeStyle = '#c4bcb0';
  cctx.lineWidth = 3;
  cctx.strokeRect(1, 1, width - 2, height - 2);

  // 2. Normal Map (математический расчет сферических нормалей пупырышков)
  const normCanvas = document.createElement('canvas');
  normCanvas.width = width;
  normCanvas.height = height;
  const nctx = normCanvas.getContext('2d');
  nctx.fillStyle = 'rgb(128, 128, 255)';
  nctx.fillRect(0, 0, width, height);

  // 3. Roughness Map
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = width;
  roughCanvas.height = height;
  const rctx = roughCanvas.getContext('2d');
  rctx.fillStyle = '#a29c92'; // матовое полимерно-бетонное основание (roughness ~0.64)
  rctx.fillRect(0, 0, width, height);

  // Расчет решетки пупырышков в шахматном (quincunx) порядке
  // 8 рядов по 8 пупырышков, шаг 64px, диаметр 28px (R = 14px)
  const rows = 8;
  const cols = 8;
  const stepY = height / rows;
  const stepX = width / cols;
  const studR = 14;

  const studs = [];
  for (let r = 0; r < rows; r++) {
    const isOdd = r % 2 === 1;
    const xOffset = isOdd ? stepX / 2 : 0;
    const cy = r * stepY + stepY / 2;

    for (let c = (isOdd ? -1 : 0); c <= cols; c++) {
      const cx = c * stepX + stepX / 2 + xOffset;
      if (cx >= -studR && cx <= width + studR) {
        studs.push({ cx, cy });
      }
    }
  }

  // Отрисовка цвета и мягких теней пупырышков
  studs.forEach(({ cx, cy }) => {
    // Мягкая контактная тень вокруг основания пупырышка
    const shadowGrad = cctx.createRadialGradient(cx, cy, studR * 0.8, cx, cy, studR * 1.25);
    shadowGrad.addColorStop(0.0, 'rgba(120, 110, 95, 0.35)');
    shadowGrad.addColorStop(1.0, 'rgba(120, 110, 95, 0.0)');
    cctx.fillStyle = shadowGrad;
    cctx.beginPath();
    cctx.arc(cx, cy, studR * 1.25, 0, Math.PI * 2);
    cctx.fill();

    // Тело пупырышка с градиентом верхнего света
    const domeGrad = cctx.createRadialGradient(cx - 3, cy - 3, 2, cx, cy, studR);
    domeGrad.addColorStop(0.0, '#f8f4ec');
    domeGrad.addColorStop(0.5, '#eee7da');
    domeGrad.addColorStop(0.9, '#dbd3c2');
    domeGrad.addColorStop(1.0, '#c7bea8');
    cctx.fillStyle = domeGrad;
    cctx.beginPath();
    cctx.arc(cx, cy, studR, 0, Math.PI * 2);
    cctx.fill();

    // Блик на макушке
    cctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    cctx.beginPath();
    cctx.arc(cx - 3, cy - 3, 4, 0, Math.PI * 2);
    cctx.fill();
  });

  // Запекание математических 3D-нормалей полусфер в Normal Map
  const normImg = nctx.getImageData(0, 0, width, height);
  const nd = normImg.data;

  const roughImg = rctx.getImageData(0, 0, width, height);
  const rd = roughImg.data;

  studs.forEach(({ cx, cy }) => {
    const minX = Math.max(0, Math.floor(cx - studR));
    const maxX = Math.min(width - 1, Math.ceil(cx + studR));
    const minY = Math.max(0, Math.floor(cy - studR));
    const maxY = Math.min(height - 1, Math.ceil(cy + studR));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const distSq = dx * dx + dy * dy;
        if (distSq <= studR * studR) {
          const rNorm = Math.sqrt(distSq) / studR;
          // Полусферическая нормаль
          const nx = (-dx / studR) * 0.92;
          const ny = (-dy / studR) * 0.92;
          const nz = Math.sqrt(Math.max(0, 1.0 - nx * nx - ny * ny));

          const idx = (y * width + x) * 4;
          nd[idx] = Math.round(128 + nx * 127);
          nd[idx + 1] = Math.round(128 + ny * 127);
          nd[idx + 2] = Math.round(nz * 255);

          // Гладкая вершина пупырышка (полировка обувью пассажиров)
          rd[idx] = Math.round(75 + (1 - rNorm) * 35);
        }
      }
    }
  });

  nctx.putImageData(normImg, 0, 0);
  rctx.putImageData(roughImg, 0, 0);

  const result = {
    colorMap: createHighResTexture(colorCanvas, 124, 1),
    normalMap: createNormalTexture(normCanvas, 124, 1),
    roughnessMap: createNormalTexture(roughCanvas, 124, 1)
  };
  textureCache.set('plat_tactile_pbr', result);
  return result;
}

/**
 * 6.3 Темносерая плитка основного полотна платформы
 * (RATP dalles de granit/asphalte gris foncé)
 */
export function getPlatformDarkTileTextures() {
  if (textureCache.has('plat_dark_tile_pbr')) return textureCache.get('plat_dark_tile_pbr');

  const width = 512;
  const height = 512;

  // 1. Color Map
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = width;
  colorCanvas.height = height;
  const cctx = colorCanvas.getContext('2d');

  // Темносерый глубокий графит
  cctx.fillStyle = '#1c1f26';
  cctx.fillRect(0, 0, width, height);

  // Сетка плит 2x2 (каждая 256px = 0.60м x 0.60м)
  const cols = 2;
  const rows = 2;
  const cellW = width / cols;
  const cellH = height / rows;
  const seamW = 4;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const px = c * cellW + seamW / 2;
      const py = r * cellH + seamW / 2;
      const pw = cellW - seamW;
      const ph = cellH - seamW;

      const pGrad = cctx.createLinearGradient(px, py, px + pw, py + ph);
      pGrad.addColorStop(0.0, '#262932');
      pGrad.addColorStop(0.5, '#1e2128');
      pGrad.addColorStop(1.0, '#191b22');
      cctx.fillStyle = pGrad;
      cctx.fillRect(px, py, pw, ph);

      // Световой кант плиты
      cctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      cctx.fillRect(px, py, pw, 2);
      cctx.fillRect(px, py, 2, ph);

      // Теневой кант
      cctx.fillStyle = 'rgba(0, 0, 0, 0.40)';
      cctx.fillRect(px, py + ph - 2, pw, 2);
      cctx.fillRect(px + pw - 2, py, 2, ph);
    }
  }

  // Межплиточные швы
  cctx.fillStyle = '#0f1115';
  for (let c = 0; c <= cols; c++) {
    cctx.fillRect(Math.max(0, c * cellW - seamW / 2), 0, seamW, height);
  }
  for (let r = 0; r <= rows; r++) {
    cctx.fillRect(0, Math.max(0, r * cellH - seamW / 2), width, seamW);
  }

  // Вкрапления кварцевой крошки
  const imgData = cctx.getImageData(0, 0, width, height);
  const d = imgData.data;
  let seed = 445566;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < d.length; i += 4) {
    const grain = (rnd() - 0.5) * 22;
    d[i] = Math.max(0, Math.min(255, d[i] + grain));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + grain + 2));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + grain + 4));
  }
  cctx.putImageData(imgData, 0, 0);

  // 2. Normal Map
  const normCanvas = document.createElement('canvas');
  normCanvas.width = width;
  normCanvas.height = height;
  const nctx = normCanvas.getContext('2d');
  nctx.fillStyle = 'rgb(128, 128, 255)';
  nctx.fillRect(0, 0, width, height);

  for (let c = 0; c <= cols; c++) {
    const x = c * cellW;
    nctx.fillStyle = 'rgb(175, 128, 240)';
    nctx.fillRect(Math.max(0, x - seamW / 2), 0, seamW / 2, height);
    nctx.fillStyle = 'rgb(80, 128, 240)';
    nctx.fillRect(Math.max(0, x), 0, seamW / 2, height);
  }
  for (let r = 0; r <= rows; r++) {
    const y = r * cellH;
    nctx.fillStyle = 'rgb(128, 175, 240)';
    nctx.fillRect(0, Math.max(0, y - seamW / 2), width, seamW / 2);
    nctx.fillStyle = 'rgb(128, 80, 240)';
    nctx.fillRect(0, Math.max(0, y), width, seamW / 2);
  }

  // 3. Roughness Map
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = width;
  roughCanvas.height = height;
  const rctx = roughCanvas.getContext('2d');
  rctx.fillStyle = '#6b707c'; // roughness ~0.42
  rctx.fillRect(0, 0, width, height);
  rctx.fillStyle = '#b8bec8'; // швы roughness ~0.75
  for (let c = 0; c <= cols; c++) rctx.fillRect(Math.max(0, c * cellW - seamW / 2), 0, seamW, height);
  for (let r = 0; r <= rows; r++) rctx.fillRect(0, Math.max(0, r * cellH - seamW / 2), width, seamW);

  const result = {
    colorMap: createHighResTexture(colorCanvas, 43, 3.3),
    normalMap: createNormalTexture(normCanvas, 43, 3.3),
    roughnessMap: createNormalTexture(roughCanvas, 43, 3.3)
  };
  textureCache.set('plat_dark_tile_pbr', result);
  return result;
}

// =============================================================================
// 7. ЛИВРЕЯ И ЭМБЛЕМЫ ПОЕЗДА МЕТРО ALSTOM / ÎLE-DE-FRANCE MOBILITÉS (LINE 18)
// =============================================================================

/**
 * 7.1 Круглый значок Линии 18 («18» в бирюзово-голубом круге с белой окантовкой)
 */
export function getAlstomLine18BadgeTexture() {
  if (textureCache.has('line18_badge_tex')) return textureCache.get('line18_badge_tex');

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;
  const radius = 220;

  // Внешняя белая эмалированная кайма
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Внутренний круг парижской линии метро: бирюзово-голубой (#26a5dc)
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 18, 0, Math.PI * 2);
  const grad = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
  grad.addColorStop(0.0, '#32b4ec');
  grad.addColorStop(0.5, '#26a5dc');
  grad.addColorStop(1.0, '#1b8bc0');
  ctx.fillStyle = grad;
  ctx.fill();

  // Тонкий внутренний световой блик
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 20, Math.PI * 1.1, Math.PI * 1.9);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 6;
  ctx.stroke();

  // Чистый белый крупный шрифт номера линии «18»
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 210px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';
  ctx.fillText('18', cx, cy + 6);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  textureCache.set('line18_badge_tex', tex);
  return tex;
}

/**
 * 7.2 Фирменный логотип Île-de-France Mobilités + Alstom
 */
export function getAlstomBrandingTexture() {
  if (textureCache.has('alstom_branding_tex')) return textureCache.get('alstom_branding_tex');

  const width = 1024;
  const height = 256;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, width, height);

  // Фирменный силуэт бегущего человека (Île-de-France Mobilités)
  const iconX = 64;
  const iconY = 48;
  const iconSize = 160;

  // Закругленный квадрат
  ctx.beginPath();
  ctx.roundRect(iconX, iconY, iconSize, iconSize, 28);
  ctx.fillStyle = '#26a5dc';
  ctx.fill();

  // Белая фигурка человека
  ctx.fillStyle = '#ffffff';
  // Голова
  ctx.beginPath();
  ctx.arc(iconX + 80, iconY + 44, 18, 0, Math.PI * 2);
  ctx.fill();
  // Торс и ноги
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(iconX + 80, iconY + 68);
  ctx.lineTo(iconX + 74, iconY + 108);
  ctx.lineTo(iconX + 54, iconY + 138); // левая нога
  ctx.moveTo(iconX + 74, iconY + 108);
  ctx.lineTo(iconX + 104, iconY + 138); // правая нога
  // Руки в динамичном беге
  ctx.moveTo(iconX + 50, iconY + 86);
  ctx.lineTo(iconX + 80, iconY + 78);
  ctx.lineTo(iconX + 108, iconY + 96);
  ctx.stroke();

  // Текстовая надпись «Île-de-France Mobilités»
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#1c2432';
  ctx.font = 'bold 58px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';
  ctx.fillText('ÎledeFrance', iconX + iconSize + 36, iconY + 16);

  ctx.fillStyle = '#26a5dc';
  ctx.font = '52px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
  ctx.fillText('mobilités', iconX + iconSize + 36, iconY + 82);

  // Технический номер состава и марка
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 24px -apple-system, monospace';
  ctx.fillText('ALSTOM METROPOLIS  •  VOITURE M.8018', iconX + iconSize + 38, iconY + 146);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  textureCache.set('alstom_branding_tex', tex);
  return tex;
}

export function getPlatformGraniteTextures() {
  return getPlatformDarkTileTextures();
}
