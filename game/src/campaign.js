// campaign.js — three nights, one dawn: meta-progression between runs (shards, shop, relics).

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

// Dawn Relics: one chosen before each night from the second on, lasts that night only.
export const RELICS = [
  { id: 'twin-flames', name: 'Twin Flames', desc: 'Flare +80 px, +1 damage' },
  { id: 'golden-motes', name: 'Golden Motes', desc: 'Motes +5 score, +1 ember' },
  { id: 'stout-heart', name: 'Stout Heart', desc: '+1 heart this night' },
];

export function chooseRelic(campaign, id) {
  if (!RELICS.find((r) => r.id === id)) return false;
  campaign.relic = id;
  return true;
}

export function relicDef(id) {
  return RELICS.find((r) => r.id === id) || null;
}

export const META_PRIORITY = ['sun-lantern', 'lantern-rack', 'ember-heart'];

export function makeCampaign() {
  return {
    night: 1,
    shards: 0,
    relic: null,
    meta: { hearts: 0, slots: 0, sun: 0 },
    metaTaken: {},
    totalScore: 0,
    nightsCleared: 0,
    embersCarry: 0,
  };
}

export function nightDef(night) {
  return NIGHTS[Math.max(1, Math.min(3, night)) - 1];
}

export function objectiveCount(world) {
  const kind = nightDef(world.night).objective.kind;
  if (kind === 'rings') return world.ringsLit;
  if (kind === 'banishes') return world.stats.banished;
  return world.stats.motes;
}

export function objectiveMet(world) {
  return objectiveCount(world) >= nightDef(world.night).objective.target;
}

// Dawn Shards a finished night pays: 2 per ring, 3 for the objective, 5 for the boss (max 18).
export function nightShards(world) {
  return world.ringsLit * 2 + (objectiveMet(world) ? 3 : 0) + 5;
}

// Settle a finished night into the campaign, once per night. Returns shards earned.
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

export function metaLine(campaign) {
  const parts = [];
  for (const item of META_SHOP) {
    const n = campaign.metaTaken[item.id] || 0;
    if (n > 0) parts.push(`${item.name} x${n}`);
  }
  return parts.length > 0 ? parts.join('  ·  ') : 'No dawn upgrades yet — shards buy power.';
}
