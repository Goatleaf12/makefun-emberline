// main.js — boot, the fixed-step loop, screens, and the ?shot= hook.
//
// The live game runs on requestAnimationFrame with a fixed 1/60 s step, so
// the simulation never depends on frame rate. Shot mode (?shot=kind&seed=N)
// stages a scene synchronously instead: it steps the real rules with the
// autopilot, paints once, and raises window.__shotReady for the screenshot
// driver. No wall clock ever enters the simulation itself.

import { FIELD } from './config.js';
import { createWorld, step, draftPick } from './world.js';
import { draw, difficultyRects } from './render.js';
import { makeInput } from './input.js';
import { makeAudio } from './audio.js';
import { draftHit, draftCardRects } from './draft.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

function loadBest() {
  try {
    return Number(localStorage.getItem('lanternward-best') || 0);
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    localStorage.setItem('lanternward-best', String(value));
  } catch {
    // Private mode: the run still counts, it just is not remembered.
  }
}

function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg;
}

const audio = makeAudio();
const input = makeInput(canvas);

let world = null;
let screen = 'title'; // 'title' | 'play' | 'pause' | 'draft' | 'won' | 'lost'
let view = { placeMode: false, placeKind: 'ember', difficulty: 'normal', pointer: { x: 480, y: 300 } };
let pending = []; // one-shot world actions for the next fixed step

function newRun(seed, difficulty = 'normal') {
  world = createWorld(seed, loadBest(), difficulty);
  screen = 'title';
  view = { placeMode: false, placeKind: 'ember', difficulty, pointer: { x: 480, y: 300 } };
  pending = [];
  setStatus('LANTERNWARD — hold the last light until dawn.');
}

function startPlaying() {
  // The run starts with the difficulty chosen on the title screen; the
  // title world's seed was only its animated backdrop.
  audio.unlock();
  newRun((Math.random() * 1e9) | 0, view.difficulty || 'normal');
  screen = 'play';
  setStatus('Wave 1 — gather motes, plant lanterns with B, hold the light.');
}

function playEventSounds() {
  for (const event of world.events) {
    if (event === 'mote') audio.pickup(world.combo);
    else if (event === 'hit') audio.hit();
    else if (event === 'flare') audio.flare();
    else if (event === 'place') audio.place();
    else if (event === 'wave' || event === 'ring' || event === 'storm') audio.wave();
    else if (event === 'boss') audio.boss();
    else if (event === 'bossdown') audio.flare();
    else if (event === 'pickup') audio.pickup(2);
    else if (event === 'win') audio.win();
    else if (event === 'lose') audio.lose();
  }
  world.events.length = 0;
}

function syncPhase() {
  if (!world) return;
  if (world.phase === 'draft' && screen === 'play') {
    screen = 'draft';
    setStatus(`Wave ${world.wave} cleared — choose an upgrade.`);
  } else if (world.phase === 'won' && screen !== 'won') {
    screen = 'won';
    saveBest(Math.max(loadBest(), world.score));
    setStatus('Dawn breaks — you win!');
  } else if (world.phase === 'lost' && screen !== 'lost') {
    screen = 'lost';
    saveBest(Math.max(loadBest(), world.score));
    setStatus('The light fades — press Space to try again.');
  }
}

