# Architecture

This is the target shape of `game/src/`. The code today (Stage 1.5) is mostly one big `GameScene.ts` (about 800 lines) plus `weapons.ts`. Card **S2-01** splits it into this layout without changing behaviour. Every later card builds on that layout, so do S2-01 to S2-03 first.

## 1. Principles

| # | Principle | What it buys |
|---|---|---|
| P1 | Data owns numbers, code owns behaviour | Designers and agents rebalance without touching TypeScript |
| P2 | One registry per content type, keyed by the data `id` | New content = data row + one small file. No scene edits |
| P3 | Content and systems get a `BattleCtx` interface, never a scene | Code can move between scenes; tests can fake the context |
| P4 | Systems talk through a typed event bus | Artifacts, combo, score, analytics and tutorial hook in without coupling |
| P5 | Only `src/platform/` imports the RUN SDK | Local dev runs on a mock; SDK changes touch one folder |
| P6 | Every optional system sits behind `config.features.*` | Any feature can be cut on deadline day by flipping a flag |
| P7 | Gameplay runs on a fixed 60 Hz step | Physics is consistent, timings in data are in steps, scripted tests are repeatable |
| P8 | The save is a versioned blob with migrations | No player loses progress when the shape changes |

## 2. Target layout

```
game/src/
  main.ts                    Phaser config + scene list only
  config/
    constants.ts             W, H, STEP and other true constants (not balance)
    settings.ts              loads config.json, merges overrides, exposes getSettings()
  data/
    types.ts                 TS types mirroring game/schemas/*.json
    load.ts                  loads content.json, config.json and level files; dev-mode sanity checks
    lookup.ts                byId maps: weapon(id), monster(id), material(id)...
  core/
    events.ts                typed event bus (see section 6)
    rng.ts                   seeded RNG (mulberry32); Math.random only for cosmetic particles
    save.ts                  load/save/migrate the player save via platform.storage
    profile.ts               in-memory player state (coins, owned, upgrades, stars) + mutators that emit events
    flow.ts                  scene transitions (goTo('map'), goTo('battle', {levelId}))
  platform/
    index.ts                 exports `platform`: the RUN adapter when hosted, the mock otherwise
    rundot.ts                the only file that imports @series-inc/rundot-game-sdk
    mock.ts                  in-memory storage, fixed time, console share, fake leaderboard
    types.ts                 Platform interface (section 8)
  battle/
    BattleCtx.ts             the interface content code uses (section 4)
    world.ts                 builds blocks/monsters from level JSON; worldW, ground, walls
    loop.ts                  fixed-step accumulator, hit-stop, step order (section 3)
    sling.ts                 aim input, pull, launch, dotted preview, weapon queue
    camera.ts                intro pan, follow, pinch/pan/zoom, view-all
    damage.ts                damage pipeline + modifiers (section 7)
    status.ts                status effects (burn, slow, stun, curse, shield, chain, poison)
    combo.ts                 MASH combo counter and banner trigger
    score.ts                 score, stars, coins earned this level
    rules.ts                 win/lose checks (all monsters dead, out of shots, runners escaped)
  content/
    weapons/index.ts         WEAPONS registry; one file per weapon: blade.ts, cleaver.ts...
    monsters/index.ts        MONSTERS behaviour registry; basic.ts, runner.ts, bomber.ts...
    artifacts/index.ts       ARTIFACTS registry (event hooks + damage modifiers)
    consumables/index.ts     CONSUMABLES registry
    levelKinds/index.ts      siege, runner, boss, daily generator
  art/
    palette.ts               Mash32 palette, C('x') lookup
    pix.ts                   pixel text, grid -> texture
    sprites/                 one file per entity: goblin_grunt.ts exports frames
    textures.ts              builds every texture at boot from sprites/ + rarity palette swaps
    backgrounds.ts           realm background generators keyed by realm.background
  audio/
    sfx.ts                   named WebAudio sounds
    music.ts                 chiptune loops from note arrays
  ui/
    widgets.ts               button, panel, icon button, counter (pixel style, 44px touch targets)
    hud.ts                   battle HUD on the UI camera
  scenes/
    BootScene.ts             load data + save, build textures, then Title
    TitleScene.ts            conga line, play button
    MapScene.ts              realms, level nodes, stars, daily countdown
    LoadoutScene.ts          pick weapons, artifacts, consumables
    BattleScene.ts           thin orchestrator: wires battle/* + content/* + hud
    ResultsScene.ts          stars, coins, share, double-coins ad
    ShopScene.ts             shop + forge tabs
  debug/
    testHook.ts              window.__mm API for scripted tests (section 10)
    overrides.ts             ?debug=1&tune.launchK=0.3 URL overrides
```

