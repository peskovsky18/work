/**
 * Александр Песковский — 2026
 * Фотореалистичные процедурные PBR-материалы вагона и станции метро высокого разрешения:
 * - Стены и пол вагона: единый гармоничный архитектурный ансамбль современного поезда метро
 *   (сатинированная шлифованная сталь + согласованный графитовый композитный пол с кварцевой крошкой)
 * - Путевая стена станции: белоснежная глазурованная керамическая плитка («кабанчик» / Subway Tiles)
 * - Потолочные светильники: призматические светорассеиватели
 */

import * as THREE from 'three';

const textureCache = new Map();

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

  const width = 2048;
  const height = 1024;

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
    const rowGrain = (rnd() - 0.5) * 16;
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const grain = rowGrain + (rnd() - 0.5) * 6;
      data[idx]     = Math.max(0, Math.min(255, data[idx] + grain));
      data[idx + 1] = Math.max(0, Math.min(255, data[idx + 1] + grain));
      data[idx + 2] = Math.max(0, Math.min(255, data[idx + 2] + grain + 2));
    }
  }
  cctx.putImageData(imgData, 0, 0);

  // Тонкие архитектурные стыки панелей вагона
  cctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
  cctx.lineWidth = 2;
  [512, 1024, 1536].forEach(px => {
    cctx.beginPath();
    cctx.moveTo(px, 0);
    cctx.lineTo(px, height);
    cctx.stroke();
  });
  cctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  cctx.lineWidth = 1;
  [513, 1025, 1537].forEach(px => {
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
    const dy = (rnd() - 0.5) * 22;
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const dx = (rnd() - 0.5) * 8;
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
    colorMap: createHighResTexture(colorCanvas, 2, 1),
    normalMap: createNormalTexture(normalCanvas, 2, 1),
    roughnessMap: createNormalTexture(roughCanvas, 2, 1)
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

  const size = 1024;
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

      // 2. Геометрический жаккардовый микро-узор метро (ромбовидная сетка 64x64 пикселей)
      const diamondX = (x % 64) - 32;
      const diamondY = (y % 64) - 32;
      const distDiamond = Math.abs(diamondX) + Math.abs(diamondY);
      const isJacquardMotif = distDiamond < 16;
      const isJacquardBorder = distDiamond >= 16 && distDiamond <= 19;

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
  cctx.lineWidth = 2.5;
  cctx.setLineDash([8, 8]);
  // Вертикальные швы кроя обивки (каждые 256 пикселей)
  [128, 384, 640, 896].forEach(sx => {
    cctx.beginPath();
    cctx.moveTo(sx, 0);
    cctx.lineTo(sx, size);
    cctx.stroke();
  });
  cctx.restore();

  // Добавляем рельеф швов на карту нормалей
  nctx.save();
  nctx.strokeStyle = 'rgb(100, 100, 240)';
  nctx.lineWidth = 3;
  nctx.setLineDash([8, 8]);
  [128, 384, 640, 896].forEach(sx => {
    nctx.beginPath();
    nctx.moveTo(sx, 0);
    nctx.lineTo(sx, size);
    nctx.stroke();
  });
  nctx.restore();

  const result = {
    colorMap: createHighResTexture(colorCanvas, 3, 3),
    normalMap: createNormalTexture(normalCanvas, 3, 3),
    roughnessMap: createNormalTexture(roughCanvas, 3, 3)
  };
  textureCache.set(cacheKey, result);
  return result;
}

export function getPhotoSeatYellowTextures() {
  return createSeatFabricPBR('yellow', {
    seed: 556677,
    base: '#dca018',
    warpRGB: [238, 178, 38], // Светло-золотистая нить основы
    weftRGB: [195, 136, 12], // Глубокая теплая охра утка
    accentRGB: [255, 198, 65], // Золотистый жаккардовый акцент
    stitch: 'rgba(110, 70, 6, 0.45)' // Тонкая контрастная строчка
  });
}

export function getPhotoSeatOrangeTextures() {
  return createSeatFabricPBR('orange', {
    seed: 889900,
    base: '#c94d1a',
    warpRGB: [225, 95, 38], // Сочная терракотовая нить основы
    weftRGB: [168, 55, 15], // Глубокий кирпичный тон утка
    accentRGB: [248, 125, 60], // Яркий микро-жаккардовый акцент
    stitch: 'rgba(90, 25, 8, 0.45)' // Тонкая контрастная строчка
  });
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
  const cols = 8;
  const rows = 8;
  const tileW = width / cols;
  const tileH = height / rows;
  const bevel = 9;
  const grout = 3.5;

  // 5.1 Color Map: сияющая белая глазурованная плитка
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = width;
  colorCanvas.height = height;
  const cctx = colorCanvas.getContext('2d');
  cctx.fillStyle = '#b8c0cc'; // Аккуратная светло-серая затирка швов
  cctx.fillRect(0, 0, width, height);

  // 5.2 Normal Map: рельефные 3D-фаски плиток
  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = width;
  normalCanvas.height = height;
  const nctx = normalCanvas.getContext('2d');
  nctx.fillStyle = 'rgb(128, 128, 255)';
  nctx.fillRect(0, 0, width, height);

  // 5.3 Roughness Map: глянцевая глазурь (0.09) и матовые швы (0.75)
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = width;
  roughCanvas.height = height;
  const rctx = roughCanvas.getContext('2d');
  rctx.fillStyle = 'rgb(190, 190, 190)';
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
      grad.addColorStop(0.35, '#f9fbff');
      grad.addColorStop(0.75, '#f3f6fb');
      grad.addColorStop(1.0, '#eaf0f8');
      cctx.fillStyle = grad;
      cctx.fillRect(tx, ty, tw, th);

      // Верхняя и левая световые фаски (Highlight)
      cctx.fillStyle = '#ffffff';
      cctx.fillRect(tx, ty, tw, bevel * 0.75);
      cctx.fillRect(tx, ty, bevel * 0.75, th);

      // Нижняя и правая теневые фаски (Ambient Shadow)
      cctx.fillStyle = 'rgba(175, 190, 210, 0.45)';
      cctx.fillRect(tx, ty + th - bevel * 0.85, tw, bevel * 0.85);
      cctx.fillRect(tx + tw - bevel * 0.85, ty, bevel * 0.85, th);

      // Глянцевая глазурь
      rctx.fillStyle = 'rgb(22, 22, 22)'; // 0.08 roughness (зеркальный глянец)
      rctx.fillRect(tx + bevel, ty + bevel, tw - bevel * 2, th - bevel * 2);
      rctx.fillStyle = 'rgb(44, 44, 44)'; // 0.17 roughness на фаске
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
    colorMap: createHighResTexture(colorCanvas, 5, 2.2),
    normalMap: createNormalTexture(normalCanvas, 5, 2.2),
    roughnessMap: createNormalTexture(roughCanvas, 5, 2.2)
  };
  textureCache.set('station_tiles_white_pbr', result);
  return result;
}

