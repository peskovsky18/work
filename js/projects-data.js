/**
 * Александр Песковский — Разнорабочий в медиа
 * База данных проектов (Год: 2026)
 */

const PROFILE_DATA = {
  name: "Александр Песковский",
  role: "Разнорабочий в медиа",
  tagline: "Видео • Фото • Монтаж • Веб",
  year: "2026",
  contacts: {
    email: "peskovsky18@gmail.com",
    instagram: "https://instagram.com/peskovsky18",
    instagramHandle: "@peskovsky18"
  }
};

const PROJECTS = [
  {
    id: 1,
    title: "Имиджевый ролик «Concrete Lab»",
    category: "video",
    categoryLabel: "Видео",
    year: "2026",
    client: "Concrete Lab",
    role: "Режиссер, оператор, колорист",
    description: "Рекламный ролик в индустриальном цеху. Ручная камера, макропланы фактуры бетона, естественный контрастный свет.",
    specs: {
      camera: "BMPCC 6K Pro",
      format: "4K DCI • BRAW 5:1",
      lens: "DZOFilm Vespid 35mm T2.1",
      post: "DaVinci Resolve Studio"
    },
    tools: ["BMPCC 6K Pro", "DaVinci Resolve", "DZOFilm"],
    mediaType: "youtube",
    mediaUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    thumbnail: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=1600&auto=format&fit=crop&q=85",
    tags: ["Видео", "Реклама", "4K DCI"]
  },
  {
    id: 2,
    title: "Фотосерия «Ночные окраины»",
    category: "photo",
    categoryLabel: "Фото",
    year: "2026",
    client: "Персональный проект",
    role: "Фотограф",
    description: "Аналоговая серия на среднеформатную черно-белую пленку. Геометрия архитектуры спальных районов и свет уличных фонарей.",
    specs: {
      camera: "Mamiya RB67 Pro-S",
      format: "6×7 Medium Format",
      film: "Ilford HP5 Plus @ 800",
      lens: "Sekor C 90mm f/3.8"
    },
    tools: ["Mamiya RB67", "Ilford HP5+", "Darkroom"],
    mediaType: "image",
    mediaUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=1600&auto=format&fit=crop&q=85",
    thumbnail: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=1600&auto=format&fit=crop&q=85",
    gallery: [
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=1600&auto=format&fit=crop&q=85",
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1600&auto=format&fit=crop&q=85",
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1600&auto=format&fit=crop&q=85",
      "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=1600&auto=format&fit=crop&q=85"
    ],
    tags: ["Фото", "Пленка 120", "Ч/Б"]
  },
  {
    id: 3,
    title: "Клип «Стены и Эхо»",
    category: "montage",
    categoryLabel: "Монтаж",
    year: "2026",
    client: "Стены и Эхо",
    role: "Режиссер монтажа, саунд-дизайн",
    description: "Монтаж музыкального видео. Ритмическая сборка по биту ударных, аналоговые глитч-эффекты и многослойный саунд-дизайн шумов.",
    specs: {
      software: "Premiere Pro • After Effects",
      timeline: "24 fps • Sound 48kHz / 24-bit",
      source: "Multi-cam 6 sources",
      color: "Film Print Emulation"
    },
    tools: ["Premiere Pro", "After Effects", "Ableton"],
    mediaType: "youtube",
    mediaUrl: "https://www.youtube-nocookie.com/embed/kJQP7kiw5Fk",
    thumbnail: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1600&auto=format&fit=crop&q=85",
    tags: ["Монтаж", "Музыкальное видео", "Саунд"]
  },
  {
    id: 4,
    title: "Веб-архив звуков города",
    category: "web",
    categoryLabel: "Веб",
    year: "2026",
    client: "Музей звуковой археологии",
    role: "Креативный директор, UI/UX",
    description: "Концепция и визуальное руководство интерактивного аудио-визуального архива. Интуитивная пространственная навигация.",
    specs: {
      role: "Creative Direction & UX",
      stack: "Web Audio API • Three.js",
      typography: "Grotesk & Monospace",
      grid: "Swiss 12-Column Responsive"
    },
    tools: ["Creative Direction", "Figma", "Spatial UI"],
    mediaType: "web",
    mediaUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1600&auto=format&fit=crop&q=85",
    thumbnail: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1600&auto=format&fit=crop&q=85",
    externalLink: "https://github.com/peskovsky18/work",
    tags: ["Веб", "Арт-дирекшн", "Интерактив"]
  },
  {
    id: 5,
    title: "Документальный проект «Ремесло»",
    category: "video",
    categoryLabel: "Видео",
    year: "2026",
    client: "Культурный фонд",
    role: "Оператор-постановщик, монтажер",
    description: "Серия наблюдений за работой мастеров ручного труда. Живой синхронный звук, глубокие тени и минимальное вмешательство в сцену.",
    specs: {
      camera: "Sony FX3 Cinema Line",
      profile: "S-Log3 / S-Gamut3.Cine",
      audio: "Sennheiser MKH 416",
      lens: "Carl Zeiss Planar 50mm T* 1.4"
    },
    tools: ["Sony FX3", "Zeiss Planar", "DaVinci"],
    mediaType: "youtube",
    mediaUrl: "https://www.youtube-nocookie.com/embed/ScMzIvxBSi4",
    thumbnail: "https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?w=1600&auto=format&fit=crop&q=85",
    tags: ["Видео", "Док", "Кинооптика"]
  },
  {
    id: 6,
    title: "Съемка коллекции «Сталь»",
    category: "photo",
    categoryLabel: "Фото",
    year: "2026",
    client: "R&S Clothing",
    role: "Фотограф, сет-дизайн",
    description: "Каталожная и лукбук съемка в индустриальном пространстве. Жесткий направленный импульсный свет и строгая композиция.",
    specs: {
      camera: "Nikon Z7 II (45.7 MP)",
      lens: "Nikkor Z 50mm f/1.2 S",
      lighting: "Godox AD300 Pro • Hard Reflector",
      raw: "Capture One Pro"
    },
    tools: ["Nikon Z7 II", "Nikkor 50mm", "Capture One"],
    mediaType: "image",
    mediaUrl: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1600&auto=format&fit=crop&q=85",
    thumbnail: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1600&auto=format&fit=crop&q=85",
    gallery: [
      "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1600&auto=format&fit=crop&q=85",
      "https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?w=1600&auto=format&fit=crop&q=85",
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1600&auto=format&fit=crop&q=85"
    ],
    tags: ["Фото", "Лукбук", "Studio"]
  },
  {
    id: 7,
    title: "Многокамерный пост-продакшн авто-шоу",
    category: "montage",
    categoryLabel: "Монтаж",
    year: "2026",
    client: "YouTube-медиа",
    role: "Монтаж, клинап, графическая упаковка",
    description: "Сборка сложного 8-камерного выпуска с таймкодом. Цветокоррекция, очистка звуковых дорожек и динамичная инфографика.",
    specs: {
      software: "Premiere Pro Multi-Cam",
      cameras: "8 synchronized angles",
      grade: "ACEScc Color Workflow",
      vfx: "After Effects Tracking"
    },
    tools: ["Premiere Pro", "After Effects", "ACES"],
    mediaType: "youtube",
    mediaUrl: "https://www.youtube-nocookie.com/embed/9bZkp7q19f0",
    thumbnail: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1600&auto=format&fit=crop&q=85",
    tags: ["Монтаж", "Мультикам", "VFX"]
  },
  {
    id: 8,
    title: "Айдентика и цифровая платформа «Цех»",
    category: "web",
    categoryLabel: "Веб",
    year: "2026",
    client: "Медиа «Цех»",
    role: "Креативный директор",
    description: "Разработка целостной визуальной системы, черно-белой верстки в духе швейцарского модернизма и адаптивного веб-интерфейса.",
    specs: {
      role: "Creative Direction",
      identity: "Custom Grid & Typography",
      deliverables: "Design System & Web App",
      year: "2026"
    },
    tools: ["Brand Identity", "Design System", "Art Direction"],
    mediaType: "web",
    mediaUrl: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=1600&auto=format&fit=crop&q=85",
    thumbnail: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=1600&auto=format&fit=crop&q=85",
    externalLink: "https://github.com/peskovsky18/work",
    tags: ["Веб", "Айдентика", "Швейцарский стиль"]
  }
];
