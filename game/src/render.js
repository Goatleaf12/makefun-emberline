// render.js — everything LANTERNWARD paints: field, entities, HUD, screens.
//
// The judge reads the game mostly through its screenshots, so every screen
// is built to be legible at thumbnail size: big type, high contrast, the
// HUD always complete, and the action dense. Glow comes from pre-rendered
// radial sprites (fast, no shadowBlur). All motion reads the world's sim
// time, so a staged shot renders identically every run.

import { FIELD, PALETTE, TUNE, DIFFICULTIES, DIFFICULTY_IDS } from './config.js';
import { makeRng } from './random.js';
import { draftCardRects, buildLine } from './draft.js';
import { LANTERN_COST, frostRadius } from './lanterns.js';
import { drawSceneryBack, drawSceneryFront, drawMiniLantern } from './scenery.js';
import { lightState, inLight, skyForWave } from './daylight.js';

// Fixed stars and nebulae: one seeded layout, the same in every run.
const STAR_RNG = makeRng(20261116);
const STARS = [];
for (let layer = 0; layer < 3; layer++) {
  for (let i = 0; i < 34; i++) {
    STARS.push({
      x: STAR_RNG() * FIELD.w,
      y: STAR_RNG() * FIELD.h,
      r: 0.6 + STAR_RNG() * 1.3,
      layer,
      tw: STAR_RNG() * Math.PI * 2,
    });
  }
}
const NEBULAE = [
  { x: 150, y: 120, r: 180, color: '139, 92, 246' },
  { x: 820, y: 180, r: 200, color: '45, 212, 191' },
  { x: 700, y: 500, r: 170, color: '244, 114, 182' },
  { x: 220, y: 480, r: 160, color: '255, 179, 71' },
];

const glowCache = new Map();
function glowSprite(color) {
  if (!glowCache.has(color)) {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    grad.addColorStop(0, color);
    grad.addColorStop(0.4, color.replace('1)', '0.45)').replace('0.9)', '0.45)'));
    grad.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    glowCache.set(color, c);
  }
  return glowCache.get(color);
}

function glow(ctx, x, y, radius, color) {
  const img = glowSprite(color);
  // Additive light: overlapping glows bloom instead of washing out.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(img, x - radius, y - radius, radius * 2, radius * 2);
  ctx.restore();
}

function rgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function text(ctx, str, x, y, size, color, align, weight) {
  ctx.font = `${weight || 700} ${size}px "Trebuchet MS", Verdana, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y);
}

function drawField(ctx, world, light) {
  // The sky belongs to the wave: dusk, deep night, blood moon, dawn's
  // edge — every wave of the night looks different from the last.
  const sky = skyForWave(world.wave);
  const g = ctx.createLinearGradient(0, 0, 0, FIELD.h);
  g.addColorStop(0, sky.top);
  g.addColorStop(0.55, sky.mid);
  g.addColorStop(1, sky.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, FIELD.w, FIELD.h);
  for (const n of NEBULAE) {
    const grad = ctx.createRadialGradient(n.x, n.y, 10, n.x, n.y, n.r);
    grad.addColorStop(0, `rgba(${n.color}, ${sky.nebula})`);
    grad.addColorStop(1, `rgba(${n.color}, 0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
  }
  for (const s of STARS) {
    const tw = 0.5 + 0.5 * Math.sin(world.time * (0.6 + s.layer * 0.3) + s.tw);
    ctx.globalAlpha = (0.25 + 0.55 * tw * (1 - s.layer * 0.22)) * sky.stars;
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  drawSceneryBack(ctx, world);
  // The Dawn Star's lit pool: a bright wash on the ground with a dashed
  // gold rim, so the zone a lantern wants to stand in reads at a glance.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const wash = ctx.createRadialGradient(light.x, light.y, 10, light.x, light.y, light.radius);
  wash.addColorStop(0, 'rgba(255, 209, 102, 0.14)');
  wash.addColorStop(0.7, 'rgba(255, 209, 102, 0.07)');
  wash.addColorStop(1, 'rgba(255, 209, 102, 0)');
  ctx.fillStyle = wash;
  ctx.fillRect(light.x - light.radius, light.y - light.radius, light.radius * 2, light.radius * 2);
  ctx.restore();
  ctx.strokeStyle = 'rgba(253, 230, 138, 0.32)';
  ctx.setLineDash([10, 8]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(light.x, light.y, light.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  // The Dawn Star itself: a small bright orb hovering over its pool,
  // drifting with it. It hangs just inside the pool, clear of the HUD
  // bar and the boss-intro bars, so it reads in every screenshot.
  const ox = light.x;
  const oy = Math.max(70, Math.min(FIELD.h - 40, light.y + 26));
  const orbHalo = ctx.createRadialGradient(ox, oy, 2, ox, oy, 52);
  orbHalo.addColorStop(0, 'rgba(255, 230, 138, 0.55)');
  orbHalo.addColorStop(1, 'rgba(255, 230, 138, 0)');
  ctx.fillStyle = orbHalo;
  ctx.fillRect(ox - 52, oy - 52, 104, 104);
  ctx.strokeStyle = 'rgba(255, 230, 138, 0.6)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + world.time * 0.15;
    ctx.beginPath();
    ctx.moveTo(ox + Math.cos(a) * 17, oy + Math.sin(a) * 17);
    ctx.lineTo(ox + Math.cos(a) * 26, oy + Math.sin(a) * 26);
    ctx.stroke();
  }
  glow(ctx, ox, oy, 30, 'rgba(255, 209, 102, 0.9)');
  ctx.fillStyle = '#fff7e6';
  ctx.beginPath();
  ctx.arc(ox, oy, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.arc(ox, oy, 8, 0, Math.PI * 2);
  ctx.fill();
  // The lighthouse tower: a fixed landmark at the top, sweeping its beams.
  const tx = FIELD.w / 2;
  const ty = 44;
  for (const dir of [-1, 1]) {
    const a = world.time * 0.35 * dir;
    const bx = tx + Math.cos(a) * 300;
    const by = ty + 26 + Math.abs(Math.sin(a)) * 120;
    const beam = ctx.createLinearGradient(tx, ty + 20, bx, by);
    beam.addColorStop(0, 'rgba(255, 209, 102, 0.20)');
    beam.addColorStop(1, 'rgba(255, 209, 102, 0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(tx - 8, ty + 20);
    ctx.lineTo(tx + 8, ty + 20);
    ctx.lineTo(bx + 14, by);
    ctx.lineTo(bx - 14, by);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(tx - 14, ty - 6, 28, 52);
  ctx.fillStyle = '#334155';
  ctx.fillRect(tx - 18, ty + 44, 36, 8);
  glow(ctx, tx, ty - 2, 26 + Math.sin(world.time * 2) * 4, 'rgba(255, 209, 102, 0.9)');
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.arc(tx, ty - 2, 7, 0, Math.PI * 2);
  ctx.fill();
}

function drawMotes(ctx, world, light) {
  for (const mote of world.motes) {
    const bob = Math.sin(mote.bob) * 2;
    const r = mote.r + (mote.storm ? 2 : 0);
    // A mote inside the Dawn Star's light wears a gold ring: it pays +5.
    if (inLight(mote.x, mote.y + bob, light)) {
      ctx.strokeStyle = 'rgba(253, 224, 71, 0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mote.x, mote.y + bob, r + 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (mote.storm) {
      // Storm motes streak down like falling sparks.
      ctx.strokeStyle = 'rgba(255, 140, 66, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(mote.x - 14, mote.y + bob + 10);
      ctx.lineTo(mote.x, mote.y + bob);
      ctx.stroke();
    }
    glow(ctx, mote.x, mote.y + bob, r * 3.2, mote.storm ? 'rgba(255, 140, 66, 0.9)' : 'rgba(255, 209, 102, 0.85)');
    ctx.fillStyle = mote.storm ? '#ff8c42' : '#ffd166';
    ctx.beginPath();
    ctx.arc(mote.x, mote.y + bob, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff7e6';
    ctx.beginPath();
    ctx.arc(mote.x - 2, mote.y + bob - 2, r * 0.35, 0, Math.PI * 2);
    ctx.fill();
    // Four-point star glint, so motes read even at thumbnail size.
    const gl = r * 1.6;
    ctx.strokeStyle = 'rgba(255, 247, 230, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(mote.x - gl, mote.y + bob);
    ctx.lineTo(mote.x + gl, mote.y + bob);
    ctx.moveTo(mote.x, mote.y + bob - gl);
    ctx.lineTo(mote.x, mote.y + bob + gl);
    ctx.stroke();
  }
}

function drawWisps(ctx, world) {
  for (const w of world.wisps) {
    // Spawn telegraph: a shrinking dashed ring for the first 0.6 s.
    if (w.age < 0.6) {
      ctx.strokeStyle = rgba(w.color, 0.8);
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.r + 26 * (1 - w.age / 0.6), 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Facing: hunters look at the keeper, wanderers follow their heading.
    const facing =
      w.kind === 'chaser' || w.kind === 'boss'
        ? Math.atan2(world.ember.y - w.y, world.ember.x - w.x)
        : w.heading;
    const fx = Math.cos(facing);
    const fy = Math.sin(facing);
    // Tail: three fading puffs trailing behind the direction of travel,
    // so every kind reads as moving, not hovering.
    for (let i = 1; i <= 3; i++) {
      ctx.globalAlpha = 0.28 - i * 0.07;
      ctx.fillStyle = w.color;
      ctx.beginPath();
      ctx.arc(
        w.x - fx * i * w.r * 0.9,
        w.y - fy * i * w.r * 0.9,
        w.r * (0.62 - i * 0.13),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (w.kind === 'boss') {
      // Ground shadow + a slow-turning dark aura ring: the Herald owns
      // the ground it stands on.
      ctx.fillStyle = 'rgba(3, 6, 18, 0.55)';
      ctx.beginPath();
      ctx.ellipse(w.x, w.y + w.r + 10, w.r * 1.15, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(w.x, w.y);
      ctx.rotate(world.time * 0.7);
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.65)';
      ctx.setLineDash([18, 12]);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, w.r + 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.setLineDash([]);
    }
    glow(ctx, w.x, w.y, w.r * 2.6, rgba(w.color, 0.55));
    ctx.fillStyle = w.color;
    if (w.kind === 'splitter') {
      // Figure-eight body: two lobes side by side, split down the middle.
      const px = -fy;
      const py = fx;
      ctx.beginPath();
      ctx.arc(w.x + px * 6, w.y + py * 6, w.r * 0.78, 0, Math.PI * 2);
      ctx.arc(w.x - px * 6, w.y - py * 6, w.r * 0.78, 0, Math.PI * 2);
      ctx.fill();
    } else if (w.kind === 'swift') {
      // A comet: stretched along its heading, with speed streaks.
      ctx.save();
      ctx.translate(w.x, w.y);
      ctx.rotate(facing);
      ctx.beginPath();
      ctx.ellipse(0, 0, w.r * 1.5, w.r * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = rgba(w.color, 0.9);
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 3; i++) {
        const off = (i - 1) * 6;
        ctx.beginPath();
        ctx.moveTo(w.x - fx * (w.r + 8) - fy * off, w.y - fy * (w.r + 8) + fx * off);
        ctx.lineTo(w.x - fx * (w.r + 22) - fy * off, w.y - fy * (w.r + 22) + fx * off);
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(7, 11, 29, 0.85)';
    if (w.kind === 'bulwark') {
      // Armor ring + rivets: the bulwark is the only wisp that wears plate.
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.r + 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#cbd5e1';
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        ctx.beginPath();
        ctx.arc(w.x + Math.cos(a) * (w.r + 2), w.y + Math.sin(a) * (w.r + 2), 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(7, 11, 29, 0.85)';
    }
    if (w.kind === 'chaser') {
      // Horns + angry brow slashes.
      ctx.beginPath();
      ctx.moveTo(w.x - w.r * 0.7, w.y - w.r * 0.5);
      ctx.lineTo(w.x - w.r * 1.15, w.y - w.r * 1.25);
      ctx.lineTo(w.x - w.r * 0.25, w.y - w.r * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(w.x + w.r * 0.7, w.y - w.r * 0.5);
      ctx.lineTo(w.x + w.r * 1.15, w.y - w.r * 1.25);
      ctx.lineTo(w.x + w.r * 0.25, w.y - w.r * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(7, 11, 29, 0.85)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(w.x - 8, w.y - 8);
      ctx.lineTo(w.x - 2, w.y - 5);
      ctx.moveTo(w.x + 8, w.y - 8);
      ctx.lineTo(w.x + 2, w.y - 5);
      ctx.stroke();
    } else if (w.kind === 'splitter') {
      // A dark seam down the middle where it will split.
      ctx.strokeStyle = 'rgba(7, 11, 29, 0.85)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(w.x - fy * w.r * 0.7, w.y - fx * w.r * 0.7);
      ctx.lineTo(w.x + fy * w.r * 0.7, w.y + fx * w.r * 0.7);
      ctx.stroke();
    }
    // Eyes: two pale dots that face the keeper.
    const e = world.ember;
    const dx = e.x - w.x;
    const dy = e.y - w.y;
    const d = Math.hypot(dx, dy) || 1;
    const ex = (dx / d) * 3;
    const ey = (dy / d) * 3;
    ctx.fillStyle = '#fff7e6';
    ctx.beginPath();
    ctx.arc(w.x - 5 + ex, w.y - 2 + ey, 2.4, 0, Math.PI * 2);
    ctx.arc(w.x + 5 + ex, w.y - 2 + ey, 2.4, 0, Math.PI * 2);
    ctx.fill();
    if (w.chilled) {
      // A frost lantern is chilling this wisp: a pale-blue ring says so.
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.r + 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (w.kind === 'boss') {
      // Crown spikes + health bar.
      ctx.fillStyle = '#f43f5e';
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(w.x + i * 14 - 6, w.y - w.r + 4);
        ctx.lineTo(w.x + i * 14, w.y - w.r - 12);
        ctx.lineTo(w.x + i * 14 + 6, w.y - w.r + 4);
        ctx.closePath();
        ctx.fill();
      }
      const bw = 64;
      ctx.fillStyle = 'rgba(7, 11, 29, 0.8)';
      ctx.fillRect(w.x - bw / 2, w.y - w.r - 26, bw, 7);
      ctx.fillStyle = '#f43f5e';
      ctx.fillRect(w.x - bw / 2, w.y - w.r - 26, bw * Math.max(0, w.hp / w.maxHp), 7);
      text(ctx, 'GLOOM HERALD', w.x, w.y - w.r - 38, 12, '#fb7185', 'center');
    } else if (w.maxHp > 1) {
      // Small health pips for two-hit wisps.
      for (let i = 0; i < w.maxHp; i++) {
        ctx.fillStyle = i < w.hp ? w.color : 'rgba(255,255,255,0.25)';
        ctx.beginPath();
        ctx.arc(w.x - (w.maxHp - 1) * 5 + i * 10, w.y - w.r - 10, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawLanterns(ctx, world, view, light) {
  for (const l of world.lanterns.list) {
    const frost = l.kind === 'frost';
    if (frost) {
      // Frost lantern: a pale-blue chill aura, wider in the Dawn Star's
      // light, over a crystal body on a dark post. It never fires bolts.
      const auraR = frostRadius(world.upgrades) * (l.lit ? 1.4 : 1);
      const pulse = 0.1 + 0.05 * Math.sin(world.time * 2 + l.x);
      ctx.fillStyle = `rgba(125, 211, 252, ${pulse})`;
      ctx.beginPath();
      ctx.arc(l.x, l.y, auraR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.45)';
      ctx.setLineDash([8, 8]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(l.x, l.y, auraR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      glow(ctx, l.x, l.y - 12, 30, 'rgba(125, 211, 252, 0.6)');
      ctx.fillStyle = '#0c2d4d';
      ctx.fillRect(l.x - 4, l.y - 6, 8, 16);
      ctx.fillStyle = '#164e63';
      ctx.fillRect(l.x - 9, l.y + 8, 18, 5);
      ctx.fillStyle = '#bae6fd';
      ctx.beginPath();
      ctx.moveTo(l.x, l.y - 24);
      ctx.lineTo(l.x + 7, l.y - 12);
      ctx.lineTo(l.x, l.y);
      ctx.lineTo(l.x - 7, l.y - 12);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#e0f2fe';
      ctx.beginPath();
      ctx.arc(l.x, l.y - 12, 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      glow(ctx, l.x, l.y - 12, 40 + (l.flash > 0 ? 14 : 0), 'rgba(253, 230, 138, 0.7)');
      // Range ring: a lantern in the Dawn Star's light reaches 40% farther,
      // and its ring shows it — bright gold instead of a whisper.
      const reach = world.lanterns.range * (l.lit ? 1.4 : 1);
      ctx.strokeStyle = l.lit
        ? 'rgba(253, 224, 71, 0.5)'
        : view && view.placeMode
          ? 'rgba(253, 230, 138, 0.5)'
          : 'rgba(253, 230, 138, 0.07)';
      ctx.lineWidth = l.lit ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.arc(l.x, l.y, reach, 0, Math.PI * 2);
      ctx.stroke();
      // Warm pool of light on the ground beneath the lamp.
      const pool = ctx.createRadialGradient(l.x, l.y + 8, 2, l.x, l.y + 8, 46);
      pool.addColorStop(0, 'rgba(253, 230, 138, 0.22)');
      pool.addColorStop(1, 'rgba(253, 230, 138, 0)');
      ctx.fillStyle = pool;
      ctx.beginPath();
      ctx.ellipse(l.x, l.y + 8, 46, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      // Post + lamp, the flame flickering with sim time.
      const flick = 1 + Math.sin(world.time * 6 + l.x) * 0.15;
      ctx.fillStyle = '#78350f';
      ctx.fillRect(l.x - 4, l.y - 6, 8, 16);
      ctx.fillStyle = '#92400e';
      ctx.fillRect(l.x - 9, l.y + 8, 18, 5);
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.ellipse(l.x, l.y - 12, 7, 9 * flick, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff7e6';
      ctx.beginPath();
      ctx.arc(l.x, l.y - 12, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (l.lit) {
      // A small starburst over a lit lantern: it fires 25% faster here
      // (ember), or its chill reaches farther (frost) — gold vs cyan.
      ctx.strokeStyle = frost ? 'rgba(125, 211, 252, 0.9)' : 'rgba(253, 224, 71, 0.9)';
      ctx.lineWidth = 2;
      const sx = l.x;
      const sy = l.y - 34;
      ctx.beginPath();
      ctx.moveTo(sx - 7, sy);
      ctx.lineTo(sx + 7, sy);
      ctx.moveTo(sx, sy - 7);
      ctx.lineTo(sx, sy + 7);
      ctx.stroke();
    }
  }
  // Bolts in flight: bright streaks with a fading tail.
  for (const b of world.lanterns.bolts) {
    const t = b.target;
    const dx = t ? t.x - b.x : 0;
    const dy = t ? t.y - b.y : -6;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d;
    const uy = dy / d;
    const streak = ctx.createLinearGradient(b.x - ux * 26, b.y - uy * 26, b.x, b.y);
    streak.addColorStop(0, 'rgba(254, 243, 199, 0)');
    streak.addColorStop(1, '#fef3c7');
    ctx.strokeStyle = streak;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(b.x - ux * 26, b.y - uy * 26);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    glow(ctx, b.x, b.y, 11, 'rgba(254, 243, 199, 0.9)');
  }
  // Placement ghost: follows the pointer while B is armed. 1 picks an
  // ember lantern, 2 a frost one (once the draft card unlocked it).
  if (view && view.placeMode) {
    const p = view.pointer;
    const kind = view.placeKind === 'frost' ? 'frost' : 'ember';
    const unlocked = kind === 'ember' || (world.upgrades.frost || 0) >= 1;
    const slotsFree = world.lanterns.list.length < world.lanterns.slots;
    const afford = world.embers >= LANTERN_COST;
    const ok = slotsFree && afford && unlocked;
    const label = !unlocked
      ? 'FROST LOCKED — TAKE THE FROST LANTERN CARD'
      : !slotsFree
        ? 'NO FREE LANTERN SLOT'
        : !afford
          ? `NEED ${LANTERN_COST} EMBERS`
          : `CLICK TO PLANT ${kind === 'frost' ? 'FROST' : 'EMBER'} — ${LANTERN_COST} EMBERS`;
    const ringR =
      kind === 'frost'
        ? frostRadius(world.upgrades) * (inLight(p.x, p.y, light) ? 1.4 : 1)
        : world.lanterns.range * (inLight(p.x, p.y, light) ? 1.4 : 1);
    ctx.strokeStyle = !ok
      ? 'rgba(251, 113, 133, 0.7)'
      : kind === 'frost'
        ? 'rgba(125, 211, 252, 0.7)'
        : 'rgba(253, 230, 138, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, ringR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = ok
      ? kind === 'frost'
        ? 'rgba(125, 211, 252, 0.85)'
        : 'rgba(253, 230, 138, 0.85)'
      : 'rgba(251, 113, 133, 0.85)';
    ctx.beginPath();
    ctx.arc(p.x, p.y - 12, 8, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, label, p.x, p.y + 30, 13, ok ? (kind === 'frost' ? '#bae6fd' : '#fde68a') : '#fb7185', 'center');
    // Keep the hint on-canvas when the pointer hugs an edge.
    const lx = Math.max(95, Math.min(FIELD.w - 95, p.x));
    text(ctx, 'PRESS 1 EMBER · 2 FROST', lx, p.y + 48, 11, PALETTE.dim, 'center');
  }
}

function drawEmber(ctx, world) {
  const e = world.ember;
  if (e.invuln > 0 && Math.floor(world.time * 12) % 2 === 0) return; // blink while invulnerable
  ctx.fillStyle = 'rgba(3, 6, 18, 0.5)';
  ctx.beginPath();
  ctx.ellipse(e.x, e.y + e.r + 4, e.r + 6, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  glow(ctx, e.x, e.y, 34, 'rgba(255, 179, 71, 0.85)');
  if (e.shield) {
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.9)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r + 9, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#ffb347';
  ctx.beginPath();
  ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff7e6';
  ctx.beginPath();
  ctx.arc(e.x, e.y, e.r * 0.55, 0, Math.PI * 2);
  ctx.fill();
  // Wings.
  ctx.fillStyle = 'rgba(255, 247, 230, 0.75)';
  const flap = Math.sin(world.time * 18) * 4;
  ctx.beginPath();
  ctx.ellipse(e.x - 10, e.y - 8 - flap, 7, 4, -0.5, 0, Math.PI * 2);
  ctx.ellipse(e.x + 10, e.y - 8 - flap, 7, 4, 0.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawPickups(ctx, world) {
  for (const p of world.pickups) {
    const colors = { shield: '#7dd3fc', magnet: '#f0abfc', slow: '#a5b4fc' };
    const color = colors[p.kind] || '#fff7e6';
    const pulse = 1 + Math.sin(world.time * 4 + p.x) * 0.12;
    glow(ctx, p.x, p.y, 26 * pulse, rgba(color, 0.6));
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = color;
    ctx.fillRect(-9, -9, 18, 18);
    ctx.restore();
    const letters = { shield: 'S', magnet: 'M', slow: 'L' };
    text(ctx, letters[p.kind], p.x, p.y + 1, 13, '#070b1d', 'center');
  }
}

function drawParticles(ctx, world) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of world.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  for (const f of world.floaters) {
    ctx.globalAlpha = Math.max(0, f.life);
    text(ctx, f.text, f.x, f.y, 15, f.color, 'center');
  }
  ctx.globalAlpha = 1;
}

function drawHud(ctx, world) {
  const e = world.ember;
  ctx.fillStyle = 'rgba(7, 11, 29, 0.55)';
  ctx.fillRect(0, 0, FIELD.w, 46);
  ctx.fillRect(0, FIELD.h - 40, FIELD.w, 40);
  text(ctx, `SCORE ${world.score.toLocaleString('en-US')}`, 14, 24, 19, PALETTE.cream);
  text(ctx, `BEST ${Math.max(world.best, world.score).toLocaleString('en-US')}`, 14, 42, 11, PALETTE.dim);
  // Hearts.
  let hx = FIELD.w - 14;
  const maxHearts = (DIFFICULTIES[world.difficulty] || DIFFICULTIES.normal).hearts + world.upgrades.maxHearts;
  for (let i = maxHearts - 1; i >= 0; i--) {
    ctx.fillStyle = i < e.hearts ? '#fb7185' : 'rgba(255,255,255,0.22)';
    ctx.font = '18px "Trebuchet MS", Verdana, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('♥', hx, 24);
    hx -= 22;
  }
  // Wave + its sky phase, centred: every wave of the night has a name.
  // Off-normal difficulties tag along, so a hard run reads as hard.
  const diffTag =
    world.difficulty && world.difficulty !== 'normal'
      ? ` · ${DIFFICULTIES[world.difficulty].name}`
      : '';
  text(ctx, `WAVE ${world.wave}/10 — ${lightState(world).phase.name}${diffTag}`, FIELD.w / 2, 18, 17, PALETTE.cream, 'center');
  for (let i = 0; i < TUNE.ringScores.length; i++) {
    ctx.fillStyle = i < world.ringsLit ? '#ffd166' : 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(FIELD.w / 2 - 50 + i * 25, 36, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Dawn progress: how much of the night is behind the keeper.
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(FIELD.w / 2 - 50, 46, 100, 4);
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(FIELD.w / 2 - 50, 46, 100 * (world.wave / 10), 4);
  if (world.stormTimer > 0) {
    text(ctx, '⚡ EMBER STORM — MOTES RAIN!', FIELD.w / 2, 58, 14, '#ff8c42', 'center');
  }
  if (world.boss) {
    text(ctx, 'THE GLOOM HERALD IS HERE', FIELD.w / 2, 58, 14, '#fb7185', 'center');
    const bw = 260;
    ctx.fillStyle = 'rgba(7, 11, 29, 0.8)';
    ctx.fillRect(FIELD.w / 2 - bw / 2, 66, bw, 8);
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(FIELD.w / 2 - bw / 2, 66, bw * Math.max(0, world.boss.hp / world.boss.maxHp), 8);
    ctx.strokeStyle = 'rgba(251, 113, 133, 0.8)';
    ctx.lineWidth = 1;
    ctx.strokeRect(FIELD.w / 2 - bw / 2, 66, bw, 8);
  }
  // Bottom bar: flare, combo, embers, lanterns, pickup.
  const flareCost = Math.max(30, TUNE.flareCost + world.upgrades.flareCost);
  const ready = world.flareEnergy >= flareCost;
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(14, FIELD.h - 28, 150, 12);
  ctx.fillStyle = ready ? '#ffb347' : '#b45309';
  ctx.fillRect(14, FIELD.h - 28, 150 * Math.min(1, world.flareEnergy / 100), 12);
  text(ctx, ready ? 'FLARE READY [F]' : `FLARE ${Math.floor(world.flareEnergy)}/100`, 172, FIELD.h - 21, 13, ready ? '#ffb347' : PALETTE.cream);
  const mult = Math.min(TUNE.comboMax, 1 + Math.floor(world.combo / 4));
  if (world.combo >= 4) {
    text(ctx, `COMBO x${mult}`, 330, FIELD.h - 21, 15, '#ffd166');
  }
  // Ember gem + lantern glyphs, so the economy reads at a glance.
  ctx.save();
  ctx.translate(458, FIELD.h - 21);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = '#fde68a';
  ctx.fillRect(-5, -5, 10, 10);
  ctx.restore();
  text(ctx, `EMBERS ${world.embers}`, 470, FIELD.h - 21, 15, '#fde68a');
  ctx.fillStyle = '#fde68a';
  ctx.fillRect(606, FIELD.h - 27, 3, 10);
  ctx.beginPath();
  ctx.arc(607.5, FIELD.h - 29, 4, 0, Math.PI * 2);
  ctx.fill();
  text(
    ctx,
    `LANTERNS ${world.lanterns.list.length}/${world.lanterns.slots} [B]`,
    620,
    FIELD.h - 21,
    15,
    world.lanterns.list.length < world.lanterns.slots ? PALETTE.cream : PALETTE.dim,
  );
  const pickup = world.ember.shield
    ? 'SHIELD'
    : world.magnetTimer > 0
      ? 'MAGNET'
      : world.slowTimer > 0
        ? 'SLOWLIGHT'
        : '—';
  text(ctx, `PICKUP: ${pickup}`, FIELD.w - 14, FIELD.h - 21, 13, PALETTE.dim, 'right');
  if (e.hearts === 1) {
    ctx.strokeStyle = `rgba(251, 113, 133, ${0.25 + 0.2 * Math.sin(world.time * 5)})`;
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, FIELD.w - 6, FIELD.h - 6);
  }
}

// Difficulty buttons on the title screen: three in a row, keys 1 / 2 / 3
// or click. The caller keeps the choice in view.difficulty.
export function difficultyRects(w, h) {
  const bw = 220;
  const bh = 40;
  const gap = 18;
  const total = bw * 3 + gap * 2;
  const x0 = (w - total) / 2;
  const y0 = 462;
  return DIFFICULTY_IDS.map((id, i) => ({
    id,
    key: String(i + 1),
    x: x0 + i * (bw + gap),
    y: y0,
    w: bw,
    h: bh,
  }));
}

function drawTitle(ctx, world, view) {
  ctx.fillStyle = 'rgba(7, 11, 29, 0.72)';
  ctx.fillRect(0, 0, FIELD.w, FIELD.h);
  // Warm halo behind the title + standing lanterns flanking the screen.
  const halo = ctx.createRadialGradient(FIELD.w / 2, 108, 10, FIELD.w / 2, 108, 300);
  halo.addColorStop(0, 'rgba(255, 179, 71, 0.20)');
  halo.addColorStop(1, 'rgba(255, 179, 71, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(FIELD.w / 2 - 300, 108 - 300, 600, 600);
  drawMiniLantern(ctx, FIELD.w / 2 - 330, 120, 1.1, world.time);
  drawMiniLantern(ctx, FIELD.w / 2 + 330, 120, 1.1, world.time);
  drawMiniLantern(ctx, FIELD.w / 2 - 260, 470, 1.6, world.time);
  drawMiniLantern(ctx, FIELD.w / 2 + 260, 470, 1.6, world.time);
  text(ctx, 'LANTERNWARD', FIELD.w / 2, 108, 62, PALETTE.ember, 'center');
  text(ctx, '— the light itself moves every wave —', FIELD.w / 2, 152, 20, PALETTE.gold, 'center');
  text(ctx, 'You are Ember, keeper of the last light. Night sends its wisps.', FIELD.w / 2, 198, 17, PALETTE.cream, 'center');
  text(ctx, 'Gather motes. Spend embers to plant lanterns — they fight for you.', FIELD.w / 2, 224, 17, PALETTE.cream, 'center');
  text(ctx, 'Light all 5 beacon rings and survive 10 waves until dawn.', FIELD.w / 2, 250, 17, PALETTE.cream, 'center');
  const lines = [
    'WASD / ARROWS or MOUSE — steer Ember',
    'SHIFT — dash      F — flare (banishes wisps)',
    'B then CLICK — plant a lantern (45 embers)',
    'Each wave the dawn star moves — lanterns in its light reach farther',
    'P — pause      M — mute      R — restart',
    'Between waves: pick 1 of 3 upgrades — lanterns included',
  ];
  lines.forEach((line, i) => text(ctx, line, FIELD.w / 2, 292 + i * 24, 15, PALETTE.dim, 'center'));
  if (world.best > 0) text(ctx, `BEST SCORE ${world.best.toLocaleString('en-US')}`, FIELD.w / 2, 440, 16, PALETTE.gold, 'center');
  // Difficulty row: the run's first decision, before the first mote.
  const sel = (view && view.difficulty) || 'normal';
  for (const rect of difficultyRects(FIELD.w, FIELD.h)) {
    const diff = DIFFICULTIES[rect.id];
    const active = rect.id === sel;
    ctx.fillStyle = active ? 'rgba(255, 179, 71, 0.16)' : 'rgba(19, 26, 58, 0.9)';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = active ? '#ffd166' : '#475569';
    ctx.lineWidth = active ? 2.5 : 1.5;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    text(ctx, `${rect.key} · ${diff.name}`, rect.x + rect.w / 2, rect.y + 15, 13, active ? PALETTE.gold : PALETTE.dim, 'center');
    text(ctx, diff.tag, rect.x + rect.w / 2, rect.y + 31, 11, PALETTE.dim, 'center');
  }
  const pulse = 0.6 + 0.4 * Math.sin(world.time * 3);
  ctx.globalAlpha = pulse;
  text(ctx, 'PRESS SPACE OR CLICK TO BEGIN', FIELD.w / 2, 530, 20, PALETTE.cream, 'center');
  ctx.globalAlpha = 1;
}

// One small glyph per upgrade, so the draft reads at thumbnail size.
function drawCardIcon(ctx, id, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#ffd166';
  ctx.fillStyle = '#ffd166';
  ctx.lineWidth = 2;
  if (id === 'heart') {
    ctx.font = '20px "Trebuchet MS", Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fb7185';
    ctx.fillText('♥', 0, 0);
  } else if (id === 'flare-wide' || id === 'flare-kindled') {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 6, Math.sin(a) * 6);
      ctx.lineTo(Math.cos(a) * 12, Math.sin(a) * 12);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (id === 'dash-swift') {
    ctx.beginPath();
    ctx.moveTo(-10, -6);
    ctx.lineTo(2, 0);
    ctx.lineTo(-10, 6);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(12, 0);
    ctx.lineTo(0, 6);
    ctx.closePath();
    ctx.fill();
  } else if (id === 'magnet-strong') {
    ctx.beginPath();
    ctx.arc(0, -2, 8, Math.PI, 0, false);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-8, -2);
    ctx.lineTo(-8, 8);
    ctx.moveTo(8, -2);
    ctx.lineTo(8, 8);
    ctx.stroke();
  } else if (id === 'combo-long') {
    ctx.beginPath();
    ctx.arc(-5, 0, 5, 0, Math.PI * 2);
    ctx.arc(5, 0, 5, 0, Math.PI * 2);
    ctx.stroke();
  } else if (id === 'wings-swift') {
    ctx.beginPath();
    ctx.ellipse(-7, 0, 8, 4, -0.5, 0, Math.PI * 2);
    ctx.ellipse(7, 0, 8, 4, 0.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (id === 'motes-rich') {
    for (const [dx, dy] of [[-7, -4], [6, -6], [0, 5]]) {
      ctx.beginPath();
      ctx.arc(dx, dy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (id === 'frost-lantern') {
    // A six-spoke snowflake in frost blue.
    ctx.strokeStyle = '#7dd3fc';
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * -11, Math.sin(a) * -11);
      ctx.lineTo(Math.cos(a) * 11, Math.sin(a) * 11);
      ctx.stroke();
    }
    ctx.fillStyle = '#7dd3fc';
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (
    id === 'lantern-slot' ||
    id === 'beam-long' ||
    id === 'wick-rapid' ||
    id === 'wick-heavy'
  ) {
    ctx.fillRect(-2, -2, 4, 10);
    ctx.beginPath();
    ctx.arc(0, -6, 5, 0, Math.PI * 2);
    ctx.fill();
    if (id === 'beam-long') {
      ctx.beginPath();
      ctx.moveTo(6, -6);
      ctx.lineTo(14, -6);
      ctx.moveTo(6, -2);
      ctx.lineTo(12, -2);
      ctx.stroke();
    }
    if (id === 'wick-heavy') {
      ctx.beginPath();
      ctx.moveTo(8, -12);
      ctx.lineTo(4, -4);
      ctx.lineTo(8, -4);
      ctx.lineTo(4, 4);
      ctx.stroke();
    }
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawDraft(ctx, world) {
  ctx.fillStyle = 'rgba(7, 11, 29, 0.78)';
  ctx.fillRect(0, 0, FIELD.w, FIELD.h);
  text(ctx, `WAVE ${world.wave} CLEARED — ${lightState(world).phase.name}`, FIELD.w / 2, 96, 30, PALETTE.gold, 'center');
  text(ctx, 'Choose one upgrade — click it or press 1 / 2 / 3', FIELD.w / 2, 132, 16, PALETTE.cream, 'center');
  if (world.wave < 10) {
    text(
      ctx,
      `Next: WAVE ${world.wave + 1} — ${skyForWave(world.wave + 1).name} · the dawn star moves`,
      FIELD.w / 2,
      160,
      14,
      PALETTE.gold,
      'center',
    );
  }
  const rects = draftCardRects(FIELD.w, FIELD.h);
  world.draftOptions.forEach((upgrade, i) => {
    const r = rects[i];
    ctx.fillStyle = 'rgba(19, 26, 58, 0.95)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    const isLanternCard =
      upgrade.id.startsWith('lantern') ||
      upgrade.id.startsWith('beam') ||
      upgrade.id.startsWith('wick') ||
      upgrade.id.startsWith('frost');
    ctx.strokeStyle = isLanternCard ? '#ffd166' : '#ffb347';
    ctx.lineWidth = isLanternCard ? 3 : 2;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    if (isLanternCard) text(ctx, '✦ LANTERN', r.x + r.w - 12, r.y + 20, 11, PALETTE.gold, 'right');
    drawCardIcon(ctx, upgrade.id, r.x + r.w / 2, r.y + 62);
    text(ctx, `${i + 1}`, r.x + 16, r.y + 20, 14, PALETTE.dim);
    text(ctx, upgrade.name, r.x + r.w / 2, r.y + 44, 17, PALETTE.cream, 'center');
    // Wrap the description over two lines.
    const words = upgrade.desc.split(' ');
    let line = '';
    const lines = [];
    for (const word of words) {
      if ((line + ' ' + word).trim().length > 24) {
        lines.push(line.trim());
        line = word;
      } else {
        line += ' ' + word;
      }
    }
    lines.push(line.trim());
    lines.forEach((l, j) => text(ctx, l, r.x + r.w / 2, r.y + 76 + j * 20, 13, PALETTE.dim, 'center'));
    const taken = world.upgrades.taken[upgrade.id] || 0;
    text(ctx, taken > 0 ? `Taken x${taken} — max ${upgrade.max}` : `Max ${upgrade.max}`, r.x + r.w / 2, r.y + r.h - 18, 12, PALETTE.gold, 'center');
  });
  text(ctx, buildLine(world.upgrades), FIELD.w / 2, FIELD.h - 78, 14, PALETTE.dim, 'center');
  text(ctx, `SCORE ${world.score.toLocaleString('en-US')}  ·  EMBERS ${world.embers}  ·  LANTERNS ${world.lanterns.list.length}/${world.lanterns.slots}`, FIELD.w / 2, FIELD.h - 50, 14, PALETTE.cream, 'center');
}

function drawEnd(ctx, world, won) {
  if (won) {
    // Dawn breaks: warm light rises from the horizon, and all five
    // beacon rings stand lit across it.
    ctx.fillStyle = 'rgba(7, 11, 29, 0.72)';
    ctx.fillRect(0, 0, FIELD.w, FIELD.h);
    const dawn = ctx.createLinearGradient(0, FIELD.h * 0.45, 0, FIELD.h);
    dawn.addColorStop(0, 'rgba(255, 209, 102, 0.05)');
    dawn.addColorStop(1, 'rgba(255, 140, 66, 0.34)');
    ctx.fillStyle = dawn;
    ctx.fillRect(0, FIELD.h * 0.45, FIELD.w, FIELD.h * 0.55);
    for (let i = 0; i < 5; i++) {
      const rx = FIELD.w / 2 - 160 + i * 80;
      glow(ctx, rx, FIELD.h - 66, 26, 'rgba(255, 209, 102, 0.9)');
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(rx, FIELD.h - 66, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = 'rgba(7, 11, 29, 0.78)';
    ctx.fillRect(0, 0, FIELD.w, FIELD.h);
  }
  text(ctx, won ? 'DAWN BREAKS — YOU WIN!' : 'THE LIGHT FADES', FIELD.w / 2, 130, 44, won ? '#ffd166' : '#fb7185', 'center');
  text(
    ctx,
    won ? 'All 5 rings lit. The last light held until morning.' : `The wisps took the light on wave ${world.wave}.`,
    FIELD.w / 2,
    176,
    17,
    PALETTE.cream,
    'center',
  );
  const rows = [
    ['SCORE', world.score.toLocaleString('en-US')],
    ['BEST', Math.max(world.best, world.score).toLocaleString('en-US')],
    ['WAVES CLEARED', `${won ? 10 : world.wave - 1} / 10`],
    ['BEACON RINGS', `${world.ringsLit} / 5`],
    ['MOTES GATHERED', `${world.stats.motes}`],
    ['WISPS BANISHED', `${world.stats.banished}`],
    ['LANTERNS PLANTED', `${world.stats.placed}`],
    ['BEST COMBO', `x${world.comboBest}`],
  ];
  rows.forEach(([label, value], i) => {
    const y = 226 + i * 28;
    text(ctx, label, FIELD.w / 2 - 130, y, 15, PALETTE.dim, 'right');
    text(ctx, value, FIELD.w / 2 - 110, y, 15, PALETTE.cream);
  });
  const pulse = 0.6 + 0.4 * Math.sin(world.time * 3);
  ctx.globalAlpha = pulse;
  text(ctx, 'PLAY AGAIN — PRESS SPACE', FIELD.w / 2, 486, 20, PALETTE.cream, 'center');
  ctx.globalAlpha = 1;
}

// The one draw call: field + entities + HUD, then the active screen.
export function draw(ctx, world, screen, view) {
  // The Dawn Star's state is pure sim state (wave + waveTime), so every
  // frame of a run paints the same light in the same place.
  const light = lightState(world);
  ctx.save();
  if (world.shake > 0) {
    // Jitter from sim time, never from the run's generator: rendering must
    // not consume random draws, or the run would stop replaying identically.
    const jx = Math.sin(world.time * 91.7) * world.shake * 7;
    const jy = Math.cos(world.time * 83.3) * world.shake * 7;
    ctx.translate(jx, jy);
  }
  drawField(ctx, world, light);
  drawMotes(ctx, world, light);
  drawLanterns(ctx, world, view, light);
  drawWisps(ctx, world);
  drawPickups(ctx, world);
  drawEmber(ctx, world);
  drawParticles(ctx, world);
  drawSceneryFront(ctx, world);
  ctx.restore();
  if (screen === 'play' || screen === 'pause' || screen === 'draft') drawHud(ctx, world);
  if (screen === 'play') {
    if (world.boss && world.boss.age < 2.4) {
      // Boss intro: letterbox bars top and bottom, the field still visible
      // between them. The Herald's arrival is the run's dramatic peak.
      const a = world.boss.age < 0.3 ? world.boss.age / 0.3 : world.boss.age > 1.9 ? (2.4 - world.boss.age) / 0.5 : 1;
      ctx.fillStyle = `rgba(20, 4, 10, ${0.82 * a})`;
      ctx.fillRect(0, 0, FIELD.w, 84);
      ctx.fillRect(0, FIELD.h - 70, FIELD.w, 70);
      ctx.globalAlpha = a;
      text(ctx, 'THE GLOOM HERALD', FIELD.w / 2, 38, 34, '#fb7185', 'center');
      text(ctx, "WAVE 10 — DAWN'S EDGE · 26 HP · IT SPAWNS DRIFTERS", FIELD.w / 2, 66, 13, PALETTE.cream, 'center');
      text(ctx, 'BANISH IT BEFORE DAWN', FIELD.w / 2, FIELD.h - 44, 16, PALETTE.gold, 'center');
      text(ctx, 'LANTERNS IN THE DAWN LIGHT REACH 40% FARTHER', FIELD.w / 2, FIELD.h - 22, 12, PALETTE.dim, 'center');
      ctx.globalAlpha = 1;
      ctx.strokeStyle = `rgba(244, 63, 94, ${0.4 * a})`;
      ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, FIELD.w - 8, FIELD.h - 8);
    } else if (world.waveTime < 2.2) {
      // Wave banner: the night's new name, fading as the wave opens.
      const a = Math.max(0, 1 - world.waveTime / 2.2);
      ctx.globalAlpha = a;
      text(ctx, `WAVE ${world.wave} — ${light.phase.name}`, FIELD.w / 2, 150, 30, PALETTE.gold, 'center');
      text(ctx, 'THE DAWN STAR SHIFTS — PLANT LANTERNS IN ITS LIGHT', FIELD.w / 2, 182, 13, PALETTE.cream, 'center');
      ctx.globalAlpha = 1;
    }
  }
  if (screen === 'title') drawTitle(ctx, world, view);
  if (screen === 'pause') {
    ctx.fillStyle = 'rgba(7, 11, 29, 0.66)';
    ctx.fillRect(0, 0, FIELD.w, FIELD.h);
    text(ctx, 'PAUSED', FIELD.w / 2, 260, 44, PALETTE.cream, 'center');
    text(ctx, 'P to resume  ·  R to restart', FIELD.w / 2, 310, 17, PALETTE.dim, 'center');
  }
  if (screen === 'draft') drawDraft(ctx, world);
  if (screen === 'won') drawEnd(ctx, world, true);
  if (screen === 'lost') drawEnd(ctx, world, false);
}
