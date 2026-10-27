# FORGE-01: Modular weapon Forge

Owner request: implement the two photographed Forge sketches, with improvements to playability. Codex owns the design and final acceptance. AGY remains disabled. A decision-complete OpenCode leaf was attempted (`agy_task_forge_types.json`, run `c24089d1b9cc4a80a733ca84d78f5b0e`); it exited 1 before writing code or a report. Codex continued directly; no provider/model fallback or RUN AI credits were used.

## Frozen design

- Six original weapon shapes: sword, longsword, dagger, cleaver, spear, twinblades.
- One blessing or enemy curse per weapon. Ten choices include normal/double/half damage, range, critical hits, coin tradeoffs, vulnerability, poison, lightning, shield suppression and health drain.
- Nine shared abilities: Dance, Rain, Burst, Whip, Clone, Strike, Slash, Spirit and Phantom. Every copy/effect uses the selected weapon artwork; circular physics approximations remain modest and body-specific.
- Nine cosmetic radiances, from Mash32. One saved recipe per shape avoids inventory flooding. Existing legendary weapons retain their own identities/powers in a separate collection view.
- Free creation grants the existing arsenal ownership field. No campaign save shape/version or prices change. Recipes persist under separate platform key `monster-mash.forge.v1`, validated and read back before ownership/success feedback. Concurrent saves are serialized.
- `features.weaponForge` gates the editor and crafted gameplay. `features.enemyAttackPhysics` gives archer/boss projectiles mass and collisions with structures/player weapons, excluding enemy monsters. Enemy projectiles do not keep a player turn busy.
- Each battle snapshots its recipes. Forge traits apply through direct/collision/blast paths once; poison/lightning do not recursively trigger traits. Gemini twins use the chosen power with their reduced damage. Every power is available once per shot.
- Copy cap is six; all gameplay timing is fixed-step/data-owned. Cancelling a battle releases visuals/bodies without firing completion explosions.

## Integration

Data: `game/public/data/forge.json`, validated by `game/schemas/forge.schema.json` and the existing weapon schema. Shared definitions: `src/data/forgeTypes.ts`. Persistence/compiler: `src/core/forge.ts`. Editor: `src/scenes/ForgeScene.ts`, opened from Shop > Forge or Loadout. Art: `src/art/forgeTextures.ts`. Ability registry: `src/content/weapons/forge.ts`. Battle definition resolver, trait gateway and enemy shots live in `src/battle/`.

Existing Shop damage upgrades remain available, now paginated. Existing weapons/levels are preserved. Pre-existing builder work is retained; its unused `cellAt` import was removed and its assigned `hover` field made public to resolve TypeScript unused-private-field errors without changing builder behavior.

## Acceptance

- `npm run check` and `npm run build`.
- `node tools/test_forge.mjs` against Vite on 5212: actual pointer selection/save, store reload, 4,860 recipe combinations, all 54 body/ability battles, modifier parity, Gemini/Long Reach, shield/poison/coins/Conduct, real enemy impulses, cleanup, failed/concurrent saves, snapshot isolation, disabled features, malformed saves and unchanged campaign progress.
- Campaign `npm run regress:quick` after focused checks; record actual outcome in LOG.md.
- Screenshot review at normal desktop and narrow landscape. Real RUN persistence and phone performance remain hosted/device checks, not claims from the in-memory mock.
