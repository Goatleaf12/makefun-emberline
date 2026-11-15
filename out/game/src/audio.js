// audio.js — every sound LANTERNWARD makes, synthesized live in WebAudio.
// No audio files ship: chimes, thuds, swells and the ambient pad are all
// oscillators and noise through filters. Silent until the player first
// interacts, and every method is a safe no-op when audio is unavailable.

export function makeAudio() {
  const audio = {
    ctx: null,
    master: null,
    music: null,
    muted: false,
    started: false,
  };

  function ensure() {
    if (audio.ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      audio.ctx = new AC();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.5;
      audio.master.connect(audio.ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  // Start the context (on first input) and the slow ambient pad.
  audio.unlock = function unlock() {
    if (!ensure() || audio.started) return;
    audio.started = true;
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
    startPad();
  };

  audio.toggleMute = function toggleMute() {
    audio.muted = !audio.muted;
    if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.5;
    return audio.muted;
  };

  function tone(freq, dur, type, vol, slideTo) {
    if (!audio.ctx || audio.muted) return;
    const t0 = audio.ctx.currentTime;
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, lowpass) {
    if (!audio.ctx || audio.muted) return;
    const t0 = audio.ctx.currentTime;
    const len = Math.max(1, Math.floor(audio.ctx.sampleRate * dur));
    const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audio.ctx.createBufferSource();
    src.buffer = buf;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = audio.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(audio.master);
    src.start(t0);
  }

  // A soft two-oscillator pad that breathes under the whole run.
  function startPad() {
    const ctx = audio.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.05;
    gain.connect(audio.master);
    const notes = [110, 164.81, 220];
    for (const freq of notes) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07 + freq / 4000;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.02;
      lfo.connect(lfoGain);
      lfoGain.connect(gain);
      osc.connect(gain);
      osc.start();
      lfo.start();
    }
    audio.music = gain;
  }

  audio.pickup = function pickup(combo) {
    const base = 660 + Math.min(combo, 5) * 60;
    tone(base, 0.12, 'sine', 0.22);
    tone(base * 1.5, 0.16, 'sine', 0.14);
  };

  audio.hit = function hit() {
    tone(140, 0.25, 'sawtooth', 0.3, 60);
    noise(0.18, 0.25, 900);
  };

  audio.flare = function flare() {
    tone(220, 0.6, 'sine', 0.28, 880);
    tone(330, 0.6, 'triangle', 0.18, 1320);
    noise(0.4, 0.12, 2400);
  };

  audio.wave = function wave() {
    tone(392, 0.3, 'triangle', 0.2);
    tone(523.25, 0.45, 'triangle', 0.2);
  };

  audio.place = function place() {
    tone(520, 0.1, 'square', 0.12);
    tone(780, 0.18, 'sine', 0.18);
  };

  audio.bolt = function bolt() {
    tone(980, 0.07, 'square', 0.06, 620);
  };

  audio.boss = function boss() {
    tone(98, 0.8, 'sawtooth', 0.3, 49);
    noise(0.6, 0.2, 500);
  };

  audio.win = function win() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      setTimeout(() => tone(f, 0.5, 'triangle', 0.22), i * 140);
    });
  };

  audio.lose = function lose() {
    [392, 311.13, 233.08].forEach((f, i) => {
      setTimeout(() => tone(f, 0.5, 'sine', 0.2), i * 180);
    });
  };

  return audio;
}
