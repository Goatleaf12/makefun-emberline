// world.js — the whole run: Ember, motes, wisps, lanterns, waves, the boss. Pure logic, fixed 1/60 s steps, seeded RNG only — a run replays exactly.

import { FIELD, TUNE, WISP_KINDS, PICKUPS, waveSpec, DIFFICULTIES } from './config.js';
import { makeRng, pick, fieldPoint } from './random.js';
import {
  makeLanterns,
  canPlaceKind,
  lanternCost,
  placeLantern,
  updateLanterns,
  frostRadius,
  frostSlow,
  stormChain,
  LANTERN_COST,
} from './lanterns.js';
import { makeUpgrades, rollDraft, applyUpgrade } from './draft.js';
import { lightState, inLight } from './daylight.js';
import { makeCampaign, nightDef } from './campaign.js';

// A brand-new run. `difficulty` changes hearts, wisp speed and count only; `campaign` carries nights held, meta upgrades and the relic; `mode` is campaign/endless/bossrush; `masteryBonus` is the keeper's starting embers (0 at level 1, so balance probes see no bonus).
export function createWorld(seed, best = 0, difficulty = 'normal', campaign = null, mode = 'campaign', masteryBonus = 0) {
  const rng = makeRng(seed);
  const diff = DIFFICULTIES[difficulty] || DIFFICULTIES.normal;
  const camp = campaign || makeCampaign();
  const night = camp.night;
  const bossSpec = nightDef(night).boss;
  const relic = camp.relic || null;
  camp.relic = null; // the relic is spent: one night, one relic
  const world = {
    seed,
    rng,
    time: 0,
    best,
    difficulty,
    mode,
    campaign: camp,
    night,
    relic,
    bossName: bossSpec.name,
    bossSpawn: bossSpec.spawn,
    phase: 'play', // 'play' | 'draft' | 'nightwon' | 'won' | 'lost'
    wave: 1,
    waveTime: 0,
    waveActive: false,
    spawnQueue: [],
    spawnTimer: 0,
    stormTimer: 0,
    ember: {
      x: FIELD.w / 2,
      y: FIELD.h / 2,
      vx: 0,
      vy: 0,
      r: TUNE.emberRadius,
      hearts: diff.hearts + camp.meta.hearts + (relic === 'stout-heart' ? 1 : 0),
      invuln: 0,
      dashTime: 0,
      dashCool: 0,
      shield: false,
    },
    motes: [],
    wisps: [],
    pickups: [],
    particles: [],
    floaters: [],
    lanterns: makeLanterns(),
    upgrades: makeUpgrades(),
    draftOptions: null,
    // Boss Rush opens with two lanterns' worth of embers: the first boss arrives at once.
    embers: mode === 'bossrush' ? 90 + masteryBonus : camp.embersCarry + masteryBonus,
    score: 0,
    combo: 0,
    comboTimer: 0,
    comboBest: 1,
    flareEnergy: 60,
    ringsLit: 0,
    slowTimer: 0,
    magnetTimer: 0,
    pickupTimer: 14,
    moteTimer: 0,
    boss: null,
    shake: 0,
    stats: { motes: 0, banished: 0, flares: 0, placed: 0, waves: 0, bosses: 0, stormHits: 0 },
    events: [],
    banner: null, // big centre text on a boss kill, e.g. 'BOSS 1 DOWN!'
  };
  syncLanterns(world);
  startWave(world, 1);
  return world;
}

// --- effective numbers (base tuning plus the run's upgrades) ------------

export function effSpeed(world) {
  return TUNE.emberSpeed + world.upgrades.speed;
}

export function effFlareCost(world) {
  return Math.max(30, TUNE.flareCost + world.upgrades.flareCost);
}

export function effFlareRadius(world) {
  return TUNE.flareRadius + world.upgrades.flareRadius + (world.relic === 'twin-flames' ? 80 : 0);
}

export function effComboWindow(world) {
  return TUNE.comboWindow + world.upgrades.comboWindow;
}

export function effMoteScore(world) {
  return TUNE.moteScore + world.upgrades.moteScore;
}

export function effMoteEnergy(world) {
  return TUNE.moteEnergy + world.upgrades.moteEnergy;
}

