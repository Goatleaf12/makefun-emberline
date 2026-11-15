// shots.js — deterministic scenes for the screenshots, played by an autopilot. Same kind + same seed renders the same frame every time.

import { createWorld, step, draftPick, effFlareCost, effFlareRadius } from './world.js';
import { LANTERN_COST, SUN_COST, STORM_COST } from './lanterns.js';
import { makeCampaign, completeNight, buyMeta, chooseRelic, META_PRIORITY } from './campaign.js';
import { defaultMastery, masteryGain, applyMasteryGain, masteryLevel, masteryTitle } from './mastery.js';
import { HOUSE_RECORDS } from './records.js';

// Draft picks the autopilot prefers, best first.
const DRAFT_PRIORITY = [
  'lantern-slot',
  'beam-long',
  'frost-lantern',
  'storm-lantern',
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
  // Deep cards sit last, so the autopilot's picks in the first three nights never change.
  'flare-burn',
  'ember-ward',
];

// One autopilot decision: where to steer, whether to dash, what to do.
// opts.reserveStorm holds the third slot for the storm lantern: a keeper building storm saves the slot
// instead of spending it on ember or frost, so the storm rod lands as soon as its card is taken.
function autopilot(world, opts = {}) {
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
      // Second lantern frost (once its card is taken), third storm (once taken), fourth sun (once the map unlocks it).
      // A storm build places the rod before frost: the rod is the point of the run.
      const hasFrost = world.lanterns.list.some((l) => l.kind === 'frost');
      const hasStorm = world.lanterns.list.some((l) => l.kind === 'storm');
      const hasSun = world.lanterns.list.some((l) => l.kind === 'sun');
      const n = world.lanterns.list.length;
      const stormFirst = opts.reserveStorm && (world.upgrades.storm || 0) >= 1 && !hasStorm && n >= 2;
      const lanternKind =
        stormFirst
          ? 'storm'
          : (world.upgrades.frost || 0) >= 1 && !hasFrost && n >= 1
            ? 'frost'
            : (world.upgrades.storm || 0) >= 1 && !hasStorm && n >= 2
              ? 'storm'
              : (world.campaign?.meta.sun || 0) >= 1 && !hasSun && n >= 2
                ? 'sun'
                : 'ember';
      const cost = lanternKind === 'sun' ? SUN_COST : lanternKind === 'storm' ? STORM_COST : LANTERN_COST;
      const reserving = opts.reserveStorm && world.stormUnlocked && (world.upgrades.storm || 0) < 1 && n >= 2;
      if (world.embers >= cost && !reserving) actions.push({ kind: 'place', x: px, y: py, lanternKind });
    }
  }
  return { steer, dash, actions };
}

