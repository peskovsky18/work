// Простая версия сайта без 3D: simple.html и список работ в <noscript> на index.html.
//
// Данные берутся из js/projects-data.js (тот же источник, что у 3D-версии), поэтому после
// любых правок работ достаточно перезапустить:
//   node tools/build_simple_page.mjs
//
// simple.html — обычная статичная страница: работы видны без JavaScript и без WebGL,
// видео не качаются, пока их не запустят (preload="none" + кадр-заставка).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { WORKS, PROFILE, LEGACY_HASHES, stageSlug } = await import(pathToFileURL(path.join(ROOT, 'js/projects-data.js')));

const SITE_URL = 'https://peskovsky18.github.io/work/';
const CSS_VERSION = '20261124';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Ширина и высота JPEG (маркер SOF), чтобы плеер сразу занимал своё место и страница не прыгала. */
function jpegSize(file) {
  const b = fs.readFileSync(path.join(ROOT, file));
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const marker = b[i + 1];
    const len = b.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
}

function workMeta(work) {
  return [work.year, work.role, work.client].filter(Boolean).map(esc).join(' · ');
}

function workCard(work, index) {
  const src = work.full || work.preview;
  const size = work.poster ? jpegSize(work.poster) : null;
  const dims = size ? ` width="${size.w}" height="${size.h}"` : '';
  const poster = work.poster ? ` poster="${esc(work.poster)}"` : '';
  const meta = workMeta(work);
  const note = work.full ? '' : '<p class="s-note">Фрагмент</p>';
  return `
      <article class="s-work" id="${esc(work.slug)}">
        <div class="s-player">
          <video controls playsinline preload="none"${poster}${dims} src="${esc(src)}" aria-label="${esc(work.title)}"></video>
        </div>
        <div class="s-work-text">
          <p class="s-label"><span class="s-num">${String(index + 1).padStart(2, '0')}</span> ${esc(work.category)}${work.badge ? ` <span class="s-badge">${esc(work.badge)}</span>` : ''}</p>
          <h2 class="s-title">${esc(work.title)}</h2>${meta ? `\n          <p class="s-meta">${meta}</p>` : ''}${note ? `\n          ${note}` : ''}
          <a class="s-share" href="#${esc(work.slug)}">Ссылка на работу</a>
        </div>
      </article>`;
}

function simplePage() {
  // Старые адреса этапов (#project-01, #tunnel…) ведут на те же работы
  const legacy = {};
  for (const [hash, stage] of Object.entries(LEGACY_HASHES)) legacy[hash] = stageSlug(stage);
  legacy.intro = '';
  const cover = SITE_URL + 'assets/images/og-cover.jpg';
  const desc = `Видеоработы ${PROFILE.name}: ${WORKS.map((w) => w.title).join(', ')}.`;
  return `<!DOCTYPE html>
<!-- Файл создан tools/build_simple_page.mjs из js/projects-data.js — правьте данные там и перезапускайте скрипт -->
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="#050506">
  <title>${esc(PROFILE.name)} | Работы</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${SITE_URL}simple.html">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${SITE_URL}simple.html">
  <meta property="og:title" content="${esc(PROFILE.name)} | Работы">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:locale" content="ru_RU">
  <meta property="og:image" content="${cover}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23f5a623'%3E%3Cpath d='M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm2 3v2h2V7H6zm4 0v2h2V7h-2zm4 0v2h2V7h-2zm4 0v2h2V7h-2z'/%3E%3C/svg%3E">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Tiny5&display=block" rel="stylesheet">
  <link rel="stylesheet" href="css/simple.css?v=${CSS_VERSION}">
  <script>
    // Старые адреса этапов 3D-версии → якоря этой страницы
    (function () {
      var legacy = ${JSON.stringify(legacy)};
      var h = location.hash.slice(1).toLowerCase();
      if (h in legacy) history.replaceState(null, '', legacy[h] ? '#' + legacy[h] : location.pathname + location.search);
    })();
  </script>
</head>
<body>
  <header class="s-header">
    <a class="s-brand" href="#top">${esc(PROFILE.name)}</a>
    <a class="s-switch" href="./?3d" id="open-3d">3D-версия</a>
  </header>

  <main id="top">
    <section class="s-intro">
      <h1>${esc(PROFILE.name)}</h1>
      <p class="s-lead">Портфолио: видеоработы</p>
      <nav class="s-toc" aria-label="Работы">
        ${WORKS.map((w) => `<a href="#${esc(w.slug)}">${esc(w.title)}</a>`).join('\n        ')}
        <a href="#contacts">Контакты</a>
      </nav>
    </section>

    <section class="s-works" aria-label="Работы">${WORKS.map(workCard).join('\n')}
    </section>

    <section class="s-contacts" id="contacts">
      <h2>Контакты</h2>
      <div class="s-contact-row">
        <a class="s-btn s-btn-primary" href="mailto:${esc(PROFILE.email)}">${esc(PROFILE.email)}</a>
        <a class="s-btn" href="${esc(PROFILE.instagram)}" target="_blank" rel="noopener">Instagram ${esc(PROFILE.instagramHandle)} ↗</a>
      </div>
    </section>
  </main>

  <footer class="s-footer">
    <p>Это простая версия сайта. <a href="./?3d">Открыть 3D-версию</a>: поездка в вагоне метро, работы на экранах.</p>
  </footer>

  <script>
    // Ссылка на 3D-версию ведёт к той же работе, что открыта здесь
    (function () {
      var link = document.getElementById('open-3d');
      function sync() { link.href = './?3d' + (location.hash && location.hash !== '#top' ? location.hash : ''); }
      window.addEventListener('hashchange', sync);
      sync();
      // Играет только один ролик
      document.addEventListener('play', function (e) {
        document.querySelectorAll('video').forEach(function (v) { if (v !== e.target) v.pause(); });
      }, true);
    })();
  </script>
</body>
</html>
`;
}

/** Список работ для тех, у кого не запускается JavaScript, и для поисковиков. */
function noscriptBlock() {
  const items = WORKS.map((w) => {
    const meta = workMeta(w);
    return `        <li><a href="simple.html#${esc(w.slug)}">${esc(w.title)}</a> — ${esc(w.category)}${meta ? `, ${meta}` : ''}</li>`;
  }).join('\n');
  return `<!-- SIMPLE-LIST:START (создаётся tools/build_simple_page.mjs) -->
  <noscript>
    <div class="noscript-list">
      <h2>${esc(PROFILE.name)}: работы</h2>
      <ul>
${items}
      </ul>
      <p><a href="simple.html">Простая версия сайта</a> · <a href="mailto:${esc(PROFILE.email)}">${esc(PROFILE.email)}</a></p>
    </div>
  </noscript>
  <!-- SIMPLE-LIST:END -->`;
}

fs.writeFileSync(path.join(ROOT, 'simple.html'), simplePage());
const indexPath = path.join(ROOT, 'index.html');
const index = fs.readFileSync(indexPath, 'utf8');
const re = /<!-- SIMPLE-LIST:START[\s\S]*?SIMPLE-LIST:END -->/;
if (!re.test(index)) throw new Error('В index.html нет блока <!-- SIMPLE-LIST:START … SIMPLE-LIST:END -->');
fs.writeFileSync(indexPath, index.replace(re, noscriptBlock()));
console.log(`simple.html: ${WORKS.length} работ; список в index.html обновлён`);
