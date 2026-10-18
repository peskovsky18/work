/**
 * Генератор текстуры схемы линий метро для лайтбокса на станции
 * Создает детализированную векторную карту скоростного транспорта на Canvas 2048x1360
 */

export function createSubwayMapCanvas() {
  const width = 2048;
  const height = 1360;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // =========================================================================
  // 1. ФОН ЛАЙТБОКСА (ГЛУБОКИЙ ТЕМНЫЙ С ИНДУСТРИАЛЬНОЙ СЕТКОЙ)
  // =========================================================================
  const bgGrad = ctx.createRadialGradient(width / 2, height / 2 + 40, 150, width / 2, height / 2 + 40, 950);
  bgGrad.addColorStop(0, '#151a24');
  bgGrad.addColorStop(0.55, '#0e121a');
  bgGrad.addColorStop(1, '#080a0f');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Тонкая координатная сетка схемы
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.022)';
  ctx.lineWidth = 1;
  const gridSize = 64;
  for (let x = 0; x <= width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 120);
    ctx.lineTo(x, height - 100);
    ctx.stroke();
  }
  for (let y = 120; y <= height - 100; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // =========================================================================
  // 2. ВЕРХНИЙ ХЕДЕР И БРЕНДИНГ МЕТРО
  // =========================================================================
  ctx.fillStyle = '#0f141e';
  ctx.fillRect(0, 0, width, 120);

  // Красная полоса метро под хедером
  ctx.fillStyle = '#e42313';
  ctx.fillRect(0, 116, width, 4);

  // Логотип «М» в красном круге
  ctx.save();
  ctx.beginPath();
  ctx.arc(72, 60, 36, 0, Math.PI * 2);
  ctx.fillStyle = '#e42313';
  ctx.fill();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(52, 75);
  ctx.lineTo(62, 45);
  ctx.lineTo(72, 63);
  ctx.lineTo(82, 45);
  ctx.lineTo(92, 75);
  ctx.stroke();
  ctx.restore();

  // Заголовок схемы
  ctx.font = 'bold 34px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('СХЕМА ЛИНИЙ СКОРОСТНОГО ТРАНСПОРТА', 128, 56);

  ctx.font = '500 16px "JetBrains Mono", monospace, sans-serif';
  ctx.fillStyle = '#7e90a6';
  ctx.fillText('МОСКОВСКИЙ МЕТРОПОЛИТЕН • КАРТА СЕТИ 2026', 130, 88);

  // Правый плакат / статус станции
  ctx.save();
  const stationBadgeX = width - 480;
  ctx.fillStyle = 'rgba(228, 35, 19, 0.12)';
  ctx.strokeStyle = '#e42313';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(stationBadgeX, 30, 420, 60, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#e42313';
  ctx.beginPath();
  ctx.arc(stationBadgeX + 30, 60, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = 'bold 15px -apple-system, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('ТЕКУЩАЯ СТАНЦИЯ: ПЕСКОВСКАЯ', stationBadgeX + 52, 53);

  ctx.font = '12px "JetBrains Mono", monospace';
  ctx.fillStyle = '#a4b3c6';
  ctx.fillText('ВЫ НАХОДИТЕСЬ НА ЛИНИИ 5 (КОЛЬЦЕВАЯ)', stationBadgeX + 52, 74);
  ctx.restore();

  // =========================================================================
  // 3. РЕКА МОСКВА (ИЗЯЩНАЯ СИНЯЯ ИЗЛУЧИНА)
  // =========================================================================
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(180, 220);
  ctx.bezierCurveTo(450, 240, 560, 480, 680, 560);
  ctx.bezierCurveTo(800, 640, 880, 610, 940, 720);
  ctx.bezierCurveTo(1000, 830, 980, 960, 1120, 990);
  ctx.bezierCurveTo(1260, 1020, 1420, 820, 1600, 800);
  ctx.bezierCurveTo(1740, 780, 1860, 940, 2048, 980);

  // Внешний контур реки
  ctx.strokeStyle = '#12263d';
  ctx.lineWidth = 42;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Внутренняя чистая водная артерия
  ctx.strokeStyle = '#1a3c63';
  ctx.lineWidth = 26;
  ctx.stroke();

  // Подписи реки
  ctx.font = 'italic bold 13px -apple-system, sans-serif';
  ctx.fillStyle = '#456f9e';
  ctx.fillText('р. Москва', 440, 310);
  ctx.fillText('р. Москва', 1340, 940);
  ctx.restore();

  // Центр кольцевых линий
  const cx = 1040;
  const cy = 720;

  // =========================================================================
  // 4. КОЛЬЦЕВЫЕ ЛИНИИ
  // =========================================================================
  // 11: Большая Кольцевая Линия (Бирюзовая)
  const rBKL = 420;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, rBKL, 0, Math.PI * 2);
  ctx.strokeStyle = '#20b2aa';
  ctx.lineWidth = 14;
  ctx.stroke();

  // 14: Московское Центральное Кольцо (Пунктирное кольцо)
  const rMCC = 490;
  ctx.beginPath();
  ctx.arc(cx, cy, rMCC, 0, Math.PI * 2);
  ctx.strokeStyle = '#e60000';
  ctx.lineWidth = 6;
  ctx.setLineDash([16, 10]);
  ctx.stroke();
  ctx.setLineDash([]);

  // 5: Кольцевая Линия (Коричневая классика)
  const rRing = 210;
  ctx.beginPath();
  ctx.arc(cx, cy, rRing, 0, Math.PI * 2);
  ctx.strokeStyle = '#894e35';
  ctx.lineWidth = 15;
  ctx.stroke();
  ctx.restore();

  // =========================================================================
  // 5. РАДИАЛЬНЫЕ ЛИНИИ МЕТРО
  // =========================================================================
  const lines = [
    // Линия 1: Сокольническая (Красная)
    {
      color: '#e42313', width: 13,
      path: [[380, 1260], [680, 1000], [cx - 60, cy + 50], [cx + 50, cy - 60], [1380, 440], [1720, 190]]
    },
    // Линия 2: Замоскворецкая (Зеленая)
    {
      color: '#2db343', width: 13,
      path: [[680, 180], [860, 420], [cx - 40, cy - 80], [cx + 20, cy + 120], [1220, 1020], [1360, 1280]]
    },
    // Линия 3: Арбатско-Покровская (Синяя)
    {
      color: '#0078bf', width: 13,
      path: [[180, 780], [540, 780], [840, 750], [cx - 30, cy], [1260, 680], [1560, 680], [1880, 520]]
    },
    // Линия 4: Филевская (Голубая)
    {
      color: '#00bfff', width: 10,
      path: [[180, 660], [520, 660], [780, 710], [cx - 100, cy + 10]]
    },
    // Линия 6: Калужско-Рижская (Оранжевая)
    {
      color: '#f38230', width: 13,
      path: [[1220, 180], [1160, 480], [cx + 40, cy - 40], [cx - 30, cy + 90], [820, 1060], [680, 1280]]
    },
    // Линия 7: Таганско-Краснопресненская (Фиолетовая)
    {
      color: '#8e44ad', width: 13,
      path: [[460, 320], [760, 560], [cx - 70, cy - 20], [cx + 70, cy + 40], [1360, 920], [1740, 1180]]
    },
    // Линия 8: Калининско-Солнцевская (Желтая)
    {
      color: '#ffcc00', width: 12,
      path: [[cx + 80, cy + 10], [1340, 720], [1620, 720], [1880, 740]]
    },
    // Линия 9: Серпуховско-Тимирязевская (Серая)
    {
      color: '#9e9e9e', width: 12,
      path: [[960, 180], [960, cy - 60], [960, cy + 80], [960, 1280]]
    },
    // Линия 10: Люблинско-Дмитровская (Салатовая)
    {
      color: '#99cc00', width: 12,
      path: [[1360, 180], [1280, 460], [cx + 120, cy + 60], [1460, 1020], [1560, 1260]]
    }
  ];

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  lines.forEach(l => {
    ctx.strokeStyle = l.color;
    ctx.lineWidth = l.width;
    ctx.beginPath();
    l.path.forEach((pt, i) => {
      if (i === 0) ctx.moveTo(pt[0], pt[1]);
      else ctx.lineTo(pt[0], pt[1]);
    });
    ctx.stroke();
  });
  ctx.restore();

  // =========================================================================
  // 6. СТАНЦИИ И УЗЛЫ ПЕРЕСАДОК
  // =========================================================================
  // Вспомогательная функция рисования обычной станции
  function drawStation(x, y, name, align = 'left', dy = 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#000000';
    ctx.stroke();

    if (name) {
      ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = '#e2e8f2';
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = 4;
      ctx.textAlign = align;
      const tx = align === 'left' ? x + 10 : (align === 'right' ? x - 10 : x);
      const ty = y + (dy || 4);
      ctx.fillText(name, tx, ty);
    }
    ctx.restore();
  }

  // Вспомогательная функция рисования пересадочного узла (двойной/тройной контур)
  function drawInterchange(x, y, name, align = 'left', dy = -14) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#11151c';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#11151c';
    ctx.fill();

    if (name) {
      ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.95)';
      ctx.shadowBlur = 5;
      ctx.textAlign = align;
      const tx = align === 'left' ? x + 14 : (align === 'right' ? x - 14 : x);
      ctx.fillText(name, tx, y + dy);
    }
    ctx.restore();
  }

  // Пересадки на кольцевой линии
  const ringNodes = [
    { angle: -Math.PI / 2, name: 'Проспект Мира', align: 'center', dy: -16 },
    { angle: -Math.PI / 4, name: 'Комсомольская', align: 'left', dy: -12 },
    { angle: 0,            name: 'Курская', align: 'left', dy: 4 },
    { angle: Math.PI / 4,  name: 'Таганская', align: 'left', dy: 16 },
    { angle: Math.PI / 2,  name: 'Павелецкая', align: 'center', dy: 22 },
    { angle: 3 * Math.PI / 4, name: 'Добрынинская', align: 'right', dy: 16 },
    { angle: Math.PI,      name: 'Парк Культуры', align: 'right', dy: 4 },
    { angle: -3 * Math.PI / 4, name: 'Киевская', align: 'right', dy: -10 },
    { angle: -5 * Math.PI / 8, name: 'Краснопресненская', align: 'right', dy: -14 },
    { angle: -3 * Math.PI / 8, name: 'Белорусская', align: 'left', dy: -16 }
  ];

  ringNodes.forEach(node => {
    const nx = cx + rRing * Math.cos(node.angle);
    const ny = cy + rRing * Math.sin(node.angle);
    drawInterchange(nx, ny, node.name, node.align, node.dy);
  });

  // Узлы в центре города
  drawInterchange(cx - 35, cy - 25, 'Охотный Ряд', 'right', -8);
  drawInterchange(cx + 10, cy - 15, 'Театральная', 'left', -8);
  drawInterchange(cx + 35, cy + 15, 'Площадь Революции', 'left', 18);
  drawInterchange(cx - 75, cy + 15, 'Арбатская', 'right', 18);
  drawInterchange(cx + 80, cy + 50, 'Китай-Город', 'left', 6);
  drawInterchange(cx - 45, cy - 90, 'Тверская / Пушкинская', 'right', -12);

  // Радиальные станции (примеры для реализма)
  drawStation(1520, 310, 'Сокольники', 'left');
  drawStation(1640, 230, 'Преображенская пл.', 'left');
  drawStation(560, 1120, 'Университет', 'right');
  drawStation(460, 1200, 'Юго-Западная', 'right');
  drawStation(750, 320, 'Динамо / ВТБ Арена', 'left');
  drawStation(800, 240, 'Аэропорт', 'left');
  drawStation(1300, 1140, 'Царицыно', 'left');
  drawStation(1680, 680, 'Первомайская', 'left');
  drawStation(400, 780, 'Славянский Бульвар', 'right');
  drawStation(1520, 1020, 'Текстильщики', 'left');
  drawStation(1640, 1100, 'Кузьминки', 'left');

  // Станции Большой Кольцевой Линии (БКЛ)
  const bklAngles = [0, Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4, Math.PI, -3 * Math.PI / 4, -Math.PI / 2, -Math.PI / 4];
  bklAngles.forEach(a => {
    const bx = cx + rBKL * Math.cos(a);
    const by = cy + rBKL * Math.sin(a);
    drawStation(bx, by);
  });

  // =========================================================================
  // 7. ОСОБЫЙ МАРКЕР «ВЫ ЗДЕСЬ / YOU ARE HERE: ПЕСКОВСКАЯ»
  // =========================================================================
  // Помещаем станцию «Песковская» на западном пересадочном секторе (Киевская / Песковская)
  const heroX = cx - rRing * 0.92;
  const heroY = cy - 40;

  ctx.save();
  // Внешний ореол подсветки
  const glowGrad = ctx.createRadialGradient(heroX, heroY, 6, heroX, heroY, 60);
  glowGrad.addColorStop(0, 'rgba(255, 30, 45, 0.7)');
  glowGrad.addColorStop(0.4, 'rgba(255, 30, 45, 0.25)');
  glowGrad.addColorStop(1, 'rgba(255, 30, 45, 0)');
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(heroX, heroY, 60, 0, Math.PI * 2);
  ctx.fill();

  // Пульсирующие концентрические кольца
  ctx.strokeStyle = '#ff3344';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(heroX, heroY, 26, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(heroX, heroY, 15, 0, Math.PI * 2);
  ctx.stroke();

  // Центр точки
  ctx.fillStyle = '#ff1a2a';
  ctx.beginPath();
  ctx.arc(heroX, heroY, 8, 0, Math.PI * 2);
  ctx.fill();

  // Фирменная выносная плашка «ВЫ ЗДЕСЬ»
  const badgeW = 290;
  const badgeH = 74;
  const badgeX = heroX - badgeW - 32;
  const badgeY = heroY - badgeH / 2;

  // Тень плашки
  ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 6;

  // Фон плашки
  ctx.fillStyle = '#e42313';
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 12);
  ctx.fill();

  // Стрелка-указатель от плашки к точке станции
  ctx.beginPath();
  ctx.moveTo(badgeX + badgeW, heroY - 10);
  ctx.lineTo(heroX - 16, heroY);
  ctx.lineTo(badgeX + badgeW, heroY + 10);
  ctx.closePath();
  ctx.fill();

  // Текст плашки
  ctx.shadowColor = 'transparent';
  ctx.font = 'bold 12px "JetBrains Mono", monospace';
  ctx.fillStyle = '#ffe5e5';
  ctx.fillText('📍 ВЫ ЗДЕСЬ • YOU ARE HERE', badgeX + 18, badgeY + 28);

  ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('СТ. ПЕСКОВСКАЯ', badgeX + 18, badgeY + 54);
  ctx.restore();

  // =========================================================================
  // 8. НИЖНЯЯ ПАНЕЛЬ ЛЕГЕНДЫ И ПРАВИЛ ПРОЕЗДА
  // =========================================================================
  // Левая плашка: Легенда линий
  ctx.save();
  const legX = 60;
  const legY = height - 190;
  const legW = 620;
  const legH = 140;

  ctx.fillStyle = 'rgba(12, 16, 24, 0.92)';
  ctx.strokeStyle = '#222938';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(legX, legY, legW, legH, 10);
  ctx.fill();
  ctx.stroke();

  ctx.font = 'bold 14px -apple-system, sans-serif';
  ctx.fillStyle = '#8e9eaf';
  ctx.fillText('ЛИНИИ МОСКОВСКОГО МЕТРОПОЛИТЕНА', legX + 20, legY + 28);

  const legendItems = [
    { num: '1', name: 'Сокольническая', color: '#e42313', col: 0, row: 0 },
    { num: '2', name: 'Замоскворецкая', color: '#2db343', col: 1, row: 0 },
    { num: '3', name: 'Арбатско-Покров.', color: '#0078bf', col: 2, row: 0 },
    { num: '5', name: 'Кольцевая', color: '#894e35', col: 0, row: 1 },
    { num: '7', name: 'Таганско-Красн.', color: '#8e44ad', col: 1, row: 1 },
    { num: '11', name: 'Большая Кольцевая', color: '#20b2aa', col: 2, row: 1 }
  ];

  legendItems.forEach(item => {
    const ix = legX + 20 + item.col * 195;
    const iy = legY + 58 + item.row * 36;

    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.arc(ix + 10, iy - 4, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = 'bold 11px -apple-system, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(item.num, ix + 10, iy);

    ctx.textAlign = 'left';
    ctx.font = '500 12px -apple-system, sans-serif';
    ctx.fillStyle = '#d4dbe4';
    ctx.fillText(item.name, ix + 28, iy);
  });
  ctx.restore();

  // Правая плашка: Информация для пассажиров
  ctx.save();
  const infoW = 540;
  const infoH = 140;
  const infoX = width - infoW - 60;
  const infoY = height - 190;

  ctx.fillStyle = 'rgba(12, 16, 24, 0.92)';
  ctx.strokeStyle = '#222938';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(infoX, infoY, infoW, infoH, 10);
  ctx.fill();
  ctx.stroke();

  ctx.font = 'bold 14px -apple-system, sans-serif';
  ctx.fillStyle = '#8e9eaf';
  ctx.fillText('ИНФОРМАЦИЯ И БЕЗОПАСНОСТЬ В ПОЕЗДЕ', infoX + 20, infoY + 28);

  ctx.font = '12px -apple-system, sans-serif';
  ctx.fillStyle = '#c0cad8';
  ctx.fillText('• Не прислоняйтесь к дверям вагона во время движения', infoX + 20, infoY + 58);
  ctx.fillText('• Экстренная связь с машинистом — кнопка переговорного устройства', infoX + 20, infoY + 84);
  ctx.fillText('• Единый контакт-центр «Московский транспорт»: 3210 (с мобильного)', infoX + 20, infoY + 110);
  ctx.restore();

  // =========================================================================
  // 9. ВНЕШНЯЯ КРОМКА ЛАЙТБОКСА
  // =========================================================================
  ctx.strokeStyle = '#2d3748';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, width - 6, height - 6);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 2;
  ctx.strokeRect(8, 8, width - 16, height - 16);

  return canvas;
}