function syncLanterns(world) {
  const u = world.upgrades;
  const l = world.lanterns;
  l.slots = 2 + u.lanternSlots + (world.campaign ? world.campaign.meta.slots : 0);
  l.range = 175 + u.lanternRange;
  l.cooldown = 1.0 * u.lanternCooldown;
  l.damage = 1 + u.lanternDamage;
  l.stormChain = stormChain(u);
}

// --- spawning ------------------------------------------------------------

function edgePoint(world) {
  const rng = world.rng;
  const side = Math.floor(rng() * 4);
  const m = 30;
  if (side === 0) return { x: m + rng() * (FIELD.w - m * 2), y: m };
  if (side === 1) return { x: m + rng() * (FIELD.w - m * 2), y: FIELD.h - m };
  if (side === 2) return { x: m, y: m + rng() * (FIELD.h - m * 2) };
  return { x: FIELD.w - m, y: m + rng() * (FIELD.h - m * 2) };
}

function spawnMote(world, storm) {
  const p = fieldPoint(world.rng, FIELD.w, FIELD.h, 40);
  world.motes.push({
    x: p.x,
    y: p.y,
    r: 7,
    storm: !!storm,
    bob: world.rng() * Math.PI * 2,
    life: 25,
  });
}

// Boss HP: the night's boss in campaign; in Endless it grows 8 HP per boss wave (26, 34, 42, …); Boss Rush the same ladder per boss.
export function bossHp(world) {
  if (world.mode === 'endless') return 26 + (Math.floor(world.wave / 10) - 1) * 8;
  if (world.mode === 'bossrush') return 26 + (world.wave - 1) * 8;
  return nightDef(world.night).boss.hp;
}

// Which boss rules an endless boss wave: Herald at 10, Hollow King at 20, Night Itself from 30 on.
function endlessBoss(world) {
  const n = Math.floor(world.wave / 10);
  if (n <= 1) return { name: 'THE GLOOM HERALD', spawn: 'drifter' };
  if (n === 2) return { name: 'THE HOLLOW KING', spawn: 'chaser' };
  return { name: 'THE NIGHT ITSELF', spawn: 'splitter' };
}

// Boss Rush cycles the same three bosses, one per round, tougher each time; adds rotate one step per cycle.
export function rushBossAt(wave) {
  const n = ((wave - 1) % 3) + 1;
  const name = n === 1 ? 'THE GLOOM HERALD' : n === 2 ? 'THE HOLLOW KING' : 'THE NIGHT ITSELF';
  const spawn = ['drifter', 'chaser', 'splitter'][(wave - 1 + Math.floor((wave - 1) / 3)) % 3];
  return { name, spawn };
}
function rushBoss(world) {
  return rushBossAt(world.wave);
}

function spawnWisp(world, kind) {
  const spec = WISP_KINDS[kind];
  const p = edgePoint(world);
  const wisp = {
    kind,
    x: p.x,
    y: p.y,
    r: spec.radius,
    hp: kind === 'boss' ? bossHp(world) : spec.hp,
    maxHp: kind === 'boss' ? bossHp(world) : spec.hp,
    speed: spec.speed,
    color: spec.color,
    heading: world.rng() * Math.PI * 2,
    turnTimer: 0,
    age: 0,
    spawnTimer: 0,
    dead: false,
  };
  world.wisps.push(wisp);
  if (kind === 'boss') {
    world.boss = wisp;
    if (world.mode === 'endless') {
      const b = endlessBoss(world);
      world.bossName = b.name;
      world.bossSpawn = b.spawn;
    } else if (world.mode === 'bossrush') {
      const b = rushBoss(world);
      world.bossName = b.name;
      world.bossSpawn = b.spawn;
    }
    world.events.push('boss');
  }
  return wisp;
}

function startWave(world, wave) {
  // Boss Rush: no ordinary wave — the boss IS the wave, plus two drifters.
  if (world.mode === 'bossrush') {
    world.wave = wave;
    const b = rushBoss(world);
    world.bossName = b.name;
    world.bossSpawn = b.spawn;
    world.waveTime = 0;
    world.waveActive = true;
    world.spawnQueue = ['boss', 'drifter', 'drifter'];
    world.spawnTimer = 0.4;
    world.stormTimer = 0;
    world.events.push('wave');
    return;
  }
  const spec = waveSpec(wave, world.difficulty, world.night, world.mode === 'endless');
  world.wave = wave;
  world.waveTime = 0;
  world.waveActive = true;
  world.spawnQueue = [];
  for (let i = 0; i < spec.count; i++) {
    world.spawnQueue.push(pick(world.rng, spec.kinds));
  }
  // Shuffle the queue so the wave never arrives in kind order.
  for (let i = world.spawnQueue.length - 1; i > 0; i--) {
    const j = Math.floor(world.rng() * (i + 1));
    const t = world.spawnQueue[i];
    world.spawnQueue[i] = world.spawnQueue[j];
    world.spawnQueue[j] = t;
  }
  if (spec.boss) world.spawnQueue.unshift('boss');
  world.spawnTimer = 0.4;
  world.stormTimer = spec.storm ? 12 : 0;
  if (spec.storm) world.events.push('storm');
  world.events.push('wave');
}

