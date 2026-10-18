/**
 * Александр Песковский — 2026
 * Фотореалистичные PBR-материалы вагона метро на основе реальной фотографии:
 * - Стены: аутентичная сатинированная сталь с круговыми рисками протирки и текстурой проката
 * - Двери: шлифованная сталь створок с отражениями
 * - Сиденья: точные винтажные стеклопластиковые ковши (горчично-желтый и тыквенно-оранжевый)
 * - Пол: фактурный матовый линолеум вагона
 * - Решетка: оригинальная перфорированная вентиляционная решетка под сиденьями
 * - Плитка станции: глянцевый белый «кабанчик» с фасками и рельефной цементной затиркой
 * - Гранит платформы: термообработанные плиты с микрозернистостью
 */

import * as THREE from 'three';

const textureLoader = new THREE.TextureLoader();
const textureCache = new Map();

/**
 * Загрузка PBR-карты с настройкой бесшовного тайлинга и трилинейной фильтрации
 */
function loadPBR(path, repeatX = 1, repeatY = 1) {
  const cacheKey = `${path}_${repeatX}_${repeatY}`;
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey);

  const tex = textureLoader.load(path);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 16;

  textureCache.set(cacheKey, tex);
  return tex;
}

// =============================================================================
// 1. АУТЕНТИЧНЫЕ СТЕНЫ ВАГОНА (РЕАЛЬНОЕ ФОТО: ШЛИФОВАННАЯ СТАЛЬ С РИСКАМИ)
// =============================================================================

export function getPhotoWallTextures() {
  return {
    colorMap: loadPBR('assets/textures/pbr_wall_steel_color.png', 4, 2),
    normalMap: loadPBR('assets/textures/pbr_wall_steel_normal.png', 4, 2),
    roughnessMap: loadPBR('assets/textures/pbr_wall_steel_roughness.png', 4, 2)
  };
}

export function getPhotoDoorTextures() {
  return {
    colorMap: loadPBR('assets/textures/pbr_door_steel_color.png', 1, 1),
    normalMap: loadPBR('assets/textures/pbr_door_steel_normal.png', 1, 1),
    roughnessMap: loadPBR('assets/textures/pbr_door_steel_roughness.png', 1, 1)
  };
}

// =============================================================================
// 2. АУТЕНТИЧНЫЙ ПОЛ ВАГОНА (РЕАЛЬНОЕ ФОТО: ТЕМНЫЙ ЛИНОЛЕУМ)
// =============================================================================

export function getPhotoFloorTextures() {
  return {
    colorMap: loadPBR('assets/textures/pbr_floor_color.png', 8, 4),
    normalMap: loadPBR('assets/textures/pbr_floor_normal.png', 8, 4),
    roughnessMap: loadPBR('assets/textures/pbr_floor_roughness.png', 8, 4)
  };
}

// =============================================================================
// 3. АУТЕНТИЧНЫЕ КРЕСЛА (РЕАЛЬНОЕ ФОТО: ЖЕЛТЫЙ И ОРАНЖЕВЫЙ СТЕКЛОПЛАСТИК)
// =============================================================================

export function getPhotoSeatYellowTextures() {
  return {
    colorMap: loadPBR('assets/textures/pbr_seat_yellow_color.png', 1, 1),
    normalMap: loadPBR('assets/textures/pbr_seat_yellow_normal.png', 1, 1),
    roughnessMap: loadPBR('assets/textures/pbr_seat_yellow_roughness.png', 1, 1)
  };
}

export function getPhotoSeatOrangeTextures() {
  return {
    colorMap: loadPBR('assets/textures/pbr_seat_orange_color.png', 1, 1),
    normalMap: loadPBR('assets/textures/pbr_seat_orange_normal.png', 1, 1),
    roughnessMap: loadPBR('assets/textures/pbr_seat_orange_roughness.png', 1, 1)
  };
}

export function getPhotoVentGrilleTexture() {
  return loadPBR('assets/textures/pbr_vent_grille_color.png', 2, 1);
}

export function getPhotoCeilingLightTexture() {
  return loadPBR('assets/textures/pbr_ceiling_light_diffuser.png', 1, 1);
}

