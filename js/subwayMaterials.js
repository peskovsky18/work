/**
 * Александр Песковский — 2026
 * Генератор процедурных фотореалистичных PBR-текстур и материалов:
 * - Глазурованная белая плитка станции («кабанчик») с фасками и швами
 * - Рифленый противоскользящий резиновый пол вагона
 * - Сатинированная шлифованная сталь стен с анизотропным зерном
 * - Винтажный формованный стеклопластик сидений с глубоким гелькоутом
 * - Термообработанный гранит платформы
 */

import * as THREE from 'three';

// Кэш сгенерированных текстур
const textureCache = new Map();

// =============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ГЕНЕРАЦИИ КАРТ НОРМАЛЕЙ И РЕЛЬЕФА
// =============================================================================

/**
 * Создает CanvasTexture с правильными настройками тайлинга и мипмаппинга
 */
function makeTexture(canvas, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

// =============================================================================
// 1. ГЛАЗУРОВАННАЯ КЕРАМИЧЕСКАЯ ПЛИТКА СТАНЦИИ («КАБАНЧИК» / METRO SUBWAY TILE)
// =============================================================================

export function getStationTileTextures() {
  if (textureCache.has('station_tiles')) return textureCache.get('station_tiles');

  const size = 512;
  const tileCols = 4;
  const tileRows = 8;
  const tileW = size / tileCols;
  const tileH = size / tileRows;
  const bevel = 6;
  const grout = 3;

  // --- 1.1 Base Color Canvas ---
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cctx = colorCanvas.getContext('2d');

  // Фон затирки (матовый светло-серый цемент)
  cctx.fillStyle = '#b8bec8';
  cctx.fillRect(0, 0, size, size);

  // --- 1.2 Normal Map Canvas ---
  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = size;
  normalCanvas.height = size;
  const nctx = normalCanvas.getContext('2d');
  nctx.fillStyle = 'rgb(128, 128, 255)'; // Плоская нормаль Z+
  nctx.fillRect(0, 0, size, size);

  // --- 1.3 Roughness Map Canvas ---
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rctx = roughCanvas.getContext('2d');
  rctx.fillStyle = 'rgb(220, 220, 220)'; // Шероховатая затирка (0.86)
  rctx.fillRect(0, 0, size, size);

  for (let r = 0; r < tileRows; r++) {
    const isOdd = r % 2 === 1;
    const xOffset = isOdd ? -tileW / 2 : 0;
    const startCol = isOdd ? -1 : 0;
    const endCol = isOdd ? tileCols + 1 : tileCols;

    for (let c = startCol; c <= endCol; c++) {
      const tx = c * tileW + xOffset + grout;
      const ty = r * tileH + grout;
      const tw = tileW - grout * 2;
      const th = tileH - grout * 2;

      // Цвет плитки (светлый фарфор с микро-градиентом)
      const grad = cctx.createLinearGradient(tx, ty, tx + tw, ty + th);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.5, '#f5f7fb');
      grad.addColorStop(1, '#edf0f6');
      cctx.fillStyle = grad;
      cctx.fillRect(tx, ty, tw, th);

      // Глянцевая поверхность плитки в Roughness (0.10 глянец)
      rctx.fillStyle = 'rgb(26, 26, 26)';
      rctx.fillRect(tx + bevel, ty + bevel, tw - bevel * 2, th - bevel * 2);

      // Фаски в Roughness (0.22)
      rctx.fillStyle = 'rgb(56, 56, 56)';
      rctx.fillRect(tx, ty, tw, bevel);
      rctx.fillRect(tx, ty + th - bevel, tw, bevel);
      rctx.fillRect(tx, ty, bevel, th);
      rctx.fillRect(tx + tw - bevel, ty, bevel, th);

      // Фаски в Normal Map:
      // Верхняя фаска (наклон вверх: Y-) -> R=128, G=70, B=255
      nctx.fillStyle = 'rgb(128, 65, 240)';
      nctx.fillRect(tx, ty, tw, bevel);
      // Нижняя фаска (наклон вниз: Y+) -> R=128, G=190, B=255
      nctx.fillStyle = 'rgb(128, 195, 240)';
      nctx.fillRect(tx, ty + th - bevel, tw, bevel);
      // Левая фаска (наклон влево: X-) -> R=65, G=128, B=255
      nctx.fillStyle = 'rgb(65, 128, 240)';
      nctx.fillRect(tx, ty, bevel, th);
      // Правая фаска (наклон вправо: X+) -> R=195, G=128, B=255
      nctx.fillStyle = 'rgb(195, 128, 240)';
      nctx.fillRect(tx + tw - bevel, ty, bevel, th);

      // Центр плитки (ровный Z-up)
      nctx.fillStyle = 'rgb(128, 128, 255)';
      nctx.fillRect(tx + bevel, ty + bevel, tw - bevel * 2, th - bevel * 2);
    }
  }

  const result = {
    colorMap: makeTexture(colorCanvas, 8, 4),
    normalMap: makeTexture(normalCanvas, 8, 4),
    roughnessMap: makeTexture(roughCanvas, 8, 4)
  };
  textureCache.set('station_tiles', result);
  return result;
}

