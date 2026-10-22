# X8b · Boss fortresses that collapse (levels 4, 8, 12, 16, 20, 24)

Read `AGENTS.md` first. Work in `game/`. Do X8a first if it is not done (`docs/handoff/agy_done.txt`).

## Goal
Rebuild the six boss levels as **bigger, layered fortresses** in the style of panel 4 of `docs/concepts/realm_*.png` (multi-tier towers, iron-plated walls, perches, a throne platform). **The buildings must not be solid**: they are frames of pillars and floors that weapons knock over. Every fortress must visibly collapse when its supports are hit.

## Where
Only `scripts/build_levels.py` (the six `write(4 …)`, `write(8 …)`, `write(12 …)`, `write(16 …)`, `write(20 …)`, `write(24 …)` blocks and their helpers), `scripts/balance_bands.json` if a band truly has to change (say why in the log), and the generated `public/data/levels/level_04.json` … `level_24.json`. Run `python scripts/build_levels.py` from `game/`, then **`git checkout -- public/data/levels/level_01.json`** if it changed (known drift). No other level may change: check `git diff --stat public/data/levels`.

## Construction rules (this is what makes it collapse)
1. **Frames, not walls.** Pillars are 8-12 px wide and 20-36 px tall; floors are 4-6 px tall and span pillars with no more than 4 px overhang each side. No block may be both wider than 14 and taller than 14 (no solid slabs). The only exceptions: iron armour plates of at most 36 x 12 sitting *on* a floor, and one throne seat of at most 40 x 12.
2. **Load-bearing, stacked.** Each tier stands only on the floor below it. Use the existing `tower(cx, base, w, tiers, pillar, ph, floor)` helper or write a similar helper; every pillar must rest on a floor, ground or plateau top (use `stand()` / exact tops like the existing code: blocks must be flush, no gaps, no overlaps, or they jitter and fall at spawn).
3. **Material mix by realm (tougher with level number):** level 4 wood with stone feet; 8 wood and stone; 12 stone with iron armour; 16 stone and crystal (crystal shatters); 20 stone and iron; 24 stone, iron and crystal. Heavier materials go low, lighter high, so a hit up high topples and a hit low brings the whole stack down.
4. **Size grows with the level:** 4: 2 towers, 2 tiers; 8: 2 towers, 3 tiers with a bridge floor between them; 12: 3 towers, 3 tiers; 16: 3 towers, 3 tiers plus a crystal spire; 20: a central 4-tier keep with two side towers; 24: the citadel: a central 4-tier keep, two side towers and two perches for flyers. Keep everything inside reach (see the docstring at the top of `build_levels.py`: targets must sit where a full pull can reach) and inside the current `worldW` of each level unless the camera framing test still passes.
5. **The boss stands on the throne floor inside the fort**, not on top of the roof, so collapsing the fort onto it is a real strategy (falling blocks hurt monsters: `impact()` in `battle/damage.ts`). Keep the boss reachable by a direct shot through a gap or over the top.
6. **Same monsters and roster** as each level has now (same types and counts, same boss), only moved into the new structure. Flyers (imp, lava imp, cloud harpy) must not overlap any block or other monster at spawn (level 17 lost imps that way).
7. Each level keeps its `loadout`, `shots`, `kind`, chests (move a chest into the new structure if it is in the way) and hints.

## Checks (all must pass, in this order)
1. **Stands still at spawn** (no settling collapse), for each of the six levels, with `tools/probe.mjs`:
   `(async()=>{const mm=window.__mm;mm.load(N,['w_militia_blade']);const b=mm.battle();const p0=b.ents.filter(e=>e.kind==='block').map(e=>({x:e.body.position.x,y:e.body.position.y}));mm.run(300);const moved=b.ents.filter(e=>e.kind==='block').filter((e,i)=>Math.hypot(e.body.position.x-p0[i].x,e.body.position.y-p0[i].y)>2).length;return JSON.stringify({blocks:p0.length,moved,dead:b.ents.filter(e=>e.kind==='monster'&&e.dead).length})})()`
   Required: `moved` = 0 and `dead` = 0.
2. **It collapses**: for each level, run the sweep (`window.__mm.sweep(N, loadout)`) and then replay its best shot with `window.__mm.play(N, loadout, [best])`; count blocks that moved more than 8 px or were destroyed. Required: at least **40%** of the blocks for the best shot. Put the numbers in the log.
3. `npm run check`, `npm run build`, and `LEVELS=4,8,12,16,20,24 npm run regress:quick` (solver bands from `scripts/balance_bands.json`, 0 one-shot wins). Then the full `npm run regress:quick`.
4. Screenshots of each fortress before and after the first solver shot: `docs/handoff/shots/x8b/level_NN_before.png` / `_after.png` (`SHOT=… node tools/probe.mjs …`). Look at them: frames, not slabs; the after shot shows a collapse.
5. LOG.md entry with the stand-still and collapse numbers per level, STATUS.md card X8b to `review`. Commit `X8b collapsible boss fortresses via agy`. Do not push or deploy.

## Do not
- Touch weapon or monster numbers in `content.json`, the physics tuning, or any code outside `scripts/`.
- Make a fortress pass the bands by making it solid or unreachable. If a band fails, adjust structure (spacing, material, tier count) and retry; change a band only as a last resort, with the reason in the log.
