# Repo map for other AIs

Merkle root `63ffb17e32bd9f7100018ffc43a091eb8715f8b3f8a6bb136b53ceca55269001` (see `MERKLE.json` for every hash; `node tools/merkle.mjs changed` lists what differs from the seal, `seal` re-seals, `verify` checks).

How to use: read `AGENTS.md`, then `docs/handoff/STATUS.md`. Pick the folder below that matches your task; each line is `file - what it is`. Golden rules: data owns numbers (content.json), content via registries, systems never import scenes, only `src/platform` touches the RUN SDK.

## Top-level tree (dir: files, hash prefix)

- `architecture/` (5 files, `e867d151`)
- `catalogue/` (3 files, `8baca4d1`)
- `docs/` (265 files, `d22adc29`)
- `docs/handoff/` (247 files, `b5980d8a`)
- `docs/handoff/ref/` (3 files, `fe95b7a4`)
- `docs/monster_mash/` (11 files, `2e316f23`)
- `docs/release/` (7 files, `a54b4b49`)
- `game/` (220 files, `8aedec29`)
- `game/public/` (75 files, `1de35f39`)
- `game/public/cdn-assets/` (3 files, `64b4c5bd`)
- `game/public/data/` (27 files, `b3b61f76`)
- `game/public/sprites/` (42 files, `dce70d2c`)
- `game/rundot/` (4 files, `8f41ac4c`)
- `game/schemas/` (4 files, `697b3e72`)
- `game/scripts/` (4 files, `5160a276`)
- `game/src/` (118 files, `cbff1dc0`)
- `game/src/art/` (12 files, `1922a7b7`)
- `game/src/audio/` (3 files, `354b8b8a`)
- `game/src/battle/` (20 files, `b8294e7b`)
- `game/src/config/` (2 files, `074ed9f9`)
- `game/src/content/` (49 files, `8ba428e8`)
- `game/src/core/` (8 files, `34dc054e`)
- `game/src/data/` (3 files, `faed13ef`)
- `game/src/debug/` (1 files, `5a453488`)
- `game/src/platform/` (5 files, `7da2b5fb`)
- `game/src/scenes/` (9 files, `236028fc`)
- `game/src/ui/` (4 files, `a2404bcc`)
- `tools/` (29 files, `90f5d1f5`)

## Files with context

