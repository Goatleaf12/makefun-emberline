// lanterns.js — placeable lanterns: the tower-defence layer. Lanterns cost embers, live until the run ends, grow through the draft.

import { FIELD } from './config.js';

export const LANTERN_COST = 45; // embers per lantern, ember or frost kind
export const SUN_COST = 60; // embers per sun lantern: it fires three bolts
export const STORM_COST = 55; // embers per storm lantern: lightning chains

// The cost of planting one lantern of a kind.
export function lanternCost(kind) {
  return kind === 'sun' ? SUN_COST : kind === 'storm' ? STORM_COST : LANTERN_COST;
}

// A storm lantern's chain: extra wisps its lightning jumps to after the first (0 = locked).
export function stormChain(upgrades) {
  const takes = upgrades.storm || 0;
  return takes > 0 ? 1 + takes : 0;
}

// A frost lantern's chill: aura reach and slow, from the Frost Lantern card's takes (0 = locked).
export function frostRadius(upgrades) {
  const takes = upgrades.frost || 0;
  return takes > 0 ? 120 + 30 * (takes - 1) : 0;
}
export function frostSlow(upgrades) {
  const takes = upgrades.frost || 0;
  return takes > 0 ? Math.min(0.6, 0.35 + 0.1 * (takes - 1)) : 0;
}

export function makeLanterns() {
  return { list: [], bolts: [], zaps: [], slots: 2, range: 175, cooldown: 1.0, damage: 1, stormChain: 0 };
}

export function canPlaceKind(lanterns, embers, kind) {
  return lanterns.list.length < lanterns.slots && embers >= lanternCost(kind);
}

// Plant a lantern at (x, y). Returns the lantern, or null when not allowed. The caller deducts cost and checks unlocks.
export function placeLantern(lanterns, x, y, kind = 'ember') {
  if (lanterns.list.length >= lanterns.slots) return null;
  const lantern = { x, y, cool: 0.25, angle: -Math.PI / 2, flash: 0, kind };
  lanterns.list.push(lantern);
  return lantern;
}

// One lantern's nearest wisp inside a given radius, or null.
function nearestWisp(lanterns, lantern, wisps, range) {
  const reach = range === undefined ? lanterns.range : range;
  let best = null;
  let bestD = reach * reach;
  for (const w of wisps) {
    if (w.dead) continue;
    const dx = w.x - lantern.x;
    const dy = w.y - lantern.y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = w;
    }
  }
  return best;
}

