// random.js — the run's only source of chance: a small seeded generator.
// Every mote, wisp, storm and draft card comes from this generator, so one
// seed replays one run exactly: same seed, same game, every time.

export function makeRng(seed) {
  let a = seed >>> 0;
  if (a === 0) a = 0x9e3779b9;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// An integer in [min, max] from the generator.
export function int(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

// One element of an array, uniformly.
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// A point inside the field, kept `margin` away from the edges.
export function fieldPoint(rng, w, h, margin) {
  return {
    x: margin + rng() * (w - margin * 2),
    y: margin + rng() * (h - margin * 2),
  };
}
