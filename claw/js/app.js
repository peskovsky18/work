/**
 * Сценарий сайта: загрузка -> выбор карты -> оплата у терминала -> автомат наполняется шарами этой карты
 * -> клешня сама достаёт шар -> шар выкатывается и раскрывается -> окно с работой.
 * Ссылка вида claw/#slug сразу открывает работу без игры.
 */
import { Machine } from './machine.js';
import { CATEGORIES, PROFILE, worksOf, workBySlug, categoryById, pluralWorks } from './catalog.js';

const $ = (id) => document.getElementById(id);
const gsap = window.gsap;

const state = {
  machine: null,
  category: null,
  seen: new Set(),
  busy: false,
  timeline: null,
  again: false
};

// ------------------------------------------------------------------ строка статуса с печатью по буквам
let typeTimer = 0;
function status(text) {
  const el = $('status-text');
  clearInterval(typeTimer);
  $('status').hidden = false;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = text;
    return;
  }
  el.textContent = '';
  let i = 0;
  typeTimer = setInterval(() => {
    el.textContent = text.slice(0, ++i);
    if (i >= text.length) clearInterval(typeTimer);
  }, 28);
}

function hideStatus() {
  clearInterval(typeTimer);
  $('status').hidden = true;
}

// ------------------------------------------------------------------ загрузка модели с прогрессом
async function fetchWithProgress(url, onProgress) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const total = Number(res.headers.get('Content-Length')) || 0;
  if (!res.body || !total) {
    const buf = await res.arrayBuffer();
    onProgress(1);
    return buf;
  }
  const reader = res.body.getReader();
  const chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    onProgress(Math.min(1, got / total));
  }
  const out = new Uint8Array(got);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out.buffer;
}

function setProgress(p) {
  const pct = Math.round(p * 100);
  $('loader-fill').style.width = `${pct}%`;
  $('loader-pct').textContent = `${pct}%`;
}

// ------------------------------------------------------------------ интерфейс
function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) n.setAttribute(k, v);
  }
  for (const c of [].concat(children)) if (c) n.append(c);
  return n;
}

function renderCards() {
  const box = $('cards');
  box.replaceChildren();
  for (const cat of CATEGORIES) {
    const n = worksOf(cat.id).length;
    box.append(el('button', {
      class: 'card-btn', type: 'button', 'data-card': cat.id,
      'aria-label': `Карта ${cat.title}: ${cat.subtitle}. ${n ? pluralWorks(n) : 'скоро'}`,
      onclick: () => chooseCard(cat)
    }, [
      el('img', { src: cat.card, alt: '', width: 1024, height: 646 }),
      el('span', { class: 'card-name' }, [el('span', { text: cat.title }), el('span', { class: 'card-key', text: cat.num })]),
      el('span', { class: 'card-sub', text: cat.subtitle }),
      el('span', { class: `card-count${n ? '' : ' soon'}`, text: n ? pluralWorks(n) : 'скоро' })
    ]));
  }
}

function renderList() {
  const body = $('list-body');
  body.replaceChildren();
  for (const cat of CATEGORIES) {
    const works = worksOf(cat.id);
    const group = el('section', { class: 'list-group', style: `--chip:${cat.colors[0]}` }, [
      el('h3', { text: `${cat.title} · ${cat.subtitle}` })
    ]);
    if (!works.length) group.append(el('p', { class: 'list-empty', text: 'Скоро здесь появятся проекты.' }));
    else {
      group.append(el('div', { class: 'list-items' }, works.map((w) => el('button', {
        class: 'list-item', type: 'button', onclick: () => { closeModal('list'); openViewer(w, cat, true); }
      }, [w.poster ? el('img', { src: w.poster, alt: '', loading: 'lazy' }) : null, el('span', { text: w.title })]))));
    }
    body.append(group);
  }
}

function renderContacts() {
  const body = $('contacts-body');
  body.replaceChildren(
    el('p', { text: PROFILE.name }),
    el('div', { class: 'contact-row' }, [el('span', { text: 'Почта' }), el('a', { href: `mailto:${PROFILE.email}`, text: PROFILE.email })]),
    el('div', { class: 'contact-row' }, [el('span', { text: 'Instagram' }),
      el('a', { href: PROFILE.instagram, target: '_blank', rel: 'noopener', text: PROFILE.instagramHandle })])
  );
}

