/**
 * База данных проектов для портфолио «Разнорабочий в медиа»
 * 
 * Чтобы добавить новую работу:
 * 1. Скопируйте любой блок ниже между фигурных скобок { ... }
 * 2. Вставьте его в массив PROJECTS
 * 3. Измените id, заголовок, категорию, описание и ссылки
 * 
 * Категории (category):
 * - "video"   (Видео)
 * - "photo"   (Фотография)
 * - "montage" (Монтаж и пост-продакшн)
 * - "web"     (Веб-проекты и Креативный дирекшн)
 */

const PROJECTS = [
  {
    id: 1,
    title: "Имиджевый ролик «Анатомия бетона»",
    category: "video",
    categoryLabel: "🎬 Видео",
    year: "2024",
    client: "Бренд брутальной мебели Concrete Lab",
    role: "Режиссер, оператор-постановщик, колорист",
    description: "Короткометражный рекламный манифест о текстуре, весе и ручном труде. Съемка в реальном цеху при температуре -5°C. Динамичная ручная камера, акцент на макро-деталях и искре сварки.",
    tools: ["BMPCC 6K Pro", "Анаморфотные линзы", "DaVinci Resolve", "Ручной свет"],
    mediaType: "youtube",
    mediaUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", // Замените на ID вашего ролика на YouTube
    thumbnail: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=900&auto=format&fit=crop&q=80",
    tags: ["Реклама", "Манифест", "Анаморфот", "Цветокор"],
    featured: true
  },
  {
    id: 2,
    title: "Фотосерия «Ночные мотыльки окраин»",
    category: "photo",
    categoryLabel: "📸 Фото",
    year: "2024",
    client: "Персональный арт-проект",
    role: "Фотограф, ретушер, сканирование пленки",
    description: "Серия аналоговых портретов и стрит-фотографии на границе жилых массивов и промзон. Съемка на среднеформатную черно-белую пленку Ilford HP5+ с пуш-процессом до 1600 ISO.",
    tools: ["Mamiya RB67", "Ilford HP5+ 400", "Epson V850 Pro", "SilverFast"],
    mediaType: "image",
    mediaUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=1600&auto=format&fit=crop&q=85",
    thumbnail: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=900&auto=format&fit=crop&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=1600&auto=format&fit=crop&q=85",
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1600&auto=format&fit=crop&q=85",
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1600&auto=format&fit=crop&q=85",
      "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=1600&auto=format&fit=crop&q=85"
    ],
    tags: ["Средний формат", "Пленка 120мм", "Портрет", "Зерно"],
    featured: true
  },
  {
    id: 3,
    title: "Монтаж музыкального клипа «Пульс Перегруза»",
    category: "montage",
    categoryLabel: "✂️ Монтаж",
    year: "2023",
    client: "Инди-рок группа «Стены и Эхо»",
    role: "Режиссер монтажа, саунд-дизайн, глитч-анимация",
    description: "Собрал 14 часов хаотичного концертного и бэкстейдж-материала в 3-минутный ураганный клип. Ритмический монтаж по долям барабанов, кастомные пленочные переходы и сложный многослойный саунд-дизайн шумов и перегрузок.",
    tools: ["Premiere Pro", "After Effects", "Семплы VHS", "Ableton Live"],
    mediaType: "youtube",
    mediaUrl: "https://www.youtube-nocookie.com/embed/kJQP7kiw5Fk", // Замените на ваше видео
    thumbnail: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=900&auto=format&fit=crop&q=80",
    tags: ["Клип", "Ритмический монтаж", "Глитч", "Саунд-дизайн"],
    featured: true
  },
  {
    id: 4,
    title: "Интерактивный спецпроект «Архив Забытых Звуков»",
    category: "web",
    categoryLabel: "🌐 Веб & Креатив",
    year: "2024",
    client: "Городской музей звуковой археологии",
    role: "Креативный директор, UI/UX арт-дирекшн",
    description: "Концепция и визуальное руководство интерактивного аудио-визуального архива. Пользователь исследует карту города 1990-х годов через аутентичные записи уличного шума, кассетных плееров и старых трамваев.",
    tools: ["Figma", "Creative Concept", "Art Direction", "Web Audio API", "Three.js"],
    mediaType: "web",
    mediaUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1600&auto=format&fit=crop&q=85",
    thumbnail: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=900&auto=format&fit=crop&q=80",
    externalLink: "https://github.com",
    tags: ["Креативный концепт", "Арт-дирекшн", "Интерактив", "Саунд-арт"],
    featured: true
  },
  {
    id: 5,
    title: "Документальный цикл «Последние ремесленники»",
    category: "video",
    categoryLabel: "🎬 Видео",
    year: "2023",
    client: "Культурный фонд «Наследие»",
    role: "Соавтор сценария, оператор 1-й камеры, монтаж",
    description: "Трехсерийный цикл о кузнецах, переплетчиках старинных книг и часовщиках. Никаких постановочных кадров — только наблюдение за кончиками пальцев и искренние монологи мастеров.",
    tools: ["Sony FX3", "Carl Zeiss Planar", "Sennheiser MKH 416", "DaVinci Resolve"],
    mediaType: "youtube",
    mediaUrl: "https://www.youtube-nocookie.com/embed/ScMzIvxBSi4",
    thumbnail: "https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?w=900&auto=format&fit=crop&q=80",
    tags: ["Документалистика", "Sony FX3", "Интервью", "Естественный свет"],
    featured: false
  },
  {
    id: 6,
    title: "Лукбук уличного бренда «Ржавчина и Сталь»",
    category: "photo",
    categoryLabel: "📸 Фото",
    year: "2024",
    client: "Локальный бренд одежды R&S",
    role: "Фотограф, сет-дизайн, креативное продюсирование",
    description: "Каталожная и эмоциональная съемка осенней коллекции на фоне заброшенных железнодорожных путей. Минималистичный жесткий вспышечный свет, резкие контрасты, честные эмоции непрофессиональных моделей.",
    tools: ["Nikon Z7 II", "Godox AD300 Pro", "Beauty Dish", "Capture One"],
    mediaType: "image",
    mediaUrl: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1600&auto=format&fit=crop&q=85",
    thumbnail: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=900&auto=format&fit=crop&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1600&auto=format&fit=crop&q=85",
      "https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?w=1600&auto=format&fit=crop&q=85",
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1600&auto=format&fit=crop&q=85"
    ],
    tags: ["Fashion", "Лукбук", "Жесткий свет", "Сет-дизайн"],
    featured: false
  },
  {
    id: 7,
    title: "Сложный монтаж и VFX для авто-шоу «Гаражный Бунт»",
    category: "montage",
    categoryLabel: "✂️ Монтаж",
    year: "2024",
    client: "YouTube-канал с аудиторией 450k",
    role: "Режиссер монтажа, клинап, графическая упаковка",
    description: "Многокамерный монтаж (8 камер + экшн-камеры в салоне + коптер). Создание системы рисованной 2D-инфографики для сравнения технических характеристик тюнингованных двигателей.",
    tools: ["Premiere Pro Multicam", "After Effects", "Mocha Pro", "Blender 3D"],
    mediaType: "youtube",
    mediaUrl: "https://www.youtube-nocookie.com/embed/9bZkp7q19f0",
    thumbnail: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=900&auto=format&fit=crop&q=80",
    tags: ["Мультикам", "VFX", "Инфографика", "YouTube"],
    featured: false
  },
  {
    id: 8,
    title: "Медиа-платформа и брендинг «Независимый Цех»",
    category: "web",
    categoryLabel: "🌐 Веб & Креатив",
    year: "2023",
    client: "Ассоциация независимых медиа-криейторов",
    role: "Креативный директор, разработка айдентики, веб-концепт",
    description: "Разработка концепта от названия и газетной черно-белой верстки до финального лонча сайта. Сетка в духе швейцарского стиля 1960-х в комбинации с грубыми резиновыми штампами и живой типографикой.",
    tools: ["Identity", "Typography", "Art Direction", "Figma", "Tone of Voice"],
    mediaType: "web",
    mediaUrl: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=1600&auto=format&fit=crop&q=85",
    thumbnail: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=900&auto=format&fit=crop&q=80",
    externalLink: "https://github.com",
    tags: ["Брендинг", "Веб-дизайн", "Айдентика", "Типографика"],
    featured: true
  }
];

