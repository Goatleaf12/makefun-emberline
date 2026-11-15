// scenery.js — the night itself: moon, hills, pines, mushrooms, crystals, fireflies, falling ash. Pure decoration, seeded once, animated only by world.time.

import { FIELD } from './config.js';
import { makeRng } from './random.js';
import { skyForWave } from './daylight.js';

const SEED = makeRng(20261116);

// --- seeded layout (fixed for every run) ---------------------------------

function ridge(rng, baseY, amp, step) {
  const points = [];
  for (let x = -40; x <= FIELD.w + 40; x += step) {
    points.push({ x, y: baseY + (rng() - 0.5) * amp });
  }
  return points;
}

const HILLS_FAR = ridge(SEED, FIELD.h - 96, 46, 80);
const HILLS_NEAR = ridge(SEED, FIELD.h - 44, 34, 60);

const PINES = [];
for (let i = 0; i < 16; i++) {
  PINES.push({
    x: SEED() * FIELD.w,
    h: 26 + SEED() * 30,
    w: 14 + SEED() * 10,
    top: SEED() < 0.25,
  });
}

const SHROOMS = [];
const SHROOM_COLORS = ['#2dd4bf', '#a78bfa', '#f472b6', '#38bdf8'];
for (let i = 0; i < 9; i++) {
  SHROOMS.push({
    x: 50 + SEED() * (FIELD.w - 100),
    y: 90 + SEED() * (FIELD.h - 170),
    r: 5 + SEED() * 5,
    color: SHROOM_COLORS[i % SHROOM_COLORS.length],
    phase: SEED() * Math.PI * 2,
  });
}

const CRYSTALS = [];
for (let i = 0; i < 5; i++) {
  const shards = [];
  const n = 2 + Math.floor(SEED() * 2);
  for (let j = 0; j < n; j++) {
    shards.push({ dx: (j - n / 2) * 9, h: 12 + SEED() * 16, lean: (SEED() - 0.5) * 10 });
  }
  CRYSTALS.push({
    x: 60 + SEED() * (FIELD.w - 120),
    y: 90 + SEED() * (FIELD.h - 160),
    shards,
    color: ['#67e8f9', '#c4b5fd', '#fda4af'][i % 3],
    phase: SEED() * Math.PI * 2,
  });
}

const FIREFLIES = [];
for (let i = 0; i < 18; i++) {
  FIREFLIES.push({
    x: 40 + SEED() * (FIELD.w - 80),
    y: 70 + SEED() * (FIELD.h - 140),
    r: 18 + SEED() * 26,
    speed: 0.25 + SEED() * 0.35,
    phase: SEED() * Math.PI * 2,
    warm: SEED() < 0.6,
  });
}

const ASH = [];
for (let i = 0; i < 26; i++) {
  ASH.push({
    x: SEED() * FIELD.w,
    y: SEED() * FIELD.h,
    fall: 6 + SEED() * 10,
    sway: 6 + SEED() * 10,
    phase: SEED() * Math.PI * 2,
    r: 0.8 + SEED() * 1.4,
  });
}

// --- helpers ---------------------------------------------------------------

function hexRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function fillRidge(ctx, points, baseY, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-40, FIELD.h + 10);
  ctx.lineTo(points[0].x, points[0].y);
  for (const p of points) ctx.lineTo(p.x, p.y);
  ctx.lineTo(FIELD.w + 40, FIELD.h + 10);
  ctx.closePath();
  ctx.fill();
}

