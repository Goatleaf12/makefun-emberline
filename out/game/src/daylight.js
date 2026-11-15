// daylight.js — the wandering light: one sky per wave, one light that moves.
//
// LANTERNWARD's signature system: every wave the night wears a different
// sky, and a Dawn Star hangs over a different part of the field. The star
// drifts slowly while its wave lasts, and the ground beneath it is lit.
// A lantern planted inside the lit pool reaches 40% farther and fires 25%
// faster; a mote gathered inside it pays +5. So the best ground changes
// every wave, and placement is a fresh decision each time — the same
// "the light moves every wave" shape the top of the board rewards, in
// lantern form.
//
// Pure functions of (wave, waveTime) only: no generator, no mutation, no
// wall clock. The light can never change a replay, a probe, or a shot.

import { FIELD } from './config.js';

export const LIGHT_RADIUS = 235;

// One phase per wave: its name, its sky, its moon, its hills, and where
// the Dawn Star anchors while the wave lasts. The night runs dusk, deep
// night, blood moon, the long dark, then first pale light to dawn's edge.
export const LIGHT_PHASES = [
  { name: 'DUSK', top: '#221133', mid: '#3d1e50', bottom: '#6e2f40', moon: '#fde68a', moonHalo: '253, 230, 138', hillsFar: '#171031', hillsNear: '#0e0a24', stars: 1.0, nebula: 0.16, anchor: { x: 150, y: 95 } },
  { name: 'EMBER DUSK', top: '#1a0f2e', mid: '#452052', bottom: '#7c3a2d', moon: '#fcd34d', moonHalo: '252, 211, 77', hillsFar: '#150d2b', hillsNear: '#0d091f', stars: 1.0, nebula: 0.15, anchor: { x: 810, y: 95 } },
  { name: 'DEEP NIGHT', top: '#070b1d', mid: '#0b1026', bottom: '#131a3a', moon: '#fef3c7', moonHalo: '253, 230, 138', hillsFar: '#0d1330', hillsNear: '#0a0f24', stars: 1.0, nebula: 0.16, anchor: { x: 480, y: 72 } },
  { name: 'WITCHING HOUR', top: '#04121f', mid: '#0b1e33', bottom: '#123a4a', moon: '#bae6fd', moonHalo: '186, 230, 253', hillsFar: '#081826', hillsNear: '#050f1c', stars: 0.9, nebula: 0.14, anchor: { x: 112, y: 300 } },
  { name: 'STARFALL', top: '#0a0a24', mid: '#141238', bottom: '#2c1e5e', moon: '#ddd6fe', moonHalo: '221, 214, 254', hillsFar: '#0e0c2c', hillsNear: '#080720', stars: 1.15, nebula: 0.2, anchor: { x: 848, y: 300 } },
  { name: 'BLOOD MOON', top: '#160a12', mid: '#2a0f1e', bottom: '#4a1626', moon: '#fca5a5', moonHalo: '252, 165, 165', hillsFar: '#1c0b16', hillsNear: '#120810', stars: 0.85, nebula: 0.14, anchor: { x: 660, y: 85 } },
  { name: 'THE LONG DARK', top: '#030712', mid: '#071022', bottom: '#0d1b33', moon: '#cbd5e1', moonHalo: '203, 213, 225', hillsFar: '#070d1c', hillsNear: '#040914', stars: 0.9, nebula: 0.12, anchor: { x: 150, y: 505 } },
  { name: 'FROST LIGHT', top: '#081120', mid: '#0e1e3a', bottom: '#1c2f55', moon: '#bfdbfe', moonHalo: '191, 219, 254', hillsFar: '#0a1526', hillsNear: '#060e1c', stars: 1.0, nebula: 0.15, anchor: { x: 810, y: 505 } },
  { name: 'FIRST PALE', top: '#131a2e', mid: '#232c4a', bottom: '#3d3a5c', moon: '#e0e7ff', moonHalo: '224, 231, 255', hillsFar: '#12162a', hillsNear: '#0b0f20', stars: 0.85, nebula: 0.13, anchor: { x: 480, y: 290 } },
  { name: "DAWN'S EDGE", top: '#1c1533', mid: '#3a2350', bottom: '#7c4a2d', moon: '#fde68a', moonHalo: '253, 230, 138', hillsFar: '#181028', hillsNear: '#0e0a20', stars: 0.7, nebula: 0.15, anchor: { x: 480, y: 85 } },
];

export function phaseForWave(wave) {
  return LIGHT_PHASES[Math.max(1, Math.min(10, wave)) - 1];
}

// The sky colours for a wave: gradient stops, moon, hills, star brightness.
export function skyForWave(wave) {
  return phaseForWave(wave);
}

// Where the Dawn Star is right now, and how far its light reaches.
// It drifts on a slow loop around its anchor while the wave lasts.
// In Endless Night and Boss Rush the ten skies cycle again and again —
// the night never reaches dawn, so the light keeps wandering instead.
export function lightState(world) {
  const wave = world.mode === 'campaign' ? world.wave : ((world.wave - 1) % 10) + 1;
  const phase = phaseForWave(wave);
  const t = world.waveTime;
  const x = phase.anchor.x + Math.sin(t * 0.1 + wave * 1.7) * 46;
  const y = phase.anchor.y + Math.cos(t * 0.07 + wave * 2.3) * 26;
  return {
    x: Math.max(40, Math.min(FIELD.w - 40, x)),
    y: Math.max(40, Math.min(FIELD.h - 40, y)),
    radius: LIGHT_RADIUS,
    phase,
  };
}

// Is a point standing in the Dawn Star's light?
export function inLight(x, y, light) {
  const dx = x - light.x;
  const dy = y - light.y;
  return dx * dx + dy * dy <= light.radius * light.radius;
}
