# Handoff log

Newest at the top. Use the template in `architecture/WORKFLOW.md`. Don't edit old entries; add a new one.

## 2026-10-21 · claude (side session) · S2-01, S2-02, S2-03 in `review`: GameScene split, no behaviour change
- **What:** one refactor for the three cards, on top of the Stage 2 code (merged from `origin/claude/brave-johnson-j555ql` first).
  - **S2-01 layout:** `GameScene.ts` (1396 lines) is now `scenes/BattleScene.ts` (92 lines) plus `battle/{state,setup,world,loop,sling,camera,damage,status,combo,score,rules,projectiles,fx,matter,ctxImpl,BattleCtx}.ts`, `ui/hud.ts` (HUD, MASH banner, results panel), `art/backgrounds.ts`, block/sling/door textures in `art/textures.ts`, `content/weapons/*.ts` (one file per weapon, `WEAPONS` registry plus `weaponImpl()`, which honours `params.behavior`) and `content/monsters/*.ts` (`MONSTERS` registry keyed by the row's `behavior`, default `basic`). `src/weapons.ts` is gone. Files moved: palette/pix/sprites/art/font5x7 to `art/`, audio/beat to `audio/`, ui to `ui/widgets.ts`, progress to `core/profile.ts`. Scene key is still `'game'`.
  - **S2-02 data:** `public/data/config.json` (new; `levels` lists the level files, `features` flags, camera and physics settings), levels moved to `public/data/levels/`, `config/settings.ts` merge (defaults, config, content, level `overrides`, then `?debug=1&tune.launchK=0.35`, `features.x=false` and so on). Weapon rows now carry `physics`, `ability`, `params`; monster rows carry `behavior`, `density`, `params`; materials carry `density`; `tuning` gained `status{}`, `flow{}` and the impact, explosion, aim and mash numbers; `damageRules` gained `impactFactorMin/Max`. `sawSteps` and `level.weapon` are removed. Schemas and `check-data` updated (it now fails if `config.levels` and the folder disagree). Flags in use: `combo` and `zoom` (both true); the `introPan` and `followShot` camera switches work too.
  - **S2-03:** `core/events.ts` (typed bus, `beginBattle/clearBattle`; HUD, MASH banner and results are driven by `coins:gained`, `score:changed`, `combo`, `level:won/lost`), `core/rng.ts` (mulberry32, seeded by level id; used for monster phase, archer fire timer and scattergun rolls; `Math.random` is left for cosmetic particles only), `BattleCtx` (documented in ARCHITECTURE.md section 4 as built), `platform/{types,index,rundot,mock}.ts`. `main.ts` no longer touches the SDK; `data/load.ts` fetches data before Phaser starts. `grep -rn "rundot-game-sdk" src | grep -v platform/rundot.ts` prints nothing; nothing in `content/` or `battle/` imports `scenes/` or `ui/`.
- **Checks:**
  - `npm run check`: 0 errors, 9 warnings (realm levels 5 to 12 have no files yet). `npm run build` ok. `rundot predeploy`: 20/20 (run with `C:\Users\samar\AppData\Local\Programs\Rundot\rundot.exe`, which is not on PATH in side sessions).
  - Scripted sweep, before and after (headless Chrome, stepping `game.scene.update` with a fixed dt; 384 single-shot runs: levels 1 to 4 x 8 weapons x 3 angles x 2 powers x ability off/at step 20, plus two multi-shot sequences and a 600-step trace of sandbox level 99). 373 of 384 runs are identical in kills, steps, score, coins, blocks and final state; the 11 that differ are all scattergun runs (its burn/slow/knock roll now uses the seeded RNG instead of `Math.random`). Both multi-shot sequences are identical. The level 99 trace is identical except imp positions (their sine phase now comes from the seeded RNG); runner escape, troll, hexer and archer rows match.
  - Level 1: every weapon kills at least one monster. Scattergun reaches a 3-kill chain (a20, power 0.9, ability at step 20: 3 kills, chain 3, level won). Best single-shot kills on level 1 match the old build for every other weapon.
  - Console: 0 errors or warnings from load through a win and a loss (also removed the old favicon 404 with an inline icon). `?debug=1&tune.launchK=0.35` changes `launchK` 0.27 to 0.35 (max launch speed 8.1 to 10.5); without `debug=1` the override is ignored.
- **Not deployed.** To deploy: `npm run build` then `rundot deploy` from `game/` (private). **Please deploy once and open it**: the platform adapter picks the RUN adapter when `RundotGameAPI.isAvailable()` is true. That is verified under dev (mock) only; on the host, check that the mute setting still persists, the safe-area top offset is applied and `game_loaded` shows up in analytics.
- **For the next agent:**
  - New weapon or monster: follow RECIPES.md. Numbers go in `params` and are read as `p.def.params` (weapons) or `m.params` (monsters). The test levels list is `config.levels`; add a new `levels/level_NN.json` there too.
  - `BattleScene.snapshot()` (via `debug/testHook.ts`) and `skipToReady()` exist for scripted tests. S2-04 can turn the harness (fake pointer events on `scene.input`, `game.loop.stop()`, then `game.scene.update(t, 1000/60)` per step) into `window.__mm` and `scripts/sweep.mjs`.
  - Still literals in code, on purpose: body friction and restitution, particle and fx timings, popup thresholds (damage 22 and 12), hurt and flash frames, imp/runner 60 Hz time scale, the preview length. Move them if a card needs to tune them.
  - Block, monster and projectile layout: monster body size still comes from `MONSTER_ART` in `art/textures.ts`, not from `monster.size`.
  - `BattleCtx.damage/endProj` signatures differ a little from the first sketch (`endProj(p)` has no silent flag, no `spawnProjectile` yet: `spawnPellet`); ARCHITECTURE.md section 4 is updated.
- **Questions for owner:** none new.

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
