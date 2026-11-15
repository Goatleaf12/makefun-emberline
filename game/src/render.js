// Drawing for EMBERLINE: the night field, Ember, motes, wisps, pickups,
// particles, the HUD, and every screen (title, pause, victory, game over).
// Reads world state only; never mutates it. All layout is in field pixels
// (960x600) and the caller scales the canvas to fit the window.

import { FIELD, PALETTE, TUNING, WISP_KINDS, PICKUP_KINDS } from './config.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawStar(ctx, x, y, r, points, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const a = (i * Math.PI) / points - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function drawField(ctx, world) {
  const g = ctx.createLinearGradient(0, 0, 0, FIELD.height);
  g.addColorStop(0, PALETTE.night);
  g.addColorStop(1, PALETTE.nightEdge);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);

  // Faint stars, placed by a fixed hash of their index so they never move.
  ctx.fillStyle = 'rgba(255,247,230,0.5)';
  for (let i = 0; i < 70; i += 1) {
    const x = (i * 137.5) % FIELD.width;
    const y = (i * 89.3) % FIELD.height;
    const s = 1 + ((i * 7) % 3) * 0.5;
    ctx.fillRect(x, y, s, s);
  }

  // The beacon: a lighthouse glow at the top centre, ringed by the five
  // beacon rings the keeper must light before dawn.
  const bx = FIELD.width / 2;
  const by = 26;
  const glow = ctx.createRadialGradient(bx, by, 4, bx, by, 120);
  glow.addColorStop(0, 'rgba(255,209,102,0.5)');
  glow.addColorStop(1, 'rgba(255,209,102,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(bx - 120, by - 120, 240, 240);
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.arc(bx, by, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a3f5e';
  ctx.fillRect(bx - 3, by + 8, 6, 14);
  for (let i = 0; i < 5; i += 1) {
    const lit = i < world.ringsLit;
    ctx.beginPath();
    ctx.arc(bx - 44 + i * 22, by + 34, 6, 0, Math.PI * 2);
    ctx.fillStyle = lit ? PALETTE.ringLit : PALETTE.ringDark;
    ctx.fill();
    if (lit) {
      ctx.strokeStyle = 'rgba(255,209,102,0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  // A soft amber vignette that deepens toward the edges of the night.
  const vg = ctx.createRadialGradient(
    FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.42,
    FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.95,
  );
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(2,4,16,0.55)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
}

function drawMotes(ctx, world) {
  for (const m of world.motes) {
    const pulse = 1 + Math.sin(m.phase) * 0.18;
    const r = m.r * pulse;
    const glow = ctx.createRadialGradient(m.x, m.y, 1, m.x, m.y, r * 3);
    glow.addColorStop(0, 'rgba(255,209,102,0.55)');
    glow.addColorStop(1, 'rgba(255,209,102,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(m.x - r * 3, m.y - r * 3, r * 6, r * 6);
    drawStar(ctx, m.x, m.y, r, 4, PALETTE.mote);
    ctx.fillStyle = PALETTE.moteCore;
    ctx.beginPath();
    ctx.arc(m.x, m.y, r * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWisps(ctx, world) {
  for (const w of world.wisps) {
    const color = WISP_KINDS[w.kind].hue;
    const flicker = 0.85 + Math.sin(w.wobble * 2) * 0.15;
    ctx.globalAlpha = flicker;
    const glow = ctx.createRadialGradient(w.x, w.y, 2, w.x, w.y, w.r * 2.6);
    glow.addColorStop(0, color);
    glow.addColorStop(1, 'rgba(125,211,252,0)');
    ctx.globalAlpha = flicker * 0.5;
    ctx.fillStyle = glow;
    ctx.fillRect(w.x - w.r * 2.6, w.y - w.r * 2.6, w.r * 5.2, w.r * 5.2);
    ctx.globalAlpha = flicker;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
    ctx.fill();
    // Two hollow eyes and a trailing tail mark the shadow.
    ctx.fillStyle = '#0b1026';
    const ex = Math.cos(w.angle);
    const ey = Math.sin(w.angle);
    ctx.beginPath();
    ctx.arc(w.x + ex * 4 - ey * 5, w.y + ey * 4 + ex * 5, 2.6, 0, Math.PI * 2);
    ctx.arc(w.x + ex * 4 + ey * 5, w.y + ey * 4 - ex * 5, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.wispEdge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.r + 3, w.angle + 2.2, w.angle + 4.1);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawPickups(ctx, world) {
  for (const p of world.pickups) {
    const info = PICKUP_KINDS[p.kind];
    const bob = Math.sin(p.phase) * 4;
    const blink = p.life < 3 ? (Math.sin(p.phase * 6) > 0 ? 1 : 0.35) : 1;
    ctx.globalAlpha = blink;
    ctx.fillStyle = info.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y + bob, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0b1026';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.kind === 'shield' ? 'S' : p.kind === 'magnet' ? 'M' : 'Z', p.x, p.y + bob + 0.5);
    ctx.globalAlpha = 1;
    ctx.fillStyle = PALETTE.cream;
    ctx.font = '11px sans-serif';
    ctx.fillText(info.label, p.x, p.y + bob + 28);
  }
}

function drawEmber(ctx, world) {
  const e = world.ember;
  const blink = e.invuln > 0 && Math.floor(e.invuln * 12) % 2 === 0;
  if (blink) return;
  const glow = ctx.createRadialGradient(e.x, e.y, 2, e.x, e.y, 46);
  glow.addColorStop(0, 'rgba(255,179,71,0.85)');
  glow.addColorStop(1, 'rgba(255,140,66,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(e.x - 46, e.y - 46, 92, 92);

  if (e.shield) {
    ctx.strokeStyle = 'rgba(147,197,253,0.9)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r + 9, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (e.dashLeft > 0) {
    ctx.strokeStyle = 'rgba(255,247,230,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r + 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Body: a warm teardrop pointing where Ember flies, with two wings.
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.angle);
  ctx.fillStyle = 'rgba(255,247,230,0.75)';
  ctx.beginPath();
  ctx.ellipse(-4, -9, 7, 4, -0.5, 0, Math.PI * 2);
  ctx.ellipse(-4, 9, 7, 4, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.ember;
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.quadraticCurveTo(2, -11, -10, -6);
  ctx.quadraticCurveTo(-14, 0, -10, 6);
  ctx.quadraticCurveTo(2, 11, 16, 0);
  ctx.fill();
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.arc(5, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBursts(ctx, world) {
  for (const p of world.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  for (const f of world.floaters) {
    ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function drawHud(ctx, world) {
  ctx.textBaseline = 'alphabetic';
  // Top bar: score, best, hearts, wave.
  ctx.fillStyle = 'rgba(5,8,24,0.72)';
  roundRect(ctx, 10, 8, 330, 52, 10);
  ctx.fill();
  ctx.fillStyle = PALETTE.cream;
  ctx.font = 'bold 21px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`SCORE ${world.score}`, 22, 30);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = PALETTE.dimCream;
  ctx.fillText(`BEST ${Math.max(world.best, world.score)}`, 22, 50);
  for (let i = 0; i < TUNING.hearts; i += 1) {
    const hx = 268 + i * 24;
    const hy = 30;
    ctx.fillStyle = i < world.hearts ? PALETTE.heart : '#3a3f5e';
    ctx.beginPath();
    ctx.moveTo(hx, hy + 5);
    ctx.bezierCurveTo(hx - 9, hy - 4, hx - 4, hy - 11, hx, hy - 4);
    ctx.bezierCurveTo(hx + 4, hy - 11, hx + 9, hy - 4, hx, hy + 5);
    ctx.fill();
  }
  ctx.fillStyle = PALETTE.cream;
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`WAVE ${Math.max(1, world.wave)}/${TUNING.totalWaves}`, FIELD.width - 16, 30);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = PALETTE.dimCream;
  ctx.fillText(world.stormActive ? 'EMBER STORM!' : 'Survive until dawn', FIELD.width - 16, 50);

  // Flare bar + combo + pickup slot, bottom-left.
  ctx.fillStyle = 'rgba(5,8,24,0.72)';
  roundRect(ctx, 10, FIELD.height - 58, 330, 48, 10);
  ctx.fill();
  ctx.fillStyle = PALETTE.dimCream;
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('FLARE  [F]', 22, FIELD.height - 38);
  ctx.fillStyle = '#3a3f5e';
  roundRect(ctx, 90, FIELD.height - 46, 130, 12, 6);
  ctx.fill();
  const frac = Math.min(1, world.energy / TUNING.flareCost);
  ctx.fillStyle = frac >= 1 ? PALETTE.flare : PALETTE.ember;
  if (frac > 0) {
    roundRect(ctx, 90, FIELD.height - 46, 130 * frac, 12, 6);
    ctx.fill();
  }
  if (frac >= 1) {
    ctx.fillStyle = PALETTE.flare;
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('READY!', 228, FIELD.height - 35);
  }
  const comboText = world.comboMult > 1 ? `COMBO x${world.comboMult}` : 'COMBO x1';
  ctx.fillStyle = world.comboMult >= 4 ? '#ff9d5c' : PALETTE.cream;
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(comboText, 22, FIELD.height - 16);
  const slot = world.pickup ? PICKUP_KINDS[world.pickup].label : 'Pickup: —';
  ctx.fillStyle = world.pickup ? PICKUP_KINDS[world.pickup].color : PALETTE.dimCream;
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(slot, 330, FIELD.height - 16);
  ctx.textAlign = 'left';

  // Low-health heartbeat vignette.
  if (world.hearts === 1 && world.screen === 'play') {
    const pulse = 0.16 + 0.1 * Math.sin(world.time * 6);
    const vg = ctx.createRadialGradient(
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.35,
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.9,
    );
    vg.addColorStop(0, 'rgba(255,40,70,0)');
    vg.addColorStop(1, `rgba(255,40,70,${pulse})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  // Centre announcement line.
  if (world.messageTimer > 0 && world.message) {
    ctx.globalAlpha = Math.min(1, world.messageTimer);
    ctx.fillStyle = PALETTE.cream;
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(world.message, FIELD.width / 2, 96);
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'left';
}

function panel(ctx, title, lines, accent) {
  const w = 560;
  const h = 120 + lines.length * 30;
  const x = (FIELD.width - w) / 2;
  const y = (FIELD.height - h) / 2;
  ctx.fillStyle = 'rgba(5,8,24,0.88)';
  roundRect(ctx, x, y, w, h, 16);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 16);
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, FIELD.width / 2, y + 58);
  ctx.fillStyle = PALETTE.cream;
  ctx.font = '17px sans-serif';
  lines.forEach((line, i) => {
    ctx.fillText(line, FIELD.width / 2, y + 96 + i * 30);
  });
  ctx.textAlign = 'left';
}

export function drawWorld(ctx, world) {
  ctx.save();
  if (world.shake > 0) {
    ctx.translate((Math.random() - 0.5) * world.shake, (Math.random() - 0.5) * world.shake);
  }
  drawField(ctx, world);
  drawMotes(ctx, world);
  drawPickups(ctx, world);
  drawWisps(ctx, world);
  drawEmber(ctx, world);
  drawBursts(ctx, world);
  ctx.restore();
  if (world.screen === 'play' || world.screen === 'pause') drawHud(ctx, world);
}

export function drawTitle(ctx, world) {
  drawWorld(ctx, world);
  ctx.fillStyle = 'rgba(5,8,24,0.55)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.fillStyle = PALETTE.ember;
  ctx.font = 'bold 64px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('EMBERLINE', FIELD.width / 2, 150);
  ctx.fillStyle = PALETTE.cream;
  ctx.font = '22px sans-serif';
  ctx.fillText('Keeper of the Last Light', FIELD.width / 2, 188);
  ctx.font = '17px sans-serif';
  ctx.fillStyle = PALETTE.dimCream;
  ctx.fillText('Gather light motes. Dodge the shadow wisps. Light all 5 beacon rings before dawn.', FIELD.width / 2, 236);
  ctx.fillText('Brave motes near wisps pay double. Chain motes for a combo up to x5.', FIELD.width / 2, 262);
  ctx.fillStyle = PALETTE.cream;
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('WASD / Arrows or hold mouse to steer  •  Shift dash  •  F flare  •  P pause  •  M mute', FIELD.width / 2, 316);
  ctx.fillText('Pickups replace each other: Shield, Magnet, Slowlight — choose what fits the moment.', FIELD.width / 2, 342);
  ctx.fillStyle = PALETTE.mote;
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('Press SPACE or click to begin', FIELD.width / 2, 408);
  if (world.best > 0) {
    ctx.fillStyle = PALETTE.dimCream;
    ctx.font = '16px sans-serif';
    ctx.fillText(`Best score: ${world.best}`, FIELD.width / 2, 442);
  }
  ctx.textAlign = 'left';
}

export function drawPause(ctx, world) {
  drawWorld(ctx, world);
  ctx.fillStyle = 'rgba(5,8,24,0.6)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  panel(ctx, 'PAUSED', [
    `Wave ${world.wave} of ${TUNING.totalWaves}  •  Score ${world.score}`,
    'Press P to resume  •  R to restart',
  ], PALETTE.cream);
}

export function drawEnd(ctx, world) {
  drawWorld(ctx, world);
  const won = world.screen === 'won';
  ctx.fillStyle = won ? 'rgba(255,190,90,0.22)' : 'rgba(5,8,24,0.62)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  panel(ctx, won ? 'DAWN BREAKS — YOU WIN!' : 'THE LIGHT FADES', [
    `Score ${world.score}  •  Best ${Math.max(world.best, world.score)}`,
    `Waves survived ${won ? TUNING.totalWaves : Math.max(0, world.wave - 1)} of ${TUNING.totalWaves}  •  Motes ${world.stats.motes}  •  Wisps banished ${world.stats.wispsBanished}`,
    `Best combo x${world.bestCombo}  •  Flares ${world.stats.flares}  •  Beacon rings ${world.ringsLit}/5`,
    'Press SPACE or click to play again  •  R restarts now',
  ], won ? PALETTE.mote : PALETTE.danger);
}

export function drawScreen(ctx, world) {
  if (world.screen === 'title') drawTitle(ctx, world);
  else if (world.screen === 'pause') drawPause(ctx, world);
  else if (world.screen === 'won' || world.screen === 'lost') drawEnd(ctx, world);
  else drawWorld(ctx, world);
}
