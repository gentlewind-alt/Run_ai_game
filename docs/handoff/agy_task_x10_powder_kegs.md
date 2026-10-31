# X10 · Powder kegs: blocks that explode when broken

Read `AGENTS.md` first. Work in `game/`. Owner request: an explosive block. When a powder keg breaks it explodes, hurting monsters and blocks nearby and setting off other kegs in range (chain reactions). Behind a feature flag.

## 1. Data
- `public/data/content.json` → `materials`: add
  `{ "id": "keg", "hp": 20, "weak": "hellfire", "density": 0.0012, "note": "powder keg: explodes when broken and sets off nearby kegs", "blast": { "radius": 34, "damage": 60 } }`
- `tuning.points.keg = 30`, `tuning.coins.keg = 3`.
- `public/data/config.json` → `features.kegs = true`.
- `schemas/content.schema.json` → `$defs.material.properties`: add `"blast": { "type": "object", "additionalProperties": false, "required": ["radius", "damage"], "properties": { "radius": { "type": "number", "exclusiveMinimum": 0 }, "damage": { "type": "number", "exclusiveMinimum": 0 } } }`.
- `src/data/types.ts` → `MaterialDef`: add `blast?: { radius: number; damage: number };`.

## 2. Behaviour (`src/battle/damage.ts`, function `kill`)
At the very end of `kill` (after the sleeping-body wake loop), add:
```ts
const blast = t.kind === 'block' ? materialDef(t.type)?.blast : undefined;
if (blast && b.settings.features.kegs) explode(b, px, py, blast.radius, blast.damage, null, null);
```
`t` is already marked dead by `discard`, so the chain cannot loop. No `if (type === 'keg')` branches anywhere in battle code: the behaviour comes from the `blast` field.

## 3. Art
- `src/art/textures.ts` `makeBattleTextures`: add an `else if (m === 'keg')` branch next to `crystal`: a barrel in palette chars. Body fill `'2'` (red), 1px `'3'` highlight on the left and top, 1px `'1'` shade on right and bottom, two horizontal 1px `'h'` hoops at 1/4 and 3/4 of the height, and a 2x2 `'4'` fuse/skull mark in the centre when the block is at least 8x8. The existing `cracked` overlay below must still apply.
- `src/builder/physics.ts` `ensureBlockTextures` `tones`: add `keg: ['3', '2', '1']`.
- `src/battle/damage.ts`: in the two particle-colour chains (in `damage` and in `kill`), add `t.type === 'keg' ? ['2', '3', '4']` before the stone fallback.

## 4. Levels
Add kegs to four siege levels: `level_02`, `level_06`, `level_10`, `level_17`. Rules:
- 2 kegs per level, block `{ "m": "keg", "x": .., "y": .., "w": 10, "h": 12 }`.
- Each keg sits flush on the ground (terrain height at its x) or on top of an existing block (keg bottom = that block's top), within ~30 px of at least one monster, and does not overlap any block or monster.
- Do not move or remove existing blocks or monsters. Do not change `shots` or `scoreTarget` unless the regress check below says to.

## Checks
1. `npm run check`, `npm run build`.
2. Dev server on 5212, then `npm run regress:quick`: passes, and there are 0 one-shot wins on the four edited levels. If a level becomes a one-shot win, move its kegs further from the monsters (do not change the blast numbers).
3. One screenshot each of level 02 before the first shot and just after a keg explodes (`docs/handoff/shots/x10/l02_start.png`, `l02_boom.png`) with `tools/probe.mjs`. The game must be muted for screenshots. Look at them: red barrels visible, explosion rings when one goes off.
4. Flag off check: with `features.kegs = false`, a broken keg just breaks (no explosion).
5. LOG.md entry, STATUS.md card X10 `review`. Commit `X10 Powder kegs via agy`. Do not push or deploy.

## Do not
Change any other material, weapon, monster or physics value; add kegs to other levels or to the builder; generate images; spend credits; touch `src/platform/`.
