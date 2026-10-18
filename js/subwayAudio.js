/**
 * Александр Песковский — 2026
 * Процедурный звуковой движок вагона метро (Web Audio API)
 * Полностью автономен, без внешних mp3 файлов
 */

let audioCtx = null;
let masterGain = null;
let rumbleFilter = null;
let clatterTimer = null;

export function initSubwayAudio() {
  if (audioCtx) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    audioCtx = new AudioContext();

    // Создаем генератор мягкого низкочастотного шума поезда (brown noise)
    const bufferSize = audioCtx.sampleRate * 2;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = output[i];
      output[i] *= 2.8;
    }

    const whiteNoise = audioCtx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    rumbleFilter = audioCtx.createBiquadFilter();
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.value = 120;
    rumbleFilter.Q.value = 2.0;

    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.0;

    whiteNoise.connect(rumbleFilter);
    rumbleFilter.connect(masterGain);
    masterGain.connect(audioCtx.destination);

    whiteNoise.start();
  } catch (e) {
    console.warn('Web Audio API недоступен:', e);
  }
}

export function updateSubwayAudio(speed, isMuted) {
  if (!audioCtx || !masterGain || !rumbleFilter) return;

  if (audioCtx.state === 'suspended' && !isMuted) {
    audioCtx.resume().catch(() => {});
  }

  const now = audioCtx.currentTime;
  if (isMuted || speed < 0.02) {
    // Плавное затухание звука поезда
    masterGain.gain.setTargetAtTime(0.0, now, 0.2);
    if (clatterTimer) {
      clearTimeout(clatterTimer);
      clatterTimer = null;
    }
  } else {
    // Громкость и частота фильтра растут с набором скорости
    const targetGain = Math.min(speed * 0.16, 0.16);
    const targetFreq = 110 + speed * 220; // 110Hz -> 330Hz
    masterGain.gain.setTargetAtTime(targetGain, now, 0.15);
    rumbleFilter.frequency.setTargetAtTime(targetFreq, now, 0.2);

    // Стук колес на стыках рельсов при движении в тоннеле
    if (speed > 0.35 && !clatterTimer) {
      const runClatterLoop = () => {
        if (!audioCtx || isMuted || speed < 0.35) {
          clatterTimer = null;
          return;
        }
        playWheelClick(0, 0.09 * speed);
        playWheelClick(0.085, 0.065 * speed);
        const nextDelay = (1150 + Math.random() * 350) / Math.max(speed, 0.4);
        clatterTimer = setTimeout(runClatterLoop, nextDelay);
      };
      clatterTimer = setTimeout(runClatterLoop, 500);
    }
  }
}

function playWheelClick(timeOffset, vol) {
  if (!audioCtx || audioCtx.state !== 'running') return;
  const now = audioCtx.currentTime + timeOffset;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  const f = audioCtx.createBiquadFilter();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(115 + Math.random() * 35, now);
  osc.frequency.exponentialRampToValueAtTime(42, now + 0.055);

  f.type = 'lowpass';
  f.frequency.value = 240;

  g.gain.setValueAtTime(vol, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);

  osc.connect(f);
  f.connect(g);
  g.connect(masterGain);

  osc.start(now);
  osc.stop(now + 0.075);
}

// Двухтональный звуковой сигнал закрытия дверей (E5 -> C5) и пневматический выпуск воздуха
export function playDoorChime() {
  if (!audioCtx || audioCtx.state !== 'running') return;
  const now = audioCtx.currentTime;

  [ { freq: 659.25, time: 0.0, dur: 0.24 }, { freq: 523.25, time: 0.25, dur: 0.35 } ].forEach(({ freq, time, dur }) => {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + time);
    g.gain.setValueAtTime(0.0, now + time);
    g.gain.linearRampToValueAtTime(0.09, now + time + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + time + dur);
    osc.connect(g);
    g.connect(audioCtx.destination);
    osc.start(now + time);
    osc.stop(now + time + dur);
  });

  // Пневматический звук "пш-ш" выпуска давления дверей
  setTimeout(() => {
    if (!audioCtx || audioCtx.state !== 'running') return;
    const pNow = audioCtx.currentTime;
    const bSize = Math.floor(audioCtx.sampleRate * 0.45);
    const nBuf = audioCtx.createBuffer(1, bSize, audioCtx.sampleRate);
    const data = nBuf.getChannelData(0);
    for (let i = 0; i < bSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bSize * 0.25));
    const src = audioCtx.createBufferSource();
    src.buffer = nBuf;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1600;
    filter.Q.value = 1.2;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.035, pNow);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    src.start(pNow);
  }, 550);
}