/**
 * Создает Three.js CanvasTexture с правильными цветовыми параметрами
 */
let cachedMapTexture = null;

export function getSubwayMapTexture(THREE) {
  if (cachedMapTexture) return cachedMapTexture;

  const canvas = createSubwayMapCanvas();
  cachedMapTexture = new THREE.CanvasTexture(canvas);
  cachedMapTexture.colorSpace = THREE.SRGBColorSpace;
  cachedMapTexture.flipY = true;
  cachedMapTexture.generateMipmaps = true;
  cachedMapTexture.minFilter = THREE.LinearMipmapLinearFilter;
  cachedMapTexture.magFilter = THREE.LinearFilter;
  cachedMapTexture.anisotropy = 4;

  return cachedMapTexture;
}

/**
 * Генератор текстуры предупреждающей надписи на стекло дверей «Не прислоняться» (чистый текст)
 */
let cachedNoLeanTexture = null;

export function getNoLeanDecalTexture(THREE) {
  if (cachedNoLeanTexture) return cachedNoLeanTexture;

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, 1024, 256);

  // Классическая белая надпись трафаретом прямо на стекле по образцу Ильи Бирмана
  // (только чистый белый текст, без плашек, рамок, значков и дублирования)
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 92px "Space Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  // Деликатная полупрозрачная тень для читаемости белой краски на фоне света станции
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;

  // Текст: аутентичный советский/московский трафарет на дверях метро
  ctx.fillText('НЕ ПРИСЛОНЯТЬСЯ', 512, 128);
  ctx.restore();

  cachedNoLeanTexture = new THREE.CanvasTexture(canvas);
  cachedNoLeanTexture.colorSpace = THREE.SRGBColorSpace;
  cachedNoLeanTexture.flipY = false;
  cachedNoLeanTexture.generateMipmaps = true;

  return cachedNoLeanTexture;
}