**Import rules.** An arrow means "may import".

```
scenes -> ui, battle, content, core, data, config, art, audio, platform
battle -> content (registries), core, data, config, art, audio
content -> battle/BattleCtx (types only), core/events, data, config, audio, art
core -> data, config, platform
platform -> (SDK only in rundot.ts)
data, config, art, audio -> nothing above them
```

Forbidden: `content/*` or `battle/*` importing `scenes/*`; anything except `platform/rundot.ts` importing `@series-inc/rundot-game-sdk`. Check with:
`grep -rn "rundot-game-sdk" game/src | grep -v platform/rundot.ts` (must print nothing).

## 3. Battle loop

```
update(delta):
  acc += min(delta, 50)
  while acc >= STEP and steps < config.physics.maxStepsPerFrame:
    particles.step()                      // visual, keeps moving during hit-stop
    if hitStop > 0: hitStop--; continue
    sling.step()                          // aim intents, queue animation
    weaponImpl.onUpdate(ctx, proj)        // projectile behaviour
    for m in monsters: behavior.onUpdate(ctx, m)
    status.step()                         // ticks burn/slow/stun timers
    matter.world.step(STEP)
    damage.flushCollisions()              // collisions queued during step -> damage
    deaths.resolve()                      // kill(), coins, events
    combo.step(); rules.step()            // win/lose
  render: sync sprites, draw overlay gfx, HUD
```

Battle states: `intro → loading → ready → aiming → flying → settling → ready | won | lost`. Only `sling.ts` moves `ready/aiming/flying`. Only `rules.ts` moves to `won/lost`.

## 4. BattleCtx (what content code may use)

```ts
export interface BattleCtx {
  step: number;                                   // steps since level start
  rng: Rng;                                       // seeded, per level
  tune: Tuning; rules: DamageRules;               // merged settings (section 9)
  events: EventBus;
  // queries
  monsters(): Ent[]; blocks(): Ent[];
  within(x: number, y: number, r: number): Ent[];
  // actions
  damage(target: Ent, amount: number, opts?: { element?: Element; source?: string; strong?: boolean }): void;
  damageAround(x: number, y: number, r: number, mult: number, opts?: { element?: Element; source?: string }): void;
  addStatus(target: Ent, status: StatusId, steps: number, params?: Record<string, number>): void;
  spawnProjectile(weaponId: string, x: number, y: number, vx: number, vy: number, opts?: { ghost?: boolean; damageMult?: number }): Proj;
  impulse(target: Ent, fx: number, fy: number): void;
  fx(kind: 'burst' | 'ring' | 'flash' | 'shake' | 'text', x: number, y: number, opts?: object): void;
  sfx(name: string): void;
}
```

If content code needs something that isn't here, add a method to `BattleCtx` and implement it in `battle/`. Don't reach into the scene.

## 5. Registries

Each registry is a `Record<string, Impl>` keyed by the data `id` (`content/weapons/index.ts` exports `WEAPONS`). Data supplies stats; the impl supplies behaviour. `data/load.ts` warns in dev if a data row has no impl, and falls back to a default (`basic` monster, `plain` weapon).

