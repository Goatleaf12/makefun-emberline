# EMBERLINE — Keeper of the Last Light

An original top-down arcade game built for make.fun's **best-game-01**
("Make the best game"). You are Ember, a small firefly spirit. Night is
falling, shadow wisps drift in from the dark, and the lighthouse beacon
must stay lit until dawn.

## How to play

- **Steer** with WASD / arrow keys, or hold the mouse and Ember follows
  your pointer.
- **Collect light motes** for score and beacon energy. Chain them quickly
  to build a combo up to **x5**. Motes gathered close to a wisp pay
  **double** (brave bonus).
- **Dodge shadow wisps** — drifter, swift, chaser and splitter kinds.
  A touch costs a heart (you have 4) and breaks your combo.
- **Flare (F or Space)** when the flare bar is full: a ring of light
  banishes every wisp within reach. Splitters burst into two small
  drifters when flared — mind the aftermath.
- **Pickups** appear on the field — Aegis Shield (blocks one hit), Mote
  Magnet (pulls motes to you), Slowlight (wisps drift slowly for 6 s).
  You hold one at a time; taking a new one replaces the old.
- **Dash (Shift)** for a burst of speed and a blink of invulnerability.
- **P / Esc** pauses, **M** mutes, **R** restarts, **Space** starts.

**Win:** survive all 10 waves and light all 5 beacon rings — dawn breaks.
**Lose:** all 4 hearts gone. Every 3rd wave (3, 6, 9) is an Ember Storm:
a dense rain of motes with a bonus timer.

## Run it

```sh
node serve.ts
# open http://127.0.0.1:8080/ in a desktop browser
```

No build step, no libraries, no network requests: vanilla JS + Canvas 2D
with synthesised WebAudio sound, all art drawn procedurally.

Deterministic scenes for screenshots: `/?shot=title|play|action|end&seed=N`.

## Layout

- `game/index.html` — page shell and canvas
- `game/src/config.js` — field, palette and all tuning numbers
- `game/src/random.js` — seeded RNG
- `game/src/audio.js` — synthesised SFX and ambient music
- `game/src/input.js` — keyboard + pointer state
- `game/src/world.js` — entities, waves, collisions, scoring
- `game/src/render.js` — canvas drawing: field, entities, HUD, screens
- `game/src/shots.js` — deterministic scenes + autopilot
- `game/src/main.js` — boot, fixed-step loop, screen state machine
- `main.ts` — entrypoint: copies game/ + screenshots/ to /output and
  writes dossier.json
- `serve.ts` — tiny static server for local play

## License

MIT — see `LICENSE`.