// Play the run forward up to maxSteps fixed steps. Drafts are picked by priority unless stopAtDraft freezes on the cards.
export function playSteps(world, maxSteps, opts = {}) {
  let steps = 0;
  while (steps < maxSteps && world.phase === 'play') {
    const { steer, dash, actions } = autopilot(world, opts);
    step(world, 1 / 60, steer, dash, actions);
    steps++;
    if (world.phase === 'draft') {
      if (opts.stopAtDraft) break;
      let idx = 0;
      let best = 999;
      const priority = opts.priority || DRAFT_PRIORITY;
      world.draftOptions.forEach((u, i) => {
        const p = priority.indexOf(u.id);
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

// Play a whole campaign: night 1, map buys, night 2, map buys, night 3, map buys, night 4. Returns { campaign, world, screen } ('won' | 'lost' | 'map'). Every night starts from a fixed seed (seed + night * 1000).
export function playCampaign(seed, difficulty = 'normal', opts = {}) {
  const campaign = makeCampaign();
  let world = createWorld(seed, 0, difficulty, campaign);
  for (let night = 1; night <= 4; night++) {
    playSteps(world, 60 * 60 * 12);
    if (world.phase === 'lost') return { campaign, world, screen: 'lost' };
    if (world.phase === 'won') {
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

// Play Endless Night until the target wave (or the run falls).
export function playEndless(seed, difficulty = 'normal', targetWave = 7) {
  const world = createWorld(seed, 0, difficulty, null, 'endless');
  let guard = 0;
  while (guard++ < 60 * 60 * 20 && world.phase === 'play') {
    playSteps(world, 60);
    if (world.wave >= targetWave) break;
  }
  return world;
}

// Stage one named scene. Returns the world, screen, campaign, and view the render needs.
export function stageShot(kind, seed, difficulty = 'normal') {
  const world = createWorld(seed, 0, difficulty);
  const view = { placeMode: false, pointer: { x: 480, y: 300 } };
  if (kind === 'title') {
    // The title shows REAL records: best scores the autopilot actually played (see records.js),
    // and the mastery those same runs banked — never a made-up number.
    view.bests = { ...HOUSE_RECORDS.bests };
    view.mastery = { ...HOUSE_RECORDS.mastery };
    return { world, screen: 'title', view, campaign: world.campaign };
  }
  if (kind === 'endless') {
    // First seed whose endless run holds to wave 7; gentle is the fallback, never a loss.
    for (let s = seed; s < seed + 24; s++) {
      const w = playEndless(s, 'normal', 7);
      if (w.phase === 'play' && w.wave >= 7) return { world: w, screen: 'play', view, campaign: w.campaign };
    }
    const w = playEndless(seed, 'gentle', 7);
    return { world: w, screen: 'play', view, campaign: w.campaign };
  }
  if (kind === 'map') {
    // First seed whose night 1 is held stages the map, shards and shop visible.
    for (let s = seed; s < seed + 24; s++) {
      const run = playCampaign(s, 'gentle', { stopAfterNight: 1 });
      if (run.screen === 'map') return { world: run.world, screen: 'map', view, campaign: run.campaign };
    }
    const run = playCampaign(seed, 'gentle', { stopAfterNight: 1 });
    return { world: run.world, screen: 'play', view, campaign: run.campaign };
  }
  if (kind === 'night2') {
    // Hold night 1, then play night 2 partway — gloom wisps, new objective, harder mix.
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
    // First seed whose whole campaign is won stages the win screen, with the mastery
    // the winning run banked — the same gain the live game shows on its win screen.
    const stageWon = (run) => {
      const gain = masteryGain(run.world, true);
      view.mastery = applyMasteryGain(defaultMastery(), gain, true, run.world.stats.bosses);
      view.masteryGain = { xp: gain, level: masteryLevel(view.mastery), title: masteryTitle(masteryLevel(view.mastery)) };
      return { world: run.world, screen: 'won', view, campaign: run.campaign };
    };
    for (let s = seed; s < seed + 24; s++) {
      const run = playCampaign(s, 'gentle');
      if (run.screen === 'won') return stageWon(run);
    }
    const run = playCampaign(seed, 'gentle');
    return run.screen === 'won' ? stageWon(run) : { world: run.world, screen: run.screen, view, campaign: run.campaign };
  }
  if (kind === 'rushdraft') {
    // Beat boss 1, freeze on the inter-boss draft: "BOSS 1 DOWN" header, next-boss preview, three cards.
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
    // Beat boss 1, take the draft, freeze on boss 2 just AFTER its intro splash ends (age 3.5 > 2.4),
    // so the letterbox bars are gone and the full HUD reads clean while the boss is still mid-fight.
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
  if (kind === 'storm') {
    // Boss Rush as a Mastery LV 2 keeper (25 XP, WARDEN): storm unlocked, +1 starting ember.
    // A real LV 2 keeper chasing the storm build picks the storm card first, so the autopilot does too —
    // the cards are still rolled by the game's own draft, only the choice changes.
    // Freeze on boss 3 (Night Itself, 42 HP) just after its intro, with a storm lantern out and lightning mid-strike.
    view.mastery = { xp: 25, runs: 2, wins: 0, bosses: 1 };
    const STORM_PRIORITY = ['storm-lantern', 'lantern-slot', 'frost-lantern', 'beam-long', 'wick-rapid', 'heart', 'motes-rich', 'flare-wide', 'wick-heavy', 'wings-swift', 'magnet-strong', 'combo-long', 'dash-swift', 'flare-kindled'];
    const STORM_OPTS = { priority: STORM_PRIORITY, reserveStorm: true };
    const hasStorm = (w) => w.lanterns.list.some((l) => l.kind === 'storm');
    for (let s = seed; s < seed + 24; s++) {
      const w = createWorld(s, 0, 'normal', null, 'bossrush', 1);
      w.stormUnlocked = true;
      let guard = 0;
      let frozen = false;
      while (guard++ < 60 * 60 * 14 && w.phase === 'play') {
        playSteps(w, 1, STORM_OPTS);
        if (w.wave >= 3 && w.boss && w.boss.age >= 3.5 && hasStorm(w) && w.lanterns.zaps.length > 0) { frozen = true; break; }
      }
      if (frozen) return { world: w, screen: 'play', view, campaign: w.campaign };
    }
    // Fallback: boss 3 with a storm lantern out (no lightning in this exact frame).
    for (let s = seed; s < seed + 24; s++) {
      const w = createWorld(s, 0, 'normal', null, 'bossrush', 1);
      w.stormUnlocked = true;
      let guard = 0;
      let frozen = false;
      while (guard++ < 60 * 60 * 14 && w.phase === 'play') {
        playSteps(w, 1, STORM_OPTS);
        if (w.wave >= 3 && w.boss && w.boss.age >= 3.5 && hasStorm(w)) { frozen = true; break; }
      }
      if (frozen) return { world: w, screen: 'play', view, campaign: w.campaign };
    }
    const w = createWorld(seed, 0, 'normal', null, 'bossrush', 1);
    w.stormUnlocked = true;
    playSteps(w, 60 * 60);
    return { world: w, screen: 'play', view, campaign: w.campaign };
  }
  if (kind === 'boss') {
    // Play until the Gloom Herald appears on wave 10, hold ~1 s into its intro splash.
    let guard = 0;
    while (guard++ < 60 * 60 * 14) {
      if (world.phase !== 'play') break;
      playSteps(world, 60);
      if (world.boss && world.boss.age >= 1.0) break;
    }
    return { world, screen: 'play', view, campaign: world.campaign };
  }
  if (kind === 'lost') {
    // First seed whose campaign night falls stages the defeat screen. Harsh is the fallback.
    const stageLost = (run) => {
      const gain = masteryGain(run.world, false);
      view.mastery = applyMasteryGain(defaultMastery(), gain, false, run.world.stats.bosses);
      view.masteryGain = { xp: gain, level: masteryLevel(view.mastery), title: masteryTitle(masteryLevel(view.mastery)) };
      return { world: run.world, screen: 'lost', view, campaign: run.campaign };
    };
    for (let s = seed; s < seed + 24; s++) {
      const run = playCampaign(s, 'normal');
      if (run.screen === 'lost') return stageLost(run);
    }
    return stageLost(playCampaign(seed, 'harsh'));
  }
  return { world, screen: 'play', view, campaign: world.campaign };
}
