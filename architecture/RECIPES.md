# Recipes: how to make common changes

Each recipe assumes the target layout from ARCHITECTURE.md (after S2-01 to S2-03). If a path doesn't exist yet, do that card first, or put the code where the current file holds the equivalent and note it in LOG.md.

Every recipe ends with the **standard checks**:
1. Run `npm run check` and `npm run build`.
2. Play the change in `npm run dev`.
3. Run `node scripts/sweep.mjs --all` if balance or levels changed (once S2-04 exists).
4. Update STATUS.md and LOG.md.

---

## Balance and feel

### Change a number (damage, HP, launch power, coins, durations)
1. Find it in `public/data/content.json`: `tuning`, `damageRules`, `economy`, or the item's own row or `params`.
2. Edit it. Durations are in 60 Hz steps unless the key ends in `Seconds` or `Ms`.
3. Try it live first, without editing: `npm run dev`, then open `/?debug=1&tune.launchK=0.3`.
4. If the number is in code instead, that's a bug. Move it to data (and the schema), then change it.

### Change it for one level only
Add `"overrides": { "tuning": { "launchK": 0.32 } }` to that level file.

### Change the damage formula
Edit only `battle/damage.ts`, and update ARCHITECTURE.md section 7 in the same commit. If a new term needs a number, add it to `damageRules` and to `content.schema.json`.

### Turn a feature on or off
`public/data/config.json` → `features.<name>`. To test without editing: `/?debug=1&features.daily=false`. If a feature has no flag, add one (schema, config.json, and an `if (settings.features.x)` at its single entry point, usually where its scene or system is started).

---

## Content

### Add a weapon
1. **Data row** in `content.json → weapons`. Use a new `w_` id; set `name`, `archetype`, `element`, `rarity`, `baseDamage`, `unlock`, `price`, and the `launch` and `tap` text. Add `physics{radius,density,spin}`, `ability{mode,label}` and `params{}`.
2. **Sprite** in `art/sprites/<id>.ts` (16x16 grid, Mash32 only). Register it in `art/textures.ts`.
3. **Behaviour**:
   - If an existing weapon behaves the same and only the numbers differ, set its behaviour key with `params.behavior: "<existing id>"`. Then no new code is needed. *(The registry lookup is `WEAPONS[params.behavior ?? id]`. Add that in S2-02 if missing.)*
   - Otherwise create `content/weapons/<short>.ts` exporting a `WeaponImpl`, and add it to `content/weapons/index.ts`. Use only `BattleCtx`, and read every number from `p.def.params`.
4. **Sound:** reuse an `sfx` name or add one in `audio/sfx.ts`.
5. **Test** with `/?debug=1&loadout=<id>,<id>,<id>` on level 90 (the debug level).
6. If it should be in the shop, it is there automatically when `enabled` isn't false and `price` is set.

### Port an item from the catalogue (`catalogue/weapons.json`, `gear.json`)
1. Pick the item. Keep its `id`, `name`, `element` and `baseDamage`. Map its rarity to `rarity`.
2. Rewrite its melee or ranged `effect` as a slingshot `launch` + `tap` (one line each). Keep the idea and change the delivery. Examples:
   - "hits from behind always crit" becomes "crits on a monster's back".
   - "pulls enemies in" becomes "the ability pulls nearby monsters to the impact".
3. Choose the closest existing behaviour (same archetype first) and only add code if the idea can't be expressed in `params`.
4. Relics become artifacts (`r_` id, `install` hooks). Consumables keep their `c_` id. Armour has no slot in this game: skip it, or turn it into a sling skin cosmetic.
5. Never use names from other franchises. All names in the catalogue are already original.

### Add a monster
1. **Data row** in `content.json → monsters`: `id`, `name`, `hp`, `weak`, `resist`, optional `size`, `density`, `coins`, `score`, `behavior`, `params`.
2. **Sprites** in `art/sprites/<id>.ts`: `idle`, `f2` and `hurt` frames (16x16; 32x32 for big monsters, 48x48 for bosses).
3. **Behaviour:** reuse one (`"behavior": "basic"`), or write `content/monsters/<id>.ts` implementing `MonsterBehavior`, then register it.
4. Add it to a realm's `monsters` list so the Daily generator can use it.
5. **Test** by putting it in `levels/level_90.json`.

### Add a block material
1. Add a row to `content.json → materials` (`id`, `hp`, `weak`, optional `density`, `friction`, `coins`).
2. Add its texture style (fill, highlight and shadow palette chars, crack pattern) in `art/textures.ts`, keyed by material id.
3. Add a debris colour set in `battle/damage.ts` (or the `fx` palette map), and a break sound if wanted.

### Add an artifact
1. Add a data row (`r_` id, `effect` text, `price`, `params`).
2. Create `content/artifacts/<short>.ts` with `install(ctx, params)`. Subscribe to events (`kill`, `hit`, `shot:launched`...) and return the unsubscribe function. Add `modifyDamage` if it changes damage.
3. Register it in `content/artifacts/index.ts`. The shop and loadout pick it up from data.

### Add a consumable
1. Add a data row (`c_` id, `price`, `targeted`, `params`).
2. Create `content/consumables/<short>.ts` with `use(ctx, params, target?)`. Register it. Randomness must use `ctx.rng`.

