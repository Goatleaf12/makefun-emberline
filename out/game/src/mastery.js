// mastery.js — Lantern Mastery: persistent meta-progression across runs.
// Every finished run banks XP from score + boss kills (localStorage);
// six levels, Keeper to First Light, shown on the title and defeat
// screens. The only in-run effect: +1 starting ember per level past
// the first (cap +5). Pure functions plus guarded localStorage: in
// Node (probes, shots) there is none, so load/save use a fresh default.

export const MASTERY_XP = [0, 25, 60, 110, 180, 270];
export const MASTERY_NAMES = ['KEEPER', 'WARDEN', 'STORMCALLER', 'DAWNKEEPER', 'LANTERNLORD', 'FIRST LIGHT'];

export function defaultMastery() {
  return { runs: 0, wins: 0, bosses: 0, xp: 0 };
}

export function masteryLevel(m) {
  let level = 1;
  for (let i = 1; i < MASTERY_XP.length; i++) if (m.xp >= MASTERY_XP[i]) level = i + 1;
  return level;
}

export function masteryTitle(level) {
  return MASTERY_NAMES[Math.max(1, Math.min(MASTERY_NAMES.length, level)) - 1];
}

// Starting embers a level grants: none at level 1, so the balance
// probes — which run at level 1 — see no bonus at all.
export function masteryBonus(level) {
  return Math.min(5, Math.max(0, level - 1));
}

// XP one finished run pays: 1 per 1,000 score, 3 per boss down, 10 for a win.
export function masteryGain(world, won) {
  return Math.floor(world.score / 1000) + world.stats.bosses * 3 + (won ? 10 : 0);
}

export function applyMasteryGain(m, xp, won, bosses) {
  return { runs: m.runs + 1, wins: m.wins + (won ? 1 : 0), bosses: m.bosses + bosses, xp: m.xp + xp };
}

export function loadMastery() {
  try {
    const raw = localStorage.getItem('lanternward-mastery');
    if (!raw) return defaultMastery();
    const m = JSON.parse(raw);
    return { runs: m.runs | 0, wins: m.wins | 0, bosses: m.bosses | 0, xp: m.xp | 0 };
  } catch {
    return defaultMastery();
  }
}

export function saveMastery(m) {
  try {
    localStorage.setItem('lanternward-mastery', JSON.stringify(m));
  } catch {
    // Private mode: the run still counts, it just is not remembered.
  }
}

// Title-screen line: level, title, XP, runs, bosses down. At level 1
// it also names what the next level unlocks: storm lanterns.
export function masteryLine(m) {
  const mm = m || defaultMastery();
  const level = masteryLevel(mm);
  return `MASTERY — LV ${level} ${masteryTitle(level)} · ${mm.xp} XP · ${mm.runs} RUNS · ${mm.bosses} BOSSES DOWN${level === 1 ? ' · STORM LANTERNS AT LV 2' : ''}`;
}
