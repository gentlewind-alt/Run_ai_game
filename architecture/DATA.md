# Data

All game numbers live in `game/public/data/`. Schemas in `game/schemas/` are the reference for every field. This file explains the conventions and what each file is for. `npm run check:data` validates everything, including cross-file references, and `npm run build` refuses to build if it fails.

## Files

| File | Schema | Holds | Status |
|---|---|---|---|
| `content.json` | `content.schema.json` | balance (`tuning`, `damageRules`, `economy`) and entities (`weapons`, `monsters`, `materials`, `artifacts`, `consumables`, `realms`, `cosmetics`) | exists |
| `config.json` | `config.schema.json` | engine and product settings: `levels` (ids of the files in `levels/`), display, world, physics, camera, `features` flags, debug | exists |
| `levels/level_NN.json` | `level.schema.json` | one level each: blocks, monsters, world width, loadout, targets. A new file must also be added to `config.levels` (`check-data` fails if they differ) | exists |
| save (in `appStorage`, key `save`) | `save.schema.json` | the player's progress: `coins`, `stars`, `owned{weapons,artifacts,consumables}`, `equipped{loadout,artifacts}`, `stats{games,wins,losses,streak,lastDaily,bossLosses}` (`bossLosses`: map of boss level id to consecutive losses driving relic pity unlocking), and `settings` | exists |

Where does a new number go?
- It changes how the game **feels or balances** (damage, HP, launch power, coins, durations): `content.json`.
- It changes **how the engine or product behaves** (resolution, gravity, a feature on or off, zoom limits): `config.json`.
- It applies to **one level only**: that level's `overrides`.
- It belongs to **one item only** (a saw's duration, a shotgun's pellet count): that item's `params`.

## Conventions

- **IDs.** Lower snake case. Prefixes: weapons `w_`, artifacts (relics) `r_`, consumables `c_`, cosmetics `s_`. Monsters, materials and realms have no prefix. IDs from `catalogue/` keep their catalogue id. An id is never renamed once it ships, because saves reference it. Use `"enabled": false` to retire one.
- **Units.**
  - Distances are world px in the 480x270 landscape space; y grows downward; the ground top is `config.world.groundY` (320).
  - Gameplay durations are **steps at 60 Hz** unless the key ends in `Seconds` or `Ms`.
  - Speeds are px per step. Angles in level files are degrees.
- **Elements:** `physical`, `hellfire`, `radiant`, `void`. Multipliers are `damageRules.elementWeak` (1.5) and `elementResist` (0.6). A monster's or material's `weak` or `resist` may be `null`.
- **Rarity:** `common`, `uncommon`, `rare`, `legendary` (white, green, blue, orange). Dictates visual card/frame styling and pity prices. Weapons enforce a loadout restriction: at most 1 legendary weapon equipped in a loadout.
- **Comments:** any key starting with `_` is a comment and ignored by the game and the checker (`"_note": "..."`).
- **Text fields** (`launch`, `tap`, `effect`, `note`) are player-facing or designer-facing descriptions. They never drive behaviour; `params` and code do.
- **New fields:** add them to the schema in the same commit, or the checker reports `unknown field`. That error is how typos get caught.

## content.json sections

