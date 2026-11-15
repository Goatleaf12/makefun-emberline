// Deterministic scenes for EMBERLINE: title, live play, action and end.
// Each scene steps the REAL world forward with a simple autopilot that
// plays by the real rules (seek motes, flee wisps, flare when it pays),
// so every screenshot is a genuine render of the game, reproducible from
// its seed. No wall clock is read here: time comes only from steps.

import { FIELD, TUNING } from './config.js';

const STEP = 1 / 60;

// A driver shaped like Controls, driven by the autopilot instead of keys.
export function makeAutopilot(world) {
  const driver = {
    pointer: { x: 0, y: 0, down: false, active: false },
    _flare: false,
    _dash: false,
    steerVector() {
      const e = world.ember;
      // A close wisp overrides everything: run straight away from it,
      // with a sideways bias so seek and flee can never cancel each
      // other out into a standstill.
      let threat = null;
      let threatD = 120;
      for (const w of world.wisps) {
        const d = Math.hypot(w.x - e.x, w.y - e.y);
        if (d < threatD) {
          threatD = d;
          threat = w;
        }
      }
      if (threat) {
        const ax = (e.x - threat.x) / (threatD || 1);
        const ay = (e.y - threat.y) / (threatD || 1);
        // Rotate the escape by ~35 degrees so the run is never head-on.
        const c = Math.cos(0.6);
        const s = Math.sin(0.6);
        let dx = ax * c - ay * s;
        let dy = ax * s + ay * c;
        if (e.x < 70) dx += 1;
        if (e.x > FIELD.width - 70) dx -= 1;
        if (e.y < 70) dy += 1;
        if (e.y > FIELD.height - 70) dy -= 1;
        const len = Math.hypot(dx, dy);
        return { x: dx / len, y: dy / len };
      }
      let tx = e.x;
      let ty = e.y;
      let best = Infinity;
      for (const m of world.motes) {
        const d = Math.hypot(m.x - e.x, m.y - e.y);
        const nearWisp = world.wisps.some((w) => Math.hypot(w.x - m.x, w.y - m.y) < 120);
        const score = d - (nearWisp ? 40 : 0);
        if (score < best) {
          best = score;
          tx = m.x;
          ty = m.y;
        }
      }
      const dx = tx - e.x;
      const dy = ty - e.y;
      const len = Math.hypot(dx, dy);
      if (len < 4) return { x: 0, y: 0 };
      return { x: dx / len, y: dy / len };
    },
    hasAction(name) {
      if (name === 'flare' && this._flare) {
        this._flare = false;
        return true;
      }
      if (name === 'dash' && this._dash) {
        this._dash = false;
        return true;
      }
      return false;
    },
    // Decide once per step whether the flare or the dash is worth it.
    think() {
      const e = world.ember;
      this._flare = false;
      this._dash = false;
      if (world.energy >= TUNING.flareCost) {
        let inRange = 0;
        let closest = Infinity;
        for (const w of world.wisps) {
          const d = Math.hypot(w.x - e.x, w.y - e.y);
          if (d <= TUNING.flareRadius) inRange += 1;
          if (d < closest) closest = d;
        }
        if (inRange >= 2 || closest < 65) this._flare = true;
      }
      let nearest = Infinity;
      for (const w of world.wisps) {
        const d = Math.hypot(w.x - e.x, w.y - e.y);
        if (d < nearest) nearest = d;
      }
      if (nearest < 48 && e.dashCool <= 0) this._dash = true;
    },
  };
  return driver;
}

function playSteps(world, driver, seconds, sound) {
  const n = Math.round(seconds / STEP);
  for (let i = 0; i < n; i += 1) {
    driver.think();
    world.step(STEP, driver, sound);
    if (world.screen !== 'play') break;
  }
}

// Stage one named scene on a fresh world. Returns the screen it landed on
// so the caller (and the balance probe) can see what really happened.
export function stageShot(kind, world, sound) {
  const driver = makeAutopilot(world);
  if (kind === 'title') {
    world.begin();
    world.screen = 'title';
    // Let the title backdrop breathe for a moment: motes shimmer, the
    // beacon glows, but nothing is played yet.
    for (let i = 0; i < 30; i += 1) {
      for (const m of world.motes) m.phase += STEP * 3;
    }
    return { screen: 'title', driver };
  }
  world.begin();
  if (kind === 'play') {
    playSteps(world, driver, 78, sound);
    return { screen: world.screen, driver };
  }
  if (kind === 'action') {
    playSteps(world, driver, 72, sound);
    // Force a flare burst for the cover if one is charged: the ring of
    // light mid-burst is the game's signature moment.
    if (world.screen === 'play' && world.energy >= TUNING.flareCost) {
      world.castFlare(sound);
    }
    return { screen: world.screen, driver };
  }
  if (kind === 'end') {
    // Play for real until dawn or defeat, up to six sim-minutes.
    playSteps(world, driver, 360, sound);
    return { screen: world.screen, driver };
  }
  return { screen: world.screen, driver };
}