// ------------------------------------------------------------------ модальные окна
let lastFocus = null;
function openModal(id) {
  lastFocus = document.activeElement;
  $(id).hidden = false;
  const focusable = $(id).querySelector('button, a, video');
  if (focusable) focusable.focus();
}

function closeModal(id) {
  const m = $(id);
  if (m.hidden) return;
  m.hidden = true;
  if (id === 'viewer') {
    const v = m.querySelector('video');
    if (v) v.pause();
    $('viewer-media').replaceChildren();
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    afterViewer();
  }
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
}

document.addEventListener('click', (e) => {
  const open = e.target.closest('[data-open]');
  if (open) openModal(open.dataset.open);
  const close = e.target.closest('[data-close]');
  if (close) closeModal(close.closest('.modal').id);
  const modal = e.target.classList && e.target.classList.contains('modal') ? e.target : null;
  if (modal) closeModal(modal.id);
  const act = e.target.closest('[data-action="change"]');
  if (act) changeCard();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    for (const id of ['contacts', 'list', 'viewer']) if (!$(id).hidden) return closeModal(id);
  }
  const typing = /input|textarea/i.test(document.activeElement.tagName);
  if (typing || document.querySelector('.modal:not([hidden])')) return;
  if (!$('choose').hidden && ['1', '2', '3'].includes(e.key)) chooseCard(CATEGORIES[Number(e.key) - 1]);
  if (!$('playbar').hidden && (e.key === ' ' || e.key === 'Enter') && document.activeElement === document.body) {
    e.preventDefault();
    playRound();
  }
});

// ------------------------------------------------------------------ окно работы
function openViewer(work, cat, direct = false) {
  const media = $('viewer-media');
  const actions = $('viewer-actions');
  const meta = $('viewer-meta');
  media.className = 'viewer-media';
  media.replaceChildren();
  actions.replaceChildren();
  meta.replaceChildren();
  $('viewer-text').textContent = '';
  const chip = $('viewer-chip');
  chip.textContent = cat ? cat.title : '';
  chip.style.setProperty('--chip', cat ? cat.colors[0] : '');

  if (work === 'soon') {
    $('viewer-title').textContent = 'Скоро';
    media.classList.add('soon');
    media.textContent = 'ШАР ПОКА ПУСТОЙ';
    $('viewer-text').textContent = `Здесь появятся ${cat.subtitle}. Пока можно написать мне: ${PROFILE.email}`;
    actions.append(el('a', { class: 'px-btn px-btn-pick', href: `mailto:${PROFILE.email}`, text: 'Написать' }));
  } else {
    $('viewer-title').textContent = work.title;
    if (work.preview) {
      const v = el('video', {
        src: work.preview, poster: work.poster, playsinline: '', muted: '', loop: '', autoplay: '', controls: '',
        preload: 'auto', 'aria-label': work.title
      });
      v.muted = true;
      media.append(v);
      v.play().catch(() => {});
      if (work.full) {
        actions.append(el('button', {
          class: 'px-btn px-btn-pick', type: 'button', text: '▶ Смотреть полностью',
          onclick: (e) => {
            v.src = work.full;
            v.loop = false;
            v.muted = false;
            v.play().catch(() => {});
            e.currentTarget.remove();
          }
        }));
      }
    } else if (work.poster) {
      media.append(el('img', { src: work.poster, alt: work.title }));
    }
    if (work.url) actions.append(el('a', { class: 'px-btn px-btn-pick', href: work.url, target: '_blank', rel: 'noopener', text: 'Открыть проект' }));
    const rows = [['Категория', work.category], ['Год', work.year], ['Роль', work.role], ['Клиент', work.client], ['', work.badge]];
    for (const [k, v] of rows) {
      if (!v) continue;
      meta.append(el('div', {}, [k ? el('dt', { text: k }) : null, el('dd', { text: v })]));
    }
    history.replaceState(null, '', `#${work.slug}`);
  }
  if (state.category && !direct) {
    actions.append(el('button', { class: 'px-btn', type: 'button', text: 'Ещё шар', onclick: () => { state.again = true; closeModal('viewer'); } }));
  }
  actions.append(el('button', {
    class: 'px-btn', type: 'button', text: 'Все работы',
    onclick: () => { closeModal('viewer'); openModal('list'); }
  }));
  openModal('viewer');
}

