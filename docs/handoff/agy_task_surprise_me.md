# Task: "Surprise me" fort generator in Create Level

Owner: users should be able to get a ready-made level in the builder with one tap, with no AI model, from our own
generator. **Do not run the game, a dev server, a browser or any tests; Claude and the owner test.** Work in `game/`.
Read `AGENTS.md` first. Keep the code style; every number in data with a schema entry; the generator must be pure and
deterministic (seeded RNG, no `Math.random`) so the same seed always gives the same fort.

## What exists

- `scripts/fort_gen.py` (offline, Python): `generate_fort(seed, base, x_min, x_max, tiers, bays, materials_by_tier,
  keep_clear, ground_fn, taper)` builds forts bottom-up from frames (pillars at bay edges, one thin floor per tier,
  optional offset bays and taper, crenellations) and `check_stable` rejects unsupported or top-heavy layouts, retrying
  up to 50 seeds. This is the design to port.
- `src/content/levelKinds/dailyLogic.js`: the Daily Mash generator (3 templates, seeded RNG `createRng`).
- `src/scenes/BuilderScene.ts` (Create Level) with `src/builder/document.ts` (`validateDraft`, `BuilderDocument`),
  `src/builder/geometry.ts` (overlaps, snapping), `src/builder/physics.ts` (settle / Test). Builder limits and piece sizes
  in `content.json` `builder` (grid 2, worldW 640, groundY 320, maxBlocks 100, maxMonsters 20, presets).

## Wanted

1. **Generator module** `src/builder/surprise.ts`: `surpriseFort(seed, options) -> BuilderDocument`, a TypeScript port of
   the `fort_gen.py` rules and stability check, producing a valid builder document (passes `validateDraft`, every block
   inside the build area, no overlaps, every block on the ground or resting on blocks below, heavy materials low, ids
   unique). Use the builder's current piece sizes (presets) so every generated piece is one the player could place.
   - **Styles** (option `style`, plus `random`): `towers` (2 or 3 separate towers of different heights), `bunker` (wide,
     low, thick walls), `bridge` (two pillars with a long span and a fort on top), `castle` (wall, two corner towers,
     crenellations), `stacks` (several small structures at different distances, like the thesis pictures).
   - **Size** (option `size`: `small`, `medium`, `large`) scales tiers, bays and block count (stay under `maxBlocks`).
   - **Monsters**: place 2 to 6 (by size) from the realm's monster list (`content.json` `realms[].monsters`, bosses
     excluded), standing on floors or the ground inside the fort with head room (`keep_clear`), never overlapping blocks.
   - **Realm** (option `realm`, default the player's latest unlocked realm): materials and monsters follow the realm
     (iron keep has iron, frost peaks crystal/ice, and so on; table in data).
   - Retry with the next seed (up to a data limit, e.g. 50) when a candidate fails the stability check or the builder's
     own overlap check; if all fail, fall back to the simplest `bunker`.
   - All numbers (tier heights, bay widths, counts per size, materials per realm, retry limit) in a new
     `content.json` `builder.surprise` block with schema entries.
2. **Builder UI**: a **Surprise me** button in the builder toolbar (fit it in without overlapping, both 480 and wider
   Android widths; the toolbar code places buttons with `button(x, y, w, label, fn)`). Tapping it opens a small panel:
   Style (Random, Towers, Bunker, Bridge, Castle, Stacks), Size (S/M/L), and **Build** / **Roll again** / **Close**.
   Build replaces the current design with a generated one (new random seed each tap, from a counter plus the time; the
   seed is stored in the document name, e.g. "Surprise #4821", so a fort can be recreated). It is **one Undo step**:
   Undo restores the previous design. If the current design has pieces, ask first ("Replace your design?").
   After building, fit the view and say in the status line "Surprise fort ready. Edit it, press Test, then save or play."
3. Generated forts then work like hand-made ones: edit, Test physics, save as a draft, play, share (where sharing is on).
4. **Check script**: extend `scripts/check-builder.mjs` (it already runs in `npm run check`) to generate 60 forts (every
   style and size, fixed seeds) and assert each passes `validateDraft`, has no overlaps, stays under the limits, has at
   least 2 monsters, and that the same seed gives byte-identical output. (Claude will add the physics settle check.)

## Report

List the files you changed, the new data values, and anything you could not finish.