| Section | Read by | Notes |
|---|---|---|
| `tuning` | sling, damage, coins, status, flow, camera | `launchK`, `maxPull`, `aimGrabRadius`, `minPull`, `chestHp`, `debrisK`, `blockDebrisFactor`, `debrisMinSpeed`, `projMinSpeed`, `hitCooldownSteps`, `minImpactDamage`, `impactBase`, `fallThreshold`, `fallK`, `explosionFalloff`, `explosionPush`, `explosionHitStop`, `hitStopFrames`, `mashHitStop`, `mashAt`, `stretchSoundMs`, `homeZoomMin`, `homeLeft`, `homeSlingFrac` (0.16, sling position fraction in viewport), `homeMarginRight` (rightmost fort padding), `coins{}` (including `chestFallback: 150`), `points{}`, `shotBonus*`. `status{burnDamage, burnTickSteps, curseMult, slowSpeedMult}` and `flow{...}` are objects |
| `damageRules` | `battle/damage.ts`, forge | formula in ARCHITECTURE.md section 7. `upgradeBaseCost` (50) goes in here when the forge is built |
| `economy` | score, results, shop, loadout | `startCoins`, `replayCoinFactor`, `lossCoinFactor`, `maxConsumableStack`, `loadoutSize` (**6** since task x2; Gold Quiver adds +1), `artifactSlots`, `secondArtifactAfterLevel`, `relicPityLosses` (default 3), `relicMarketPrice{common, rare, legendary}`, `dailyStreakRewardDay`, `dailyStreakRewardCoins` |
| `weapons[]` | weapon registry, shop, loadout | `physics{radius,density,spin,gravity,align}`, `ability{mode,label,charges}` (`charges`: allowed activations per shot), `rarity`, `baseDamage` (commons 11-35, **rares 28-42**, **legendaries 44-60** — see section 2 of `09_expansion_design.md`), `unlock` (`'default'` or `{ boss?: string, chest?: string, shop?: boolean, level?: number }`), and `params{}` (every number the behaviour file reads). `params.behavior` reuses another weapon's code |
| `stretchWeapons[]`, `stretchArtifacts[]` | nobody | parked ideas; move a row into the main list to build it |
| `monsters[]` | monster registry, world | `behavior` defaults to the monster id, then `basic`. `density` defaults to 0.001. `boss` (boolean) marks boss monsters (e.g. Iron Warlord; reduces chain duration). `params` holds the behaviour's numbers (`regenPerSec`, `blastRadius`, `shield`...); `selfMoving: 1` marks monsters that never "settle" (imp, runner). `size{w,h}` currently comes from `art/textures.ts` `MONSTER_ART` |
| `materials[]` | world, damage | `density` and `friction` default to the values in `battle/world.ts` |
| `artifacts[]`, `consumables[]` | registries, shop | Numbers in `params`. Artifacts: `r_gale_eye` (`radius`, `strength`), `r_echo_stone` (`delaySteps`, `mult`), `r_lodestone_bracer` (`radius`, `bonus`), `r_analyst_lens` (`previewMult`), `r_stormcaller_torc` (`everyHits`, `mult`), `r_gamblers_charm` (`coinMult`, `critChance`, `critMult`, `critCoins`). Consumables: `targeted` (boolean), `params`: `c_jury_rigged_bomb` (`radius`, `damage`, `fizzleChance`), `c_prime_serum` (`shots`, `mult`), `c_mindflash` (`steps`), `c_chainward_talisman` (`steps`, `bossSteps`, `pickRadius`) |
| `mods` (runtime) | `BattleCtx.mods` | In-battle modifiers set by artifacts/consumables: `damageMult` (Prime Serum launch buff), `serumShots`, `serumMult`, `coinMult` (Gambler's Charm), `previewMult` (Analyst Lens) |
| `realms[]` | map, world, art, audio | `levels` are level ids in play order |
| `cosmetics[]` | shop, daily reward | `priceBits` needs `features.iap` and a matching `rundot/shop.config.json` entry |

## Level files

Minimal level:

```json
{
  "$schema": "../../../schemas/level.schema.json",
  "id": 2,
  "name": "Bomber Alley",
  "realm": "goblin_hills",
  "kind": "siege",
  "worldW": 432,
  "loadout": ["w_militia_blade", "w_militia_blade", "w_iron_cleaver"],
  "scoreTarget": 4000,
  "blocks": [ { "m": "wood", "x": 250, "y": 306, "w": 8, "h": 28 } ],
  "monsters": [ { "t": "goblin_grunt", "x": 250, "y": 313 } ]
}
```

- `x`, `y` are the **centre** of the block or monster. A block resting on the ground has `y = groundY - h/2`. A monster standing on the ground has `y = groundY - 7`.
- `loadout` fixes the weapons for this level (tutorials, the boss). Omit it and set `shots` to let players bring their own loadout (from S3).
- `shots`: number of shots allowed. **Levels 1-3 keep 4** (tutorial pace); **levels 4-7 use 5**, **levels 8-12 use 6**. The player never gets more shots than `min(economy.loadoutSize + Gold Quiver bonus, level.shots)`. Do not hand-edit; regenerate with `scripts/build_levels.py`.
- `terrain`: optional polyline `[[x, y], ...]` defining the ground height profile from left to right (y grows downward; flat outside the first and last point; default flat ground at `config.world.groundY`).
- Monsters in level files specify `t` (monster id), `x`, `y`. Runner monsters (e.g. `skeleton_runner`) also support `dir` (`1` right, `-1` left, default 1), `speed` (px per fixed step, default 0.8), `delay` (seconds before starting), and optional waypoint `path`.
- Runner levels need `exit` (door coordinates `{x, y}`) and runners. `escapeLimit` defaults to 0.
- `chests`: optional array `[ { "id": "chest_3", "x": 210, "y": 312, "hp": 40, "reward": "w_steersong_arrow" } ]` placing breakable chests. Destroying a chest awards the relic weapon in `reward` (or `tuning.coins.chestFallback` coins if already owned).
- The Daily Mash generator builds a level object in memory with `id: 0` and `kind: "daily"`. It must pass the same schema; the generator's unit test validates it.
- Add `"$schema"` at the top of each file to get editor autocomplete. The checker ignores it.

## config.json (current values)

```json
{
  "$schema": "../../schemas/config.schema.json",
  "version": 1,
  "_note": "Engine and product settings. Balance numbers live in content.json. The viewport is the constant W x H (480 x 270) in src/config/constants.ts.",
  "levels": [1, 2, 3, 4, 99],
  "display": { "pixelArt": true, "maxParticles": 90 },
  "world": { "groundY": 320, "slingX": 56, "slingY": 262 },
  "physics": { "stepHz": 60, "gravityY": 1, "positionIterations": 8, "velocityIterations": 6, "enableSleeping": true, "maxStepsPerFrame": 3 },
  "camera": {
    "introPan": true, "followShot": true, "maxZoom": 1.8,
    "introMs": 900, "introHoldMs": 450, "toggleMs": 260,
    "followLead": 0.15, "followEase": 0.1, "groundFrac": 0.83, "zoomOutRise": 0.4
  },
  "features": {
    "map": false, "shop": false, "forge": false, "artifacts": false, "consumables": false,
    "combo": true, "daily": false, "leaderboard": false, "share": false,
    "ads": false, "iap": false, "tutorial": false, "music": false, "zoom": true
  },
  "debug": { "urlOverrides": true, "testHook": true }
}
```

Each stage card turns on the flags for what it ships. On deadline day, a broken feature is turned off rather than fixed.

## Player level builder (BUILDER-01)

- `config.features.builder` enables the Title screen's **Create level** button. `content.builder` owns the piece catalogue, materials, build bounds, grid, limits, test loadout and connection physics.
- Blocks may have stable `id`, `shape` (`rectangle`, `circle`, `triangle`), `angle` (degrees) and `static` fields. Anchored blocks remain breakable. Existing rectangles keep their original physics and texture keys.
- `level.connections` references block IDs. Each connection has `id`, `type` (`lock` or `rope`), `a`, `b`, `pointA`, `pointB`, and optional rope `length`. Points are body-local; `a: null` means pointA is a fixed world anchor. Locks use two separated pins to preserve angle. Ropes exert tension and allow slack. Destroying either block removes its connections.
- The draft format is `{ schema: "monster-mash-builder", version: 1, name, blocks, monsters, connections }`. Validate it with `builder/document.ts`. Drafts use the separate platform storage key `monster-mash.builder.v1`; JSON export/import is portable. The campaign save shape and version are unchanged.
- Custom play uses an ephemeral level (1000), never writes campaign level data, and skips rewards, progress, consumables, artifact installs, tutorials and rewarded ads. **Test** runs the same block/connection physics; **Stop** restores authored positions.
- Run `npm run check:builder` for malformed-import, geometry, reference, round-trip and conversion checks. It is also part of check/build.

## Deprecations (keep the game reading both until the card that removes them)

None open. S2-02 removed `level.weapon`, `tuning.sawSteps`, the legacy `public/data/level_NN.json` location and the weapon stats in code.



## Weapon size and runner start (added 2026-10-22)

- `config.json → display.weapon` sets the drawn weapon size in world px: `flightPx` (16), `slingPx` (24), `queuePx` (24) and `relicBonus` (1.25, applied to 32 px relic art). Code never holds these numbers; `src/art/weaponScale.ts` turns them into a scale. A weapon row may set `display: { px }` to override its flight size (long items).
- `level.runnersStartOnShot: true` keeps runners standing until the first shot is fired. Level 4 uses it, and its first hint says so. Edit levels 1-8 through `game/scripts/build_levels.py`, then regenerate (`python3 scripts/build_levels.py`), because the generator overwrites the JSON.
- Params like `w_steersong_arrow.params.splitScale` hold per-weapon sizes too (the split arrows are drawn at 0.5 of their 32 px art).
