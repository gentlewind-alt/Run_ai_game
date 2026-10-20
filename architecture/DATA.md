# Data

All game numbers live in `game/public/data/`. Schemas in `game/schemas/` are the reference for every field. This file explains the conventions and what each file is for. `npm run check:data` validates everything, including cross-file references, and `npm run build` refuses to build if it fails.

## Files

| File | Schema | Holds | Status |
|---|---|---|---|
| `content.json` | `content.schema.json` | balance (`tuning`, `damageRules`, `economy`) and entities (`weapons`, `monsters`, `materials`, `artifacts`, `consumables`, `realms`, `cosmetics`) | exists |
| `config.json` | `config.schema.json` | engine and product settings: `levels` (ids of the files in `levels/`), display, world, physics, camera, `features` flags, debug | exists |
| `levels/level_NN.json` | `level.schema.json` | one level each: blocks, monsters, world width, loadout, targets. A new file must also be added to `config.levels` (`check-data` fails if they differ) | exists |
| save (in `appStorage`, key `save`) | `save.schema.json` | the player's progress | create in S3-02 |

Where does a new number go?
- It changes how the game **feels or balances** (damage, HP, launch power, coins, durations): `content.json`.
- It changes **how the engine or product behaves** (resolution, gravity, a feature on or off, zoom limits): `config.json`.
- It applies to **one level only**: that level's `overrides`.
- It belongs to **one item only** (a saw's duration, a shotgun's pellet count): that item's `params`.

## Conventions

- **IDs.** Lower snake case. Prefixes: weapons `w_`, artifacts (relics) `r_`, consumables `c_`, cosmetics `s_`. Monsters, materials and realms have no prefix. IDs from `catalogue/` keep their catalogue id. An id is never renamed once it ships, because saves reference it. Use `"enabled": false` to retire one.
- **Units.**
  - Distances are world px in the 216x384 portrait space; y grows downward; the ground top is `config.world.groundY` (320).
  - Gameplay durations are **steps at 60 Hz** unless the key ends in `Seconds` or `Ms`.
  - Speeds are px per step. Angles in level files are degrees.
- **Elements:** `physical`, `hellfire`, `radiant`, `void`. Multipliers are `damageRules.elementWeak` (1.5) and `elementResist` (0.6). A monster's or material's `weak` or `resist` may be `null`.
- **Rarity:** `common`, `uncommon`, `rare`, `epic`, `legendary`, `mythic` (white, green, blue, purple, orange, red).
- **Comments:** any key starting with `_` is a comment and ignored by the game and the checker (`"_note": "..."`).
- **Text fields** (`launch`, `tap`, `effect`, `note`) are player-facing or designer-facing descriptions. They never drive behaviour; `params` and code do.
- **New fields:** add them to the schema in the same commit, or the checker reports `unknown field`. That error is how typos get caught.

## content.json sections

| Section | Read by | Notes |
|---|---|---|
| `tuning` | sling, damage, coins, status, flow | `launchK`, `maxPull`, `aimGrabRadius`, `minPull`, `debrisK`, `debrisMinSpeed`, `projMinSpeed`, `hitCooldownSteps`, `minImpactDamage`, `impactBase`, `fallThreshold`, `fallK`, `explosionFalloff`, `explosionPush`, `explosionHitStop`, `hitStopFrames`, `mashHitStop`, `mashAt`, `stretchSoundMs`, `homeZoomMin`, `homeLeft`, `coins{}`, `points{}`, `shotBonus*`. `status{burnDamage, burnTickSteps, curseMult, slowSpeedMult}` and `flow{...}` (when a shot counts as over, settle timings, win delay) are objects |
| `damageRules` | `battle/damage.ts`, forge | formula in ARCHITECTURE.md section 7. `upgradeBaseCost` (50) goes in here when the forge is built |
| `economy` | score, results, daily | `leftoverShotCoins`, `starScoreFactor`, `dailyStreakRewardDay`, `dailyStreakRewardCoins`. Created when first needed |
| `weapons[]` | weapon registry, shop, loadout | `physics{radius,density,spin,gravity,align}`, `ability{mode,label}` and `params{}` (every number the behaviour file reads). `params.behavior` reuses another weapon's code |
| `stretchWeapons[]`, `stretchArtifacts[]` | nobody | parked ideas; move a row into the main list to build it |
| `monsters[]` | monster registry, world | `behavior` defaults to the monster id, then `basic`. `density` defaults to 0.001. `params` holds the behaviour's numbers (`regenPerSec`, `blastRadius`, `shield`...); `selfMoving: 1` marks monsters that never "settle" (imp, runner). `size{w,h}` currently comes from `art/textures.ts` `MONSTER_ART` |
| `materials[]` | world, damage | `density` and `friction` default to the values in `battle/world.ts` |
| `artifacts[]`, `consumables[]` | registries, shop | numbers in `params` |
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
- Runner levels need `exit` and runners with an optional `path` and `delay`. `escapeLimit` defaults to 0.
- The Daily Mash generator builds a level object in memory with `id: 0` and `kind: "daily"`. It must pass the same schema; the generator's unit test validates it.
- Add `"$schema"` at the top of each file to get editor autocomplete. The checker ignores it.

## config.json (current values)

```json
{
  "$schema": "../../schemas/config.schema.json",
  "version": 1,
  "_note": "Engine and product settings. Balance numbers live in content.json. The viewport is the constant W x H (216 x 384) in src/config/constants.ts.",
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

## Deprecations (keep the game reading both until the card that removes them)

None open. S2-02 removed `level.weapon`, `tuning.sawSteps`, the legacy `public/data/level_NN.json` location and the weapon stats in code.


