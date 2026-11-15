// Seeded randomness for EMBERLINE. Every die roll in the game flows
// through one of these generators, so a seed fully decides a run and
// screenshots can be replayed exactly. Nothing here reads the clock.

// A small 32-bit hash of a numeric seed into four state words.
function seedWords(seed) {
  let a = (seed >>> 0) || 0x9e3779b9;
  const words = [];
  for (let i = 0; i < 4; i += 1) {
    a ^= a << 13;
    a ^= a >>> 17;
    a ^= a << 5;
    a >>>= 0;
    words.push(a);
    a = (a + 0x9e3779b9) >>> 0;
  }
  return words;
}

// Mulberry-style generator: fast, deterministic, good enough for a game.
export function makeRng(seed) {
  let s = seedWords(seed);
  let state = s[0];
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    range(min, max) {
      return min + this.next() * (max - min);
    },
    int(min, max) {
      return Math.floor(this.range(min, max + 1));
    },
    pick(list) {
      return list[Math.floor(this.next() * list.length)];
    },
    chance(p) {
      return this.next() < p;
    },
    angle() {
      return this.next() * Math.PI * 2;
    },
  };
}

// A throwaway unseeded generator for the live game (menus, ambience).
// Gameplay itself always uses makeRng with the run's seed.
export function makeLiveRng() {
  return makeRng((Math.random() * 0xffffffff) >>> 0);
}