### Add a status effect (burn, freeze, curse...)
Add it in `battle/status.ts`: give it an id, decide whether it stacks, write its tick behaviour, set its damage multiplier if any, and give it a tint. Put its numbers in the `params` of whatever applies it.

---

## Levels and realms

### Add or edit a level
1. Copy the closest `public/data/levels/level_NN.json` to the next number. The id must match the file number.
2. Add the id to the right realm's `levels` (in play order).
3. Use the coordinates in DATA.md. Ground-standing blocks have `y = 320 - h/2`; monsters on the ground have `y = 313`.
4. Run `npm run check:data`. It catches unknown materials and monsters, out-of-world positions, and runners without an exit.
5. Run `node scripts/sweep.mjs --level NN`. Set `scoreTarget` to about 70% of the best sweep score, and make sure no single shot clears it.
6. Play it by hand twice.

### Add a realm
1. Add a row to `content.json → realms` (`id`, `name`, `levels`, `monsters`, `palette` text, `background` key, `music` key).
2. Write a background generator in `art/backgrounds.ts` and a music loop in `audio/music.ts`.
3. Add the levels (recipe above). The map lays realms out in array order.

### Add a level kind (new rules, like a timed level)
Create `content/levelKinds/<kind>.ts` implementing `LevelKind`, add the kind to the `kind` enum in `level.schema.json`, and set `"kind"` in the level.

---

## Systems, UI and platform

### Add a new system (for example achievements)
1. Write `core/<system>.ts` or `battle/<system>.ts`. It listens to events and never imports a scene.
2. Add a feature flag and start the system only when the flag is on.
3. If it stores data, add fields to `save.schema.json`, bump `version`, and add a migration that fills defaults.

### Change the save shape
1. Bump `version` in `save.schema.json` and in `core/save.ts`.
2. Append a migration `(old) => new` that fills defaults. Never delete fields players already have without a migration.
3. Test loading a v(N-1) blob from the mock (`scripts/fixtures/save_vN-1.json`).
4. **Owner approval** is needed if the change resets anything a player earned.

### Add a screen
Create `scenes/<Name>Scene.ts` and register it in `main.ts`. Navigate only with `flow.goTo()`. Build buttons from `ui/widgets.ts` (pixel style, at least 44 px touch area at device scale). Put text sizes and colours in `ui/widgets.ts`, not in the scene.

### Use a new RUN SDK feature
1. Read the docs (`game/node_modules/@series-inc/rundot-game-sdk/docs`) and the matching `rundot skills` entry.
2. Add a method to `platform/types.ts`, implement it in `rundot.ts` with try/catch and a safe default, and add a fake in `mock.ts`.
3. Gate it with a feature flag. Never import the SDK outside `platform/rundot.ts`.

### Change resolution or orientation
Edit `config.json → display.width/height`. Everything positional reads `config.world` and `display`, not literals. Expect to re-check the HUD layout and each level's `worldW`, and run the sweep again. Orientation is also registered with RUN (`game.config.prod.json`, `rundot init --orientation`), so ask the owner before changing it.

### Change art style or palette
Edit `art/palette.ts`. Sprites index the palette by character, so a palette swap recolours everything. Changing a sprite is editing its grid file.

---

### Build and test a custom level

1. Choose **Create level** on the Title screen. Pick a block and material, then tap the grid to place it. Use **Select** to drag pieces; **Rotate** turns them in 15-degree steps.
2. Use **Anchor** for fixed supports. **Lock** joins two tapped blocks at their current relative angle. **Rope** starts on a block or an empty fixed anchor point, then attaches to the second tapped block. **Unlink** removes the selected block's connections.
3. Add **Target** monsters. Use **Test** to check balance and hanging mechanisms; **Stop** restores the design. Supported stacks still obey physics, so test before sharing.
4. **Undo/Redo** includes pieces, targets and connections. Drafts save separately through platform storage. **Export/Import** transfers the versioned JSON; malformed imports leave the current draft intact.
5. **Play** launches an isolated slingshot attempt. **Edit** returns to the draft. Custom attempts award no campaign progress or inventory.

## Create a custom weapon

1. Open **Shop > Forge > Create a weapon**, or **Forge weapon** on an unrestricted loadout screen.
2. Choose a **Body**, then one **Bless** or **Curse** trait, an **Ability**, and an **Aura**. The live preview explains the tradeoff. Each shape keeps one build; changing a shape opens that shape's saved recipe.
3. Choose **Save weapon**. The weapon is added to the arsenal after its recipe is saved. Return to Loadout and tap it to fill a firing slot. Campaign levels with fixed teaching loadouts retain their authored weapons.
4. In flight, tap the ability button or let the weapon's first impact activate the power. Powers use the selected weapon design, including rain, clones and spectral strikes. Each shot gets one activation. Gemini's secondary crafted shot activates on impact at reduced strength.
5. **Legends** shows the existing legendary collection; its original powers and one-legendary loadout restriction remain.

Verification: start Vite on 5212, then run `node tools/test_forge.mjs` from the repository root. The local mock stores recipes only for the current browser session; RUN uses platform storage.

## Deploy

1. `npm run build`, then `rundot predeploy` (fix what it reports), then `rundot deploy`.
2. Paste the URL and version into LOG.md.
3. Never run `rundot game set-public` without owner approval (card S6-02).