// Прибывающий мажорный аккорд на станции назначения (C5 -> E5 -> G5)
export function playArrivalChime() {
  if (!audioCtx || audioCtx.state !== 'running') return;
  const now = audioCtx.currentTime;
  [523.25, 659.25, 783.99].forEach((freq, idx) => {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + idx * 0.15);
    g.gain.setValueAtTime(0.0, now + idx * 0.15);
    g.gain.linearRampToValueAtTime(0.07, now + idx * 0.15 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.15 + 0.55);
    osc.connect(g);
    g.connect(audioCtx.destination);
    osc.start(now + idx * 0.15);
    osc.stop(now + idx * 0.15 + 0.55);
  });
}

// Звук скрежета колодок и экстренного торможения стоп-крана
export function playBrakeScreech() {
  if (!audioCtx || audioCtx.state !== 'running') return;
  const now = audioCtx.currentTime;

  const osc1 = audioCtx.createOscillator();
  const osc2 = audioCtx.createOscillator();
  const g = audioCtx.createGain();

  osc1.type = 'sawtooth';
  osc2.type = 'triangle';
  osc1.frequency.setValueAtTime(2400, now);
  osc1.frequency.exponentialRampToValueAtTime(800, now + 1.2);
  osc2.frequency.setValueAtTime(2450, now);
  osc2.frequency.exponentialRampToValueAtTime(780, now + 1.2);

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 2200;
  filter.Q.value = 3.5;

  g.gain.setValueAtTime(0.0, now);
  g.gain.linearRampToValueAtTime(0.12, now + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 1.3);

  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(g);
  g.connect(audioCtx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 1.35);
  osc2.stop(now + 1.35);
}

// Мягкий тактильный колокольчик включения звука
export function playHapticChime() {
  if (!audioCtx || audioCtx.state !== 'running') return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(520, now);
  osc.frequency.exponentialRampToValueAtTime(780, now + 0.08);

  g.gain.setValueAtTime(0.06, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.10);

  osc.connect(g);
  g.connect(audioCtx.destination);

  osc.start(now);
  osc.stop(now + 0.11);
}

// Резонансный станционный гонг отправления поезда со станции 1
export function playStationDepartureGong() {
  if (!audioCtx || audioCtx.state !== 'running') return;
  const now = audioCtx.currentTime;

  [349.23, 698.46, 1046.5].forEach((freq, idx) => {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    const initialGain = 0.06 / (idx + 1);
    g.gain.setValueAtTime(0.0, now);
    g.gain.linearRampToValueAtTime(initialGain, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.2 - idx * 0.2);

    osc.connect(g);
    g.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 1.25);
  });
}

// Станционный перезвон информационного оповещения при прибытии на станцию 2
export function playStationPAChime() {
  if (!audioCtx || audioCtx.state !== 'running') return;
  const now = audioCtx.currentTime;
  const notes = [
    { freq: 587.33, t: 0.0, dur: 0.32 }, // D5
    { freq: 739.99, t: 0.18, dur: 0.32 }, // F#5
    { freq: 880.00, t: 0.36, dur: 0.40 }, // A5
    { freq: 1174.66, t: 0.54, dur: 0.65 } // D6
  ];

  notes.forEach(({ freq, t, dur }) => {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + t);

    g.gain.setValueAtTime(0.0, now + t);
    g.gain.linearRampToValueAtTime(0.05, now + t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, now + t + dur);

    osc.connect(g);
    g.connect(audioCtx.destination);
    osc.start(now + t);
    osc.stop(now + t + dur + 0.05);
  });
}

