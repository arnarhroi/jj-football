// Tiny synthesised sound effects (no audio files needed).
let ctx = null, master = null, crowdGain = null, enabled = true, noise = null;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = enabled ? 0.7 : 0; master.connect(ctx.destination);
  noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // ambient crowd murmur
  const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 600; bp.Q.value = 0.6;
  crowdGain = ctx.createGain(); crowdGain.gain.value = 0.05;
  src.connect(bp); bp.connect(crowdGain); crowdGain.connect(master); src.start();
}

export function setSound(on) {
  enabled = on;
  if (master) master.gain.value = on ? 0.7 : 0;
}

function env(g, t, a, peak, dur) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

function noiseBurst(t, dur, type, freq, peak, q = 1, attack = 0.005) {
  const s = ctx.createBufferSource(); s.buffer = noise;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); env(g, t, attack, peak, dur);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t, Math.random()); s.stop(t + dur + 0.05);
  return f;
}

function tone(t, type, f0, f1, dur, peak) {
  const o = ctx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain(); env(g, t, 0.004, peak, dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  return o;
}

export function sfx(name, power = 1) {
  if (!ctx || !enabled) return;
  const t = ctx.currentTime;
  switch (name) {
    case 'kick':
      tone(t, 'sine', 180, 45, 0.16, 0.9 * Math.min(1, 0.5 + power));
      noiseBurst(t, 0.05, 'highpass', 2500, 0.4);
      break;
    case 'post':
      tone(t, 'triangle', 1180, 1150, 0.7, 0.35);
      tone(t, 'sine', 2350, 2300, 0.5, 0.15);
      tone(t, 'sine', 90, 60, 0.15, 0.6);
      break;
    case 'net':
      noiseBurst(t, 0.35, 'lowpass', 1200, 0.5, 0.7, 0.02);
      break;
    case 'save':
      tone(t, 'sine', 130, 60, 0.14, 0.8);
      noiseBurst(t, 0.08, 'bandpass', 900, 0.5);
      break;
    case 'cheer': {
      const f = noiseBurst(t, 2.6, 'bandpass', 900, 0.9, 0.5, 0.25);
      f.frequency.linearRampToValueAtTime(1400, t + 0.6);
      noiseBurst(t + 0.1, 2.2, 'bandpass', 2200, 0.35, 0.8, 0.3);
      break;
    }
    case 'groan': {
      const f = noiseBurst(t, 1.4, 'bandpass', 700, 0.6, 0.6, 0.15);
      f.frequency.exponentialRampToValueAtTime(250, t + 1.2);
      break;
    }
    case 'whistle': {
      for (const [st, du] of [[0, 0.18], [0.25, 0.5]]) {
        const o = tone(t + st, 'sine', 2900, 2850, du, 0.3);
        const lfo = ctx.createOscillator(); lfo.frequency.value = 28;
        const lg = ctx.createGain(); lg.gain.value = 120; lfo.connect(lg); lg.connect(o.frequency);
        lfo.start(t + st); lfo.stop(t + st + du + 0.05);
      }
      break;
    }
    case 'ding':
      tone(t, 'sine', 880, 880, 0.25, 0.4); tone(t + 0.09, 'sine', 1320, 1320, 0.35, 0.35);
      break;
    case 'tick':
      tone(t, 'square', 1000, 1000, 0.05, 0.12);
      break;
    case 'click':
      tone(t, 'sine', 600, 400, 0.06, 0.25);
      break;
    case 'win':
      [523, 659, 784, 1047].forEach((f, i) => tone(t + i * 0.13, 'triangle', f, f, 0.4, 0.4));
      break;
    case 'lose':
      [392, 330, 262].forEach((f, i) => tone(t + i * 0.2, 'triangle', f, f * 0.97, 0.45, 0.35));
      break;
  }
}

export function crowdLevel(v) {
  if (crowdGain && ctx) crowdGain.gain.setTargetAtTime(v, ctx.currentTime, 0.4);
}
