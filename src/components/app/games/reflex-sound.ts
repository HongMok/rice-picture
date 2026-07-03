// reflex 类游戏共用的音效反馈：Web Audio 合成短音，不依赖音频素材文件。
// 开关状态存 localStorage，跨局记住用户偏好。

const STORAGE_KEY = 'rice-picture:reflex-sound-on';

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  return ctx;
}

export function loadSoundPref(): boolean {
  if (typeof window === 'undefined') return true;
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === null ? true : v === '1';
}

export function saveSoundPref(on: boolean) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
}

function tone(freq: number, durationMs: number, type: OscillatorType = 'sine') {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = 0.15;
  osc.connect(gain);
  gain.connect(c.destination);
  const now = c.currentTime;
  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);
  osc.start(now);
  osc.stop(now + durationMs / 1000);
}

export function playHit(soundOn: boolean) {
  if (!soundOn) return;
  tone(880, 140, 'triangle');
}

export function playMiss(soundOn: boolean) {
  if (!soundOn) return;
  tone(220, 120, 'sine');
}

export function playFinish(soundOn: boolean) {
  if (!soundOn) return;
  tone(660, 160, 'triangle');
  setTimeout(() => tone(990, 220, 'triangle'), 140);
}

/** 金币收集音：两段短促上行三角波，明显区别于 hit（后者只是打击反馈） */
export function playCoin(soundOn: boolean) {
  if (!soundOn) return;
  tone(1200, 90, 'triangle');
  setTimeout(() => tone(1600, 120, 'triangle'), 60);
}

/** 连击音：短促上扬的方波扫频 */
export function playCombo(soundOn: boolean, comboLevel: number) {
  if (!soundOn) return;
  const base = 700 + Math.min(comboLevel, 8) * 60;
  tone(base, 90, 'square');
  setTimeout(() => tone(base * 1.5, 140, 'square'), 70);
}

/** 首次用户手势时解锁 AudioContext（同 GamePlayer.tsx unlockTts 的思路） */
export function unlockAudio() {
  const c = getCtx();
  if (c && c.state === 'suspended') c.resume();
}