function pine(ctx, x, baseY, h, w, color) {
  ctx.fillStyle = color;
  const tiers = 3;
  for (let i = 0; i < tiers; i++) {
    const ty = baseY - (h * (i + 1)) / tiers;
    const tw = (w * (tiers - i)) / tiers;
    ctx.beginPath();
    ctx.moveTo(x - tw / 2, ty + h / tiers);
    ctx.lineTo(x, ty - h / tiers);
    ctx.lineTo(x + tw / 2, ty + h / tiers);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillRect(x - 1.5, baseY - 4, 3, 5);
}

// A small standing lantern, reused by the title screen.
export function drawMiniLantern(ctx, x, y, scale, time) {
  const s = scale || 1;
  const flick = 1 + Math.sin(time * 5 + x) * 0.12;
  const grad = ctx.createRadialGradient(x, y - 12 * s, 2, x, y - 12 * s, 42 * s);
  grad.addColorStop(0, 'rgba(253, 230, 138, 0.5)');
  grad.addColorStop(1, 'rgba(253, 230, 138, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(x - 42 * s, y - 54 * s, 84 * s, 84 * s);
  ctx.fillStyle = '#78350f';
  ctx.fillRect(x - 4 * s, y - 6 * s, 8 * s, 18 * s);
  ctx.fillStyle = '#92400e';
  ctx.fillRect(x - 10 * s, y + 10 * s, 20 * s, 5 * s);
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.ellipse(x, y - 13 * s, 8 * s, 10 * s * flick, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff7e6';
  ctx.beginPath();
  ctx.arc(x, y - 13 * s, 3.5 * s, 0, Math.PI * 2);
  ctx.fill();
}

// --- the moon + a slow meteor ----------------------------------------------

function drawMoon(ctx, world) {
  const sky = skyForWave(world.wave);
  const mx = 838;
  const my = 88;
  const halo = ctx.createRadialGradient(mx, my, 10, mx, my, 90);
  halo.addColorStop(0, `rgba(${sky.moonHalo}, 0.28)`);
  halo.addColorStop(1, `rgba(${sky.moonHalo}, 0)`);
  ctx.fillStyle = halo;
  ctx.fillRect(mx - 90, my - 90, 180, 180);
  ctx.fillStyle = sky.moon;
  ctx.beginPath();
  ctx.arc(mx, my, 32, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(203, 177, 106, 0.55)';
  ctx.beginPath();
  ctx.arc(mx - 10, my - 6, 7, 0, Math.PI * 2);
  ctx.arc(mx + 9, my + 10, 5, 0, Math.PI * 2);
  ctx.arc(mx + 12, my - 12, 4, 0, Math.PI * 2);
  ctx.fill();
  // A slow meteor crosses the sky every 11 seconds of sim time.
  const t = world.time % 11;
  if (t < 1.1) {
    const p = t / 1.1;
    const hx = 140 + p * 320;
    const hy = 52 + p * 130;
    const streak = ctx.createLinearGradient(hx, hy, hx - 70, hy - 28);
    streak.addColorStop(0, `rgba(255, 247, 230, ${0.9 * (1 - p)})`);
    streak.addColorStop(1, 'rgba(255, 247, 230, 0)');
    ctx.strokeStyle = streak;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx - 70, hy - 28);
    ctx.stroke();
  }
}

// --- back layer: sky furniture, ground, decor -------------------------------

export function drawSceneryBack(ctx, world) {
  const sky = skyForWave(world.wave);
  drawMoon(ctx, world);
  fillRidge(ctx, HILLS_FAR, FIELD.h, sky.hillsFar);
  fillRidge(ctx, HILLS_NEAR, FIELD.h, sky.hillsNear);
  for (const p of PINES) {
    if (p.top) pine(ctx, p.x, 22, p.h * 0.6, p.w * 0.6, sky.hillsFar);
    else pine(ctx, p.x, FIELD.h + 4, p.h, p.w, '#080d20');
  }
  for (const s of SHROOMS) {
    const glow = 0.5 + 0.3 * Math.sin(world.time * 1.6 + s.phase);
    const grad = ctx.createRadialGradient(s.x, s.y - 6, 1, s.x, s.y - 6, s.r * 3.4);
    grad.addColorStop(0, hexRgba(s.color, 0.35 * glow));
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(s.x - s.r * 3.4, s.y - 6 - s.r * 3.4, s.r * 6.8, s.r * 6.8);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(s.x - 1.5, s.y - 6, 3, 8);
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y - 6, s.r, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 247, 230, 0.85)';
    ctx.beginPath();
    ctx.arc(s.x - s.r * 0.35, s.y - 6 - s.r * 0.4, 1.4, 0, Math.PI * 2);
    ctx.arc(s.x + s.r * 0.3, s.y - 6 - s.r * 0.2, 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const c of CRYSTALS) {
    const pulse = 0.55 + 0.3 * Math.sin(world.time * 2 + c.phase);
    ctx.globalAlpha = pulse;
    for (const sh of c.shards) {
      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.moveTo(c.x + sh.dx - 5, c.y);
      ctx.lineTo(c.x + sh.dx + sh.lean, c.y - sh.h);
      ctx.lineTo(c.x + sh.dx + 5, c.y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 247, 230, 0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(c.x + sh.dx + sh.lean, c.y - sh.h);
      ctx.lineTo(c.x + sh.dx + 5, c.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

// --- front layer: drifting life + vignette -----------------------------------

export function drawSceneryFront(ctx, world) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const f of FIREFLIES) {
    const x = f.x + Math.sin(world.time * f.speed + f.phase) * f.r;
    const y = f.y + Math.cos(world.time * f.speed * 0.8 + f.phase) * f.r * 0.6;
    const a = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(world.time * 2.2 + f.phase * 3));
    const grad = ctx.createRadialGradient(x, y, 0.5, x, y, 9);
    grad.addColorStop(0, f.warm ? `rgba(255, 209, 102, ${a})` : `rgba(125, 211, 252, ${a})`);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - 9, y - 9, 18, 18);
    ctx.fillStyle = f.warm ? '#ffe9a8' : '#bae6fd';
    ctx.beginPath();
    ctx.arc(x, y, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(255, 179, 71, 0.5)';
  for (const m of ASH) {
    const y = (m.y + world.time * m.fall) % FIELD.h;
    const x = m.x + Math.sin(world.time * 0.3 + m.phase) * m.sway;
    ctx.globalAlpha = 0.28 + 0.22 * Math.sin(world.time + m.phase);
    ctx.beginPath();
    ctx.arc(x, y, m.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const vig = ctx.createRadialGradient(
    FIELD.w / 2, FIELD.h / 2, FIELD.h * 0.42,
    FIELD.w / 2, FIELD.h / 2, FIELD.h * 0.95,
  );
  vig.addColorStop(0, 'rgba(3, 6, 18, 0)');
  vig.addColorStop(1, 'rgba(3, 6, 18, 0.5)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, FIELD.w, FIELD.h);
}
