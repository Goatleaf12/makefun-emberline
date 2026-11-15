# makefun-emberline

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/Goatleaf12/makefun-emberline/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/Goatleaf12/makefun-emberline/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

LANTERNWARD — Hold the Last Light: an original top-down arcade tower-defence game where Ember the firefly gathers light motes, plants fighting lanterns, dodges shadow wisps, and lights five beacon rings before dawn across 10 waves — ending in a boss wave, the Gloom Herald.

## How to play

- **Steer** with WASD / arrow keys, or hold the mouse and Ember follows
  your pointer.
- **Collect light motes** for score and beacon energy. Every mote is also
  an **ember** — the currency you spend on lanterns. Chain motes quickly
  to build a combo up to **x5**. Motes gathered close to a wisp pay
  **double** (brave bonus).
- **Dodge shadow wisps** — drifter, swift, chaser and splitter kinds.
  A touch costs a heart (you have 4) and breaks your combo.
- **Flare (F or Space)** when the flare bar is full: a ring of light
  banishes every wisp within reach. Splitters burst into two small
  drifters when flared — mind the aftermath.
- **Plant lanterns (B, then click)** for 45 embers each: they stand on the
  field and fire light bolts at the nearest wisp in range. You start with
  2 lantern slots; the draft can add more, and make them shoot farther,
  faster, or harder. Placement is the run's central decision.
- **Boss wave 10:** the Gloom Herald — a slow, tough wisp (26 HP) that
  spawns drifters every few seconds and drops a shower of motes when it
  falls.
- **Pickups** appear on the field — Aegis Shield (blocks one hit), Mote
  Magnet (pulls motes to you), Slowlight (wisps drift slowly for 6 s).
  You hold one at a time; taking a new one replaces the old.
- **Dash (Shift)** for a burst of speed and a blink of invulnerability —
  dashes leave a bright trail behind Ember.
- **The night is alive:** drifting nebula clouds, a three-layer parallax
  starfield, sweeping lighthouse beams from the beacon, and a pulsing
  glow on every lit beacon ring. Each wisp kind glows in its own colour
  (sky-blue drifter, violet chaser, magenta splitter, cyan swift) and
  shows a shrinking warning ring when it spawns.
- **Draft (new in v2, grown in v3):** clear a wave and choose 1 of 3 upgrade cards —
  Extra Heart, Wide Flare, Kindled Flare, Swift Dash, Strong Magnet, Long
  Combo, Swift Wings, Rich Motes — plus four lantern cards: Lantern Slot,
  Long Beam, Rapid Wick and Heavy Wick. Click a card or press **1 / 2 / 3**.
  Upgrades stack across the 10 waves, so every run builds differently.
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

Deterministic scenes for screenshots: `/?shot=title|play|action|draft|end&seed=N`.

## Layout

- `game/index.html` — page shell and canvas
- `game/src/config.js` — field, palette and all tuning numbers
- `game/src/random.js` — seeded RNG
- `game/src/audio.js` — synthesised SFX and ambient music
- `game/src/input.js` — keyboard + pointer state
- `game/src/world.js` — entities, waves, collisions, scoring
- `game/src/lanterns.js` — placeable fighting lanterns (slots, bolts, range)
- `game/src/draft.js` — the between-wave upgrade draft (12 upgrades, 3 cards)
- `game/src/render.js` — canvas drawing: field, entities, HUD, screens
- `game/src/shots.js` — deterministic scenes + autopilot
- `game/src/main.js` — boot, fixed-step loop, screen state machine
- `main.ts` — entrypoint: copies game/ + screenshots/ to /output and
  writes dossier.json
- `serve.ts` — tiny static server for local play

## License

MIT — see `LICENSE`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=6hqf4yjs&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
