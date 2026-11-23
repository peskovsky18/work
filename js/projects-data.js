/**
 * Работы портфолио — единственный источник данных для этапов прокрутки,
 * экранов в вагоне, ссылок (#slug), полноэкранного просмотра и простой версии без 3D.
 * После правок запустите: node tools/build_simple_page.mjs (пересоберёт simple.html и список в index.html).
 *
 * Работы по порядку показываются на экранах Screen_1..Screen_4 модели вагона
 * (assets/models/subway.blend), поэтому их ровно столько, сколько экранов.
 *
 * Поля:
 *   slug     — адрес этапа в ссылке: https://…/work/#slug
 *   title    — название
 *   category — подпись над названием
 *   badge    — бейдж рядом с названием (необязательно)
 *   preview  — короткий зацикленный ролик для экрана в вагоне
 *   full     — полная версия для кнопки «Смотреть полностью» (null — кнопки нет)
 *   poster   — кадр-заставка для плеера и простой версии simple.html (необязательно)
 *   year, role, client — показываются в плеере, только если заполнены
 */

export const PROFILE = {
  name: 'Александр Песковский',
  email: 'peskovsky18@gmail.com',
  instagram: 'https://instagram.com/peskovsky18',
  instagramHandle: '@peskovsky18'
};

export const WORKS = [
  {
    slug: 'swag',
    title: 'Свэг',
    category: 'Видео',
    badge: 'Shot on iPhone',
    preview: 'assets/videos/preview_swag.mp4',
    full: 'assets/videos/swag_full.mp4',
    poster: 'assets/images/swag_thumb.jpg',
    year: '',
    role: '',
    client: ''
  },
  {
    slug: 'mini-swag',
    title: 'Мини свэг',
    category: 'Видео',
    badge: 'Shot on iPhone',
    preview: 'assets/videos/preview_mini_swag.mp4',
    full: 'assets/videos/mini_swag_full.mp4',
    poster: 'assets/images/mini_swag_thumb.jpg',
    year: '',
    role: '',
    client: ''
  },
  {
    slug: 'night-tunnel',
    title: 'Ночной тоннель',
    category: 'Видео',
    badge: 'Shot on iPhone',
    preview: 'assets/videos/preview_tunnel.mp4',
    full: null,
    poster: 'assets/images/tunnel_thumb.jpg',
    year: '',
    role: '',
    client: ''
  },
  {
    slug: 'industry',
    title: 'Индустрия',
    category: 'Видео',
    badge: 'Shot on iPhone',
    preview: 'assets/videos/preview_industry.mp4',
    full: null,
    poster: 'assets/images/industry_thumb.jpg',
    year: '',
    role: '',
    client: ''
  }
];

/** Номер этапа прокрутки: 0 — вход, 1..N — работы, N+1 — контакты */
export const CONTACT_STAGE = WORKS.length + 1;

/** Старые адреса этапов, чтобы ранее отправленные ссылки продолжали работать */
export const LEGACY_HASHES = {
  'project-01': 1, 'project-02': 2, 'project-03': 3, 'project-04': 4,
  'tunnel': 3, '03': 3, '04': 4, 'stage-9': CONTACT_STAGE
};

export function stageSlug(stageIndex) {
  if (stageIndex === 0) return 'intro';
  if (stageIndex === CONTACT_STAGE) return 'contacts';
  const work = WORKS[stageIndex - 1];
  return work ? work.slug : `stage-${stageIndex}`;
}
