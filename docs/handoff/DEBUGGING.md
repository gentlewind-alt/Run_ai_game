# Local debugging

Debug mode exists only on your machine: `?debug=1` is honoured on `localhost`, `127.0.0.1` or the Vite dev server, **never on the hosted game** (it would unlock everything and break the leaderboards).

## Start
```
cd game
npm run dev:debug        # dev server, opens /?debug=1
npm run preview:debug    # a production-like build with source maps and no minify, served locally with ?debug=1
npm run build:debug      # only builds to game/dist-debug (source maps, not minified)
```
URL options: `?debug=1&level=24` starts straight in level 24; `?debug=1&sandbox=1` opens the sandbox level 99; `?mock=1` uses the mock platform (fake leaderboard rows).

## What debug mode gives you
- **Panel** (press the backtick key): fps, scene, level, battle state, step count, shots left, monsters and blocks alive, coins, the track playing. Buttons: Win, Lose, Restart, Map, Prev/Next level, +3 shots, +10k coins, Unlock all, Physics (Matter debug draw), a theme picker with a boss tick-box to audition any soundtrack.
- **Console:** `window.__dbg` has `win() lose() goto(n) step(±1) coins(n) unlockAll() moreShots(n) physicsDraw() track(theme, variant, boss) state()`; `window.__mm` is the scripted test hook (load, fire, run, settle, sweep, solveStep, play, state, give, profile, battle).
- Cheats on: every level and weapon unlocked, progress is not saved, weapon prices are not enforced (`core/profile.ts`, `core/economy.ts`).

## Tools that use it
`tools/probe.mjs "<js>"` (headless Chrome, optional `SHOT=file.png`), `tools/gate_file.mjs`, `tools/level_review.mjs`, `tools/regress.mjs`. They need the dev server on port 5212 (`npx vite --port 5212 --strictPort`) and, for the level tools, nothing else touching `public/data/levels/level_99.json`.

## Soundtrack
`public/data/music.json` (one theme per realm plus title and map and a boss mix per theme; the level number picks key and tempo drift), `src/audio/trackgen.ts` (notes), `src/audio/music.ts` (Web Audio player). `node tools/render_tracks.mjs` renders every theme, boss mix and level to WAV files in `docs/music/` (git-ignored) and checks all tracks, so you can hear them without the browser.

Global Challenges (share, browse, scores) need `?mock=1` locally: the SDK mock has no UGC backend, the in-memory mock has two seeded challenges.

Live game admin: five quick taps on the Title screen's top-left corner, then the admin code (see `tools/admin_code.mjs`). `?owner=1` no longer exists. In local dev admin works the same way with `?mock=1`.