// --- scoring ---------------------------------------------------------------

function burst(world, x, y, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = world.rng() * Math.PI * 2;
    const v = speed * (0.4 + world.rng() * 0.8);
    world.particles.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: 0.5 + world.rng() * 0.4,
      maxLife: 0.9,
      color,
      size: 2 + world.rng() * 3,
    });
  }
}

function floater(world, x, y, text, color) {
  world.floaters.push({ x, y, text, color: color || '#fff7e6', life: 1.1 });
}

function comboMult(world) {
  return Math.min(TUNE.comboMax, 1 + Math.floor(world.combo / 4));
}

function nearWisp(world, x, y) {
  for (const w of world.wisps) {
    if (w.dead) continue;
    const dx = w.x - x;
    const dy = w.y - y;
    if (dx * dx + dy * dy < TUNE.braveRadius * TUNE.braveRadius) return true;
  }
  return false;
}

function lightRings(world) {
  while (
    world.ringsLit < TUNE.ringScores.length &&
    world.score >= TUNE.ringScores[world.ringsLit]
  ) {
    world.ringsLit++;
    world.events.push('ring');
    floater(world, FIELD.w / 2, 90, `BEACON RING ${world.ringsLit} LIT`, '#ffd166');
    burst(world, FIELD.w / 2, 120, '#ffd166', 24, 160);
  }
}

// --- damage ----------------------------------------------------------------

function banishWisp(world, wisp, source) {
  if (wisp.dead) return;
  wisp.dead = true;
  world.stats.banished++;
  const kind = WISP_KINDS[wisp.kind];
  const gain = (TUNE.wispScore + kind.bonus) * comboMult(world);
  world.score += gain;
  world.embers += 1;
  floater(world, wisp.x, wisp.y, `+${gain}`, kind.color);
  burst(world, wisp.x, wisp.y, kind.color, wisp.kind === 'boss' ? 40 : 12, 170);
  if (wisp.kind === 'splitter') {
    for (let i = 0; i < 2; i++) {
      const child = spawnWisp(world, 'drifter');
      child.x = wisp.x + (i === 0 ? -14 : 14);
      child.y = wisp.y;
      child.r = 10;
      child.speed = 0.7;
    }
  }
  if (wisp.kind === 'boss') {
    world.stats.bosses++;
    world.banner = { text: `BOSS ${world.stats.bosses} DOWN!`, t: 2.4 };
    // Boss Rush: downing the second boss opens sun lanterns for the rest of the rush.
    if (world.mode === 'bossrush' && world.stats.bosses === 2 && world.campaign) {
      world.campaign.meta.sun = 1;
      floater(world, wisp.x, wisp.y - 30, 'SUN LANTERNS UNLOCKED', '#fde047');
    }
    world.boss = null;
    for (let i = 0; i < 10; i++) spawnMote(world, true);
    world.events.push('bossdown');
  }
  lightRings(world);
}

export function hurtWisp(world, wisp, damage, source) {
  if (wisp.dead) return;
  wisp.hp -= damage;
  burst(world, wisp.x, wisp.y, '#fef3c7', 3, 90);
  if (wisp.hp <= 0) banishWisp(world, wisp, source);
}

function fireFlare(world) {
  const cost = effFlareCost(world);
  if (world.flareEnergy < cost) return false;
  world.flareEnergy -= cost;
  world.stats.flares++;
  world.events.push('flare');
  const radius = effFlareRadius(world);
  const e = world.ember;
  burst(world, e.x, e.y, '#ffb347', 30, 260);
  for (const wisp of [...world.wisps]) {
    if (wisp.dead) continue;
    const dx = wisp.x - e.x;
    const dy = wisp.y - e.y;
    if (dx * dx + dy * dy <= radius * radius) {
      hurtWisp(world, wisp, TUNE.flareDamage + (world.relic === 'twin-flames' ? 1 : 0), 'flare');
    }
  }
  return true;
}

