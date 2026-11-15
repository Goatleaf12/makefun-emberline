// config.js — every number LANTERNWARD is tuned from, in one place.
//
// The field is 960 by 600 logical pixels and the canvas scales it to the
// window. Ten waves run from dusk to dawn; wave 10 ends with the Gloom
// Herald. Five beacon rings light as the score climbs. Four hearts, one
// flare that costs energy, and a mote economy that buys lanterns.

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

// What one wave throws at the keeper. Counts grow, speed grows, and new
// kinds join as the night deepens. Wave 10 is the boss wave: the Herald
// plus a slow trickle of drifters while it lives.
export function waveSpec(wave) {
  const kinds = ['drifter'];
  if (wave >= 2) kinds.push('chaser');
  if (wave >= 3) kinds.push('splitter');
  if (wave >= 4) kinds.push('swift');
  return {
    count: wave === 1 ? 5 : 5 + wave * 2,
    speed: wave === 1 ? 44 : 48 + wave * 7,
    kinds,
    storm: TUNE.stormWaves.includes(wave),
    boss: wave === 10,
  };
}

// A wisp kind's body: health, speed factor, score bonus, radius, colour.
export const WISP_KINDS = {
  drifter: { hp: 1, speed: 0.9, bonus: 0, radius: 15, color: PALETTE.wispDrifter },
  chaser: { hp: 2, speed: 1.15, bonus: 15, radius: 15, color: PALETTE.wispChaser },
  splitter: { hp: 2, speed: 0.95, bonus: 25, radius: 16, color: PALETTE.wispSplitter },
  swift: { hp: 1, speed: 1.55, bonus: 5, radius: 12, color: PALETTE.wispSwift },
  boss: { hp: 26, speed: 0.55, bonus: 500, radius: 34, color: PALETTE.wispBoss },
};

// The three pickups. One slot only: taking a new one replaces the old.
export const PICKUPS = {
  shield: { name: 'Aegis Shield', hint: 'Blocks one hit' },
  magnet: { name: 'Mote Magnet', hint: 'Pulls motes to you' },
  slow: { name: 'Slowlight', hint: 'Wisps slow for 6s' },
};