// =============================================================================
// 4. ГЛАЗУРОВАННАЯ КЕРАМИЧЕСКАЯ ПЛИТКА СТАНЦИИ («КАБАНЧИК»)
// =============================================================================

export function getStationTileTextures() {
  if (textureCache.has('station_tiles_pbr')) return textureCache.get('station_tiles_pbr');

  const size = 512;
  const tileCols = 4;
  const tileRows = 8;
  const tileW = size / tileCols;
  const tileH = size / tileRows;
  const bevel = 6;
  const grout = 3;

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cctx = colorCanvas.getContext('2d');
  cctx.fillStyle = '#b0b6c0';
  cctx.fillRect(0, 0, size, size);

  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = size;
  normalCanvas.height = size;
  const nctx = normalCanvas.getContext('2d');
  nctx.fillStyle = 'rgb(128, 128, 255)';
  nctx.fillRect(0, 0, size, size);

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rctx = roughCanvas.getContext('2d');
  rctx.fillStyle = 'rgb(220, 220, 220)';
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

      const grad = cctx.createLinearGradient(tx, ty, tx + tw, ty + th);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.5, '#f4f6fa');
      grad.addColorStop(1, '#eaedf4');
      cctx.fillStyle = grad;
      cctx.fillRect(tx, ty, tw, th);

      rctx.fillStyle = 'rgb(22, 22, 22)'; // глянцевая керамическая глазурь (roughness 0.09)
      rctx.fillRect(tx + bevel, ty + bevel, tw - bevel * 2, th - bevel * 2);

      rctx.fillStyle = 'rgb(50, 50, 50)';
      rctx.fillRect(tx, ty, tw, bevel);
      rctx.fillRect(tx, ty + th - bevel, tw, bevel);
      rctx.fillRect(tx, ty, bevel, th);
      rctx.fillRect(tx + tw - bevel, ty, bevel, th);

      nctx.fillStyle = 'rgb(128, 65, 240)';
      nctx.fillRect(tx, ty, tw, bevel);
      nctx.fillStyle = 'rgb(128, 195, 240)';
      nctx.fillRect(tx, ty + th - bevel, tw, bevel);
      nctx.fillStyle = 'rgb(65, 128, 240)';
      nctx.fillRect(tx, ty, bevel, th);
      nctx.fillStyle = 'rgb(195, 128, 240)';
      nctx.fillRect(tx + tw - bevel, ty, bevel, th);

      nctx.fillStyle = 'rgb(128, 128, 255)';
      nctx.fillRect(tx + bevel, ty + bevel, tw - bevel * 2, th - bevel * 2);
    }
  }

  const makeTex = (canvas, rx, ry) => {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    return t;
  };

  const result = {
    colorMap: makeTex(colorCanvas, 8, 4),
    normalMap: makeTex(normalCanvas, 8, 4),
    roughnessMap: makeTex(roughCanvas, 8, 4)
  };
  textureCache.set('station_tiles_pbr', result);
  return result;
}

// =============================================================================
// 5. ТЕРМООБРАБОТАННЫЙ ГРАНИТ ПЛАТФОРМЫ
// =============================================================================

export function getPlatformGraniteTextures() {
  if (textureCache.has('platform_granite_pbr')) return textureCache.get('platform_granite_pbr');

  const size = 512;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cctx = colorCanvas.getContext('2d');
  cctx.fillStyle = '#22252c';
  cctx.fillRect(0, 0, size, size);

  const imgData = cctx.getImageData(0, 0, size, size);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const grain = (Math.random() - 0.5) * 28;
    d[i] = Math.max(0, Math.min(255, d[i] + grain));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + grain + 2));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + grain + 4));
  }
  cctx.putImageData(imgData, 0, 0);

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

  const makeTex = (canvas, rx, ry) => {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    return t;
  };

  const result = {
    colorMap: makeTex(colorCanvas, 8, 3),
    normalMap: makeTex(normalCanvas, 8, 3)
  };
  textureCache.set('platform_granite_pbr', result);
  return result;
}