// --- pickups -----------------------------------------------------------------

function applyPickup(world, kind) {
  const e = world.ember;
  if (kind === 'shield') e.shield = true;
  if (kind === 'magnet') world.magnetTimer = 12;
  if (kind === 'slow') world.slowTimer = 6;
  world.events.push('pickup');
}

// --- the draft ---------------------------------------------------------------

export function openDraft(world) {
  world.phase = 'draft';
  world.draftOptions = rollDraft(world.rng, world.upgrades, !!world.stormUnlocked);
  world.events.push('draft');
}

export function draftPick(world, index) {
  const options = world.draftOptions;
  if (!options || index < 0 || index >= options.length) return false;
  const upgrade = options[index];
  applyUpgrade(world.upgrades, upgrade);
  if (upgrade.id === 'heart') {
    const max = (DIFFICULTIES[world.difficulty] || DIFFICULTIES.normal).hearts + world.upgrades.maxHearts;
    world.ember.hearts = Math.min(max, world.ember.hearts + 1);
  }
  syncLanterns(world);
  world.draftOptions = null;
  world.phase = 'play';
  world.stats.waves++;
  startWave(world, world.wave + 1);
  return true;
}

// --- the step ------------------------------------------------------------------

function stepEmber(world, dt, steer, dashHeld) {
  const e = world.ember;
  const speed = effSpeed(world);
  if (e.invuln > 0) e.invuln -= dt;
  if (e.dashCool > 0) e.dashCool -= dt;
  if (dashHeld && e.dashCool <= 0 && (steer.x !== 0 || steer.y !== 0)) {
    e.dashTime = TUNE.dashTime;
    e.dashCool = TUNE.dashCooldown * world.upgrades.dashCooldown;
    burst(world, e.x, e.y, '#ffb347', 8, 120);
  }
  const v = e.dashTime > 0 ? TUNE.dashSpeed : speed;
  if (e.dashTime > 0) e.dashTime -= dt;
  e.vx = steer.x * v;
  e.vy = steer.y * v;
  e.x = Math.max(e.r, Math.min(FIELD.w - e.r, e.x + e.vx * dt));
  e.y = Math.max(e.r, Math.min(FIELD.h - e.r, e.y + e.vy * dt));
  if (e.dashTime > 0) {
    world.particles.push({
      x: e.x,
      y: e.y,
      vx: -e.vx * 0.1,
      vy: -e.vy * 0.1,
      life: 0.3,
      maxLife: 0.3,
      color: '#ffb347',
      size: 5,
    });
  }
}

function stepWisps(world, dt) {
  const e = world.ember;
  const slow = world.slowTimer > 0 ? 0.5 : 1;
  const spec = waveSpec(world.wave, world.difficulty, world.night, world.mode === 'endless');
  // Frost lanterns: a wisp in any frost aura moves slower; a lit frost lantern's aura reaches 40% farther.
  const frostR = frostRadius(world.upgrades);
  const frostS = frostSlow(world.upgrades);
  const frostAuras = [];
  if (frostS > 0) {
    for (const l of world.lanterns.list) {
      if (l.kind !== 'frost') continue;
      frostAuras.push({ x: l.x, y: l.y, r: frostR * (l.lit ? 1.4 : 1) });
    }
  }
  for (const w of world.wisps) {
    if (w.dead) continue;
    w.age += dt;
    if (w.age > TUNE.wispLifetime && w.kind !== 'boss') {
      w.dead = true;
      continue;
    }
    let chill = 0;
    for (const a of frostAuras) {
      const dx = w.x - a.x;
      const dy = w.y - a.y;
      if (dx * dx + dy * dy <= a.r * a.r) chill = frostS;
    }
    w.chilled = chill > 0;
    const speed = spec.speed * w.speed * slow * (1 - chill);
    if (w.kind === 'chaser' || w.kind === 'boss') {
      const dx = e.x - w.x;
      const dy = e.y - w.y;
      const d = Math.hypot(dx, dy) || 1;
      w.x += (dx / d) * speed * dt;
      w.y += (dy / d) * speed * dt;
    } else if (w.kind === 'swift') {
      w.turnTimer -= dt;
      if (w.turnTimer <= 0) {
        w.turnTimer = 0.8 + world.rng() * 0.8;
        w.heading += (world.rng() - 0.5) * 1.2;
      }
      w.x += Math.cos(w.heading) * speed * dt;
      w.y += Math.sin(w.heading) * speed * dt + Math.sin(world.time * 3 + w.age) * 20 * dt;
    } else {
      w.turnTimer -= dt;
      if (w.turnTimer <= 0) {
        w.turnTimer = 1 + world.rng() * 1.5;
        w.heading = world.rng() * Math.PI * 2;
      }
      w.x += Math.cos(w.heading) * speed * dt;
      w.y += Math.sin(w.heading) * speed * dt;
    }
    w.x = Math.max(w.r, Math.min(FIELD.w - w.r, w.x));
    w.y = Math.max(w.r, Math.min(FIELD.h - w.r, w.y));
    if (w.kind === 'boss') {
      w.spawnTimer -= dt;
      if (w.spawnTimer <= 0) {
        w.spawnTimer = world.mode === 'bossrush' ? 6 : 4;
        const child = spawnWisp(world, world.bossSpawn || 'drifter');
        child.x = w.x;
        child.y = w.y + 30;
      }
    }
  }
  world.wisps = world.wisps.filter((w) => !w.dead);
}