// =============================================================================
// 6. ТЕРМООБРАБОТАННЫЙ ГРАНИТ ПЛАТФОРМЫ
// =============================================================================
export function getPlatformGraniteTextures() {
  if (textureCache.has('platform_granite_pbr')) return textureCache.get('platform_granite_pbr');

  const size = 1024;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cctx = colorCanvas.getContext('2d');
  cctx.fillStyle = '#1c1f26';
  cctx.fillRect(0, 0, size, size);

  const imgData = cctx.getImageData(0, 0, size, size);
  const d = imgData.data;
  let seed = 887766;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < d.length; i += 4) {
    const grain = (rnd() - 0.5) * 24;
    d[i] = Math.max(0, Math.min(255, d[i] + grain));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + grain + 2));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + grain + 4));
  }
  cctx.putImageData(imgData, 0, 0);

  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = size;
  normalCanvas.height = size;
  const nctx = normalCanvas.getContext('2d');
  nctx.fillStyle = 'rgb(128, 128, 255)';
  nctx.fillRect(0, 0, size, size);

  const nData = nctx.getImageData(0, 0, size, size);
  const nd = nData.data;
  seed = 667788;
  for (let i = 0; i < nd.length; i += 4) {
    const nx = (rnd() - 0.5) * 20;
    const ny = (rnd() - 0.5) * 20;
    nd[i] = Math.max(0, Math.min(255, 128 + nx));
    nd[i + 1] = Math.max(0, Math.min(255, 128 + ny));
    nd[i + 2] = 250;
  }
  nctx.putImageData(nData, 0, 0);

  const result = {
    colorMap: createHighResTexture(colorCanvas, 6, 2.5),
    normalMap: createNormalTexture(normalCanvas, 6, 2.5)
  };
  textureCache.set('platform_granite_pbr', result);
  return result;
}
