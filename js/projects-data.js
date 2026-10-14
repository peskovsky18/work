/**
 * Проекты и контакты: Александр Песковский — Разнорабочий в медиа
 */

const PROFILE_DATA = {
  name: "Александр Песковский",
  role: "Разнорабочий в медиа",
  tagline: "Видео • Фото • Монтаж • Веб",
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
    year: "2024",
    client: "Concrete Lab",
    role: "Режиссер, оператор, цветокоррекция",
    description: "Съемка рекламного ролика в действующем цеху. Ручная камера, макропланы, естественный свет и тяжелые фактуры.",
    tools: ["BMPCC 6K Pro", "DaVinci Resolve"],
    mediaType: "youtube",
    mediaUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    thumbnail: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=1600&auto=format&fit=crop&q=85",
    tags: ["Видео", "Реклама", "Камера"]
  },
  {
    id: 2,
    title: "Фотосерия «Ночные окраины»",
    category: "photo",
    categoryLabel: "Фото",
    year: "2024",
    client: "Персональный проект",
    role: "Фотограф",
    description: "Черно-белая аналоговая фотография. Съемка на среднеформатную пленку в ночном городе.",
    tools: ["Mamiya RB67", "Ilford HP5+ 400"],
    mediaType: "image",
    mediaUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=1600&auto=format&fit=crop&q=85",
    thumbnail: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=1600&auto=format&fit=crop&q=85",
    gallery: [
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=1600&auto=format&fit=crop&q=85",
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1600&auto=format&fit=crop&q=85",
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1600&auto=format&fit=crop&q=85",
      "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=1600&auto=format&fit=crop&q=85"
    ],
    tags: ["Фото", "Пленка", "Ч/Б"]
  },
  {
    id: 3,
    title: "Клип «Стены и Эхо»",
    category: "montage",
    categoryLabel: "Монтаж",
    year: "2023",
    client: "Стены и Эхо",
    role: "Монтаж, саунд-дизайн",
    description: "Монтаж динамичного концертного видео. Ритмическая сборка по биту барабанов, аналоговые переходы и работа со звуком.",
    tools: ["Premiere Pro", "After Effects"],
    mediaType: "youtube",
    mediaUrl: "https://www.youtube-nocookie.com/embed/kJQP7kiw5Fk",
    thumbnail: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1600&auto=format&fit=crop&q=85",
    tags: ["Монтаж", "Клип", "Саунд"]
  },
  {
    id: 4,
    title: "Веб-архив звуков города",
    category: "web",
    categoryLabel: "Веб",
    year: "2024",
    client: "Музей звука",
    role: "Креативный директор",
    description: "Концепция и арт-дирекшн интерактивного звукового архива. Интерфейс карты и аудиовизуальный опыт.",
    tools: ["Art Direction", "UI/UX Concept"],
    mediaType: "web",
    mediaUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1600&auto=format&fit=crop&q=85",
    thumbnail: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1600&auto=format&fit=crop&q=85",
    externalLink: "https://github.com/peskovsky18/work",
    tags: ["Веб", "Арт-дирекшн"]
  },
  {
    id: 5,
    title: "Документальный проект «Ремесло»",
    category: "video",
    categoryLabel: "Видео",
    year: "2023",
    client: "Фонд ремесел",
    role: "Оператор, монтажер",
    description: "Серия коротких зарисовок о мастерах ручного труда. Живой естественный звук, длинные планы и внимание к деталям.",
    tools: ["Sony FX3", "DaVinci Resolve"],
    mediaType: "youtube",
    mediaUrl: "https://www.youtube-nocookie.com/embed/ScMzIvxBSi4",
    thumbnail: "https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?w=1600&auto=format&fit=crop&q=85",
    tags: ["Видео", "Док"]
  },
  {
    id: 6,
    title: "Съемка лукбука коллекции «Сталь»",
    category: "photo",
    categoryLabel: "Фото",
    year: "2024",
    client: "R&S Clothing",
    role: "Фотограф",
    description: "Каталожная съемка на индустриальной локации. Жесткий импульсный свет, высокий контраст, минималистичная композиция.",
    tools: ["Nikon Z7 II", "Godox"],
    mediaType: "image",
    mediaUrl: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1600&auto=format&fit=crop&q=85",
    thumbnail: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1600&auto=format&fit=crop&q=85",
    gallery: [
      "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1600&auto=format&fit=crop&q=85",
      "https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?w=1600&auto=format&fit=crop&q=85",
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1600&auto=format&fit=crop&q=85"
    ],
    tags: ["Фото", "Лукбук"]
  },
  {
    id: 7,
    title: "Пост-продакшн авто-шоу",
    category: "montage",
    categoryLabel: "Монтаж",
    year: "2024",
    client: "YouTube-проект",
    role: "Монтаж, графика",
    description: "Многокамерный монтаж 8 источников, синхронизация звука, цветокоррекция и лаконичная графическая упаковка.",
    tools: ["Premiere Pro", "After Effects"],
    mediaType: "youtube",
    mediaUrl: "https://www.youtube-nocookie.com/embed/9bZkp7q19f0",
    thumbnail: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1600&auto=format&fit=crop&q=85",
    tags: ["Монтаж", "Мультикам"]
  },
  {
    id: 8,
    title: "Айдентика и сайт медиа «Цех»",
    category: "web",
    categoryLabel: "Веб",
    year: "2023",
    client: "Медиа «Цех»",
    role: "Креативный директор",
    description: "Разработка визуальной стилистики, шрифтовой системы и интерфейса цифрового журнала.",
    tools: ["Art Direction", "Figma", "Branding"],
    mediaType: "web",
    mediaUrl: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=1600&auto=format&fit=crop&q=85",
    thumbnail: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=1600&auto=format&fit=crop&q=85",
    externalLink: "https://github.com/peskovsky18/work",
    tags: ["Веб", "Айдентика"]
  }
];