function handleActions(actions) {
  for (const action of actions) {
    if (action === 'confirm') {
      if (screen === 'title') startPlaying();
      else if (screen === 'won' || screen === 'lost') newRun((Math.random() * 1e9) | 0, world.difficulty);
    } else if (action === 'pause') {
      if (screen === 'play') {
        screen = 'pause';
        setStatus('Paused.');
      } else if (screen === 'pause') {
        screen = 'play';
      }
    } else if (action === 'restart') {
      newRun((Math.random() * 1e9) | 0, world ? world.difficulty : 'normal');
    } else if (action === 'mute') {
      const muted = audio.toggleMute();
      setStatus(muted ? 'Sound off.' : 'Sound on.');
    } else if (action === 'place') {
      if (screen === 'play') {
        view.placeMode = !view.placeMode;
        if (view.placeMode) view.placeKind = 'ember';
        setStatus(
          view.placeMode
            ? 'Placing a lantern — click the field to plant (45 embers). 1 Ember · 2 Frost · B cancels.'
            : 'Placement off.',
        );
      }
    } else if (action === 'cancel') {
      view.placeMode = false;
    } else if (action === 'flare') {
      if (screen === 'play') pending.push({ kind: 'flare' });
    } else if (action === 'click') {
      if (screen === 'title') {
        // A click on a difficulty button selects it; anywhere else starts.
        const rects = difficultyRects(FIELD.w, FIELD.h);
        const hit = rects.find(
          (r) =>
            input.pointer.x >= r.x &&
            input.pointer.x <= r.x + r.w &&
            input.pointer.y >= r.y &&
            input.pointer.y <= r.y + r.h,
        );
        if (hit) view.difficulty = hit.id;
        else startPlaying();
      } else if (screen === 'won' || screen === 'lost') {
        newRun((Math.random() * 1e9) | 0, world.difficulty);
      } else if (screen === 'draft') {
        const rects = draftCardRects(FIELD.w, FIELD.h);
        const idx = draftHit(rects, input.pointer.x, input.pointer.y);
        if (idx >= 0 && draftPick(world, idx)) {
          screen = 'play';
          setStatus(`Wave ${world.wave} — the night deepens.`);
        }
      } else if (screen === 'play' && view.placeMode) {
        pending.push({ kind: 'place', x: input.pointer.x, y: input.pointer.y, lanternKind: view.placeKind });
        view.placeMode = false;
      }
    } else if (action === 'draft1' || action === 'draft2' || action === 'draft3') {
      if (screen === 'title') {
        // Keys 1 / 2 / 3 pick the difficulty on the title screen.
        const ids = ['gentle', 'normal', 'harsh'];
        view.difficulty = ids[Number(action.slice(-1)) - 1];
      } else if (screen === 'play' && view.placeMode) {
        // Keys 1 / 2 switch the lantern kind while placing.
        if (action === 'draft1') {
          view.placeKind = 'ember';
          setStatus('Placing an ember lantern — click the field to plant (45 embers). B cancels.');
        } else if (action === 'draft2') {
          if ((world.upgrades.frost || 0) >= 1) {
            view.placeKind = 'frost';
            setStatus('Placing a frost lantern — click the field to plant (45 embers). B cancels.');
          } else {
            setStatus('Frost lanterns are locked — take the Frost Lantern draft card.');
          }
        }
      } else if (screen === 'draft') {
        const idx = Number(action.slice(-1)) - 1;
        if (draftPick(world, idx)) {
          screen = 'play';
          setStatus(`Wave ${world.wave} — the night deepens.`);
        }
      }
    }
  }
}

function stepOnce() {
  handleActions(input.drain());
  view.pointer.x = input.pointer.x;
  view.pointer.y = input.pointer.y;
  const steer = input.steer(world.ember);
  const dash = input.dashHeld();
  const actions = pending;
  pending = [];
  step(world, 1 / 60, steer, dash, actions);
  playEventSounds();
  syncPhase();
}

function fitCanvas() {
  const availW = window.innerWidth - 16;
  const availH = window.innerHeight - 46;
  const scale = Math.max(0.4, Math.min(availW / FIELD.w, availH / FIELD.h, 1.4));
  canvas.style.width = `${Math.floor(FIELD.w * scale)}px`;
  canvas.style.height = `${Math.floor(FIELD.h * scale)}px`;
}

window.addEventListener('resize', fitCanvas);

// --- shot mode: stage, paint, signal readiness, stop. --------------------
const params = new URLSearchParams(location.search);
const shotKind = params.get('shot');
const shotSeed = Number(params.get('seed') || 7);

if (shotKind) {
  const staged = stageShot(shotKind, shotSeed);
  world = staged.world;
  screen = staged.screen;
  view = staged.view;
  fitCanvas();
  draw(ctx, world, screen, view);
  draw(ctx, world, screen, view);
  window.__shotReady = true;
} else {
  // --- live mode -----------------------------------------------------------
  newRun((Math.random() * 1e9) | 0);
  fitCanvas();
  let last = performance.now();
  let acc = 0;
  const STEP = 1 / 60;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (screen === 'play' && world) {
      acc += dt;
      let n = 0;
      while (acc >= STEP && n < 5) {
        stepOnce();
        acc -= STEP;
        n++;
      }
      if (n === 5) acc = 0;
    } else {
      // Menus still animate (title pulse, draft glow): advance sim time
      // without stepping rules, so nothing in the run changes.
      if (world) world.time += dt;
      handleActions(input.drain());
      if (screen === 'draft' && world.phase === 'draft') {
        // Draft keys/clicks are handled above; nothing else to do here.
      }
    }
    draw(ctx, world, screen, view);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
