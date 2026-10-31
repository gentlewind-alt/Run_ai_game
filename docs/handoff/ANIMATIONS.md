# Enemy animations: how they are made and what is checked

Every enemy has a looping strip in `game/public/sprites/monsters/anim/<id>_<idle|fly|run>.png` (square frames side by side, the
frame size equals the enemy's still sprite). `content.json` lists them per enemy under `anim` with a playback speed. In battle
(`src/battle/loop.ts`) the strip plays while the enemy stands (idle), hovers (fly) or runs; the still sprite shows when it is hurt,
stunned or frozen.

## Where each strip comes from

`node tools/anim_build.mjs` builds all of them and, per enemy, keeps the best candidate that meets the bar:
1. the **AI animation** (`rundot generate animate-sprite`, raw sheets kept in `tools/anim_sheets/`), converted by
   `tools/anim_convert.mjs` (colours locked to the still's own palette, one scale matching the still, crisp majority-vote downscale,
   repeated frames dropped, stray pixels removed, feet planted). Used only when it passes and does not flicker.
2. an animation **computed from the still sprite** (`tools/lib/procedural.mjs`): it always looks exactly like the enemy and only
   breathes, sways, hovers or flaps. Used when the AI version fails or flickers.
`FORCE_COMPUTED` in `tools/anim_build.mjs` lists enemies whose AI frames passed the numbers but looked wrong to the eye. The chosen
source for each strip is in `tools/anim_report.json`.

## The bar (`tools/lib/anim.mjs`, enforced by `npm run check` through `game/scripts/check-anims.mjs`)

At least 4 frames; the motion is visible but not total; the loop closes without a jump; no frame repeats (a repeat stalls the loop);
the size matches the still (0.75 to 1.25 of its area); the feet stay put; no sideways sliding; no stray pixels the still does not
have; every colour belongs to the still's palette; the silhouette looks like the still; the still's bright details (eyes, glows,
jewels) survive. A strip that fails fails the check.

## What the numbers cannot tell

Whether it looks good. After any rebuild, look at it: `node tools/anim_preview.mjs out.png goblin_grunt:idle ...` writes a
magnified sheet (reference sprite first, then every frame). Stills are in `tools/anim_stills/`.

## Redoing one enemy

New AI sheet: `rundot generate animate-sprite --source-url <upscaled still> --prompt "..." --pixel --frames 6 --out tools/anim_sheets/<id>.png`
(150 credits), then `node tools/anim_build.mjs <id>`. No credits are needed to re-run the conversion or the computed version.