```ts
// content/weapons/types.ts
export interface WeaponImpl {
  texture: string;                                 // texture key built in art/textures.ts
  onLaunch?(ctx: BattleCtx, p: Proj): void;
  onAbility?(ctx: BattleCtx, p: Proj): void;       // button press (data: ability.mode = button|both)
  onImpact?(ctx: BattleCtx, p: Proj, hit: Hit): void; // first hit (ability.mode = impact|both)
  onUpdate?(ctx: BattleCtx, p: Proj): void;
  drawFx?(ctx: BattleCtx, p: Proj, g: Phaser.GameObjects.Graphics): void;
}
// physics (radius, density, spin) and ability (mode, label) move from code to data: weapon.physics, weapon.ability
// per-weapon numbers (saw duration, pellet count...) live in weapon.params

export interface MonsterBehavior {
  onSpawn?(ctx: BattleCtx, m: Ent): void;
  onUpdate?(ctx: BattleCtx, m: Ent): void;         // runners walk the path, imps fly, trolls regen
  onDamaged?(ctx: BattleCtx, m: Ent, hit: Hit): number | void; // may change the amount (hexer shield)
  onDeath?(ctx: BattleCtx, m: Ent): void;          // bomber explodes
}

export interface ArtifactImpl {                    // equipped artifacts subscribe for the level
  install(ctx: BattleCtx, params: Params): () => void;   // subscribe to events; return an uninstall function
  modifyDamage?(hit: Hit, params: Params): number;       // optional multiplier in the damage pipeline
}

export interface ConsumableImpl {
  targeted: boolean;                               // mirrors data; true = player taps a spot/monster
  use(ctx: BattleCtx, params: Params, target?: { x: number; y: number; ent?: Ent }): void;
}

export interface LevelKind {                       // 'siege' | 'runner' | 'boss' | 'daily'
  build?(ctx: BattleCtx, level: Level): void;      // extra setup (exit door, boss weak point)
  checkLose?(ctx: BattleCtx): string | null;       // e.g. 'runners_escaped'
}
```

## 6. Events

Typed in `core/events.ts`. Emit with `events.emit('kill', {...})`, listen with `events.on(...)`. Listeners added during a battle are removed when the battle ends. `BattleScene` calls `events.clearBattle()` on shutdown.

| Event | Payload | Typical listeners |
|---|---|---|
| `level:start` | `{ levelId, kind }` | tutorial hints, analytics, artifacts install |
| `shot:launched` | `{ weaponId, index }` | Echo Stone (ghost shot), HUD |
| `shot:ability` | `{ weaponId, x, y }` | Gale Eye (wind burst), sfx |
| `shot:ended` | `{ weaponId }` | camera, sling queue |
| `hit` | `{ target, amount, element, source, x, y }` | Stormcaller Torc (every 5th hit), numbers popup |
| `kill` | `{ target, by, x, y }` | combo, score, coins, Gamblers Charm |
| `combo` | `{ count, mult }` | MASH banner, sfx, haptics |
| `runner:escaped` | `{ count, limit }` | rules, HUD |
| `coins:gained` | `{ amount, x?, y? }` | HUD, Lodestone Bracer |
| `level:won` | `{ levelId, stars, score, coins }` | profile, save, results, leaderboard (daily) |
| `level:lost` | `{ levelId, reason }` | results, analytics |
| `profile:changed` | `{ field }` | save (debounced), shop UI |

Add events here first, then in `core/events.ts`.

## 7. Damage pipeline

`battle/damage.ts` is the only place that computes damage.

```
amount = base                                  // weapon.baseDamage, or debris/fall formula
       × rules.globalScale
       × (1 + rules.upgradeDamagePerStep × upgradeLevel)
       × element                               // rules.elementWeak / elementResist / 1
       × impact                                // clamp(rel / maxSpeed, impactFactorMin..Max)
       × status                                // curse +15% etc. from status.ts
       × Π artifact.modifyDamage(hit)
       × combo.mult (only for score, not HP)   // HP damage ignores combo; score uses it
then  monsterBehavior.onDamaged may adjust (shield absorbs)
then  apply, emit 'hit', and maybe 'kill'
```

Collisions are queued during `matter.world.step` and resolved after it. Never destroy bodies inside a collision callback.