### game/src/
- `game/src/art/backgrounds.ts` - Realm backdrops: sky, three parallax ridges and (optionally) a flat ground. Layers scroll slower than the camera.
- `game/src/art/font5x7.ts` - "Mash Sans": 5x7 caps and digits, lowercase with descenders (9 rows total). Rows separated by '/'.
- `game/src/art/generatedSprites.ts` - Sprites made with the RUN CLI (`rundot generate sprite`) and processed by tools/process_sprites.ps1.
- `game/src/art/icons.ts` - Small icons for artifacts, consumables, coins and locks. Built with the same palette-bound kit as the sprites.
- `game/src/art/monsterTextures.ts` - Per-pixel patches on top of a grid: [x, y, char].
- `game/src/art/omnitrixTextures.ts` - One alien forearm, fist pointing down. 0 = outline, D = dark, M = mid, L = light (replaced per arm kind).
- `game/src/art/palette.ts` - "Mash32": Sweetie 16 (0-f) plus 16 extra earth/stone tones (g-v). Grids index it with base-32 chars.
- `game/src/art/pix.ts` - 3x5 pixel font, rows separated by '/'.
- `game/src/art/relicTextures.ts` - ------------------------------------------------------------------ Slingshots (16x48)
- `game/src/art/sprites.ts` - Palette-indexed pixel grids ('.' = transparent, chars index Mash32 in base 32).
- `game/src/art/terrain.ts` - `surface(x)` gives the ground height at world x. The texture covers x0..x1 and the rows from `top` down to the screen bottom.
- `game/src/art/textures.ts` - Filled rect with 3-tone shading: highlight top and left, shade bottom and right.
- `game/src/audio/beat.ts` - 0..1 position inside the current beat.
- `game/src/audio/music.ts` - 120 BPM -> 0.5s per beat, 0.25s per 8th note, 0.125s per 16th note
- `game/src/audio/sfx.ts` - Must be called from a user gesture (first pointerdown).
- `game/src/battle/BattleCtx.ts` - A block or a monster.
- `game/src/battle/artifacts.ts` - Product of every installed artifact's damage modifier for this hit.
- `game/src/battle/camera.ts` - Adds the fixed UI camera. Objects created while `b.uiMode` is true are drawn by it only; everything else by the world camera.
- `game/src/battle/combo.ts` - Once per gameplay step: the chain resets when the window runs out.
- `game/src/battle/consumables.ts` - The items the player owns, in data order. Built when the battle is created.
- `game/src/battle/ctxImpl.ts` - Implements BattleCtx over a BattleState: the only door content code uses to touch the battle.
- `game/src/battle/damage.ts` - damage = baseDamage x forge upgrade x impact x element x combo x global scale x the shot's own multiplier.
- `game/src/battle/fx.ts` - Full-height lightning bolt 3 px wide with white core and cyan halo, held at peak for 24+ steps.
- `game/src/battle/loop.ts` - Called every frame by the scene. Runs 0..maxStepsPerFrame whole steps, then updates the visuals.
- `game/src/battle/matter.ts` - The Matter.js namespace that Phaser bundles.
- `game/src/battle/projectiles.ts` - Matter ignores per-body gravity scale here, so add the difference as a force before each step.
- `game/src/battle/rules.ts` - A runner reached the exit door.
- `game/src/battle/score.ts` - Bonus for leftover shots, then 1 star for a win, 2 with a shot left, 3 at the level's score target.
- `game/src/battle/setup.ts` - The state for one battle. Scene objects (graphics, sprites, cameras) are filled in by `buildBattle`.
- `game/src/battle/sling.ts` - The slingshot: weapon queue, aim input, pull, launch, ability trigger and the dotted preview.
- `game/src/battle/snapshot.ts`
- `game/src/battle/state.ts` - What the battle needs from the HUD (implemented in ui/hud.ts). Keeps battle/ free of ui/ imports.
- `game/src/battle/status.ts` - Ticks one monster's timers (burn can kill it).
- `game/src/battle/terrain.ts` - Sorted by x and extended flat to both ends of the world. Flat at groundY when the level has no terrain.
- `game/src/battle/world.ts` - Sling, blocks, monsters and the exit door. Call after the view is set up.
- `game/src/config/constants.ts` - True constants. Balance lives in public/data/content.json; engine settings in public/data/config.json.
- `game/src/config/settings.ts` - One merged settings object per battle. Order: code defaults, config.json, content.json, level overrides, URL overrides (?debug=1).
- `game/src/content/artifacts/index.ts` - Gale Eye: the ability also releases a wind burst that knocks monsters and light blocks back.
- `game/src/content/artifacts/types.ts` - A weapon hit in the damage pipeline, offered to artifacts that modify damage.
- `game/src/content/consumables/index.ts` - true = the player taps a spot (or a monster) after pressing the icon.
- `game/src/content/levelKinds/boss.ts` - S4-02: "The win unlocks the Gatebreaker Ram (if built) or gives a big coin reward."
- `game/src/content/levelKinds/daily.ts`
- `game/src/content/levelKinds/dailyLogic.d.ts`
- `game/src/content/levelKinds/dailyLogic.js` - Pure JS daily level generator (zero dependencies) shared by game code and check-daily.mjs
- `game/src/content/levelKinds/index.ts`
- `game/src/content/levelKinds/types.ts` - Called once after battle entities and level are created.
- `game/src/content/monsters/archer.ts` - Visual only: an arrow flies at the launcher pad and fizzles.
- `game/src/content/monsters/basic.ts` - No special behaviour: stands, gets hit, dies. The fallback for any monster without its own behaviour.
- `game/src/content/monsters/bomber.ts` - Explodes on death, hurting neighbours and blocks.
- `game/src/content/monsters/darkElfMatron.ts` - Dark Elf Matron: Mini-boss with a periodic shield aura that blocks damage for 2 s every 6 s.
- `game/src/content/monsters/frostGiant.ts` - * Frost Giant (boss), also the Forge Tyrant and the Storm Sovereign through a theme flag: armoured, stomps and drops a volley on a timer, and every so
- `game/src/content/monsters/goblinChief.ts` - Goblin Chief: Mini-boss with armor 8 who stomps every 4 seconds causing a ground shake.
- `game/src/content/monsters/hexer.ts` - Shields its neighbours (they absorb `shield` damage); hurting the hexer drops every shield it raised.
- `game/src/content/monsters/iceGolem.ts` - Ice Golem: when it is destroyed it shatters, and the ice shards hurt everything close by.
- `game/src/content/monsters/imp.ts` - Flies a sine path around where it spawned.
- `game/src/content/monsters/index.ts` - Behaviours keyed by the monster row's `behavior` (default: the monster id, then 'basic').
- `game/src/content/monsters/ironWarlord.ts`
- `game/src/content/monsters/runner.ts` - * Runs along the ground toward the exit door; reaching it counts as an escape. It waits out the intro pan and the weapon hop, so the player always get
- `game/src/content/monsters/troll.ts` - Regenerates HP unless burning.
- `game/src/content/monsters/types.ts` - Behaviour for one monster `behavior` key (defaults to the monster id, then 'basic'). Numbers come from the data row's `params`.
- `game/src/content/validate.ts` - Dev-only sanity check: every data row has an implementation (otherwise it falls back to the default behaviour).
- `game/src/content/weapons/blackHoleMarble.ts` - * Black Hole Marble (legendary): the tap leaves a singularity hanging in the air. For `holeSteps` it pulls everything within its radius toward it with
- `game/src/content/weapons/blade.ts` - Whirlwind roll: the blade keeps its gravity, drops to the ground and rolls along it as a buzzsaw, carving through
- `game/src/content/weapons/blastTube.ts` - Nuke lob: detonate in the air (or on the first hit) for a huge blast that falls off with distance, with a white flash,
- `game/src/content/weapons/boomerang.ts` - Rebound: flies out, then curves back on its own; the return pass deals extra damage and slices everything along its path.
- `game/src/content/weapons/brahmastraArrow.ts` - Distance from a point to the segment (x0,y0)-(x1,y1).
- `game/src/content/weapons/bulwarkDisc.ts` - Tap: redirects once toward the nearest monster
- `game/src/content/weapons/chainRod.ts` - * Chain Rod (rare): the tap releases lightning that jumps from the rod to the nearest monster, then on to the nearest one from there, up to `jumps` mo
- `game/src/content/weapons/cleaver.ts` - Crater slam: dive straight down; where it lands it digs a visible crater and sends out a crumbling shock ring.
- `game/src/content/weapons/cometFists.ts` - Dive-slam straight down
- `game/src/content/weapons/earthwormDrill.ts` - The eruption: a blast under the fort with an upward shove and a spray of dirt.
- `game/src/content/weapons/hailstormCauldron.ts` - * Hailstorm Cauldron (rare): the tap tips the cauldron over the nearest monster and the sky opens: a rain of stew drops falls across a band, one every
- `game/src/content/weapons/index.ts` - Behaviour per weapon id in content.json. Stats and numbers come from the data row.
- `game/src/content/weapons/kineticPalms.ts` - Cyan muzzle flash at palm
- `game/src/content/weapons/omnitrixDial.ts` - Where an arm stops: the ground, or the top of the first block or monster under it.
- `game/src/content/weapons/pike.ts` - Driller: speeds up and pierces up to `pierce` wood blocks or monsters; the first solid it meets after that is blasted.
- `game/src/content/weapons/pinataMirv.ts` - * Pinata MIRV (rare): the tap bursts the pinata into five candy bombs that fan out, arc down and each explode on the first thing they touch (ground, b
- `game/src/content/weapons/rollingMillstone.ts` - * Rolling Millstone (rare): the Blade's rolling behaviour on a heavy stone wheel. The tap sends it rolling along the ground for 1.5 s, crushing blocks
- `game/src/content/weapons/scattergun.ts` - Cluster: bursts into pellets in a cone; each pellet rolls burn, slow or knockback and pops in a small blast where it lands.
- `game/src/content/weapons/scepter.ts` - Hellbrand: curse burst, and the brand falls to the ground as a fire pool that burns whatever stands in it.
- `game/src/content/weapons/silklineShooters.ts` - Find nearest monster, or nearest block if no monsters
- `game/src/content/weapons/skyforgeMaul.ts` - First tap: lightning bolt + crackling electric field
- `game/src/content/weapons/staff.ts` - generation 0 is a volley bolt (splits on hit); generation 1 is an ember from a split (does not split again).
- `game/src/content/weapons/steersongArrow.ts` - Tap 1: arms the explosion (the default)
- `game/src/content/weapons/types.ts` - * Behaviour for one weapon id. Stats and numbers come from the data row (`physics`, `ability`, `params`), read through `p.def`. Ability modes: 'button
- `game/src/content/weapons/util.ts` - Where something falling at x stops: the ground, or the top of the first block or monster under it.
- `game/src/core/economy.ts`
- `game/src/core/events.ts` - Event payloads. Add an event to the table in architecture/ARCHITECTURE.md first.
- `game/src/core/flow.ts` - A black cover with a star-shaped hole of radius `from`, animated to `to`.
- `game/src/core/leaderboards.ts` - Sum of the best score of every campaign level (the Daily Mash, level 0, has its own board).
- `game/src/core/profile.ts` - `?level=N` (with ?debug=1) jumps straight into that level.
- `game/src/core/responsive.ts` - Generates a subtle 8x8 Bayer pixel-dither pattern in Mash32 ink tones as a PNG data URI.
- `game/src/core/rng.ts` - Seeded RNG (mulberry32). Gameplay randomness uses this; Math.random is for cosmetic particles only.
- `game/src/core/save.ts` - Upgrades a blob one version at a time: migrations[n] turns version n into n + 1. Add one with every schema bump.
- `game/src/data/load.ts` - Loads config.json, content.json and every level file before the game starts.
- `game/src/data/lookup.ts` - Level 1 is the fallback for an unknown id. Level 0 is generated daily.
- `game/src/data/types.ts` - TypeScript mirrors of game/schemas/*.json (only the fields the code reads).
- `game/src/debug/testHook.ts` - window.__mm: a scripted-test API (dev and ?debug=1 only). It advances the fixed step synchronously, without rendering,
- `game/src/main.ts`
- `game/src/platform/boards.ts` - Board names the game uses, and how a board name maps onto the RUN leaderboard options.
- `game/src/platform/index.ts` - Testing switch: open the game with ?mock=1 to use the in-memory mock (fake leaderboard rows, no ads) even where the SDK exists.
- `game/src/platform/mock.ts` - Local dev without the RUN host: in-memory storage, console logging, no ads or purchases.
- `game/src/platform/rundot.ts` - The only file that imports the RUN SDK.
- `game/src/platform/types.ts` - The only way game code talks to the host. Every method catches its own errors and returns a safe default.
- `game/src/scenes/BattleScene.ts` - Thin orchestrator: builds the battle, hooks the HUD to its events and runs the fixed-step loop. Rules live in battle/.
- `game/src/scenes/BootScene.ts` - Creates every shared texture (data and save are already loaded by main.ts), then opens the title.
- `game/src/scenes/CreditsScene.ts`
- `game/src/scenes/LeaderboardScene.ts` - Daily, per-level and overall score boards, with your own row highlighted.
- `game/src/scenes/LoadoutScene.ts` - Before each level: pick weapons in firing order, artifacts, items, and fling into battle.
- `game/src/scenes/MapScene.ts` - Realm lighting: sky bands top to bottom, then the ground strip.
- `game/src/scenes/ResultsScene.ts` - Results overlay: stars, score, coins, and Next / Retry / Map.
- `game/src/scenes/ShopScene.ts`
- `game/src/scenes/TitleScene.ts` - The front door: the title bounces letter by letter on the beat while a conga line of monsters dances past.
- `game/src/style.css`
- `game/src/ui/cards.ts` - Standard item card used across Loadout and Shop grids.
- `game/src/ui/coins.ts` - Coin icon and total at (x, y), kept up to date while the scene is alive. Left-aligned.
- `game/src/ui/hud.ts` - What the HUD needs from the scene hosting the battle.
- `game/src/ui/widgets.ts` - * Chunky sticker button: Ink outline, top highlight, 2px shade. Sinks 1px when pressed. Hit area is at least 26 internal px each way (about 44 css px 

### game/scripts/
- `game/scripts/balance_bands.json` - Allowed solver shot-count band per level (read by tools/regress.mjs)
- `game/scripts/build_levels.py` - Generates public/data/levels/level_01..24.json (terrain, blocks, monsters, chests, loadouts)
- `game/scripts/check-daily.mjs`
- `game/scripts/check-data.mjs` - Data validator (schemas and cross-refs); part of npm run check

### game/public/data/
- `game/public/data/config.json` - Runtime config: level id list, features flags, display, world, physics, camera
- `game/public/data/content.json` - All content rows: weapons, monsters, artifacts, consumables, realms, tuning (numbers only; schema in game/schemas)

### game/schemas/
- `game/schemas/config.schema.json`
- `game/schemas/content.schema.json`
- `game/schemas/level.schema.json`
- `game/schemas/save.schema.json`

### game/rundot/
- `game/rundot/cli_hooks.json`
- `game/rundot/leaderboard.config.json`
- `game/rundot/shop.config.json`
- `game/rundot/textGen.config.json`

### tools/
- `tools/agy_chain.sh`
- `tools/agy_share.mjs` - Exclude MERKLE.*
- `tools/audit_shots.mjs` - 1. Ensure Vite dev server is running on port 5173
- `tools/balance_table.mjs` - tools/balance_table.mjs
- `tools/bisect_revert.py` - Bisect helper: restores one weapon (code file and data row) to the committed version. usage from game/: python ../tools/bisect_revert.py <weapon_id> <
- `tools/gen_arm_sprites.sh`
- `tools/gen_realm56_sprites.sh`
- `tools/gen_realm_sprites.sh`
- `tools/gen_relic_sprites.sh`
- `tools/make_compare.mjs`
- `tools/make_icon.html`
- `tools/measure_apex.mjs`
- `tools/merkle.mjs` - Merkle-tree repo index for MONSTER MASH: Slingshot Siege.
- `tools/probe.mjs` - Evaluates a JS expression inside the running game (headless Chrome) and prints the result.
- `tools/process_sprites.ps1`
- `tools/regress.mjs` - 1. Ensure Vite dev server is running on port 5173
- `tools/relic_shots.mjs`
- `tools/repro_mount.mjs` - Repro helper: starts a level through the natural intro/loading path in headless Chrome and reports the sling-mounted sprite.
- `tools/responsive_shots.mjs`
- `tools/scene_shot.mjs` - Opens a scene from the title screen in headless Chrome the way a player would and saves a screenshot.
- `tools/sprite_sheet.ps1`
- `tools/test_balance_solver.mjs`
- `tools/test_l12_solver.mjs`
- `tools/test_quick_levels.mjs`
- `tools/test_scenes.sh`
- `tools/test_weapons.sh`
- `tools/tune_boss.mjs`
- `tools/verify_s5_all.mjs` - Launch Chrome headless with debugging port
- `tools/weapon_shots.mjs`

### architecture/
- `architecture/ARCHITECTURE.md` - Architecture
- `architecture/DATA.md` - Data
- `architecture/RECIPES.md` - Recipes: how to make common changes
- `architecture/STAGES.md` - Stages and task cards
- `architecture/WORKFLOW.md` - Workflow: how agents work together

### docs/monster_mash/
- `docs/monster_mash/00_local_kickoff.md` - Local kickoff: paste this into your local AI coding tool
- `docs/monster_mash/01_plan.md` - Monster Mash: plan (for the owner)
- `docs/monster_mash/02_master_brief.md` - MASTER BRIEF: paste this once, at the start of the Game Studio chat
- `docs/monster_mash/03_stage_prompts.md` - Stage prompts: send these one at a time, after the master brief
- `docs/monster_mash/04_platform_report.md` - Step 0: RUN platform report
- `docs/monster_mash/05_review_request.md` - Paste this into the cloud session
- `docs/monster_mash/06_cloud_review.md` - Cloud review of the Stage 1 build (for the local session)
- `docs/monster_mash/07_local_reply.md` - Local reply to 06_cloud_review.md
- `docs/monster_mash/08_design_direction.md` - Design direction: Monster Mash
- `docs/monster_mash/09_expansion_design.md` - 09 Expansion design (owner goal, 2026-10-22)
- `docs/monster_mash/10_sfx_plan.md` - Weapon-ability sound plan (for later)

### docs/handoff/
- `docs/handoff/AGY_BRIEF.md` - agy standing brief (read first, every run)
- `docs/handoff/LOG.md` - Handoff log
- `docs/handoff/STATUS.md` - Status board
- `docs/handoff/agy_chain.log`
- `docs/handoff/agy_done.txt`
- `docs/handoff/relic_art_reference.js` - Approved v2 design reference for the relic weapons (batch A). Draft procedural generators written by Claude,

### repo root
- `.gitignore`
- `AGENTS.md` - Start here: golden rules, commands, repo map
- `CLAUDE.md` - Includes AGENTS.md
- `README.md` - MONSTER MASH: Slingshot Siege
- `gen_log.txt`
- `package.json`
- `vite4.log`
- `vite5.log`
- `vite6.log`

### Data and art (not listed per file)
- `game/public/data/levels/level_NN.json` - one per level 1-24 (+99 sandbox), generated by build_levels.py; do not hand-edit.
- `game/public/sprites/{relics,monsters,arms}/` - generated pixel art (process with tools/process_sprites.ps1); referenced by `sprite`/`extraSprites` fields in content.json.
- `docs/handoff/agy_task_*.md` - task briefs for the agy delegate worker; `docs/handoff/shots/` - screenshots.
