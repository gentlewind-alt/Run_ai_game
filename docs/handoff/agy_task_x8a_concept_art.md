# X8a · Concept-art look: realm backdrops and block textures

Read `AGENTS.md` first (golden rules). Work in `game/`. Visual only: **no physics, no collision size, no data numbers change.**

## Reference (look at these images before you start)
- `docs/concepts/realm_1_goblin_hills.png` … `realm_6_sky_citadel.png`: the target look.
- `docs/concepts/backdrops/{hills,wood,keep,frost,ember,sky}.png`: generated scenery plates (no forts). If one is missing, skip that realm and say so in the log; do not generate images yourself.
- Current game look: `docs/handoff/shots/gen/omni_arm_in_game.png`.

What the concepts have that the game lacks: (1) a painted scenery plate behind everything; (2) blocks with texture: stone as **mortared bricks**, iron as **riveted plates**, wood as **planks with grain and nail heads**, all with a dark 1 px outline and a light top-left edge.

## Part 1: backdrop plates
1. Process each plate into `game/public/sprites/bg/<style>.png`:
   - Downscale with **nearest neighbour** (no smoothing) to **640 x 360**. Use PowerShell `System.Drawing` (`InterpolationMode = NearestNeighbor`, `PixelOffsetMode = Half`) or extend `tools/process_sprites.ps1` with a `bg` map. Do not install packages.
   - Snap colours to the Mash32 palette (`game/src/art/palette.ts`; `process_sprites.ps1` already has the snapping code: reuse it).
2. Load them in `BootScene.preload` the same way generated sprites are (see `art/generatedSprites.ts`): key `bg_<style>`. A missing file must fall back silently (the retry/`loaderror` handling in `BootScene` already covers failed loads).
3. In `art/backgrounds.ts` `buildBackground`: when `scene.textures.exists('bg_' + styleKey)`, draw it as the **farthest** layer: `scene.add.image(...)` at depth **-4.5**, `setScrollFactor(0.05, 1)`, scaled so it covers the visible sky (height from about y = -40 down to the ground line `groundY`, width covering `worldW` at that scroll factor; tile it horizontally if needed). Keep the existing procedural `par_far`, `par_mid`, `par_near` and ground on top of it (they give parallax). Hide the procedural `par_sky` only when the plate exists. `styleFor(realm)` already maps realm ids to style keys; use the same key.
4. Readability: monsters and blocks must stay readable over it. Add a translucent overlay rectangle (alpha 0.25, palette colour of the realm's darkest sky band) between plate and ridges if a plate is busy.

## Part 2: block textures (`art/textures.ts` `makeBattleTextures`)
Redraw the three materials. Same canvas size `b.w x b.h`, same keys, same `cracked` variant. Palette chars only (`C(ch)`, see `palette.ts`).
- **Common**: 1 px outline `'v'` all round; top row and left column one step lighter; bottom row and right column one step darker.
- **Stone (`k` base, `l` light, `m` dark mortar)**: running-bond bricks. Brick height 4 px (3 px when the block is shorter than 9), brick length 8 px, rows offset by 4 px. Mortar lines in `m`. Each brick gets a 1 px `l` highlight on its top-left. For blocks under 8 px on either side: plain base with outline and one mortar line.
- **Iron (`e` base, `d` light, `f` dark, `c` rivet)**: plates split every 12 px along the long side by a `f` seam with a `d` line next to it; 2x2 rivets (`c` with a `f` shadow pixel) at each plate's corners when the plate is at least 8 x 8; a diagonal `d` sheen line on plates wider than 16.
- **Wood (`g` base, `i` light, `h` dark)**: planks along the long side, 4 px wide, separated by `h` lines; grain: 1 px `h` dashes inside each plank every 5-7 px (use a deterministic hash of x, y, not `Math.random`); nail heads (`v` pixel with an `i` pixel above) 2 px in from each end of every plank when the plank is at least 10 long.
- **Crystal**: keep as is but add a 1 px `c` facet diagonal.
- **Cracked**: a jagged 2-segment crack in `v` with a `m`/`f`/`h` (per material) edge pixel, plus one missing corner (2x2 transparent) so damage reads clearly.
- Blocks are 6 to 144 px. Check the textures read at 6 x 30 (thin pillar), 10 x 30, 50 x 6 (floor), 36 x 12 (iron), 144 x 6 (long roof).

## Checks (all must pass)
1. `npm run check` and `npm run build`.
2. Screenshots with `tools/probe.mjs` (dev server: `npx vite --port 5212 --strictPort` started detached; see `docs/handoff/LOG.md` for how). One per realm, level 1, 5, 9, 13, 17, 21 after `window.__mm.load(n, [...])`, saved to `docs/handoff/shots/x8a/level_NN.png`. Look at every one: plate visible, ridges and ground drawn over it, blocks show bricks / rivets / planks, monsters readable.
3. `npm run regress:quick` passes unchanged (physics untouched, so bands must not move).
4. Append a `docs/handoff/LOG.md` entry (newest at top, template in `architecture/WORKFLOW.md`) and set card X8a to `review` in `docs/handoff/STATUS.md`.
5. Commit: `X8a concept-art backdrops and block textures via agy`. Do not push, do not deploy.

## Do not
- Change block sizes, materials, densities, HP, collision, level files or `content.json` numbers.
- Generate or download images, spend credits, deploy, or touch `src/platform/`.
