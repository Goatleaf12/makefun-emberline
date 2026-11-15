// main.js — boot, the fixed-step loop, screens, and the ?shot= hook.
//
// The live game runs on requestAnimationFrame with a fixed 1/60 s step, so
// the simulation never depends on frame rate. Shot mode (?shot=kind&seed=N)
// stages a scene synchronously instead: it steps the real rules with the
// autopilot, paints once, and raises window.__shotReady for the screenshot
// driver. No wall clock ever enters the simulation itself.

import { FIELD } from './config.js';
import { createWorld, step, draftPick } from './world.js';
import { draw, difficultyRects, modeRects, mapShopRects, mapRelicRects } from './render.js';
import { makeInput } from './input.js';
import { makeAudio } from './audio.js';
import { draftHit, draftCardRects } from './draft.js';
import { stageShot } from './shots.js';
import { makeCampaign, completeNight, buyMeta, chooseRelic, META_SHOP, RELICS } from './campaign.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

function loadBest(mode = 'campaign') {
  try {
    // Endless Night keeps its own best score, apart from the campaign's.
    return Number(localStorage.getItem(mode === 'endless' ? 'lanternward-best-endless' : 'lanternward-best') || 0);
  } catch {
    return 0;
  }
}

function saveBest(value, mode = 'campaign') {
  try {
    localStorage.setItem(mode === 'endless' ? 'lanternward-best-endless' : 'lanternward-best', String(value));
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
let campaign = makeCampaign();
let screen = 'title'; // 'title' | 'play' | 'pause' | 'draft' | 'map' | 'won' | 'lost'
let view = { placeMode: false, placeKind: 'ember', difficulty: 'normal', mode: 'campaign', pointer: { x: 480, y: 300 } };
let pending = []; // one-shot world actions for the next fixed step

function newRun(seed, difficulty = 'normal', camp = null, mode = 'campaign') {
  if (camp) campaign = camp;
  world = createWorld(seed, loadBest(mode), difficulty, campaign, mode);
  screen = 'title';
  view = { placeMode: false, placeKind: 'ember', difficulty, mode, pointer: { x: 480, y: 300 } };
  pending = [];
  setStatus(mode === 'endless' ? 'ENDLESS NIGHT — no dawn, only waves. Survive.' : 'LANTERNWARD — hold the last light until dawn.');
}

function startPlaying() {
  // A fresh campaign: three nights, no shards, no relic. The run starts
  // with the difficulty chosen on the title screen; the title world's
  // seed was only its animated backdrop.
  audio.unlock();
  if (view.mode === 'endless') {
    // Endless Night: waves without end, its own best score, no campaign.
    campaign = makeCampaign();
    newRun((Math.random() * 1e9) | 0, view.difficulty || 'normal', campaign, 'endless');
    screen = 'play';
    setStatus('Endless Night — survive as many waves as you can. No dawn is coming.');
    return;
  }
  campaign = makeCampaign();
  newRun((Math.random() * 1e9) | 0, view.difficulty || 'normal', campaign);
  screen = 'play';
  setStatus('Night 1 — gather motes, plant lanterns with B, hold the light.');
}

function startNight() {
  // The next night of the same campaign: the map's shards, meta upgrades
  // and chosen relic all carry in.
  audio.unlock();
  newRun((Math.random() * 1e9) | 0, world ? world.difficulty : 'normal', campaign);
  screen = 'play';
  setStatus(`Night ${world.night} — the night deepens. Hold the light.`);
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
  } else if (world.phase === 'nightwon' && screen === 'play') {
    // The night is held: settle it into the campaign, then open the map.
    const earned = completeNight(campaign, world);
    screen = 'map';
    setStatus(`Night ${world.night} held — ${earned} dawn shards earned. Spend them, choose a relic.`);
  } else if (world.phase === 'won' && screen !== 'won') {
    // Settle the last night through the same path as the others, so the
    // campaign total on the victory screen includes all three nights.
    completeNight(campaign, world);
    screen = 'won';
    saveBest(Math.max(loadBest(world.mode), world.score), world.mode);
    setStatus('Dawn breaks — all three nights held!');
  } else if (world.phase === 'lost' && screen !== 'lost') {
    screen = 'lost';
    saveBest(Math.max(loadBest(world.mode), world.score), world.mode);
    setStatus(world.mode === 'endless' ? 'The night claims you — press Space for another endless run.' : 'The light fades — press Space to try this night again.');
  }
}

function handleActions(actions) {
  for (const action of actions) {
    if (action === 'confirm') {
      if (screen === 'title') startPlaying();
      else if (screen === 'map') startNight();
      else if (screen === 'won') startPlaying();
      else if (screen === 'lost') {
        // The campaign keeps its shards and meta: only this night restarts.
        // An endless run just starts again at wave 1.
        newRun((Math.random() * 1e9) | 0, world.difficulty, campaign, world.mode);
        screen = 'play';
        setStatus(
          world.mode === 'endless'
            ? 'Endless Night again — wave 1. The night has no end.'
            : `Night ${world.night} again — the night deepens. Hold the light.`,
        );
      }
    } else if (action === 'pause') {
      if (screen === 'play') {
        screen = 'pause';
        setStatus('Paused.');
      } else if (screen === 'pause') {
        screen = 'play';
      }
    } else if (action === 'restart') {
      newRun((Math.random() * 1e9) | 0, world ? world.difficulty : 'normal', campaign, world ? world.mode : 'campaign');
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
        // A click on a mode button picks the mode; on a difficulty button
        // selects it; anywhere else starts.
        const mRects = modeRects(FIELD.w, FIELD.h);
        const mHit = mRects.find(
          (r) =>
            input.pointer.x >= r.x &&
            input.pointer.x <= r.x + r.w &&
            input.pointer.y >= r.y &&
            input.pointer.y <= r.y + r.h,
        );
        if (mHit) view.mode = mHit.id;
        else {
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
        }
      } else if (screen === 'map') {
        // A click on a shop card buys it; on a relic card chooses it;
        // anywhere else enters the next night.
        const shopRects = mapShopRects(FIELD.w, FIELD.h);
        const shopIdx = draftHit(shopRects, input.pointer.x, input.pointer.y);
        if (shopIdx >= 0) {
          const item = META_SHOP[shopIdx];
          if (buyMeta(campaign, item.id)) {
            setStatus(`Bought ${item.name} — ${campaign.shards} shards left.`);
          } else if ((campaign.metaTaken[item.id] || 0) >= item.max) {
            setStatus(`${item.name} is maxed out.`);
          } else {
            setStatus(`Need ${item.cost - campaign.shards} more shards for ${item.name}.`);
          }
        } else {
          const relicRects = mapRelicRects(FIELD.w, FIELD.h);
          const relicIdx = draftHit(relicRects, input.pointer.x, input.pointer.y);
          if (relicIdx >= 0) {
            chooseRelic(campaign, RELICS[relicIdx].id);
            setStatus(`Relic chosen: ${RELICS[relicIdx].name} for Night ${campaign.night}.`);
          } else {
            startNight();
          }
        }
      } else if (screen === 'won') {
        startPlaying();
      } else if (screen === 'lost') {
        newRun((Math.random() * 1e9) | 0, world.difficulty, campaign, world.mode);
        screen = 'play';
        setStatus(world.mode === 'endless' ? 'Endless Night again — wave 1. The night has no end.' : `Night ${world.night} again — the night deepens. Hold the light.`);
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
    } else if (
      action === 'draft1' ||
      action === 'draft2' ||
      action === 'draft3' ||
      action === 'draft4' ||
      action === 'draft5' ||
      action === 'draft6'
    ) {
      const num = Number(action.slice(-1));
      if (screen === 'title') {
        // Keys 1 / 2 / 3 pick the difficulty on the title screen;
        // keys 4 / 5 pick the mode (campaign or Endless Night).
        const ids = ['gentle', 'normal', 'harsh'];
        if (num >= 1 && num <= 3) view.difficulty = ids[num - 1];
        else if (num === 4) view.mode = 'campaign';
        else if (num === 5) view.mode = 'endless';
      } else if (screen === 'map') {
        // Keys 1 / 2 / 3 buy a dawn upgrade; 4 / 5 / 6 choose a relic.
        if (num >= 1 && num <= 3) {
          const item = META_SHOP[num - 1];
          if (buyMeta(campaign, item.id)) {
            setStatus(`Bought ${item.name} — ${campaign.shards} shards left.`);
          } else if ((campaign.metaTaken[item.id] || 0) >= item.max) {
            setStatus(`${item.name} is maxed out.`);
          } else {
            setStatus(`Need ${item.cost - campaign.shards} more shards for ${item.name}.`);
          }
        } else {
          const relic = RELICS[num - 4];
          chooseRelic(campaign, relic.id);
          setStatus(`Relic chosen: ${relic.name} for Night ${campaign.night}.`);
        }
      } else if (screen === 'play' && view.placeMode) {
        // Keys 1 / 2 / 3 switch the lantern kind while placing.
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
        } else if (action === 'draft3') {
          if (world.campaign && world.campaign.meta.sun >= 1) {
            view.placeKind = 'sun';
            setStatus('Placing a sun lantern — click the field to plant (60 embers). B cancels.');
          } else {
            setStatus('Sun lanterns are locked — buy the Sun Lantern on the campaign map.');
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
  campaign = staged.campaign || campaign;
  screen = staged.screen;
  view = staged.view;
  fitCanvas();
  draw(ctx, world, screen, view, campaign);
  draw(ctx, world, screen, view, campaign);
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
    draw(ctx, world, screen, view, campaign);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