## 8. Platform adapter

```ts
export interface Platform {
  hosted: boolean;                                    // false under the mock
  init(): Promise<void>;
  storage: { get(key: string): Promise<string | null>; set(key: string, v: string): Promise<void> };
  serverTime(): Promise<number>;                      // ms epoch (RUN requestTimeAsync)
  profile(): Promise<{ id: string; name: string; avatarUrl?: string }>;
  safeArea(): { top: number; bottom: number; left: number; right: number };
  leaderboard: { submit(board: string, score: number): Promise<void>; top(board: string, n: number): Promise<Row[]>; myRank(board: string): Promise<Row | null> };
  share(text: string, params?: Record<string, string>): Promise<boolean>;
  ads: { rewardedReady(): Promise<boolean>; showRewarded(): Promise<boolean> }; // false on desktop
  iap: { available(): boolean; buy(itemId: string): Promise<boolean>; owned(itemId: string): Promise<boolean> };
  lifecycle: { onPause(f: () => void): void; onResume(f: () => void): void };
  haptic(kind: 'light' | 'heavy'): void;
  track(event: string, data?: object): void;          // analytics
}
```

Every method catches its own errors and returns a safe default. Callers never need try/catch. A feature is active only when `config.features.X` is true **and** the platform supports it (`ads` and `iap` are false on desktop and under the mock).

## 9. Settings and overrides

`config/settings.ts` builds one merged settings object at level start, applied in this order:

1. Code defaults in `config/settings.ts` (so a missing key never crashes)
2. `public/data/config.json` (display, physics, camera, features)
3. `public/data/content.json` (`tuning`, `damageRules`, `economy`)
4. Level `overrides` (`{"tuning": {"launchK": 0.3}}`)
5. URL overrides, only when `?debug=1`: `&tune.launchK=0.3&features.daily=false`

Read settings through `ctx.tune` / `getSettings()`. Never read the JSON directly from a system.

## 10. Test hook (dev and `?debug=1` only)

```ts
window.__mm = {
  load(levelId: number): Promise<void>;       // jump into a level, skipping intro tweens
  fire(o: { angleDeg: number; power: number; abilityAfterSteps?: number }): void; // power 0..1
  run(steps: number): void;                   // advance the fixed step synchronously
  settle(maxSteps?: number): void;            // run until settled or won/lost
  state(): { state: string; shotsLeft: number; monsters: number; score: number; coins: number };
  set(path: string, value: unknown): void;    // e.g. set('tune.launchK', 0.3)
  give(o: { coins?: number; unlockAll?: boolean }): void;
};
```

`scripts/sweep.mjs` (card S2-09) uses this to fire a grid of shots at every level and report the best kills per shot, flagging levels that one shot can clear or that no sweep could clear.

## 11. Art and audio

- Palette: Mash32 in `art/palette.ts`. Sprites are text grids, one base-32 character per pixel (`.` is transparent). Every colour must come from the palette.
- Frames: `<id>` (idle), `<id>_f2` (second idle frame), `<id>_hurt`. Weapons: `<weaponId>` icon used both in flight and in the queue.
- Rarity tint: `textures.ts` makes palette-swapped copies for rarity frames (`<id>@epic`).
- Backgrounds: `backgrounds.ts` exports generators keyed by `realm.background`. Three parallax layers, scrollFactor 0.2 / 0.5 / 1.
- Audio: `audio/sfx.ts` keyed names (`hit`, `crunch`, `coin`, `mash`...). Music is note arrays per realm (`realm.music`). Mute lives in the save (`settings.muted`).

## 12. Budgets

| Item | Budget |
|---|---|
| Physics bodies per level | 120 |
| Particles alive | `config.display.maxParticles` (90) |
| Physics steps per frame | `config.physics.maxStepsPerFrame` (3) |
| JS bundle (gzip) | under 300 KB of our code (Phaser is shared by RUN) |
| Frame rate | 60 fps on a mid-range phone; test with 4x CPU throttle in Chromium |
| Save blob | under 64 KB |