const placeholderCache = {};
export function getPlaceholderScreenTexture(THREE, numStr, titleStr) {
  const key = `${numStr}_${titleStr}`;
  if (placeholderCache[key]) return placeholderCache[key];
  const cvs = document.createElement('canvas');
  cvs.width = 1920; cvs.height = 1080;
  const ctx = cvs.getContext('2d');
  const bg = ctx.createRadialGradient(960, 540, 200, 960, 540, 1000);
  bg.addColorStop(0, '#10131a'); bg.addColorStop(0.6, '#090b0f'); bg.addColorStop(1, '#050608');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 1920, 1080);
  // Grid & frame marks
  ctx.strokeStyle = 'rgba(255,255,255,0.025)'; ctx.lineWidth = 1;
  for (let x = 0; x <= 1920; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1080); ctx.stroke(); }
  for (let y = 0; y <= 1080; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1920, y); ctx.stroke(); }
  const p = 80, m = 35; ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2;
  ctx.strokeRect(p, p, m, m); ctx.strokeRect(1920 - p - m, p, m, m);
  ctx.strokeRect(p, 1080 - p - m, m, m); ctx.strokeRect(1920 - p - m, 1080 - p - m, m, m);
  // Status & Title
  ctx.fillStyle = 'rgba(245, 166, 35, 0.85)'; ctx.beginPath(); ctx.arc(p + 15, p + 20, 6, 0, Math.PI * 2); ctx.fill();
  ctx.font = '600 22px "JetBrains Mono", monospace'; ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillText('STANDBY // 16:9 4K', p + 32, p + 28);
  ctx.font = '800 240px "Space Grotesk", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.035)'; ctx.fillText(numStr, 960, 520);
  ctx.font = '700 52px "Space Grotesk", sans-serif'; ctx.fillStyle = '#ffffff'; ctx.fillText(titleStr, 960, 500);
  ctx.font = '500 22px "JetBrains Mono", monospace'; ctx.fillStyle = 'rgba(142,149,165,0.85)'; ctx.fillText('В РАЗРАБОТКЕ • СКОРО В ПОРТФОЛИО', 960, 570);
  const tex = new THREE.CanvasTexture(cvs);
  tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = false; tex.generateMipmaps = true;
  placeholderCache[key] = tex;
  return tex;
}