// =============================================================================
// 2. РИФЛЕНЫЙ РЕЗИНОВЫЙ ПОЛ ВАГОНА МЕТРО (NON-SLIP RIBBED TRANSIT FLOOR)
// =============================================================================

export function getSubwayFloorTextures() {
  if (textureCache.has('subway_floor')) return textureCache.get('subway_floor');

  const size = 512;
  const ribPeriod = 16; // шаг полос рифления

  // --- 2.1 Base Color ---
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cctx = colorCanvas.getContext('2d');
  cctx.fillStyle = '#17191e'; // темно-графитовый цвет резины
  cctx.fillRect(0, 0, size, size);

  // Добавляем мелкие микро-вкрапления минеральной крошки
  const imgData = cctx.getImageData(0, 0, size, size);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const speckle = (Math.random() - 0.5) * 14;
    data[i] = Math.max(0, Math.min(255, data[i] + speckle));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + speckle));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + speckle + 2));
  }
  cctx.putImageData(imgData, 0, 0);

  // --- 2.2 Normal Map ---
  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = size;
  normalCanvas.height = size;
  const nctx = normalCanvas.getContext('2d');
  nctx.fillStyle = 'rgb(128, 128, 255)';
  nctx.fillRect(0, 0, size, size);

  // --- 2.3 Roughness Map ---
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rctx = roughCanvas.getContext('2d');
  rctx.fillStyle = 'rgb(120, 120, 120)'; // базовый полуматовый 0.47
  rctx.fillRect(0, 0, size, size);

  // Отрисовка продольных противоскользящих ребер
  for (let x = 0; x < size; x += ribPeriod) {
    // Впадина слева (наклон влево)
    nctx.fillStyle = 'rgb(85, 128, 245)';
    nctx.fillRect(x, 0, 3, size);

    // Вершина ребра (глянцевая от шагов)
    nctx.fillStyle = 'rgb(128, 128, 255)';
    nctx.fillRect(x + 3, 0, 6, size);
    rctx.fillStyle = 'rgb(60, 60, 60)'; // гладкая вершина (0.24)
    rctx.fillRect(x + 3, 0, 6, size);

    // Скат справа (наклон вправо)
    nctx.fillStyle = 'rgb(175, 128, 245)';
    nctx.fillRect(x + 9, 0, 3, size);

    // Канавка между ребрами
    rctx.fillStyle = 'rgb(160, 160, 160)'; // шершавая канавка (0.63)
    rctx.fillRect(x + 12, 0, ribPeriod - 12, size);
  }

  const result = {
    colorMap: makeTexture(colorCanvas, 12, 6),
    normalMap: makeTexture(normalCanvas, 12, 6),
    roughnessMap: makeTexture(roughCanvas, 12, 6)
  };
  textureCache.set('subway_floor', result);
  return result;
}

// =============================================================================
// 3. ШЛИФОВАННАЯ СТАЛЬ И МЕЛАМИН СТЕН (BRUSHED STAINLESS STEEL & MELAMINE)
// =============================================================================

export function getSubwayWallTextures() {
  if (textureCache.has('subway_walls')) return textureCache.get('subway_walls');

  const size = 512;

  // --- 3.1 Normal Map (горизонтальные линии шлифовки) ---
  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = size;
  normalCanvas.height = size;
  const nctx = normalCanvas.getContext('2d');
  nctx.fillStyle = 'rgb(128, 128, 255)';
  nctx.fillRect(0, 0, size, size);

  // --- 3.2 Roughness Map (анизотропные полосы отражения) ---
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rctx = roughCanvas.getContext('2d');
  rctx.fillStyle = 'rgb(80, 80, 80)';
  rctx.fillRect(0, 0, size, size);

  // Генерируем сотни тончайших горизонтальных полос проката
  for (let y = 0; y < size; y += 2) {
    const intensity = Math.sin(y * 1.5) * 18 + (Math.random() - 0.5) * 22;
    const gVal = Math.round(128 + intensity);
    nctx.strokeStyle = `rgb(128, ${gVal}, 250)`;
    nctx.lineWidth = 1.2;
    nctx.beginPath();
    nctx.moveTo(0, y);
    nctx.lineTo(size, y);
    nctx.stroke();

    const rVal = Math.round(75 + (Math.random() - 0.5) * 35);
    rctx.strokeStyle = `rgb(${rVal}, ${rVal}, ${rVal})`;
    rctx.lineWidth = 1;
    rctx.beginPath();
    rctx.moveTo(0, y);
    rctx.lineTo(size, y);
    rctx.stroke();
  }

  const result = {
    normalMap: makeTexture(normalCanvas, 6, 2),
    roughnessMap: makeTexture(roughCanvas, 6, 2)
  };
  textureCache.set('subway_walls', result);
  return result;
}

