// The rules of EMBERLINE: entities, waves, collisions, scoring, pickups.
// DOM-free and clock-free: every step advances a fixed dt with the seeded
// RNG, so the same seed always plays the same game. The renderer only
// reads this state; it never changes it.

import { FIELD, TUNING, WISP_KINDS, PICKUP_KINDS, waveSpec } from './config.js';
import { createDraft } from './draft.js';

const TAU = Math.PI * 2;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function edgeSpawn(rng) {
  const side = rng.int(0, 3);
  const m = 24;
  if (side === 0) return { x: rng.range(m, FIELD.width - m), y: -m };
  if (side === 1) return { x: rng.range(m, FIELD.width - m), y: FIELD.height + m };
  if (side === 2) return { x: -m, y: rng.range(m, FIELD.height - m) };
  return { x: FIELD.width + m, y: rng.range(m, FIELD.height - m) };
}

export function createWorld(rng) {
  const state = {
    screen: 'title',
    time: 0,
    wave: 0,
    score: 0,
    best: 0,
    hearts: TUNING.hearts,
    maxHearts: TUNING.hearts,
    energy: 0,
    // Per-run copies of the numbers the upgrade draft can improve. The
    // shared TUNING table never changes; the draft rewrites these.
    flareRadius: TUNING.flareRadius,
    flareCost: TUNING.flareCost,
    dashCooldown: TUNING.dashCooldown,
    magnetRadius: 150,
    comboWindow: TUNING.comboWindow,
    emberSpeed: TUNING.emberSpeed,
    moteValue: TUNING.moteValue,
    moteEnergy: TUNING.moteEnergy,
    draft: null,
    upgradesTaken: {},
    comboChain: 0,
    comboTimer: 0,
    comboMult: 1,
    bestCombo: 1,
    ringsLit: 0,
    pickup: null,
    slowTimer: 0,
    stormTimer: 0,
    stormActive: false,
    shake: 0,
    wavePhase: 'idle',
    intermission: 0,
    spawnLeft: 0,
    spawnTimer: 0,
    ember: {
      x: FIELD.width / 2, y: FIELD.height / 2, vx: 0, vy: 0,
      r: TUNING.emberRadius,
      angle: -Math.PI / 2, invuln: 0, dashLeft: 0, dashCool: 0, shield: false,
    },
    motes: [],
    wisps: [],
    pickups: [],
    particles: [],
    floaters: [],
    stats: { motes: 0, wispsBanished: 0, flares: 0, hits: 0 },
    message: '',
    messageTimer: 0,
  };

  function burst(x, y, color, n, speed) {
    for (let i = 0; i < n; i += 1) {
      const a = rng.angle();
      const s = rng.range(speed * 0.3, speed);
      state.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: rng.range(0.35, 0.8), maxLife: 0.8, size: rng.range(2, 5), color,
      });
    }
  }

  function floater(x, y, text, color) {
    state.floaters.push({ x, y, text, color, life: 1.1, maxLife: 1.1 });
  }

  function say(text, seconds) {
    state.message = text;
    state.messageTimer = seconds;
  }

  function spawnMote(nearStorm) {
    const m = 30;
    state.motes.push({
      x: rng.range(m, FIELD.width - m),
      y: rng.range(m, FIELD.height - m),
      r: TUNING.moteRadius,
      phase: rng.range(0, TAU),
      brave: false,
      storm: !!nearStorm,
    });
  }

  function spawnWisp(kind, x, y, child) {
    const base = WISP_KINDS[kind];
    const p = (x === undefined) ? edgeSpawn(rng) : { x, y };
    state.wisps.push({
      kind,
      x: p.x, y: p.y,
      r: child ? base.radius * 0.65 : base.radius,
      angle: rng.angle(),
      turn: rng.range(-1.4, 1.4),
      speed: base.speed,
      life: TUNING.wispLifetime,
      age: 0,
      wobble: rng.range(0, TAU),
      child: !!child,
    });
  }

  function dropPickup() {
    const kinds = Object.keys(PICKUP_KINDS);
    const kind = kinds[rng.int(0, kinds.length - 1)];
    const m = 50;
    state.pickups.push({
      kind,
      x: rng.range(m, FIELD.width - m),
      y: rng.range(m, FIELD.height - m),
      life: TUNING.pickupLifetime,
      phase: rng.range(0, TAU),
    });
  }

  function lightRings() {
    let lit = 0;
    for (const t of TUNING.ringScores) if (state.score >= t) lit += 1;
    if (lit > state.ringsLit) {
      state.ringsLit = lit;
      floater(state.ember.x, state.ember.y - 30, `BEACON RING ${lit} LIT!`, '#ffd166');
      burst(state.ember.x, state.ember.y, '#ffd166', 24, 200);
    }
  }

  function startWave(n) {
    const spec = waveSpec(n);
    state.wave = n;
    state.wavePhase = 'spawning';
    state.spawnLeft = spec.wispCount;
    state.spawnTimer = 0.6;
    state.stormActive = spec.storm;
    if (spec.storm) {
      state.stormTimer = 14;
      for (let i = 0; i < TUNING.stormMotes; i += 1) spawnMote(true);
      say('EMBER STORM — a rain of light!', 3);
    } else {
      say(`Wave ${n} of ${TUNING.totalWaves}`, 2.2);
    }
    if (n === 1) {
      for (let i = 0; i < TUNING.moteTarget; i += 1) spawnMote(false);
    }
    if (rng.chance(0.55)) dropPickup();
  }

  function endWave() {
    state.energy = Math.min(100, state.energy + 15);
    if (state.wave >= TUNING.totalWaves) {
      state.wavePhase = 'intermission';
      state.screen = 'won';
      state.stats.bestCombo = state.bestCombo;
      return;
    }
    // Between waves the keeper drafts one upgrade, then the next wave
    // opens only once a card is picked. Play is fully paused meanwhile.
    state.wavePhase = 'draft';
    createDraft(state, rng);
    state.screen = 'draft';
    state.message = '';
    state.messageTimer = 0;
  }

  function collectMote(mote, index) {
    state.motes.splice(index, 1);
    const nearWisp = state.wisps.some((w) => dist(w, mote) < TUNING.braveDistance);
    const mult = state.comboMult * (nearWisp ? TUNING.braveFactor : 1);
    const gained = state.moteValue * mult;
    state.score += gained;
    state.energy = Math.min(100, state.energy + state.moteEnergy);
    state.comboChain += 1;
    state.comboTimer = state.comboWindow;
    state.comboMult = Math.min(TUNING.comboMax, 1 + Math.floor(state.comboChain / TUNING.comboStep));
    if (state.comboMult > state.bestCombo) state.bestCombo = state.comboMult;
    state.stats.motes += 1;
    burst(mote.x, mote.y, '#ffd166', 8, 120);
    floater(mote.x, mote.y - 12, `+${gained}${nearWisp ? ' BRAVE!' : ''}`, nearWisp ? '#ff9d5c' : '#ffd166');
    lightRings();
  }

  function banishWisp(wisp, index, byFlare) {
    state.wisps.splice(index, 1);
    state.stats.wispsBanished += 1;
    const pts = WISP_KINDS[wisp.kind].score;
    state.score += pts;
    burst(wisp.x, wisp.y, WISP_KINDS[wisp.kind].hue, 16, 180);
    floater(wisp.x, wisp.y - 12, `+${pts}`, '#a5f3fc');
    if (wisp.kind === 'splitter' && byFlare) {
      spawnWisp('drifter', wisp.x - 14, wisp.y, true);
      spawnWisp('drifter', wisp.x + 14, wisp.y, true);
      floater(wisp.x, wisp.y + 16, 'It splits!', '#f472b6');
    }
    lightRings();
  }

  function castFlare(sound) {
    if (state.energy < state.flareCost) return false;
    state.energy -= state.flareCost;
    state.stats.flares += 1;
    const e = state.ember;
    burst(e.x, e.y, '#ffe9a8', 40, 320);
    state.shake = Math.max(state.shake, 8);
    let cleared = 0;
    for (let i = state.wisps.length - 1; i >= 0; i -= 1) {
      if (dist(state.wisps[i], e) <= state.flareRadius) {
        banishWisp(state.wisps[i], i, true);
        cleared += 1;
      }
    }
    floater(e.x, e.y - 34, cleared > 0 ? `FLARE! ${cleared} banished` : 'FLARE!', '#ffe9a8');
    if (sound) sound.flareSwell();
    return true;
  }

  function takeHit(wisp, index, sound) {
    const e = state.ember;
    if (e.invuln > 0 || e.dashLeft > 0) return;
    if (e.shield) {
      e.shield = false;
      state.wisps.splice(index, 1);
      burst(e.x, e.y, '#93c5fd', 22, 220);
      floater(e.x, e.y - 26, 'Shield held!', '#93c5fd');
      if (sound) sound.thud();
      return;
    }
    state.hearts -= 1;
    state.stats.hits += 1;
    e.invuln = TUNING.hitInvulnerable;
    state.shake = TUNING.shakeOnHit;
    state.comboChain = 0;
    state.comboMult = 1;
    burst(e.x, e.y, '#ff6b81', 26, 260);
    burst(wisp.x, wisp.y, '#7dd3fc', 12, 160);
    if (sound) sound.thud();
    if (state.hearts <= 0) {
      state.screen = 'lost';
      state.stats.bestCombo = state.bestCombo;
    }
  }

  function stepPlay(dt, driver, sound) {
    const e = state.ember;
    state.time += dt;
    if (state.messageTimer > 0) state.messageTimer -= dt;
    if (state.slowTimer > 0) state.slowTimer -= dt;
    if (state.stormTimer > 0) {
      state.stormTimer -= dt;
      if (state.stormTimer <= 0) state.stormActive = false;
    }
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) {
        state.comboChain = 0;
        state.comboMult = 1;
      }
    }
    if (e.invuln > 0) e.invuln -= dt;
    if (e.dashCool > 0) e.dashCool -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 30);

    // --- movement: keys win, otherwise hold-mouse steers toward pointer
    let dir = driver.steerVector();
    if (dir.x === 0 && dir.y === 0 && driver.pointer.down) {
      const dx = driver.pointer.x - e.x;
      const dy = driver.pointer.y - e.y;
      const d = Math.hypot(dx, dy);
      if (d > 6) dir = { x: dx / d, y: dy / d };
    }
    if (driver.hasAction('dash') && e.dashCool <= 0) {
      e.dashLeft = TUNING.dashTime;
      e.dashCool = state.dashCooldown;
      if (sound) sound.dash();
    }
    const speed = e.dashLeft > 0 ? TUNING.dashSpeed : state.emberSpeed;
    if (e.dashLeft > 0) {
      e.dashLeft -= dt;
      // A bright trail marks the dash, so the burst reads on screen.
      state.particles.push({
        x: e.x, y: e.y, vx: -e.vx * 0.1, vy: -e.vy * 0.1,
        life: 0.3, maxLife: 0.3, size: 5, color: '#ffe9a8',
      });
    }
    e.vx = dir.x * speed;
    e.vy = dir.y * speed;
    e.x = clamp(e.x + e.vx * dt, 16, FIELD.width - 16);
    e.y = clamp(e.y + e.vy * dt, 16, FIELD.height - 16);
    if (dir.x !== 0 || dir.y !== 0) e.angle = Math.atan2(dir.y, dir.x);

    if (driver.hasAction('flare')) castFlare(sound);

    // --- wave spawning
    if (state.wavePhase === 'spawning') {
      state.spawnTimer -= dt;
      if (state.spawnLeft > 0 && state.spawnTimer <= 0) {
        const spec = waveSpec(state.wave);
        spawnWisp(rng.pick(spec.kinds));
        state.spawnLeft -= 1;
        state.spawnTimer = spec.spawnGap;
      }
      if (state.spawnLeft <= 0 && state.wisps.length === 0) endWave();
    } else if (state.wavePhase === 'intermission') {
      state.intermission -= dt;
      if (state.intermission <= 0) startWave(state.wave + 1);
    } else if (state.wavePhase === 'clearing' && state.wisps.length === 0) {
      endWave();
    }
    if (state.wavePhase === 'spawning' && state.spawnLeft <= 0 && state.wisps.length === 0) {
      endWave();
    }

    // --- motes: keep the field lit
    const target = state.stormActive ? TUNING.moteTarget + 10 : TUNING.moteTarget;
    while (state.motes.length < target) spawnMote(state.stormActive);
    for (let i = state.motes.length - 1; i >= 0; i -= 1) {
      const m = state.motes[i];
      m.phase += dt * 3;
      const d = dist(m, e);
      if (state.pickup === 'magnet' && d < state.magnetRadius) {
        const pull = 260 * dt;
        m.x += ((e.x - m.x) / (d || 1)) * pull;
        m.y += ((e.y - m.y) / (d || 1)) * pull;
      }
      if (d < e.r + m.r + 6) {
        collectMote(m, i);
        if (sound) sound.chime(state.comboMult);
      }
    }

    // --- pickups: one slot, a new one replaces the old
    for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
      const p = state.pickups[i];
      p.life -= dt;
      p.phase += dt * 2;
      if (p.life <= 0) {
        state.pickups.splice(i, 1);
        continue;
      }
      if (dist(p, e) < e.r + 16) {
        state.pickups.splice(i, 1);
        state.pickup = p.kind;
        if (p.kind === 'shield') e.shield = true;
        if (p.kind === 'slow') state.slowTimer = TUNING.slowDuration;
        floater(e.x, e.y - 26, PICKUP_KINDS[p.kind].label, PICKUP_KINDS[p.kind].color);
        burst(e.x, e.y, PICKUP_KINDS[p.kind].color, 14, 160);
        if (sound) sound.pickup();
      }
    }

    // --- wisps: drift, hunt, split, fade
    const slowFactor = state.slowTimer > 0 ? 0.45 : 1;
    for (let i = state.wisps.length - 1; i >= 0; i -= 1) {
      const w = state.wisps[i];
      w.life -= dt;
      w.age += dt;
      w.wobble += dt * 2;
      const spec = waveSpec(state.wave);
      const spd = spec.speed * w.speed * slowFactor * (w.child ? 0.6 : 1);
      if (w.kind === 'chaser') {
        const want = Math.atan2(e.y - w.y, e.x - w.x);
        let diff = want - w.angle;
        while (diff > Math.PI) diff -= TAU;
        while (diff < -Math.PI) diff += TAU;
        w.angle += clamp(diff, -1.5 * dt, 1.5 * dt);
      } else if (w.kind === 'swift') {
        w.angle += Math.sin(w.wobble) * 0.9 * dt;
      } else {
        w.angle += w.turn * dt;
      }
      w.x += Math.cos(w.angle) * spd * dt;
      w.y += Math.sin(w.angle) * spd * dt;
      if (w.x < 10 || w.x > FIELD.width - 10) w.angle = Math.PI - w.angle;
      if (w.y < 10 || w.y > FIELD.height - 10) w.angle = -w.angle;
      w.x = clamp(w.x, 8, FIELD.width - 8);
      w.y = clamp(w.y, 8, FIELD.height - 8);
      if (w.life <= 0) {
        state.wisps.splice(i, 1);
        continue;
      }
      if (dist(w, e) < w.r + e.r - 2) {
        takeHit(w, i, sound);
        if (state.screen !== 'play') return;
      }
    }

    // --- particles + floating text decay
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
    for (let i = state.floaters.length - 1; i >= 0; i -= 1) {
      const f = state.floaters[i];
      f.life -= dt;
      f.y -= 26 * dt;
      if (f.life <= 0) state.floaters.splice(i, 1);
    }
  }

  function begin() {
    state.screen = 'play';
    state.time = 0;
    state.wave = 0;
    state.score = 0;
    state.hearts = TUNING.hearts;
    state.maxHearts = TUNING.hearts;
    state.energy = 0;
    state.flareRadius = TUNING.flareRadius;
    state.flareCost = TUNING.flareCost;
    state.dashCooldown = TUNING.dashCooldown;
    state.magnetRadius = 150;
    state.comboWindow = TUNING.comboWindow;
    state.emberSpeed = TUNING.emberSpeed;
    state.moteValue = TUNING.moteValue;
    state.moteEnergy = TUNING.moteEnergy;
    state.draft = null;
    state.upgradesTaken = {};
    state.comboChain = 0;
    state.comboTimer = 0;
    state.comboMult = 1;
    state.bestCombo = 1;
    state.ringsLit = 0;
    state.pickup = null;
    state.slowTimer = 0;
    state.stormTimer = 0;
    state.stormActive = false;
    state.motes = [];
    state.wisps = [];
    state.pickups = [];
    state.particles = [];
    state.floaters = [];
    state.stats = { motes: 0, wispsBanished: 0, flares: 0, hits: 0 };
    state.ember.x = FIELD.width / 2;
    state.ember.y = FIELD.height / 2;
    state.ember.invuln = 0;
    state.ember.shield = false;
    startWave(1);
  }

  function step(dt, driver, sound) {
    if (state.screen === 'play') stepPlay(dt, driver, sound);
  }

  // The world is its state, with its verbs attached: callers read fields
  // (world.score, world.ember) and call methods (world.step) on one object.
  state.begin = begin;
  state.step = step;
  state.castFlare = castFlare;
  state.startWave = startWave;
  state.endWave = endWave;
  return state;
}