function afterViewer() {
  const again = state.again;
  state.again = false;
  if (!state.machine || !state.category || state.busy) return;
  state.machine.backToIdle();
  showPlaybar();
  if (again) playRound();
}

function showPlaybar() {
  if (!state.category) return;
  const chip = $('playbar-card');
  chip.textContent = `Карта: ${state.category.title}`;
  chip.style.setProperty('--chip', state.category.colors[0]);
  const works = worksOf(state.category.id);
  const left = works.filter((w) => !state.seen.has(w.slug)).length;
  $('playbar-left').textContent = !works.length ? 'проекты скоро' : left ? `ещё ${pluralWorks(left)}` : 'все работы открыты';
  $('playbar').hidden = false;
}

// ------------------------------------------------------------------ игра
async function chooseCard(cat) {
  if (state.busy || !state.machine) return;
  state.busy = true;
  $('choose').hidden = true;
  $('playbar').hidden = true;
  const m = state.machine;
  state.category = cat;
  state.seen.clear();
  m.resetCards();
  m.setScreen('idle');
  status(`Прикладываю карту «${cat.title}»…`);
  $('fast').hidden = true;
  await m.pay(cat, () => status('Оплачено! Загружаю шары этой карты…'));
  m.applyShot('glass', 1.2);
  await gsap.delayedCall(0.6, () => {});
  await m.fill(cat, worksOf(cat.id));
  state.busy = false;
  playRound();
}

async function playRound() {
  if (state.busy || !state.category) return;
  const m = state.machine;
  let cap = m.pickCapsule(state.seen);
  if (!cap) {
    // шары кончились: автомат наполняется заново
    status('Шары кончились, пополняю автомат…');
    await m.fill(state.category, worksOf(state.category.id));
    cap = m.pickCapsule(state.seen);
  }
  if (!cap) return;
  state.busy = true;
  $('playbar').hidden = true;
  $('fast').hidden = false;
  state.timeline = m.play(cap, status);
  await state.timeline;
  state.timeline = null;
  hideStatus();
  state.busy = false;
  if (cap.work !== 'soon') state.seen.add(cap.work.slug);
  openViewer(cap.work, state.category);
}

function changeCard() {
  if (state.busy) return;
  closeModal('viewer');
  $('playbar').hidden = true;
  hideStatus();
  state.machine.resetCards();
  state.machine.setScreen('idle');
  state.machine.applyShot('intro', 1.2);
  $('choose').hidden = false;
  const first = $('cards').querySelector('button');
  if (first) first.focus();
}

$('fast').addEventListener('click', () => {
  if (state.timeline) state.timeline.timeScale(4);
});
$('again').addEventListener('click', () => playRound());

// ------------------------------------------------------------------ старт
async function boot() {
  renderCards();
  renderList();
  renderContacts();
  const fonts = document.fonts ? Promise.all(['800 16px "JetBrains Mono"', '400 16px "JetBrains Mono"'].map((f) => document.fonts.load(f, 'Ааz'))).catch(() => {}) : Promise.resolve();
  try {
    const [buffer] = await Promise.all([fetchWithProgress('claw_machine.glb', setProgress), fonts]);
    state.machine = new Machine($('scene'));
    await state.machine.load(buffer);
    window.__claw = state; // для отладки в консоли
  } catch (err) {
    console.error(err);
    $('loader').querySelector('.px-title').textContent = 'Автомат сломался';
    $('loader-pct').innerHTML = 'Не удалось загрузить 3D. <a href="../simple.html">Простая версия</a>';
    return;
  }
  $('loader').hidden = true;
  $('choose').hidden = false;
  const slug = decodeURIComponent(location.hash.slice(1));
  const work = slug && workBySlug(slug);
  if (work) openViewer(work, categoryById(work.group), true);
}

boot();