// Step every lantern and bolt. `hurt(wisp, damage)` is the world's damage hook.
// `light` is the Dawn Star's state or null: a lantern in its light reaches 40% farther and fires 25% faster.
export function updateLanterns(lanterns, wisps, dt, hurt, light) {
  for (const lantern of lanterns.list) {
    lantern.cool -= dt;
    if (lantern.flash > 0) lantern.flash -= dt;
    // Frost lanterns never fire: their chill is applied to wisps by the world (see stepWisps).
    if (lantern.kind === 'frost') {
      lantern.lit =
        !!light &&
        (lantern.x - light.x) * (lantern.x - light.x) +
          (lantern.y - light.y) * (lantern.y - light.y) <=
          light.radius * light.radius;
      continue;
    }
    const lit =
      !!light &&
      (lantern.x - light.x) * (lantern.x - light.x) +
        (lantern.y - light.y) * (lantern.y - light.y) <=
        light.radius * light.radius;
    lantern.lit = lit;
    if (lantern.kind === 'storm') {
      // Storm lanterns strike the nearest wisp in range, then jump to the nearest wisp within
      // 140 px of the last strike, up to the chain count. Each strike is a zap for the renderer;
      // its kink is a pure function of its endpoints, so rendering never consumes a random draw.
      const range = lanterns.range * (lit ? 1.4 : 1);
      const target = nearestWisp(lanterns, lantern, wisps, range);
      if (target && lantern.cool <= 0) {
        lantern.cool = lanterns.cooldown * (lit ? 0.8 : 1);
        lantern.flash = 0.12;
        let from = { x: lantern.x, y: lantern.y - 14 };
        let cur = target;
        const hit = new Set();
        for (let n = 0; n < 1 + (lanterns.stormChain || 0) && cur; n++) {
          hit.add(cur);
          lanterns.zaps.push({ x1: from.x, y1: from.y, x2: cur.x, y2: cur.y, life: 0.18, mx: (from.x + cur.x) / 2 + ((from.x * 7 + cur.x * 13) % 36) - 18, my: (from.y + cur.y) / 2 + ((from.y * 11 + cur.y * 5) % 36) - 18 });
          hurt(cur, lanterns.damage, 'storm');
          from = { x: cur.x, y: cur.y };
          let next = null;
          let bd = 140 * 140;
          for (const w of wisps) {
            if (w.dead || hit.has(w)) continue;
            const dx = w.x - from.x;
            const dy = w.y - from.y;
            const d = dx * dx + dy * dy;
            if (d < bd) {
              bd = d;
              next = w;
            }
          }
          cur = next;
        }
      }
      continue;
    }
    const range = lanterns.range * (lit ? 1.4 : 1);
    const target = nearestWisp(lanterns, lantern, wisps, range);
    if (target) {
      lantern.angle = Math.atan2(target.y - lantern.y, target.x - lantern.x);
      if (lantern.cool <= 0) {
        lantern.cool = lanterns.cooldown * (lit ? 0.8 : 1);
        lantern.flash = 0.12;
        if (lantern.kind === 'sun') {
          // A sun lantern fires a three-bolt spread: straight shots, so the side bolts can catch what the centre misses.
          for (const off of [-0.35, 0, 0.35]) {
            const a = lantern.angle + off;
            lanterns.bolts.push({
              x: lantern.x,
              y: lantern.y - 14,
              target,
              speed: 520,
              damage: lanterns.damage,
              life: 1.2,
              spread: true,
              vx: Math.cos(a),
              vy: Math.sin(a),
            });
          }
        } else {
          lanterns.bolts.push({
            x: lantern.x,
            y: lantern.y - 14,
            target,
            speed: 520,
            damage: lanterns.damage,
            life: 1.2,
          });
        }
      }
    }
  }
  for (const bolt of lanterns.bolts) {
    bolt.life -= dt;
    if (bolt.spread) {
      // Straight-line bolt: bursts on the first wisp it touches.
      bolt.x += bolt.vx * bolt.speed * dt;
      bolt.y += bolt.vy * bolt.speed * dt;
      if (
        bolt.life <= 0 ||
        bolt.x < 0 ||
        bolt.x > FIELD.w ||
        bolt.y < 0 ||
        bolt.y > FIELD.h
      ) {
        bolt.dead = true;
        continue;
      }
      for (const w of wisps) {
        if (w.dead) continue;
        const dx = w.x - bolt.x;
        const dy = w.y - bolt.y;
        if (dx * dx + dy * dy < (w.r + 10) * (w.r + 10)) {
          bolt.dead = true;
          hurt(w, bolt.damage, 'bolt');
          break;
        }
      }
      continue;
    }
    const t = bolt.target;
    if (!t || t.dead || bolt.life <= 0) {
      bolt.dead = true;
      continue;
    }
    const dx = t.x - bolt.x;
    const dy = t.y - bolt.y;
    const d = Math.hypot(dx, dy);
    const step = bolt.speed * dt;
    if (d <= Math.max(step, 14)) {
      bolt.dead = true;
      hurt(t, bolt.damage, 'bolt');
    } else {
      bolt.x += (dx / d) * step;
      bolt.y += (dy / d) * step;
    }
  }
  lanterns.bolts = lanterns.bolts.filter((b) => !b.dead);
  for (const z of lanterns.zaps) z.life -= dt;
  lanterns.zaps = lanterns.zaps.filter((z) => z.life > 0);
}