/**
 * Генератор текстуры подвесного светящегося указателя станции 2 (Контакты)
 */
let cachedStationSignTex = null;
export function getStationSignTexture(THREE) {
  if (cachedStationSignTex) return cachedStationSignTex;

  const cvs = document.createElement('canvas');
  cvs.width = 1200;
  cvs.height = 300;
  const ctx = cvs.getContext('2d');

  // Глубокий темный фон лайтбокса
  ctx.fillStyle = '#0a0d13';
  ctx.fillRect(0, 0, 1200, 300);

  // Верхняя полоса акцентной линии метро
  ctx.fillStyle = '#f5a623';
  ctx.fillRect(0, 0, 1200, 10);

  // Логотип «М»
  ctx.save();
  ctx.beginPath();
  ctx.arc(80, 150, 42, 0, Math.PI * 2);
  ctx.fillStyle = '#e42313';
  ctx.fill();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(56, 168);
  ctx.lineTo(68, 132);
  ctx.lineTo(80, 154);
  ctx.lineTo(92, 132);
  ctx.lineTo(104, 168);
  ctx.stroke();
  ctx.restore();

  // Основной заголовок станции
  ctx.font = '800 52px "Space Grotesk", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('СТАНЦИЯ ПЕСКОВСКАЯ', 156, 138);

  // Подзаголовок: выход в город и пересадки
  ctx.font = '600 24px "JetBrains Mono", monospace';
  ctx.fillStyle = '#8e95a5';
  ctx.fillText('ВЫХОД В ГОРОД // ПОРТФОЛИО 2026 // WAY OUT ↗', 158, 185);

  // Правая стрелка и пиктограмма
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, 1180, 280);

  cachedStationSignTex = new THREE.CanvasTexture(cvs);
  cachedStationSignTex.colorSpace = THREE.SRGBColorSpace;
  cachedStationSignTex.flipY = true;
  cachedStationSignTex.generateMipmaps = true;
  return cachedStationSignTex;
}

