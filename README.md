# makefun-emberline

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/Goatleaf12/makefun-emberline/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/Goatleaf12/makefun-emberline/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

LANTERNWARD — tower defense where the light itself moves every wave: an original top-down arcade tower-defence game where Ember the firefly gathers light motes, plants fighting lanterns, dodges shadow wisps, and lights five beacon rings before dawn across 10 waves — ending in a boss wave, the Gloom Herald. Every wave the Dawn Star moves to a new sky, and lanterns standing in its light reach 40% farther and fire 25% faster.

## How to play

- **Steer** with WASD / arrow keys, or hold the mouse and Ember follows
  your pointer.
- **Collect light motes** for score and beacon energy. Every mote is also
  an **ember** — the currency you spend on lanterns. Chain motes quickly
  to build a combo up to **x5**. Motes gathered close to a wisp pay
  **double** (brave bonus).
- **Dodge shadow wisps** — drifter, swift, chaser, splitter and bulwark
  kinds. A touch costs a heart (you have 4) and breaks your combo.
  **Bulwarks (new in v10)** arrive from wave 5: slow, steel-grey, 3 HP,
  ringed in plate — they soak bolts, so flare them or chill them.
- **Flare (F or Space)** when the flare bar is full: a ring of light
  banishes every wisp within reach. Splitters burst into two small
  drifters when flared — mind the aftermath.
- **Plant lanterns (B, then click)** for 45 embers each: they stand on the
  field and fire light bolts at the nearest wisp in range. You start with
  2 lantern slots; the draft can add more, and make them shoot farther,
  faster, or harder. Placement is the run's central decision.
- **The Dawn Star moves every wave (new in v5):** each of the 10 waves has
  its own sky — Dusk, Deep Night, Blood Moon, the Long Dark, Dawn's Edge —
  and a wandering Dawn Star hangs over a different part of the field,
  drifting as the wave lasts. A lantern planted inside its lit pool reaches
  **40% farther** and fires **25% faster**; a mote gathered inside it pays
  **+5**. The best ground changes every wave, so placement is a fresh
  decision each time — the light itself is the moving target.
- **Frost lanterns (new in v7):** take the Frost Lantern draft card and
  you may plant a second kind of lantern — a frost crystal that never
  fires, but chills every wisp in its aura to 65% speed (wider and
  colder with further takes). Ember bolts kill; frost buys time. In
  place mode press **1** for ember, **2** for frost.
- **Three difficulties (new in v7):** pick on the title screen — **First
  Light** (gentle: 5 hearts, slower wisps), **Long Night** (the intended
  game), **Endless Dark** (brutal: 3 hearts, faster wisps, one more wisp
  per wave).
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
- **Draft (new in v2, grown in v3, v7):** clear a wave and choose 1 of 3 upgrade cards —
  Extra Heart, Wide Flare, Kindled Flare, Swift Dash, Strong Magnet, Long
  Combo, Swift Wings, Rich Motes — plus five lantern cards: Lantern Slot,
  Long Beam, Rapid Wick, Heavy Wick and Frost Lantern. Click a card or press **1 / 2 / 3**.
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

Deterministic scenes for screenshots: `/?shot=title|play|action|draft|end|boss&seed=N`.

## Layout

- `game/index.html` — page shell and canvas
- `game/src/config.js` — field, palette and all tuning numbers
- `game/src/random.js` — seeded RNG
- `game/src/audio.js` — synthesised SFX and ambient music
- `game/src/input.js` — keyboard + pointer state
- `game/src/daylight.js` — the wandering light: one sky per wave, the
  Dawn Star's drift, the lit pool, sunlit motes (new in v5)
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