function stepMotes(world, dt) {
  const e = world.ember;
  const target = world.stormTimer > 0 ? 26 : 14;
  world.moteTimer -= dt;
  if (world.motes.length < target && world.moteTimer <= 0) {
    world.moteTimer = world.stormTimer > 0 ? 0.15 : 0.5;
    spawnMote(world, world.stormTimer > 0);
  }
  const magnetR = 90 + world.upgrades.magnet;
  for (const mote of world.motes) {
    mote.life -= dt;
    mote.bob += dt * 2;
    const dx = e.x - mote.x;
    const dy = e.y - mote.y;
    const d = Math.hypot(dx, dy);
    if (world.magnetTimer > 0 && d < magnetR && d > 1) {
      const pull = 260 * dt;
      mote.x += (dx / d) * pull;
      mote.y += (dy / d) * pull;
    }
    if (d < e.r + mote.r + 4) {
      mote.dead = true;
      const brave = nearWisp(world, mote.x, mote.y);
      // A mote in the Dawn Star's light pays +5; Golden Motes adds +5 score and +1 ember.
      const sunlit = inLight(mote.x, mote.y, lightState(world));
      const mult = comboMult(world);
      const gain =
        effMoteScore(world) * mult * (brave ? 2 : 1) +
        (sunlit ? 5 : 0) +
        (world.relic === 'golden-motes' ? 5 : 0);
      world.score += gain;
      world.embers += TUNE.moteEmbers + (world.relic === 'golden-motes' ? 1 : 0);
      world.flareEnergy = Math.min(100, world.flareEnergy + effMoteEnergy(world));
      world.combo++;
      world.comboTimer = effComboWindow(world);
      world.comboBest = Math.max(world.comboBest, comboMult(world));
      world.stats.motes++;
      floater(world, mote.x, mote.y, `+${gain}`, sunlit ? '#fde047' : brave ? '#ff8c42' : '#ffd166');
      burst(world, mote.x, mote.y, '#ffd166', 5, 80);
      world.events.push('mote');
      lightRings(world);
    }
  }
  world.motes = world.motes.filter((m) => !m.dead && m.life > 0);
}

function stepCollisions(world) {
  const e = world.ember;
  if (e.invuln <= 0) {
    for (const w of world.wisps) {
      if (w.dead) continue;
      const dx = w.x - e.x;
      const dy = w.y - e.y;
      const rr = w.r + e.r;
      if (dx * dx + dy * dy < rr * rr) {
        if (e.shield) {
          e.shield = false;
          e.invuln = 1;
          burst(world, e.x, e.y, '#7dd3fc', 14, 150);
          floater(world, e.x, e.y - 24, 'SHIELD HELD', '#7dd3fc');
        } else {
          e.hearts--;
          e.invuln = 1.2;
          world.shake = 0.5;
          world.combo = 0;
          world.comboTimer = 0;
          burst(world, e.x, e.y, '#fb7185', 18, 180);
          world.events.push('hit');
          if (e.hearts <= 0) {
            world.phase = 'lost';
            world.events.push('lose');
            return;
          }
        }
        break;
      }
    }
  }
  for (const p of world.pickups) {
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    if (dx * dx + dy * dy < (e.r + 12) * (e.r + 12)) {
      p.dead = true;
      applyPickup(world, p.kind);
      floater(world, p.x, p.y, PICKUPS[p.kind].name.toUpperCase(), '#7dd3fc');
    }
  }
  world.pickups = world.pickups.filter((p) => !p.dead && p.life > 0);
}

