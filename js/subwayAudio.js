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
