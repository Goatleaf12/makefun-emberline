// shots.js — deterministic scenes for the screenshots, played by an autopilot.
//
// A shot is a real run of the real rules: the autopilot steers Ember, fires
// the flare, plants lanterns and picks drafts, stepping the world in fixed
// 1/60 s slices from a seed. Same kind + same seed renders the same frame
// every time, which is what makes the screenshots honest renders rather
// than staged drawings.

import { createWorld, step, draftPick, effFlareCost, effFlareRadius } from './world.js';
import { LANTERN_COST } from './lanterns.js';

// Draft picks the autopilot prefers, best first: lantern growth early,
// then survival, then damage.
const DRAFT_PRIORITY = [
  'lantern-slot',
  'beam-long',
  'wick-rapid',
  'heart',
  'motes-rich',
  'flare-wide',
  'wick-heavy',
  'wings-swift',
  'magnet-strong',
  'combo-long',
  'dash-swift',
  'flare-kindled',
];

// One autopilot decision: where to steer, whether to dash, what to do.
function autopilot(world) {
  const e = world.ember;
  let mote = null;
  let md = Infinity;
  for (const m of world.motes) {
    const d = (m.x - e.x) * (m.x - e.x) + (m.y - e.y) * (m.y - e.y);
    if (d < md) {
      md = d;
      mote = m;
    }
  }
  let wisp = null;
  let wd = Infinity;
  for (const w of world.wisps) {
    const d = (w.x - e.x) * (w.x - e.x) + (w.y - e.y) * (w.y - e.y);
    if (d < wd) {
      wd = d;
      wisp = w;
    }
  }
  let steer = { x: 0, y: 0 };
  if (wisp && wd < 70 * 70) {
    const d = Math.sqrt(wd) || 1;
    steer = { x: (e.x - wisp.x) / d, y: (e.y - wisp.y) / d };
  } else if (mote) {
    const d = Math.sqrt(md) || 1;
    steer = { x: (mote.x - e.x) / d, y: (mote.y - e.y) / d };
  }
  const dash = !!wisp && wd < 45 * 45 && e.dashCool <= 0;
  const actions = [];
  if (world.flareEnergy >= effFlareCost(world)) {
    const R = effFlareRadius(world);
    let near = 0;
    for (const w of world.wisps) {
      const dx = w.x - e.x;
      const dy = w.y - e.y;
      if (dx * dx + dy * dy < R * R) near++;
    }
    if (near >= 2) actions.push({ kind: 'flare' });
  }
  if (
    world.embers >= LANTERN_COST &&
    world.lanterns.list.length < world.lanterns.slots &&
    world.wave >= 2
  ) {
    const px = Math.max(60, Math.min(900, e.x + 90));
    const py = Math.max(60, Math.min(540, e.y - 70));
    let clear = true;
    for (const l of world.lanterns.list) {
      const dx = l.x - px;
      const dy = l.y - py;
      if (dx * dx + dy * dy < 120 * 120) clear = false;
    }
    if (clear) actions.push({ kind: 'place', x: px, y: py });
  }
  return { steer, dash, actions };
}

// Play the run forward up to maxSteps fixed steps. Drafts are picked by
// priority unless stopAtDraft freezes on the cards instead.
export function playSteps(world, maxSteps, opts = {}) {
  let steps = 0;
  while (steps < maxSteps && world.phase === 'play') {
    const { steer, dash, actions } = autopilot(world);
    step(world, 1 / 60, steer, dash, actions);
    steps++;
    if (world.phase === 'draft') {
      if (opts.stopAtDraft) break;
      let idx = 0;
      let best = 999;
      world.draftOptions.forEach((u, i) => {
        const p = DRAFT_PRIORITY.indexOf(u.id);
        if (p >= 0 && p < best) {
          best = p;
          idx = i;
        }
      });
      draftPick(world, idx);
    }
  }
  return steps;
}

// Stage one named scene. Returns the world, the screen to paint, and the
// view (placement ghost) the render needs.
export function stageShot(kind, seed) {
  const world = createWorld(seed, 0);
  const view = { placeMode: false, pointer: { x: 480, y: 300 } };
  if (kind === 'title') {
    return { world, screen: 'title', view };
  }
  if (kind === 'draft') {
    playSteps(world, 60 * 240, { stopAtDraft: true });
    return { world, screen: world.phase === 'draft' ? 'draft' : 'play', view };
  }
  if (kind === 'play') {
    playSteps(world, 60 * 75);
    return { world, screen: 'play', view };
  }
  if (kind === 'action') {
    playSteps(world, 60 * 150);
    view.placeMode = world.embers >= LANTERN_COST;
    view.pointer = { x: 620, y: 220 };
    return { world, screen: 'play', view };
  }
  if (kind === 'end') {
    playSteps(world, 60 * 60 * 14);
    const screen = world.phase === 'won' ? 'won' : world.phase === 'lost' ? 'lost' : 'play';
    return { world, screen, view };
  }
  return { world, screen: 'play', view };
}
