# Handoff log

Newest at the top. Use the template in `architecture/WORKFLOW.md`. Don't edit old entries; add a new one.

## 2026-10-21 02:05 · local · Stage 2 first pass (S2-05..09, S3-03 in `review`)
- **What:** built Stage 2 before reading the blueprint, on top of the Stage 1.5 code, so it is **not** in the S2-01..03 layout. Everything is in `game/src/scenes/GameScene.ts` (about 1000 lines) plus `weapons.ts`, `art.ts`, `ui.ts`, `font5x7.ts`, `beat.ts`, `progress.ts`, `scenes/BootScene.ts`, `scenes/LoadoutScene.ts`.
  - 8 weapons in a registry with button/impact abilities; 8 monster behaviours; element icons; combo and MASH banner on the beat; score and stars; loadout picker; levels 1 to 4 and sandbox level 99.
  - Monsters take fall and impact damage (`tuning.fallThreshold`, `fallK`, `debrisK`).
  - Design pass from `docs/monster_mash/08_design_direction.md`: beat clock, lowercase 5x7 font, button kit, impact kit, 3-tone sprites with auto outline, dithered sky and 3 parallax layers.
- **Schema changes:** added `dir` and `speed` to level monsters (runner direction and speed). Level files now use `hints`, `escapeLimit`, `exit.y`, `shots`, `realm`, `kind` as the schema defines.
- **Conflicts resolved:** merged the blueprint; `docs/monster_mash/content.json` stays deleted; the data lives in `game/public/data/content.json` (new `tuning` keys: `fallThreshold`, `fallK`, `blockDebrisFactor`, `homeZoomMin`, `homeLeft`, `points`, `shotBonusPoints`, `shotBonusCoins`).
- **Checks:** `npm run check` 0 errors, `npm run build` ok, `rundot predeploy` 20/20. Scripted sweeps: every weapon kills at least one monster on level 1 with some aim; levels 2 to 4 are clearable in 1 to 3 shots; monsters verified by script (imp flies a sine path, runner escapes at the door, troll regains 10 HP in 2 s, hexer shields a neighbour, a 280 px fall kills a goblin).
- **Deployed:** v1.3.0 https://w.run/u/83DTzRcGtCh99lCAuhBn/private?k=cebc9f99a0b809b71bddcc00d5907563
- **Notes / for the next agent:**
  - Gravity: this Matter build ignores `body.gravityScale`. Weapons use `setGravity()` which sets `ignoreGravity` or a manual per-step force.
  - Tweens run on wall-clock time. Tests use `GameScene.skipToReady()` and step with `game.scene.update(t, dt)` (no rendering, about 50 times faster than `game.step`).
  - `pointerWorld()` is computed from the view state, not the camera matrix, so it works without a render.
  - Missing against the cards: iron and crystal materials, runner `path`/`delay`, `features.*` flags, the S2-01..03 module split, S2-04 sweep as a script, and `scoreTarget` from sweep data (current ones are guesses: 1200, 1800, 2000, 3000).
  - Iron Warlord (the 9th monster) is S4-02.
- **Questions for owner:** phone test of v1.3.0.

## 2026-10-21 · cloud · Blueprint moved to architecture/
- **What:** `docs/blueprint/` is now `architecture/` at the repo root (ARCHITECTURE, DATA, STAGES, RECIPES, WORKFLOW). References in AGENTS.md, STATUS.md, the schemas and the old stage prompts are updated. Older log entries still say `docs/blueprint/`; read that as `architecture/`.
- **Checks:** `npm run check` and `npm run build` pass. No code changed.

## 2026-10-21 · cloud · Blueprint added
- **What:**
  - `AGENTS.md` (root entry point) and `docs/blueprint/{ARCHITECTURE,DATA,STAGES,RECIPES,WORKFLOW}.md`.
  - JSON Schemas in `game/schemas/` for content, level, config and save.
  - `game/scripts/check-data.mjs`, a no-dependency validator with cross-reference checks, wired into `npm run check`, `npm run check:data` and `npm run build`.
  - The Four Realms item catalogue copied into `catalogue/`.
  - This board and log.
- **Removed:** `docs/monster_mash/content.json`. `game/public/data/content.json` is now the only copy (they had drifted: the game copy has `tuning`).
- **Superseded:** `docs/monster_mash/03_stage_prompts.md`, replaced by `docs/blueprint/STAGES.md`. Numbered `0x_` reply files are replaced by this log.
- **Checks:** `npm run check` and `npm run build` pass on `ce5f90e` plus this change. `check-data` prints 0 errors and 13 warnings, which are expected (no config.json yet, `level.weapon` deprecated, levels 2-12 missing). A negative test with injected typos and bad references catches all 7.
- **For the next agent:** start with **S2-01** (split GameScene, about 800 lines, with no behaviour change), then S2-02 and S2-03. Everything else builds on that layout. The local session's notes in `07_local_reply.md` still apply: tweens are wall-clock, so scripted tests must skip the intro pan.
- **Questions for owner:** see "Waiting on owner" in STATUS.md.
