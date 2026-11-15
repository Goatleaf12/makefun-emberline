// records.js — the title screen's HOUSE RECORDS: the best scores the autopilot actually
// played in each mode, and the mastery those same runs banked. Measured by
// lanternward-v23-probe.mjs (12 gentle seeds per mode, 36 runs banked): campaign best is
// the best TOTAL score of a full 4-night gentle campaign; endless / boss-rush bests are
// the best scores over 12 gentle runs each. Never made up: a title shot staged from this
// file shows real played scores.
export const HOUSE_RECORDS = {
  bests: { campaign: 286185, endless: 770955, bossrush: 197675 },
  mastery: { runs: 36, wins: 2, bosses: 156, xp: 5677 },
};
