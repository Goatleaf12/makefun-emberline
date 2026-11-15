// The between-wave upgrade draft for EMBERLINE. After the keeper clears
// a wave, play pauses and three upgrade cards are offered; the keeper
// picks one (click, or keys 1 / 2 / 3) and the next wave begins with that
// upgrade in force. Every upgrade is a small, permanent change to the
// keeper's own numbers, so choices compound across the ten waves.
// DOM-free and clock-free: options are drawn from the world's seeded RNG,
// so the same seed always offers the same three cards.

import { FIELD, TUNING } from './config.js';

export const CARD_W = 264;
export const CARD_H = 200;
export const CARD_GAP = 24;
export const CARD_Y = 196;

// Eight upgrades. `max` caps how often one can be taken, so no single
// upgrade can be stacked into a solved game; `apply` mutates only the
// per-run fields the world owns (never the shared TUNING table).
export const UPGRADES = [
  {
    id: 'heart', name: 'Extra Heart', detail: '+1 max heart, and heal 1 now',
    color: '#ff6b81', icon: '♥', max: 2,
    apply(world) {
      world.maxHearts = Math.min(6, world.maxHearts + 1);
      world.hearts = Math.min(world.maxHearts, world.hearts + 1);
    },
  },
  {
    id: 'flarewide', name: 'Wide Flare', detail: 'Flare banishes 60 px farther',
    color: '#ffe9a8', icon: '◎', max: 3,
    apply(world) { world.flareRadius = Math.min(430, world.flareRadius + 60); },
  },
  {
    id: 'flarecheap', name: 'Kindled Flare', detail: 'Flare costs 15 less energy',
    color: '#ffd166', icon: '✦', max: 3,
    apply(world) { world.flareCost = Math.max(45, world.flareCost - 15); },
  },
  {
    id: 'dashquick', name: 'Swift Dash', detail: 'Dash recharges 30% faster',
    color: '#fff7e6', icon: '»', max: 3,
    apply(world) { world.dashCooldown = Math.max(0.6, world.dashCooldown * 0.7); },
  },
  {
    id: 'magnet', name: 'Strong Magnet', detail: 'Magnet pulls motes from 80 px farther',
    color: '#fbbf24', icon: '◉', max: 3,
    apply(world) { world.magnetRadius = Math.min(360, world.magnetRadius + 80); },
  },
  {
    id: 'combolong', name: 'Long Combo', detail: 'Combo window lasts 1.2 s longer',
    color: '#ff9d5c', icon: '∞', max: 3,
    apply(world) { world.comboWindow = Math.min(6, world.comboWindow + 1.2); },
  },
  {
    id: 'swiftwing', name: 'Swift Wings', detail: 'Ember flies 30 px/s faster',
    color: '#7dd3fc', icon: '➤', max: 3,
    apply(world) { world.emberSpeed = Math.min(340, world.emberSpeed + 30); },
  },
  {
    id: 'richmotes', name: 'Rich Motes', detail: 'Every mote pays +5 score, +2 energy',
    color: '#a5f3fc', icon: '★', max: 3,
    apply(world) { world.moteValue += 5; world.moteEnergy += 2; },
  },
];

function taken(world, id) {
  return world.upgradesTaken[id] || 0;
}

// How many times this upgrade can still be offered to this keeper.
export function draftRemaining(world, upgrade) {
  return Math.max(0, upgrade.max - taken(world, upgrade.id));
}

// Draw three distinct upgrades the keeper has not maxed out yet, using
// the world's seeded RNG so the offer is reproducible from the seed.
export function createDraft(world, rng) {
  const pool = UPGRADES.filter((u) => draftRemaining(world, u) > 0);
  // Fisher-Yates shuffle driven by the seeded RNG.
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = rng.int(0, i);
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  const options = pool.slice(0, 3);
  world.draft = { options, wave: world.wave };
  return world.draft;
}

// The three card rectangles, in field pixels, shared by the renderer
// (drawing) and the input handling (click hit-testing).
export function draftCardRects() {
  const total = CARD_W * 3 + CARD_GAP * 2;
  const x0 = (FIELD.width - total) / 2;
  return [0, 1, 2].map((i) => ({
    x: x0 + i * (CARD_W + CARD_GAP),
    y: CARD_Y,
    w: CARD_W,
    h: CARD_H,
  }));
}

// Which card (0, 1, 2) a field-coordinate click lands on, or -1.
export function draftPickAt(world, x, y) {
  if (!world.draft) return -1;
  const rects = draftCardRects();
  for (let i = 0; i < rects.length; i += 1) {
    const r = rects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}

// Take the chosen card: apply its upgrade, clear the draft, and open the
// next wave. Returns the upgrade taken, or null when there is no draft.
export function applyDraftPick(world, index) {
  if (!world.draft) return null;
  const option = world.draft.options[index];
  if (!option) return null;
  option.apply(world);
  world.upgradesTaken[option.id] = taken(world, option.id) + 1;
  world.draft = null;
  world.screen = 'play';
  world.message = `${option.name}!`;
  world.messageTimer = 2;
  world.startWave(world.wave + 1);
  return option;
}

// How many upgrades the keeper has taken so far, for the HUD.
export function draftTakenCount(world) {
  return Object.values(world.upgradesTaken).reduce((a, b) => a + b, 0);
}

// The draft's headline, so the renderer never hard-codes the wording.
export function draftTitle(world) {
  return `WAVE ${world.wave} CLEARED — CHOOSE AN UPGRADE`;
}
