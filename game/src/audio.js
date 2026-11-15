// Synthesised sound for EMBERLINE: every chime, thud and swell is made
// with WebAudio oscillators, so the game ships no audio files at all.
// Safe to construct in Node or a headless browser: the audio context is
// only created lazily, on the first user gesture or explicit unlock.

export class SoundBank {
  constructor() {
    this.context = null;
    this.muted = false;
    this.musicNodes = null;
    this.master = null;
  }

  unlock() {
    if (this.context) {
      if (this.context.state === 'suspended') this.context.resume();
      return;
    }
    const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
    if (!AC) return;
    this.context = new AC();
    this.master = this.context.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.context.destination);
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  tone(freq, dur, type, vol, slideTo) {
    if (!this.context || this.muted) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + dur);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  chime(combo) {
    const base = 620 + Math.min(combo, 5) * 70;
    this.tone(base, 0.14, 'sine', 0.22);
    this.tone(base * 1.5, 0.2, 'sine', 0.14);
  }

  thud() {
    this.tone(150, 0.3, 'triangle', 0.4, 55);
    this.tone(70, 0.35, 'sine', 0.35, 40);
  }

  flareSwell() {
    this.tone(220, 0.7, 'sawtooth', 0.12, 880);
    this.tone(440, 0.7, 'sine', 0.18, 1320);
    this.tone(660, 0.5, 'sine', 0.1, 990);
  }

  horn() {
    this.tone(196, 0.5, 'triangle', 0.25);
    this.tone(294, 0.5, 'triangle', 0.2);
    this.tone(392, 0.6, 'sine', 0.15);
  }

  click() {
    this.tone(880, 0.06, 'square', 0.08);
  }

  pickup() {
    this.tone(520, 0.12, 'sine', 0.2, 780);
    this.tone(780, 0.16, 'sine', 0.14, 1040);
  }

  dash() {
    this.tone(300, 0.12, 'sine', 0.1, 720);
  }

  victory() {
    [523, 659, 784, 1047].forEach((f, i) => {
      if (!this.context || this.muted) return;
      const now = this.context.currentTime + i * 0.16;
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.55);
    });
  }

  // A slow two-oscillator pad that breathes under the game. Started once
  // per session; the LFO keeps it moving without any scheduling loop.
  startMusic() {
    if (!this.context || this.musicNodes) return;
    const pad = this.context.createGain();
    pad.gain.value = 0.05;
    pad.connect(this.master);
    const oscs = [110, 164.8, 220].map((f) => {
      const o = this.context.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      o.connect(pad);
      o.start();
      return o;
    });
    const lfo = this.context.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = this.context.createGain();
    lfoGain.gain.value = 0.025;
    lfo.connect(lfoGain);
    lfoGain.connect(pad.gain);
    lfo.start();
    this.musicNodes = { oscs, lfo, pad };
  }
}
