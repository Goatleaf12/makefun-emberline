// campaign.js — the campaign of three nights: meta-progression between runs.
// One run is a single night of ten waves; a campaign is three nights in
// a row, each with its own objective and boss. Between nights the keeper
// spends Dawn Shards on permanent upgrades that carry into every later
// night. Draft upgrades carry over too, lanterns do not, and half the
// embers carry — so the build grows while the nights get harder.
//
// Pure data and pure functions of (campaign, world) only: no DOM, no RNG,
// no clock. The map screen, the shots and the probes all read this file.

export const NIGHTS = [
  {
    id: 1,
    name: 'FIRST LIGHT',
    short: 'Light the rings',
    objective: { kind: 'rings', target: 5, label: 'Light all 5 beacon rings' },
    boss: { name: 'THE GLOOM HERALD', hp: 26, spawn: 'drifter' },
  },
  {
    id: 2,
    name: 'THE LONG DARK',
    short: 'Banish the horde',
    objective: { kind: 'banishes', target: 40, label: 'Banish 40 wisps' },
    boss: { name: 'THE HOLLOW KING', hp: 32, spawn: 'chaser' },
  },
  {
    id: 3,
    name: "DAWN'S EDGE",
    short: 'Gather the dawn',
    objective: { kind: 'motes', target: 120, label: 'Gather 120 motes' },
    boss: { name: 'THE NIGHT ITSELF', hp: 40, spawn: 'splitter' },
  },
];

// The meta shop on the campaign map: permanent upgrades, bought with
// Dawn Shards. Each may be taken up to `max` times across the campaign.
export const META_SHOP = [
  {
    id: 'ember-heart',
    name: 'Ember Heart',
    desc: '+1 max heart, every night',
    cost: 4,
    max: 2,
    apply: (meta) => {
      meta.hearts += 1;
    },
  },
  {
    id: 'lantern-rack',
    name: 'Lantern Rack',
    desc: '+1 lantern slot, every night',
    cost: 5,
    max: 2,
    apply: (meta) => {
      meta.slots += 1;
    },
  },
  {
    id: 'sun-lantern',
    name: 'Sun Lantern',
    desc: 'Unlock sun lanterns: 3-bolt spread',
    cost: 6,
    max: 1,
    apply: (meta) => {
      meta.sun += 1;
    },
  },
];

// Dawn Relics: one is chosen on the campaign map before each night from
// the second on, and lasts that night only. Each is a pure tuning lever,
// so the choice is a real decision, not a new system.
export const RELICS = [
  { id: 'twin-flames', name: 'Twin Flames', desc: 'Flare +80 px, +1 damage' },
  { id: 'golden-motes', name: 'Golden Motes', desc: 'Motes +5 score, +1 ember' },
  { id: 'stout-heart', name: 'Stout Heart', desc: '+1 heart this night' },
];

// Choose (or re-choose) the relic for the coming night. Free, one at a
// time; picking another replaces the first.
export function chooseRelic(campaign, id) {
  if (!RELICS.find((r) => r.id === id)) return false;
  campaign.relic = id;
  return true;
}

export function relicDef(id) {
  return RELICS.find((r) => r.id === id) || null;
}

// The order the autopilot (and a hurried keeper) buys in: the unlock
// first, then room for more lanterns, then hearts.
export const META_PRIORITY = ['sun-lantern', 'lantern-rack', 'ember-heart'];

export function makeCampaign() {
  return {
    night: 1, // the night the next world starts on (1..3)
    shards: 0, // Dawn Shards: the meta currency
    relic: null, // the relic chosen for the coming night (null = none)
    meta: { hearts: 0, slots: 0, sun: 0 },
    metaTaken: {}, // shop id -> takes so far
    totalScore: 0, // sum of the nights' scores
    nightsCleared: 0,
    embersCarry: 0, // half the embers of the last night, for the next one
  };
}

export function nightDef(night) {
  return NIGHTS[Math.max(1, Math.min(3, night)) - 1];
}

// How far the run has come toward this night's objective.
export function objectiveCount(world) {
  const kind = nightDef(world.night).objective.kind;
  if (kind === 'rings') return world.ringsLit;
  if (kind === 'banishes') return world.stats.banished;
  return world.stats.motes;
}

export function objectiveMet(world) {
  return objectiveCount(world) >= nightDef(world.night).objective.target;
}

// Dawn Shards a finished night pays: 2 per beacon ring, 3 for the
// night's objective, 5 for the boss. A perfect night pays 18.
export function nightShards(world) {
  return world.ringsLit * 2 + (objectiveMet(world) ? 3 : 0) + 5;
}

// Settle a finished night into the campaign. Returns the shards earned.
// Call exactly once per night, when the world's phase turns to nightwon.
export function completeNight(campaign, world) {
  const earned = nightShards(world);
  campaign.shards += earned;
  campaign.lastEarned = earned;
  campaign.totalScore += world.score;
  campaign.nightsCleared += 1;
  campaign.embersCarry = Math.floor(world.embers / 2);
  campaign.night = world.night + 1;
  return earned;
}

// Buy one meta upgrade. Returns true when the purchase lands.
export function buyMeta(campaign, id) {
  const item = META_SHOP.find((m) => m.id === id);
  if (!item) return false;
  const taken = campaign.metaTaken[id] || 0;
  if (taken >= item.max) return false;
  if (campaign.shards < item.cost) return false;
  campaign.shards -= item.cost;
  item.apply(campaign.meta);
  campaign.metaTaken[id] = taken + 1;
  return true;
}

// One line naming the campaign's build so far, for the map screen.
export function metaLine(campaign) {
  const parts = [];
  for (const item of META_SHOP) {
    const n = campaign.metaTaken[item.id] || 0;
    if (n > 0) parts.push(`${item.name} x${n}`);
  }
  return parts.length > 0 ? parts.join('  ·  ') : 'No dawn upgrades yet — shards buy power.';
}