/**
 * Генератор аутентичной эмалированной таблички с названием станции на путевой стене («СТАНЦИЯ ПЕСКОВСКАЯ»)
 */
let cachedTrackWallSignTex = null;
export function getTrackWallSignTexture(THREE) {
  if (cachedTrackWallSignTex) return cachedTrackWallSignTex;

  const cvs = document.createElement('canvas');
  cvs.width = 1600;
  cvs.height = 360;
  const ctx = cvs.getContext('2d');

  // Литая латунная основа таблички с фаской
  const plateGrad = ctx.createLinearGradient(0, 0, 0, 360);
  plateGrad.addColorStop(0, '#1c1f26');
  plateGrad.addColorStop(0.5, '#121419');
  plateGrad.addColorStop(1, '#0b0c10');
  ctx.fillStyle = plateGrad;
  ctx.fillRect(0, 0, 1600, 360);

  // Латунная рамка по периметру
  ctx.strokeStyle = '#c9933b';
  ctx.lineWidth = 10;
  ctx.strokeRect(16, 16, 1568, 328);

  ctx.strokeStyle = '#845d1e';
  ctx.lineWidth = 2;
  ctx.strokeRect(26, 26, 1548, 308);

  // Латунные заклепки / болты по углам и краям
  const bolts = [
    [40, 40], [1560, 40], [40, 320], [1560, 320],
    [800, 24], [800, 336]
  ];
  bolts.forEach(([bx, by]) => {
    ctx.beginPath();
    ctx.arc(bx, by, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#dfab48';
    ctx.fill();
    ctx.strokeStyle = '#5a3d0b';
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  // Эмблема метро «М» в латунном круге по центру сверху
  ctx.save();
  ctx.translate(800, 75);
  ctx.fillStyle = '#e42313';
  ctx.beginPath();
  ctx.arc(0, 0, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f5c862';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-12, 11);
  ctx.lineTo(-6, -11);
  ctx.lineTo(0, 3);
  ctx.lineTo(6, -11);
  ctx.lineTo(12, 11);
  ctx.stroke();
  ctx.restore();

  // Основное название станции: «ПЕСКОВСКАЯ»
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Рельефная тень букв
  ctx.font = '900 86px "Cinzel", "Georgia", "Times New Roman", serif';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.fillText('П Е С К О В С К А Я', 803, 198);

  // Золотые буквы с легким градиентом
  const textGrad = ctx.createLinearGradient(0, 140, 0, 240);
  textGrad.addColorStop(0, '#fff4d6');
  textGrad.addColorStop(0.4, '#f5c862');
  textGrad.addColorStop(0.8, '#d49b2f');
  textGrad.addColorStop(1, '#9e6d15');
  ctx.fillStyle = textGrad;
  ctx.fillText('П Е С К О В С К А Я', 800, 195);

  // Тонкий контур вокруг букв
  ctx.strokeStyle = '#422c06';
  ctx.lineWidth = 1.5;
  ctx.strokeText('П Е С К О В С К А Я', 800, 195);

  // Подзаголовок латиницей и дата
  ctx.font = '600 24px "Space Grotesk", sans-serif';
  ctx.letterSpacing = '6px';
  ctx.fillStyle = '#a6b0c2';
  ctx.fillText('СТАНЦИЯ ОТКРЫТА В 2026 ГОДУ • PESKOVSKAYA STATION', 800, 275);

  cachedTrackWallSignTex = new THREE.CanvasTexture(cvs);
  cachedTrackWallSignTex.colorSpace = THREE.SRGBColorSpace;
  cachedTrackWallSignTex.flipY = true;
  cachedTrackWallSignTex.generateMipmaps = true;
  return cachedTrackWallSignTex;
}