// One fixed step. `actions` are one-shot intents: { kind: 'flare' } or { kind: 'place', x, y }.
export function step(world, dt, steer, dashHeld, actions) {
  if (world.phase !== 'play') return;
  world.time += dt;
  world.waveTime += dt;
  if (world.comboTimer > 0) {
    world.comboTimer -= dt;
    if (world.comboTimer <= 0) world.combo = 0;
  }
  if (world.slowTimer > 0) world.slowTimer -= dt;
  if (world.magnetTimer > 0) world.magnetTimer -= dt;
  if (world.stormTimer > 0) world.stormTimer -= dt;
  if (world.shake > 0) world.shake -= dt;
  if (world.banner) {
    world.banner.t -= dt;
    if (world.banner.t <= 0) world.banner = null;
  }

  for (const action of actions || []) {
    if (action.kind === 'flare') fireFlare(world);
    if (action.kind === 'place') {
      const kind = { frost: 'frost', sun: 'sun', storm: 'storm' }[action.lanternKind] || 'ember';
      const cost = lanternCost(kind);
      // Frost needs the Frost Lantern card; sun needs the map's Sun Lantern; storm needs the Storm Lantern card.
      if (kind === 'frost' && (world.upgrades.frost || 0) < 1) {
        world.events.push('placefail');
      } else if (kind === 'sun' && (!world.campaign || world.campaign.meta.sun < 1)) {
        world.events.push('placefail');
      } else if (kind === 'storm' && (world.upgrades.storm || 0) < 1) {
        world.events.push('placefail');
      } else if (canPlaceKind(world.lanterns, world.embers, kind)) {
        world.embers -= cost;
        placeLantern(world.lanterns, action.x, action.y, kind);
        world.stats.placed++;
        world.events.push('place');
        burst(
          world,
          action.x,
          action.y,
          kind === 'frost' ? '#7dd3fc' : kind === 'sun' ? '#fde047' : kind === 'storm' ? '#c48dff' : '#fde68a',
          12,
          120,
        );
      } else {
        world.events.push('placefail');
      }
    }
  }

  stepEmber(world, dt, steer, dashHeld);

  if (world.spawnQueue.length > 0) {
    world.spawnTimer -= dt;
    if (world.spawnTimer <= 0) {
      world.spawnTimer = 0.7;
      spawnWisp(world, world.spawnQueue.shift());
    }
  }

  stepMotes(world, dt);
  stepWisps(world, dt);
  updateLanterns(
    world.lanterns,
    world.wisps,
    dt,
    (w, dmg, src) => {
      if (src === 'storm') world.stats.stormHits++;
      hurtWisp(world, w, dmg, src);
    },
    lightState(world),
  );
  stepCollisions(world);
  if (world.phase !== 'play') return;

  world.pickupTimer -= dt;
  if (world.pickupTimer <= 0) {
    world.pickupTimer = 18;
    const kinds = Object.keys(PICKUPS);
    const p = fieldPoint(world.rng, FIELD.w, FIELD.h, 60);
    world.pickups.push({ kind: pick(world.rng, kinds), x: p.x, y: p.y, life: TUNE.pickupLifetime });
  }
  for (const p of world.pickups) p.life -= dt;

  for (const pt of world.particles) {
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.96;
    pt.vy *= 0.96;
  }
  world.particles = world.particles.filter((p) => p.life > 0);
  for (const f of world.floaters) {
    f.life -= dt;
    f.y -= 24 * dt;
  }
  world.floaters = world.floaters.filter((f) => f.life > 0);

  if (world.waveActive && world.spawnQueue.length === 0 && world.wisps.length === 0) {
    world.waveActive = false;
    if (world.mode !== 'campaign' || world.wave < 10) {
      openDraft(world);
    } else {
      world.phase = world.night >= 3 ? 'won' : 'nightwon';
      world.events.push('win');
    }
  }
}