// Персональные данные и контакты
const PROFILE_DATA = {
  name: "РАЗНОРАБОЧИЙ В МЕДИА",
  alias: "Саша Песковский", // Замените на ваше настоящее имя
  tagline: "Снимаю • Режу • Направляю",
  bio: "Человек-оркестр для визуальных проектов любой сложности. От написания режиссерского тритмента и выставления света в пыльном ангаре до ритмичного монтажа с саунд-дизайном и арт-дирекшна интерактивных веб-сайтов. Беру сырую задачу и сдаю готовый цельный продукт без лишних звеньев и пафоса.",
  stats: [
    { number: "8+ лет", label: "в медиа-поле" },
    { number: "250+", label: "снятых и смонтированных видео" },
    { number: "0", label: "пропущенных дедлайнов" },
    { number: "All-in-one", label: "заменяю полтора отдела" }
  ],
  services: [
    {
      title: "Видеопроизводство",
      icon: "camera",
      desc: "Режиссура, операторская работа, постановка света, документалистика, реклама, YouTube-форматы."
    },
    {
      title: "Монтаж и Пост",
      icon: "scissors",
      desc: "Динамичный темпоритм, мультикам, цветокоррекция в DaVinci, плотный саунд-дизайн, чистка звука."
    },
    {
      title: "Фотография",
      icon: "aperture",
      desc: "Аналог и цифра. Портреты, репортажи, лукбуки, архитектура. Характер и свет важнее гламура."
    },
    {
      title: "Креативный дирекшн",
      icon: "compass",
      desc: "Концепция медиапроектов, разработка сценариев, айдентика, веб-дирекшн, упаковка продукта."
    }
  ],
  contacts: {
    telegram: "https://t.me/your_telegram", // Замените на ваш Telegram
    telegramUsername: "@your_telegram",
    email: "hello@yourdomain.com",          // Замените на ваш Email
    instagram: "https://instagram.com",
    city: "Москва / Санкт-Петербург / Remote",
    status: "Открыт к проектам и безумным коллаборациям"
  }
};
