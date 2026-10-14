/**
 * Александр Песковский — Разнорабочий в медиа (2026)
 * База данных проектов: только два раздела — «Видео» (Снято на iPhone) и «Креатив»
 */

const PROFILE_DATA = {
  name: "Александр Песковский",
  role: "Разнорабочий в медиа",
  year: "2026",
  tagline: "Снимаю на iPhone • Режу • Арт-дирекшн",
  contacts: {
    email: "peskovsky18@gmail.com",
    instagram: "https://instagram.com/peskovsky18",
    instagramHandle: "@peskovsky18"
  }
};

const PROJECTS = [
  // ==========================================
  // РАЗДЕЛ: ВИДЕО (Снято на iPhone)
  // ==========================================
  {
    id: 1,
    title: "Имиджевый ролик «Concrete Lab»",
    category: "video",
    categoryLabel: "Видео",
    year: "2026",
    client: "Concrete Lab",
    role: "Режиссер, оператор, колорист",
    shotOnIphone: true,
    iphoneBadge: "Снято на iPhone • ProRes Log",
    description: "Рекламный ролик в цеху. Съемка полностью на iPhone в профиле Apple Log. Макропланы фактуры бетона, естественный контраст и глубокие тени.",
    specs: {
      gear: "Снято на iPhone",
      format: "4K ProRes Log • 24 fps",
      post: "DaVinci Resolve • ACES",
      year: "2026"
    },
    mediaType: "youtube",
    mediaUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    thumbnail: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=1200&auto=format&fit=crop&q=85"
  },
  {
    id: 2,
    title: "Музыкальный клип «Стены и Эхо»",
    category: "video",
    categoryLabel: "Видео",
    year: "2026",
    client: "Стены и Эхо",
    role: "Режиссер, оператор, монтаж",
    shotOnIphone: true,
    iphoneBadge: "Снято на iPhone • 4K 120fps",
    description: "Концертное и бэкстейдж видео. Скоростная съемка 120 кадров/сек на iPhone, ритмический темпоритм под ударные и аналоговая стилизация.",
    specs: {
      gear: "Снято на iPhone",
      format: "4K 120 fps Slow-Mo",
      post: "Premiere Pro • After Effects",
      year: "2026"
    },
    mediaType: "youtube",
    mediaUrl: "https://www.youtube-nocookie.com/embed/kJQP7kiw5Fk",
    thumbnail: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200&auto=format&fit=crop&q=85"
  },
  {
    id: 3,
    title: "Документальный очерк «Ремесло»",
    category: "video",
    categoryLabel: "Видео",
    year: "2026",
    client: "Культурный фонд",
    role: "Оператор-постановщик, монтаж",
    shotOnIphone: true,
    iphoneBadge: "Снято на iPhone • Естественный свет",
    description: "Серия наблюдений за работой мастеров ручного труда. Мобильный сетап без тяжелой техники, позволивший войти в доверие героям и снять живые эмоции.",
    specs: {
      gear: "Снято на iPhone",
      format: "4K HDR Dolby Vision",
      post: "DaVinci Studio • Grade",
      year: "2026"
    },
    mediaType: "youtube",
    mediaUrl: "https://www.youtube-nocookie.com/embed/ScMzIvxBSi4",
    thumbnail: "https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?w=1200&auto=format&fit=crop&q=85"
  },
  {
    id: 4,
    title: "Динамичный ролик авто-проекта",
    category: "video",
    categoryLabel: "Видео",
    year: "2026",
    client: "YouTube-медиа",
    role: "Оператор экшн-кадров, монтаж",
    shotOnIphone: true,
    iphoneBadge: "Снято на iPhone • Action Mode",
    description: "Съемка в движении из салона и с внешних креплений. Встроенная стабилизация Action Mode и запись напрямую на внешний SSD.",
    specs: {
      gear: "Снято на iPhone",
      format: "4K 60 fps Action Mode",
      post: "Premiere Pro • Sound Design",
      year: "2026"
    },
    mediaType: "youtube",
    mediaUrl: "https://www.youtube-nocookie.com/embed/9bZkp7q19f0",
    thumbnail: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1200&auto=format&fit=crop&q=85"
  },

  // ==========================================
  // РАЗДЕЛ: КРЕАТИВ (Арт-дирекшн и Веб)
  // ==========================================
  {
    id: 5,
    title: "Веб-платформа «Архив звуков»",
    category: "creative",
    categoryLabel: "Креатив",
    year: "2026",
    client: "Музей звуковой археологии",
    role: "Креативный директор, UI/UX",
    shotOnIphone: false,
    iphoneBadge: "Креативный дирекшн • 2026",
    description: "Интерактивный архив городского аудио. Концепция аудиовизуального взаимодействия, строгая швейцарская сетка и пространственная карта звуков.",
    specs: {
      direction: "Creative Direction & UX",
      stack: "Web Audio API • Three.js",
      typography: "Custom Grid • Monospace",
      year: "2026"
    },
    mediaType: "web",
    mediaUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1600&auto=format&fit=crop&q=85",
    thumbnail: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1200&auto=format&fit=crop&q=85",
    externalLink: "https://github.com/peskovsky18/work"
  },
  {
    id: 6,
    title: "Айдентика и медиа «Цех»",
    category: "creative",
    categoryLabel: "Креатив",
    year: "2026",
    client: "Медиа «Цех»",
    role: "Креативный директор, брендинг",
    shotOnIphone: false,
    iphoneBadge: "Арт-дирекшн • Айдентика",
    description: "Разработка целостной визуальной системы журнала: черно-белая минималистичная типографика, гайдлайны для обложек и дизайн цифровой платформы.",
    specs: {
      direction: "Brand Identity & Art Direction",
      deliverable: "Design System & Web App",
      style: "Swiss Modernism • Editorial",
      year: "2026"
    },
    mediaType: "web",
    mediaUrl: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=1600&auto=format&fit=crop&q=85",
    thumbnail: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=1200&auto=format&fit=crop&q=85",
    externalLink: "https://github.com/peskovsky18/work"
  },
  {
    id: 7,
    title: "Интерактивный лукбук «Сталь»",
    category: "creative",
    categoryLabel: "Креатив",
    year: "2026",
    client: "R&S Clothing",
    role: "Арт-директор, сет-дизайн",
    shotOnIphone: false,
    iphoneBadge: "Арт-дирекшн • Сет-дизайн",
    description: "Креативное руководство визуальной кампанией: индустриальный сеттинг, жесткий направленный свет, концепция цифрового лукбука.",
    specs: {
      direction: "Set Design & Art Direction",
      medium: "Lookbook & Digital Campaign",
      year: "2026"
    },
    mediaType: "image",
    mediaUrl: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1600&auto=format&fit=crop&q=85",
    thumbnail: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1200&auto=format&fit=crop&q=85",
    gallery: [
      "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1600&auto=format&fit=crop&q=85",
      "https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?w=1600&auto=format&fit=crop&q=85"
    ]
  },
  {
    id: 8,
    title: "Визуальная концепция арт-пространства",
    category: "creative",
    categoryLabel: "Креатив",
    year: "2026",
    client: "Пространство «Линия»",
    role: "Креативный директор",
    shotOnIphone: false,
    iphoneBadge: "Концепция • Навигация",
    description: "Разработка навигационной графики, вывесок и пространственной айдентики для независимого выставочного кластера.",
    specs: {
      direction: "Spatial Identity & Branding",
      year: "2026"
    },
    mediaType: "image",
    mediaUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=1600&auto=format&fit=crop&q=85",
    thumbnail: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=1200&auto=format&fit=crop&q=85"
  }
];
