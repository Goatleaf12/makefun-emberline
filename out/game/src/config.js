// config.js — every number LANTERNWARD is tuned from, in one place.
// The field is 960 by 600; ten waves run from dusk to dawn, wave 10
// ends with the Gloom Herald. Hearts, wisp speed and count vary by
// difficulty; one flare, and a mote economy that buys lanterns.

export const FIELD = { w: 960, h: 600 };

export const PALETTE = {
  night0: '#070b1d',
  night1: '#0b1026',
  night2: '#131a3a',
  ember: '#ffb347',
  emberHot: '#ff8c42',
  gold: '#ffd166',
  cream: '#fff7e6',
  dim: '#9aa7d8',
  wispDrifter: '#38bdf8',
  wispChaser: '#a855f7',
  wispSplitter: '#ec4899',
  wispSwift: '#22d3ee',
  wispBoss: '#f43f5e',
  lantern: '#fde68a',
  bolt: '#fef3c7',
  danger: '#fb7185',
};

export const TUNE = {
  hearts: 4,
  emberSpeed: 235, // px/s, before Swift Wings
  dashSpeed: 430,
  dashTime: 0.16, // seconds of dash
  dashCooldown: 2.2,
  emberRadius: 13,
  moteScore: 10,
  moteEnergy: 6, // flare energy per mote
  moteEmbers: 1, // currency per mote
  wispScore: 25, // banishing a wisp pays this, plus its kind bonus
  flareRadius: 250,
  flareCost: 90, // energy, 0..100
  flareDamage: 3,
  comboWindow: 2.5, // seconds to keep the chain alive
  comboMax: 5,
  braveRadius: 110, // a mote this close to a wisp pays double
  ringScores: [1000, 3000, 7000, 14000, 25000],
  stormWaves: [3, 6, 9],
  wispLifetime: 22, // seconds before a wisp fades out on its own
  pickupLifetime: 12,
};

// The three difficulties, picked on the title screen (keys 1 / 2 / 3).
// Gentle is for learning; harsh is faster with one heart fewer.
// Difficulty only changes hearts, wisp speed and count — never the rules.
export const DIFFICULTIES = {
  gentle: { name: 'FIRST LIGHT', tag: 'gentle', hearts: 5, speed: 0.8, count: -2 },
  normal: { name: 'LONG NIGHT', tag: 'the intended night', hearts: 4, speed: 1, count: 0 },
  harsh: { name: 'ENDLESS DARK', tag: 'brutal', hearts: 3, speed: 1.15, count: 1 },
};
export const DIFFICULTY_IDS = ['gentle', 'normal', 'harsh'];

// What one wave throws at the keeper. Counts and speed grow; new
// kinds join as the night deepens. Wave 10 is the boss wave. Later
// campaign nights are harder; Endless Night borrows the later nights'
// kinds as its waves climb, and a boss every tenth wave.
export function waveSpec(wave, difficulty = 'normal', night = 1, endless = false) {
  const kinds = ['drifter'];
  if (wave >= 2) kinds.push('chaser');
  if (wave >= 3) kinds.push('splitter');
  if (wave >= 4) kinds.push('swift');
  if (wave >= 5) kinds.push('bulwark');
  if ((night >= 2 || (endless && wave >= 12)) && wave >= 2) kinds.push('gloom');
  if ((night >= 3 || (endless && wave >= 15)) && wave >= 3) kinds.push('spark');
  const diff = DIFFICULTIES[difficulty] || DIFFICULTIES.normal;
  const nightCount = night >= 3 ? 1 : 0;
  const nightSpeed = night >= 3 ? 1.06 : night === 2 ? 1.03 : 1;
  // Past wave 10 the endless horde itself speeds up, 1.5% a wave.
  const endlessSpeed = endless && wave > 10 ? 1 + 0.015 * (wave - 10) : 1;
  return {
    count: Math.max(3, (wave === 1 ? 5 : 5 + wave * 2) + diff.count + nightCount),
    speed: (wave === 1 ? 44 : 48 + wave * 7) * diff.speed * nightSpeed * endlessSpeed,
    kinds,
    storm: TUNE.stormWaves.includes(wave),
    boss: wave === 10 || (endless && wave % 10 === 0),
  };
}

// A wisp kind's body: health, speed factor, score bonus, radius, colour.
export const WISP_KINDS = {
  drifter: { hp: 1, speed: 0.9, bonus: 0, radius: 15, color: PALETTE.wispDrifter },
  chaser: { hp: 2, speed: 1.15, bonus: 15, radius: 15, color: PALETTE.wispChaser },
  splitter: { hp: 2, speed: 0.95, bonus: 25, radius: 16, color: PALETTE.wispSplitter },
  swift: { hp: 1, speed: 1.55, bonus: 5, radius: 12, color: PALETTE.wispSwift },
  bulwark: { hp: 3, speed: 0.7, bonus: 30, radius: 18, color: '#94a3b8' },
  gloom: { hp: 4, speed: 0.6, bonus: 40, radius: 20, color: '#8b7cc8' },
  spark: { hp: 1, speed: 1.9, bonus: 10, radius: 10, color: '#facc15' },
  boss: { hp: 26, speed: 0.55, bonus: 500, radius: 34, color: PALETTE.wispBoss },
};

// The three pickups. One slot only: taking a new one replaces the old.
export const PICKUPS = {
  shield: { name: 'Aegis Shield', hint: 'Blocks one hit' },
  magnet: { name: 'Mote Magnet', hint: 'Pulls motes to you' },
  slow: { name: 'Slowlight', hint: 'Wisps slow for 6s' },
};
