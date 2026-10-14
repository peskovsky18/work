/**
 * Александр Песковский — 2026
 * База данных: только для кого работа и «Shot on iPhone»
 */

const PROFILE_DATA = {
  name: "Александр Песковский",
  role: "Разнорабочий в медиа",
  year: "2026",
  contacts: {
    email: "peskovsky18@gmail.com",
    instagram: "https://instagram.com/peskovsky18",
    instagramHandle: "@peskovsky18"
  }
};

const PROJECTS = [
  // ==========================================
  // ВИДЕО — ВСЁ SHOT ON IPHONE
  // ==========================================
  {
    id: 1,
    client: "Concrete Lab",
    title: "Имиджевый ролик",
    category: "video",
    categoryLabel: "Видео",
    badge: "Shot on iPhone",
    year: "2026",
    mediaType: "youtube",
    mediaUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    thumbnail: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=1600&auto=format&fit=crop&q=85"
  },
  {
    id: 2,
    client: "Стены и Эхо",
    title: "Музыкальный клип",
    category: "video",
    categoryLabel: "Видео",
    badge: "Shot on iPhone",
    year: "2026",
    mediaType: "youtube",
    mediaUrl: "https://www.youtube-nocookie.com/embed/kJQP7kiw5Fk",
    thumbnail: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1600&auto=format&fit=crop&q=85"
  },
  {
    id: 3,
    client: "Культурный фонд",
    title: "Документальный очерк",
    category: "video",
    categoryLabel: "Видео",
    badge: "Shot on iPhone",
    year: "2026",
    mediaType: "youtube",
    mediaUrl: "https://www.youtube-nocookie.com/embed/ScMzIvxBSi4",
    thumbnail: "https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?w=1600&auto=format&fit=crop&q=85"
  },
  {
    id: 4,
    client: "YouTube-шоу",
    title: "Динамичный выпуск",
    category: "video",
    categoryLabel: "Видео",
    badge: "Shot on iPhone",
    year: "2026",
    mediaType: "youtube",
    mediaUrl: "https://www.youtube-nocookie.com/embed/9bZkp7q19f0",
    thumbnail: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1600&auto=format&fit=crop&q=85"
  },

  // ==========================================
  // КРЕАТИВ — АРТ-ДИРЕКШН И КОНЦЕПЦИИ
  // ==========================================
  {
    id: 5,
    client: "Музей звука",
    title: "Интерактивный архив",
    category: "creative",
    categoryLabel: "Креатив",
    badge: "Креативный дирекшн",
    year: "2026",
    mediaType: "web",
    mediaUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1600&auto=format&fit=crop&q=85",
    thumbnail: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1600&auto=format&fit=crop&q=85",
    externalLink: "https://github.com/peskovsky18/work"
  },
  {
    id: 6,
    client: "Медиа «Цех»",
    title: "Айдентика и журнал",
    category: "creative",
    categoryLabel: "Креатив",
    badge: "Арт-дирекшн",
    year: "2026",
    mediaType: "web",
    mediaUrl: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=1600&auto=format&fit=crop&q=85",
    thumbnail: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=1600&auto=format&fit=crop&q=85",
    externalLink: "https://github.com/peskovsky18/work"
  },
  {
    id: 7,
    client: "R&S Clothing",
    title: "Сет-дизайн лукбука",
    category: "creative",
    categoryLabel: "Креатив",
    badge: "Креативный продакшн",
    year: "2026",
    mediaType: "image",
    mediaUrl: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1600&auto=format&fit=crop&q=85",
    thumbnail: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1600&auto=format&fit=crop&q=85"
  },
  {
    id: 8,
    client: "Пространство «Линия»",
    title: "Визуальная концепция",
    category: "creative",
    categoryLabel: "Креатив",
    badge: "Арт-дирекшн",
    year: "2026",
    mediaType: "image",
    mediaUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=1600&auto=format&fit=crop&q=85",
    thumbnail: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=1600&auto=format&fit=crop&q=85"
  }
];
