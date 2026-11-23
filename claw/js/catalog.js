/**
 * Карты автомата и работы в них.
 * Работы берутся из общего js/projects-data.js: поле group решает, в какую карту попадёт работа
 * ('video' по умолчанию, 'creative', 'vibecode'). Пути там от корня сайта, здесь их поправляем.
 */
import { WORKS, PROFILE } from '../../js/projects-data.js';

export { PROFILE };

export const CATEGORIES = [
  {
    id: 'video', num: 1, title: 'ВИДЕО', subtitle: 'видеоработы',
    card: 'textures/card_video.webp', colors: ['#ff2bd6', '#9a6bff', '#ff5c9d']
  },
  {
    id: 'creative', num: 2, title: 'КРЕАТИВ', subtitle: 'креативные и продюсерские проекты',
    card: 'textures/card_creative.webp', colors: ['#ff8a3d', '#ffd23f', '#f23a4f']
  },
  {
    id: 'vibecode', num: 3, title: 'ВАЙБКОД', subtitle: 'вайбкод-проекты',
    card: 'textures/card_vibecode.webp', colors: ['#3ee0b0', '#19b5b5', '#4aa8ff']
  }
];

const fromRoot = (p) => (!p ? null : /^([a-z]+:)?\/\//i.test(p) ? p : `../${p}`);

export const ITEMS = WORKS.map((w) => ({
  ...w,
  group: w.group || 'video',
  preview: fromRoot(w.preview),
  full: fromRoot(w.full),
  poster: fromRoot(w.poster),
  url: w.url || null
}));

export const categoryById = (id) => CATEGORIES.find((c) => c.id === id);
export const worksOf = (id) => ITEMS.filter((w) => w.group === id);
export const workBySlug = (slug) => ITEMS.find((w) => w.slug === slug);

export function pluralWorks(n) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} работа`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} работы`;
  return `${n} работ`;
}
