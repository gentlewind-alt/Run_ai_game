# Task: legendary abilities get catastrophe-scale presentation

Owner's words: the legendary abilities and their effects "are not up to the mark of being called LEGEND. They should be grander, wider, like a catastrophe, dramatic." Damage is NOT the problem. The problem is presentation only.

Read `AGENTS.md`, `architecture/ARCHITECTURE.md` and `architecture/RECIPES.md` first. Work in `game/`.

## The six legendaries (rarity "legendary" in `game/public/data/content.json`)

| Weapon | Code | Ability today | Make it look like |
|---|---|---|---|
| Comet Fists (`w_comet_fists`) | `src/content/weapons/cometFists.ts` | Dive-slam, earthquake wave, one rock spike ahead | The sky dims; a giant comet (`legend_comet`, drawn 2-3x big) streaks in from the top corner onto the slam point with a fire trail; impact = white flash, short hit-stop, camera punch, a crater shock ring that runs along the ground both ways, rocks flung up; then a CHAIN of 3-5 rock spikes (`legend_rock_spike`) erupting one after another along the ground ahead. |
| Bulwark Disc (`w_bulwark_disc`) | `bulwarkDisc.ts` | Redirect toward nearest monster; sixth bounce = shield blast | Redirect: a golden rune circle spins up around the disc and a rune line draws to the target. Every bounce leaves a fading rune ring. Sixth bounce: a huge translucent shield dome (`legend_shield_dome`) bursts out from the disc, rune rings rotating, a blue-white flash, a wide shockwave and glass-like shards. |
| Skyforge Maul (`w_skyforge_maul`) | `skyforgeMaul.ts` | Lightning on 4 chosen monsters; tap again to recall | The screen darkens and a storm cloud (`legend_storm_cloud`) rolls in over the targets with thunder flashes; each strike is a thick forked bolt from the cloud with a scorch glow on impact; on the last strike the colossal storm hammer (`legend_storm_hammer`) drops out of the cloud onto the highest-HP target with a shockwave, then rises back into the cloud as the cloud clears. |
| Brahmastra Arrow (`w_brahmastra_arrow`) | `brahmastraArrow.ts` | One thick beam from the sky onto the nearest monster | A short freeze (hit-stop) and the sky dims gold; a divine sun-eye (`legend_sun_eye`) opens above the target while light rays converge into it; then a WIDE pillar beam with a white core and gold edges, light rays sweeping across the whole screen, the ground under it glowing molten, a final white flash and embers drifting up. |
| Alien Dial (`w_omnitrix_dial`) | `omnitrixDial.ts` | A giant alien foot stomps from the sky; level-wide earthquake | A green hourglass flash fills the screen; a dark shadow grows on the ground; the giant alien foot (`legend_alien_foot`, drawn very big) slams down from above the screen; dust waves roll across the WHOLE level in both directions, the camera shakes hard, a green energy ring expands past the screen edges. Keep the existing screech/quake sounds. |
| Black Hole Marble (`w_black_hole_marble`) | `blackHoleMarble.ts` | Singularity drags everything in, then collapses | The screen vignettes dark around it; the black hole (`legend_black_hole_swirl`, an 8-frame animation) grows at the singularity and keeps swirling; streaks of light and debris spiral inward from far away; monster and block SPRITES near it stretch toward it (visual only); on collapse it shrinks to a point, a beat of silence, then a white-purple nova ring explodes outward with a flash. |

All six should feel like the biggest moment in the game: use the whole screen (dim/vignette overlays, full-width rings and dust, camera punch or shake, flashes, short hit-stop), not just effects around the weapon.

## Art (made with the RUN CLI by Claude; do NOT call `rundot generate`)

Processed sprites will be at `game/public/sprites/legend/<name>.png`: `legend_comet` (64 px), `legend_rock_spike` (48), `legend_shield_dome` (96), `legend_storm_hammer` (72), `legend_storm_cloud` (128), `legend_sun_eye` (64), `legend_alien_foot` (96), `legend_black_hole` (96), and `legend_black_hole_swirl.png`, a horizontal sprite sheet of 8 equal frames (frame width = image width / 8).

Load them through each weapon row's `extraSprites` field in `content.json` (see `src/art/generatedSprites.ts`: each path is loaded with its file name as the texture key, e.g. `"extraSprites": ["sprites/legend/legend_comet"]` gives the key `legend_comet`). For the swirl sheet, add the frames at runtime (`scene.textures.get(key).add(i, 0, x, 0, w, h)`) or load it as a spritesheet; then play it as an animation or by switching frames on a step counter. If a file is missing (Claude may still be generating it), draw a procedural stand-in so nothing ever shows Phaser's green missing-texture box.

## Rules

- Presentation only. Do not change damage numbers, targets, radii, status effects or which monsters get hit. You MAY delay when the existing damage lands so it hits in sync with the visual (for example when the comet arrives), using step counters (Actors / `p.steps`), never real-time timers, so it stays deterministic for the Arena verifier.
- New numbers (timings in steps, sizes, counts) go in each weapon's `params` in `content.json` (or a config block with a schema entry), not as literals scattered in code. Follow how params are read today.
- Weapon code only talks to the battle through `BattleCtx` (`src/battle/BattleCtx.ts`, implemented in `src/battle/ctxImpl.ts`). If you need new effect helpers (screen dim, vignette, camera punch, sprite stretch, chained spikes), add them to `src/battle/fx.ts`, expose them on `ctx.fx`, and reuse them across the six weapons.
- The Arena headless verifier (`src/arena/headless.ts`, bundled by `scripts/build-arena-headless.mjs`) runs this code with a stub scene: any new scene/camera/tween call must be safe there (the stub proxies most calls; check `cameras`, `tweens`, `time`, `add`). Do not import `core/economy` from battle code.
- Visual timing can use tweens; gameplay timing must use steps.
- Keep the existing generic ability animation in `src/battle/weaponAnim.ts` working (it runs before each ability); you are adding the big set piece on top.
- Match the surrounding code style (comment density, naming). Keep it tidy: shared helpers instead of six copies.
- `npm run check` and `npm run build` must pass. Do not commit, push or deploy. Do not touch files outside `game/` except this brief.

## Done when

All six legendaries play their new set piece in the browser (dev server at http://localhost:5173/?mock=1&debug=1; `window.__mm.load(levelNumber, loadout)`, `__mm.fire({angleDeg, power, abilityAfterSteps})`, `__mm.settle(n)`), check and build pass, and you list what you changed per weapon and any art you had to stand in for.
