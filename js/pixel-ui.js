// Пиксельный интерфейс: текст в окнах печатается по буквам, как в диалогах старых игр.
//
// Печатаются строка приглашения на входе и название работы на каждом экране —
// каждый раз, когда этап становится активным. Буквы лежат в DOM сразу (прозрачными),
// поэтому окно не меняет размер, а экранные чтецы получают весь текст.
// При «уменьшении движения» в настройках системы текст показывается сразу.

const TYPE_TARGETS = '.intro-line, .hud-item-title';
const CHAR_DELAY_MS = 34;

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const timers = new WeakMap();

function splitIntoChars(el) {
  if (el.dataset.typewriter) return;
  const text = el.textContent;
  el.textContent = '';
  for (const ch of text) {
    const span = document.createElement('span');
    span.className = 'tw-ch';
    span.textContent = ch;
    el.appendChild(span);
  }
  el.dataset.typewriter = 'ready';
}

function typeOut(el) {
  splitIntoChars(el);
  clearInterval(timers.get(el));
  const chars = el.querySelectorAll('.tw-ch');
  if (reduceMotion.matches) {
    chars.forEach((c) => c.classList.add('on'));
    return;
  }
  chars.forEach((c) => c.classList.remove('on'));
  let i = 0;
  const id = setInterval(() => {
    // Пробел не тратит такт, чтобы ритм печати шёл по буквам
    while (i < chars.length && chars[i].textContent === ' ') chars[i++].classList.add('on');
    if (i < chars.length) chars[i++].classList.add('on');
    if (i >= chars.length) clearInterval(id);
  }, CHAR_DELAY_MS);
  timers.set(el, id);
}

function typeStage(stage) {
  stage.querySelectorAll(TYPE_TARGETS).forEach(typeOut);
}

export function initPixelUI() {
  const stages = document.querySelectorAll('.story-stage');
  const wasActive = new WeakMap();

  // До загрузки сцены буквы спрятаны: первый показ входа печатается после прелоадера
  stages.forEach((stage) => {
    stage.querySelectorAll(TYPE_TARGETS).forEach(splitIntoChars);
    wasActive.set(stage, stage.classList.contains('active'));
  });

  let sceneReady = false;
  const observer = new MutationObserver((records) => {
    records.forEach(({ target }) => {
      const active = target.classList.contains('active');
      if (active && !wasActive.get(target) && sceneReady) typeStage(target);
      wasActive.set(target, active);
    });
  });
  stages.forEach((stage) => observer.observe(stage, { attributes: true, attributeFilter: ['class'] }));

  const start = () => {
    if (sceneReady) return;
    sceneReady = true;
    const active = document.querySelector('.story-stage.active');
    if (active) typeStage(active);
  };
  window.addEventListener('scene-ready', start, { once: true });
  // Если сцена так и не загрузилась, текст всё равно должен появиться
  setTimeout(start, 20000);
}
