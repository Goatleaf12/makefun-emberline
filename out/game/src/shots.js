// shots.js — deterministic scenes for the screenshots, played by an autopilot.
//
// A shot is a real run of the real rules: the autopilot steers Ember, fires
// the flare, plants lanterns and picks drafts, stepping the world in fixed
// 1/60 s slices from a seed. Same kind + same seed renders the same frame
// every time, which is what makes the screenshots honest renders rather
// than staged drawings.

import { createWorld, step, draftPick, effFlareCost, effFlareRadius } from './world.js';
import { LANTERN_COST, SUN_COST } from './lanterns.js';
import { makeCampaign, completeNight, buyMeta, chooseRelic, META_PRIORITY } from './campaign.js';

// Draft picks the autopilot prefers, best first: lantern growth early,
// then survival, then damage.
const DRAFT_PRIORITY = [
  'lantern-slot',
  'beam-long',
  'frost-lantern',
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
    world.lanterns.list.length < world.lanterns.slots &&
    (world.wave >= 2 || world.mode === 'bossrush')
  ) {
    const px = Math.max(60, Math.min(900, e.x + 90));
    const py = Math.max(60, Math.min(540, e.y - 70));
    let clear = true;
    for (const l of world.lanterns.list) {
      const dx = l.x - px;
      const dy = l.y - py;
      if (dx * dx + dy * dy < 120 * 120) clear = false;
    }
    if (clear) {
      // Once the frost card is taken, the second lantern is a frost one:
      // the chill covers the lane the ember lanterns do not. Once the
      // Sun Lantern is bought on the campaign map, the third is a sun one.
      const hasFrost = world.lanterns.list.some((l) => l.kind === 'frost');
      const hasSun = world.lanterns.list.some((l) => l.kind === 'sun');
      const lanternKind =
        (world.upgrades.frost || 0) >= 1 && !hasFrost && world.lanterns.list.length >= 1
          ? 'frost'
          : (world.campaign?.meta.sun || 0) >= 1 && !hasSun && world.lanterns.list.length >= 2
            ? 'sun'
            : 'ember';
      const cost = lanternKind === 'sun' ? SUN_COST : LANTERN_COST;
      if (world.embers >= cost) actions.push({ kind: 'place', x: px, y: py, lanternKind });
    }
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

// Play a whole campaign with the autopilot: night 1, map buys, night 2,
// map buys, night 3. Between nights the autopilot buys meta upgrades in
// priority order and picks the Twin Flames relic. Returns { campaign,
// world, screen } where screen is 'won' (campaign complete), 'lost' (a
// night fell), or 'map' when stopAfterNight freezes on the map after that
// night. Every night starts from a fixed seed (seed + night * 1000), so a
// campaign replays identically.
export function playCampaign(seed, difficulty = 'normal', opts = {}) {
  const campaign = makeCampaign();
  let world = createWorld(seed, 0, difficulty, campaign);
  for (let night = 1; night <= 3; night++) {
    playSteps(world, 60 * 60 * 12);
    if (world.phase === 'lost') return { campaign, world, screen: 'lost' };
    if (world.phase === 'won') {
      // The last night: settle it too, so the campaign total includes it.
      completeNight(campaign, world);
      return { campaign, world, screen: 'won' };
    }
    if (world.phase !== 'nightwon') return { campaign, world, screen: 'lost' };
    completeNight(campaign, world);
    for (const id of META_PRIORITY) buyMeta(campaign, id);
    chooseRelic(campaign, 'twin-flames');
    if (opts.stopAfterNight === night) return { campaign, world, screen: 'map' };
    world = createWorld(seed + night * 1000, 0, difficulty, campaign);
  }
  return { campaign, world, screen: 'won' };
}

// Play Endless Night until the target wave (or the run falls). Returns
// the world, still in 'play' when it held that far. The autopilot plays
// it exactly like a campaign night: same steering, same drafts.
export function playEndless(seed, difficulty = 'normal', targetWave = 7) {
  const world = createWorld(seed, 0, difficulty, null, 'endless');
  let guard = 0;
  while (guard++ < 60 * 60 * 20 && world.phase === 'play') {
    playSteps(world, 60);
    if (world.wave >= targetWave) break;
  }
  return world;
}

// Stage one named scene. Returns the world, the screen to paint, the
// campaign, and the view (placement ghost) the render needs.
export function stageShot(kind, seed, difficulty = 'normal') {
  const world = createWorld(seed, 0, difficulty);
  const view = { placeMode: false, pointer: { x: 480, y: 300 } };
  if (kind === 'title') {
    return { world, screen: 'title', view, campaign: world.campaign };
  }
  if (kind === 'endless') {
    // Normal difficulty: the first seed whose endless run holds to wave 7
    // stages the mode in full flight — high wave, lanterns out, the HUD
    // reading ENDLESS NIGHT. Gentle is the fallback, never a loss.
    for (let s = seed; s < seed + 24; s++) {
      const w = playEndless(s, 'normal', 7);
      if (w.phase === 'play' && w.wave >= 7) return { world: w, screen: 'play', view, campaign: w.campaign };
    }
    const w = playEndless(seed, 'gentle', 7);
    return { world: w, screen: 'play', view, campaign: w.campaign };
  }
  if (kind === 'map') {
    // Gentle, seed search: the first seed whose night 1 is held stages
    // the campaign map, shards and shop visible.
    for (let s = seed; s < seed + 24; s++) {
      const run = playCampaign(s, 'gentle', { stopAfterNight: 1 });
      if (run.screen === 'map') return { world: run.world, screen: 'map', view, campaign: run.campaign };
    }
    const run = playCampaign(seed, 'gentle', { stopAfterNight: 1 });
    return { world: run.world, screen: 'play', view, campaign: run.campaign };
  }
  if (kind === 'night2') {
    // Normal difficulty: hold night 1, then play night 2 partway — gloom
    // wisps, a new objective, and the campaign's harder mix on screen.
    for (let s = seed; s < seed + 24; s++) {
      const run = playCampaign(s, 'normal', { stopAfterNight: 1 });
      if (run.screen === 'map') {
        const world2 = createWorld(s + 1000, 0, 'normal', run.campaign);
        playSteps(world2, 60 * 75);
        return { world: world2, screen: 'play', view, campaign: run.campaign };
      }
    }
    const run = playCampaign(seed, 'normal', { stopAfterNight: 1 });
    return { world: run.world, screen: 'play', view, campaign: run.campaign };
  }
  if (kind === 'draft') {
    playSteps(world, 60 * 240, { stopAtDraft: true });
    return { world, screen: world.phase === 'draft' ? 'draft' : 'play', view, campaign: world.campaign };
  }
  if (kind === 'play') {
    playSteps(world, 60 * 75);
    return { world, screen: 'play', view, campaign: world.campaign };
  }
  if (kind === 'action') {
    playSteps(world, 60 * 150);
    view.placeMode = world.embers >= LANTERN_COST;
    view.pointer = { x: 620, y: 220 };
    return { world, screen: 'play', view, campaign: world.campaign };
  }
  if (kind === 'end') {
    // Gentle, seed search: the first seed whose whole campaign is won
    // stages the campaign win screen. A full campaign is three nights,
    // so the search may take a while — it is deterministic.
    for (let s = seed; s < seed + 24; s++) {
      const run = playCampaign(s, 'gentle');
      if (run.screen === 'won') return { world: run.world, screen: 'won', view, campaign: run.campaign };
    }
    const run = playCampaign(seed, 'gentle');
    return { world: run.world, screen: run.screen, view, campaign: run.campaign };
  }
  if (kind === 'rushdraft') {
    // Boss Rush: beat boss 1, then freeze on the inter-boss draft — the
    // "BOSS 1 DOWN" header, the next-boss preview, and the three cards.
    for (let s = seed; s < seed + 24; s++) {
      const w = createWorld(s, 0, 'normal', null, 'bossrush');
      playSteps(w, 60 * 60 * 12, { stopAtDraft: true });
      if (w.phase === 'draft' && w.stats.bosses >= 1) return { world: w, screen: 'draft', view, campaign: w.campaign };
    }
    const w = createWorld(seed, 0, 'normal', null, 'bossrush');
    playSteps(w, 60 * 60 * 12, { stopAtDraft: true });
    return { world: w, screen: w.phase === 'draft' ? 'draft' : 'play', view, campaign: w.campaign };
  }
  if (kind === 'bossrush') {
    // Boss Rush: beat boss 1, take the inter-boss draft, then freeze on
    // boss 2 just AFTER its intro splash ends (age 3.5 > 2.4), so the
    // letterbox bars are gone and the full HUD — mode line, score,
    // hearts, boss health bar, flare, lanterns — reads clean while the
    // boss is still mid-fight.
    for (let s = seed; s < seed + 24; s++) {
      const w = createWorld(s, 0, 'normal', null, 'bossrush');
      let guard = 0;
      while (guard++ < 60 * 60 * 14 && w.phase === 'play') {
        playSteps(w, 60);
        if (w.wave >= 2 && w.boss && w.boss.age >= 3.5) break;
      }
      if (w.phase === 'play' && w.wave >= 2 && w.boss) return { world: w, screen: 'play', view, campaign: w.campaign };
    }
    const w = createWorld(seed, 0, 'normal', null, 'bossrush');
    playSteps(w, 60 * 60);
    return { world: w, screen: 'play', view, campaign: w.campaign };
  }
  if (kind === 'boss') {
    // Play until the Gloom Herald appears on wave 10, then hold about a
    // second into its intro splash. One-second chunks keep the staging
    // deterministic: the same seed always freezes the same frame.
    let guard = 0;
    while (guard++ < 60 * 60 * 14) {
      if (world.phase !== 'play') break;
      playSteps(world, 60);
      if (world.boss && world.boss.age >= 1.0) break;
    }
    return { world, screen: 'play', view, campaign: world.campaign };
  }
  return { world, screen: 'play', view, campaign: world.campaign };
}
