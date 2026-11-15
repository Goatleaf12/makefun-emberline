// EMBERLINE tuning: every number that shapes the night lives here.
// One place to tune, so the feel of the game can be balanced without
// touching the rules in world.js or the drawing in render.js.

export const FIELD = { width: 960, height: 600 };

export const PALETTE = {
  night: '#070a1e',
  nightEdge: '#171233',
  ember: '#ffb347',
  emberHot: '#ff8c42',
  mote: '#ffd166',
  moteCore: '#fff3c4',
  wisp: '#38bdf8',
  wispEdge: '#a78bfa',
  cream: '#fff7e6',
  dimCream: '#c9c2a8',
  heart: '#ff6b81',
  ringLit: '#ffd166',
  ringDark: '#3a3f5e',
  flare: '#ffe9a8',
  danger: '#ff5d73',
  nebulaViolet: '#6d28d9',
  nebulaTeal: '#0e7490',
  nebulaRose: '#be185d',
  nebulaAmber: '#b45309',
};

// Each wisp kind now has its own unmistakable colour AND glow: sky-blue
// drifter, violet chaser, magenta splitter, cyan swift. At thumbnail size
// the player can tell at a glance which threat is coming.
export const WISP_GLOWS = {
  drifter: 'rgba(56,189,248,0.55)',
  chaser: 'rgba(168,85,247,0.55)',
  splitter: 'rgba(236,72,153,0.55)',
  swift: 'rgba(34,211,238,0.55)',
};

export const TUNING = {
  hearts: 4,
  emberRadius: 13,
  emberSpeed: 235,
  dashSpeed: 520,
  dashTime: 0.16,
  dashCooldown: 1.4,
  moteRadius: 8,
  moteValue: 10,
  moteEnergy: 6,
  braveDistance: 95,
  braveFactor: 2,
  comboWindow: 2.6,
  comboStep: 5,
  comboMax: 5,
  flareCost: 90,
  flareRadius: 250,
  flareScore: { drifter: 50, chaser: 80, splitter: 100, swift: 60 },
  hitInvulnerable: 1.6,
  shakeOnHit: 14,
  wispLifetime: 20,
  moteTarget: 14,
  stormMotes: 42,
  pickupLifetime: 12,
  slowDuration: 6,
  ringScores: [3000, 8000, 15000, 25000, 40000],
  totalWaves: 10,
  stormWaves: [3, 6, 9],
  intermission: 1.8,
};

// What each wave throws at the keeper. Counts grow, speed grows, and new
// wisp kinds join the night as the waves deepen.
export function waveSpec(wave) {
  const wispCount = 3 + wave * 2;
  const speed = 48 + wave * 6;
  const kinds = ['drifter'];
  if (wave >= 2) kinds.push('swift');
  if (wave >= 3) kinds.push('chaser');
  if (wave >= 4) kinds.push('splitter');
  return {
    wave,
    wispCount,
    speed,
    kinds,
    spawnGap: Math.max(0.55, 1.5 - wave * 0.09),
    storm: TUNING.stormWaves.includes(wave),
  };
}

export const WISP_KINDS = {
  drifter: { radius: 15, speed: 0.62, score: 50, hue: '#38bdf8' },
  chaser: { radius: 15, speed: 0.95, score: 80, hue: '#a855f7' },
  splitter: { radius: 19, speed: 0.55, score: 100, hue: '#ec4899' },
  swift: { radius: 11, speed: 1.35, score: 60, hue: '#22d3ee' },
};

export const PICKUP_KINDS = {
  shield: { label: 'Aegis Shield', detail: 'Blocks one hit', color: '#93c5fd' },
  magnet: { label: 'Mote Magnet', detail: 'Pulls motes to you', color: '#fbbf24' },
  slow: { label: 'Slowlight', detail: 'Wisps drift slowly', color: '#a5b4fc' },
};
