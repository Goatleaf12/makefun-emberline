// draft.js — the between-wave upgrade draft: 3 cards, pick 1, the build is the sum of picks.

export const UPGRADES = [
  {
    id: 'heart',
    name: 'Extra Heart',
    desc: '+1 max heart, heal 1',
    max: 2,
    apply: (u) => { u.maxHearts += 1; u.heal = 1; },
  },
  {
    id: 'flare-wide',
    name: 'Wide Flare',
    desc: '+60 px flare radius',
    max: 3,
    apply: (u) => { u.flareRadius += 60; },
  },
  {
    id: 'flare-kindled',
    name: 'Kindled Flare',
    desc: 'Flare costs 15 less energy',
    max: 3,
    apply: (u) => { u.flareCost -= 15; },
  },
  {
    id: 'dash-swift',
    name: 'Swift Dash',
    desc: 'Dash recharges 30% faster',
    max: 2,
    apply: (u) => { u.dashCooldown *= 0.7; },
  },
  {
    id: 'magnet-strong',
    name: 'Strong Magnet',
    desc: '+80 px mote pull',
    max: 2,
    apply: (u) => { u.magnet += 80; },
  },
  {
    id: 'combo-long',
    name: 'Long Combo',
    desc: '+1.2 s combo window',
    max: 2,
    apply: (u) => { u.comboWindow += 1.2; },
  },
  {
    id: 'wings-swift',
    name: 'Swift Wings',
    desc: '+30 px/s speed',
    max: 3,
    apply: (u) => { u.speed += 30; },
  },
  {
    id: 'motes-rich',
    name: 'Rich Motes',
    desc: '+5 score, +2 energy per mote',
    max: 3,
    apply: (u) => { u.moteScore += 5; u.moteEnergy += 2; },
  },
  {
    id: 'frost-lantern',
    name: 'Frost Lantern',
    desc: 'Unlock frost lanterns: chill wisps nearby',
    max: 3,
    apply: (u) => { u.frost = (u.frost || 0) + 1; },
  },
  {
    id: 'storm-lantern',
    name: 'Storm Lantern',
    desc: 'Unlock storm lanterns: lightning chains',
    max: 2,
    apply: (u) => { u.storm = (u.storm || 0) + 1; },
  },
  {
    id: 'lantern-slot',
    name: 'Lantern Slot',
    desc: '+1 lantern you may plant',
    max: 2,
    apply: (u) => { u.lanternSlots += 1; },
  },
  {
    id: 'beam-long',
    name: 'Long Beam',
    desc: 'Lanterns reach +55 px',
    max: 3,
    apply: (u) => { u.lanternRange += 55; },
  },
  {
    id: 'wick-rapid',
    name: 'Rapid Wick',
    desc: 'Lanterns fire 25% faster',
    max: 3,
    apply: (u) => { u.lanternCooldown *= 0.75; },
  },
  {
    id: 'wick-heavy',
    name: 'Heavy Wick',
    desc: 'Lantern bolts hit +1 harder',
    max: 2,
    apply: (u) => { u.lanternDamage += 1; },
  },
];

// The run's upgrade state: one object the world owns, the draft mutates.
export function makeUpgrades() {
  return {
    maxHearts: 0,
    heal: 0,
    flareRadius: 0,
    flareCost: 0,
    dashCooldown: 1,
    magnet: 0,
    comboWindow: 0,
    speed: 0,
    moteScore: 0,
    moteEnergy: 0,
    lanternSlots: 0,
    lanternRange: 0,
    lanternCooldown: 1,
    lanternDamage: 0,
    frost: 0,
    storm: 0,
    taken: {},
  };
}

// Three distinct cards the run may still take. The Storm Lantern card joins the pool only at Mastery level 2.
export function rollDraft(rng, upgrades, allowStorm = false) {
  const pool = UPGRADES.filter((u) => (u.id !== 'storm-lantern' || allowStorm) && (upgrades.taken[u.id] || 0) < u.max);
  const options = [];
  while (options.length < 3 && pool.length > 0) {
    const i = Math.floor(rng() * pool.length);
    options.push(pool.splice(i, 1)[0]);
  }
  return options;
}

export function applyUpgrade(upgrades, upgrade) {
  upgrade.apply(upgrades);
  upgrades.taken[upgrade.id] = (upgrades.taken[upgrade.id] || 0) + 1;
}

export function draftCardRects(w, h) {
  const cw = 210;
  const ch = 150;
  const gap = 26;
  const total = cw * 3 + gap * 2;
  const x0 = (w - total) / 2;
  const y0 = h / 2 - 40;
  return [0, 1, 2].map((i) => ({
    x: x0 + i * (cw + gap),
    y: y0,
    w: cw,
    h: ch,
  }));
}

export function draftHit(rects, x, y) {
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}

export function buildLine(upgrades) {
  const parts = [];
  for (const u of UPGRADES) {
    const n = upgrades.taken[u.id] || 0;
    if (n > 0) parts.push(`${u.name} x${n}`);
  }
  return parts.length > 0 ? parts.join('  ·  ') : 'No upgrades yet — pick your first.';
}
