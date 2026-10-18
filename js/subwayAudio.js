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
  } else {
    // Громкость и частота фильтра растут с набором скорости (макс громкость 0.18 - мягкий комфортный фон)
    const targetGain = Math.min(speed * 0.16, 0.16);
    const targetFreq = 110 + speed * 220; // 110Hz -> 330Hz
    masterGain.gain.setTargetAtTime(targetGain, now, 0.15);
    rumbleFilter.frequency.setTargetAtTime(targetFreq, now, 0.2);
  }
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