// =============================================================================
// 4. СТЕКЛОПЛАСТИК СИДЕНИЙ (RETRO MOLDED FIBERGLASS RESIN)
// =============================================================================

export function getFiberglassTextures() {
  if (textureCache.has('fiberglass_seats')) return textureCache.get('fiberglass_seats');

  const size = 512;

  // --- 4.1 Normal Map (волокнистая текстура стекломата под смолой) ---
  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = size;
  normalCanvas.height = size;
  const nctx = normalCanvas.getContext('2d');
  nctx.fillStyle = 'rgb(128, 128, 255)';
  nctx.fillRect(0, 0, size, size);

  // Рисуем хаотичные волокна стеклоткани
  nctx.lineWidth = 1.5;
  for (let i = 0; i < 400; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const len = 12 + Math.random() * 24;
    const angle = Math.random() * Math.PI * 2;
    const dx = Math.cos(angle) * len;
    const dy = Math.sin(angle) * len;

    const nx = Math.round(128 + Math.cos(angle) * 25);
    const ny = Math.round(128 + Math.sin(angle) * 25);
    nctx.strokeStyle = `rgb(${nx}, ${ny}, 245)`;
    nctx.beginPath();
    nctx.moveTo(x, y);
    nctx.lineTo(x + dx, y + dy);
    nctx.stroke();
  }

  // --- 4.2 Roughness Map (глянцевый гелькоут с микропорами) ---
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rctx = roughCanvas.getContext('2d');
  rctx.fillStyle = 'rgb(70, 70, 70)'; // базовый глянец (0.27)
  rctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 600; i++) {
    const px = Math.random() * size;
    const py = Math.random() * size;
    const rad = 1 + Math.random() * 2.5;
    const val = Math.round(90 + Math.random() * 50);
    rctx.fillStyle = `rgba(${val}, ${val}, ${val}, 0.5)`;
    rctx.beginPath();
    rctx.arc(px, py, rad, 0, Math.PI * 2);
    rctx.fill();
  }

  const result = {
    normalMap: makeTexture(normalCanvas, 4, 4),
    roughnessMap: makeTexture(roughCanvas, 4, 4)
  };
  textureCache.set('fiberglass_seats', result);
  return result;
}

// =============================================================================
// 5. ТЕРМООБРАБОТАННЫЙ ГРАНИТ ПЛАТФОРМЫ (FLAMED GRANITE SLABS)
// =============================================================================

export function getPlatformGraniteTextures() {
  if (textureCache.has('platform_granite')) return textureCache.get('platform_granite');

  const size = 512;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cctx = colorCanvas.getContext('2d');
  cctx.fillStyle = '#22252c';
  cctx.fillRect(0, 0, size, size);

  // Кристаллическая гранитная зернистость
  const imgData = cctx.getImageData(0, 0, size, size);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const grain = (Math.random() - 0.5) * 28;
    d[i] = Math.max(0, Math.min(255, d[i] + grain));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + grain + 2));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + grain + 4));
  }
  cctx.putImageData(imgData, 0, 0);

  // Швы гранитных плит
  cctx.strokeStyle = '#121418';
  cctx.lineWidth = 2;
  cctx.strokeRect(0, 0, size, size);

  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = size;
  normalCanvas.height = size;
  const nctx = normalCanvas.getContext('2d');
  nctx.fillStyle = 'rgb(128, 128, 255)';
  nctx.fillRect(0, 0, size, size);

  const nData = nctx.getImageData(0, 0, size, size);
  const nd = nData.data;
  for (let i = 0; i < nd.length; i += 4) {
    const nx = (Math.random() - 0.5) * 16;
    const ny = (Math.random() - 0.5) * 16;
    nd[i] = Math.max(0, Math.min(255, 128 + nx));
    nd[i + 1] = Math.max(0, Math.min(255, 128 + ny));
    nd[i + 2] = 250;
  }
  nctx.putImageData(nData, 0, 0);

  const result = {
    colorMap: makeTexture(colorCanvas, 8, 3),
    normalMap: makeTexture(normalCanvas, 8, 3)
  };
  textureCache.set('platform_granite', result);
  return result;
}
