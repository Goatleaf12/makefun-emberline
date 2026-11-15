// EMBERLINE boot: canvas setup, fixed-step loop, screen state machine,
// and the deterministic ?shot= hook the screenshots are taken from.
// Shot mode stages a scene from its seed and freezes it; live mode runs
// the game for a human player. No network, no libraries.

import { FIELD } from './config.js';
import { makeRng, makeLiveRng } from './random.js';
import { SoundBank } from './audio.js';
import { Controls } from './input.js';
import { createWorld } from './world.js';
import { drawScreen } from './render.js';
import { stageShot } from './shots.js';
import { applyDraftPick, draftPickAt } from './draft.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const BEST_KEY = 'emberline-best';

const params = new URLSearchParams(window.location.search);
const shotKind = params.get('shot');
const seedParam = params.get('seed');
const seed = seedParam === null ? (Math.random() * 0xffffffff) >>> 0 : parseInt(seedParam, 10);

const rng = shotKind ? makeRng(seed) : makeLiveRng();
const sound = new SoundBank();
const controls = new Controls();
controls.attach(canvas);
const world = createWorld(rng);

let best = 0;
try {
  best = parseInt(window.localStorage.getItem(BEST_KEY) || '0', 10) || 0;
} catch {
  best = 0;
}
world.best = best;

function saveBest() {
  if (world.score > world.best) {
    world.best = world.score;
    try {
      window.localStorage.setItem(BEST_KEY, String(world.best));
    } catch {
      // Private mode or blocked storage: the best score just lives for
      // this session, and the game plays on regardless.
    }
  }
}

function describe() {
  if (world.screen === 'title') return 'EMBERLINE — press Space or click to begin. Best ' + world.best + '.';
  if (world.screen === 'pause') return 'Paused. Press P to resume, R to restart.';
  if (world.screen === 'draft') return `Wave ${world.wave} cleared — choose 1 of 3 upgrades (keys 1/2/3 or click a card).`;
  if (world.screen === 'won') return `Dawn breaks — you win! Score ${world.score}. Press Space to play again.`;
  if (world.screen === 'lost') return `Game over — score ${world.score}, wave ${world.wave}. Press Space to play again.`;
  return `Wave ${world.wave} of 10 — score ${world.score}, ${world.hearts} hearts, flare ${Math.min(100, Math.round((world.energy / 90) * 100))}%.`;
}

function render() {
  ctx.clearRect(0, 0, FIELD.width, FIELD.height);
  drawScreen(ctx, world);
  statusEl.textContent = describe();
}

// One fixed step of live play: menu keys, pause, restart, then the world.
function liveStep(dt) {
  if (controls.hasAction('mute')) {
    sound.setMuted(!sound.muted);
  }
  if (world.screen === 'title') {
    if (controls.hasAction('confirm') || controls.keys.has(' ')) {
      controls.drainActions();
      sound.unlock();
      sound.startMusic();
      sound.click();
      world.begin();
    }
    return;
  }
  if (world.screen === 'pause') {
    if (controls.hasAction('pause') || controls.hasAction('confirm')) {
      controls.drainActions();
      world.screen = 'play';
    } else if (controls.hasAction('restart')) {
      controls.drainActions();
      world.begin();
    }
    return;
  }
  // The upgrade draft: keys 1/2/3 pick a card, a click on a card does too.
  if (world.screen === 'draft') {
    let pick = -1;
    if (controls.hasAction('draft1')) pick = 0;
    else if (controls.hasAction('draft2')) pick = 1;
    else if (controls.hasAction('draft3')) pick = 2;
    else if (controls.hasAction('confirm')) pick = draftPickAt(world, controls.pointer.x, controls.pointer.y);
    if (pick >= 0) {
      const taken = applyDraftPick(world, pick);
      if (taken) {
        controls.drainActions();
        sound.pickup();
      }
    } else {
      controls.drainActions();
    }
    return;
  }
  if (world.screen === 'won' || world.screen === 'lost') {
    saveBest();
    if (controls.hasAction('confirm') || controls.hasAction('restart') || controls.keys.has(' ')) {
      controls.drainActions();
      sound.click();
      world.begin();
    }
    return;
  }
  // Playing.
  if (controls.hasAction('pause')) {
    world.screen = 'pause';
    return;
  }
  if (controls.hasAction('restart')) {
    world.begin();
    return;
  }
  if (controls.hasAction('confirm')) sound.unlock();
  const before = world.screen;
  world.step(dt, controls, sound);
  if (world.screen === 'won' && before === 'play') {
    saveBest();
    sound.victory();
  } else if (world.screen === 'lost' && before === 'play') {
    saveBest();
  }
}

// Fit the 960x600 field into the window while keeping its aspect ratio.
function fitCanvas() {
  // Leave room for the status line below the canvas, or the flex column
  // overflows the viewport and the canvas top gets clipped.
  const scale = Math.min(window.innerWidth / FIELD.width, (window.innerHeight - 40) / FIELD.height, 1.6);
  canvas.style.width = `${Math.floor(FIELD.width * scale)}px`;
  canvas.style.height = `${Math.floor(FIELD.height * scale)}px`;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

// Scale pointer coordinates into field pixels (the canvas is letterboxed).
function pointerToField(e) {
  const rect = canvas.getBoundingClientRect();
  const sx = FIELD.width / rect.width;
  const sy = FIELD.height / rect.height;
  controls.pointer.x = (e.clientX - rect.left) * sx;
  controls.pointer.y = (e.clientY - rect.top) * sy;
}
canvas.addEventListener('pointermove', pointerToField);
canvas.addEventListener('pointerdown', pointerToField);

if (shotKind) {
  // Deterministic scene: stage it from the seed, paint twice so the
  // canvas is settled, then signal the screenshot driver.
  const scene = stageShot(shotKind, world, null);
  world.best = Math.max(world.best, 1200);
  render();
  render();
  window.__shotReady = true;
  window.__shotScreen = scene.screen;
} else {
  world.begin();
  world.screen = 'title';
  let last = performance.now();
  let acc = 0;
  const STEP = 1 / 60;
  function frame(now) {
    const elapsed = Math.min(0.1, (now - last) / 1000);
    last = now;
    acc += elapsed;
    let guard = 0;
    while (acc >= STEP && guard < 5) {
      liveStep(STEP);
      acc -= STEP;
      guard += 1;
    }
    render();
    requestAnimationFrame(frame);
  }
  render();
  requestAnimationFrame(frame);
}
