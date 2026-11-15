// lanterns.js — placeable light-lanterns: the tower-defence layer of LANTERNWARD.
//
// A lantern is a small tower the keeper plants on the field. It watches its
// radius and fires a light bolt at the nearest wisp inside it. Lanterns cost
// embers (the mote currency), live until the run ends, and grow through the
// between-wave draft (range, fire rate, damage, extra slots). Placement is
// the run's central decision: where to stand the light, and when to spend.

export const LANTERN_COST = 45; // embers per lantern

// A fresh lantern set: two slots to start, no lanterns, no bolts in flight.
export function makeLanterns() {
  return { list: [], bolts: [], slots: 2, range: 175, cooldown: 1.0, damage: 1 };
}

// How many lanterns stand right now.
export function lanternCount(lanterns) {
  return lanterns.list.length;
}

// Whether the keeper may plant one more right now.
export function canPlace(lanterns, embers) {
  return lanterns.list.length < lanterns.slots && embers >= LANTERN_COST;
}

// Plant a lantern at (x, y). Returns the lantern, or null when placement
// is not allowed (no free slot, or too few embers). The caller deducts the
// cost; this function only builds the lantern itself.
export function placeLantern(lanterns, x, y) {
  if (lanterns.list.length >= lanterns.slots) return null;
  const lantern = { x, y, cool: 0.25, angle: -Math.PI / 2, flash: 0 };
  lanterns.list.push(lantern);
  return lantern;
}

// One lantern's nearest wisp inside its radius, or null.
function nearestWisp(lanterns, lantern, wisps) {
  let best = null;
  let bestD = lanterns.range * lanterns.range;
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
export function updateLanterns(lanterns, wisps, dt, hurt) {
  for (const lantern of lanterns.list) {
    lantern.cool -= dt;
    if (lantern.flash > 0) lantern.flash -= dt;
    const target = nearestWisp(lanterns, lantern, wisps);
    if (target) {
      lantern.angle = Math.atan2(target.y - lantern.y, target.x - lantern.x);
      if (lantern.cool <= 0) {
        lantern.cool = lanterns.cooldown;
        lantern.flash = 0.12;
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
  for (const bolt of lanterns.bolts) {
    bolt.life -= dt;
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
