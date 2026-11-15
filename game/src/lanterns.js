// lanterns.js — placeable light-lanterns: the tower-defence layer of LANTERNWARD.
//
// A lantern is a small tower the keeper plants on the field. It watches its
// radius and fires a light bolt at the nearest wisp inside it. Lanterns cost
// embers (the mote currency), live until the run ends, and grow through the
// between-wave draft (range, fire rate, damage, extra slots). Placement is
// the run's central decision: where to stand the light, and when to spend.

import { FIELD } from './config.js';

export const LANTERN_COST = 45; // embers per lantern, ember or frost kind
export const SUN_COST = 60; // embers per sun lantern: it fires three bolts

// The cost of planting one lantern of a kind.
export function lanternCost(kind) {
  return kind === 'sun' ? SUN_COST : LANTERN_COST;
}

// A frost lantern's chill: how far its aura reaches and how much it slows
// wisps inside it, from the Frost Lantern card's takes (0 = locked).
// The first take unlocks; further takes widen and deepen the chill.
export function frostRadius(upgrades) {
  const takes = upgrades.frost || 0;
  return takes > 0 ? 120 + 30 * (takes - 1) : 0;
}
export function frostSlow(upgrades) {
  const takes = upgrades.frost || 0;
  return takes > 0 ? Math.min(0.6, 0.35 + 0.1 * (takes - 1)) : 0;
}

// A fresh lantern set: two slots to start, no lanterns, no bolts in flight.
export function makeLanterns() {
  return { list: [], bolts: [], slots: 2, range: 175, cooldown: 1.0, damage: 1 };
}

// Whether the keeper may plant one more of a given kind right now.
export function canPlaceKind(lanterns, embers, kind) {
  return lanterns.list.length < lanterns.slots && embers >= lanternCost(kind);
}

// Plant a lantern at (x, y). `kind` is 'ember' (fires light bolts) or
// 'frost' (chills wisps nearby, never fires). Returns the lantern, or null
// when placement is not allowed (no free slot, or too few embers). The
// caller deducts the cost and checks the frost unlock; this function only
// builds the lantern itself.
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

// Step every lantern and every bolt in flight. `hurt(wisp, damage)` is the
// world's damage hook: it applies the hit, scores it and spawns particles.
// `light` is the Dawn Star's state ({x, y, radius}) or null: a lantern
// standing in its light reaches 40% farther and fires 25% faster, so the
// best ground moves with the star. `lantern.lit` records the buff for the
// renderer; it is pure sim state, set only here.
export function updateLanterns(lanterns, wisps, dt, hurt, light) {
  for (const lantern of lanterns.list) {
    lantern.cool -= dt;
    if (lantern.flash > 0) lantern.flash -= dt;
    // A frost lantern never fires: its chill is applied to wisps by the
    // world (see stepWisps). It still counts as lit when it stands in the
    // Dawn Star's light, so its aura visibly widens there.
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
    const range = lanterns.range * (lit ? 1.4 : 1);
    const target = nearestWisp(lanterns, lantern, wisps, range);
    if (target) {
      lantern.angle = Math.atan2(target.y - lantern.y, target.x - lantern.x);
      if (lantern.cool <= 0) {
        lantern.cool = lanterns.cooldown * (lit ? 0.8 : 1);
        lantern.flash = 0.12;
        if (lantern.kind === 'sun') {
          // A sun lantern fires a three-bolt spread: straight shots, not
          // homing, so the side bolts can catch what the centre misses.
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
      // Straight-line spread bolt: flies its fixed direction and bursts
      // on the first wisp it touches.
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
}
