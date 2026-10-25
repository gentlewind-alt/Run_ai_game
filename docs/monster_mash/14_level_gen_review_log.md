# Level generator review log

Generator: `game/scripts/level_gen.py`. Review tool: `node tools/level_review.mjs <round> <realms> <archetypes|all> <seeds> <difficulty or arch:d,...>`.
Pass = 0 blocks moved and 0 monsters dead after 300 steps, best-shot collapse >= 40%, solver wins in 3 to 5 shots.
Screenshots and sheets: `docs/handoff/shots/levelgen/<round>/`.

## Round 1 (frost, ember, sky; 4 archetypes; seed 1; difficulty 2; band 2 to 5)
- Fixed before the run: tower failed to generate for ember and sky (bay narrower than an ogre); the review tool tested with a one-weapon loadout (every level "lost"); the dev server was down for the first run (all screenshots were error pages).
- Result 8/12. Failures: `ember_hanging_weight` and `sky_hanging_weight` (not won in 6 shots: two ogres plus a mage and flyers, and the falling block only covers one of them), `sky_bomber_relay` (6 shots: ogre, mage and three harpies on top of the chain), `sky_balanced_beam` (1 block moved at spawn).
- Most passing levels were solved in 2 shots: too easy for the band the campaign uses (3 to 5).
- Changes: band is 3 to 5; difficulty now adds content only at d3 (second heavy in the tower, extra ranged under the beam, second heavy beside a hanging weight); hanging weight keeps one heavy at d1 and d2; bomber relay has fewer flyers.

## Round 2 (3 realms, 4 archetypes, seeds 1 and 2; tower, beam, bomber at d3, hanging weight at d2; band 3 to 5): 4/24
- Looking at the screenshots and listing what moved or died at spawn (probe): **flyers die at spawn** in tall towers (sky and ember towers: two harpies or imps each): they sway 26 px sideways and the old clearance only looked at x within 26 px of a block centre; **the crystal screen beside a balanced beam slides** when the beam is long (it stands on the plateau slope at x below 172); **hanging weight fails to generate** for ember seed 2 (the left screen frame had its first post on the slope, so the contact check rejects every attempt).
- Most failures were not defects but the band: 2-shot solves are the intended trick on balance and hanging layouts, as with the hand-built levels 15, 17, 21, 22. The band is 2 to 5 again; a one-shot win is still a failure.
- Fixes: flyer clearance uses each block's width and a 44 px margin above; the screen is only placed at x >= 172; the left frame moved to x 170 and 186 and only appears when the slab clears it.

## Round 3 (same 24 levels, band 2 to 5, after the fixes above): 18/24
- Spawn defects are gone: 0 blocks moved and 0 monsters dead on all 24. Pass 18/24.
- Remaining failures, read off the sheet and the numbers: **ember and sky towers with two ogres** (6 shots or not won: 660 hp of ogre in one frame); **frost hanging weight** (1 shot: one golem and a mage under the slab are crushed together); **sky bomber relay seed 1** (6 shots: an ogre plus three or four harpies); flyer counts were higher than intended (the loop gave d + 1 flyers).
- Fixes: ogres are "big": a second heavy is only added for lighter types (golem, brute, troll), otherwise a supporter; hanging weight gets a second light heavy from difficulty 2; flyer counts reduced for tower (d - 1) and bomber relay (d - 2).

## Boss concept level (separate from the generator)
- `game/scripts/concepts/eye_of_the_citadel.py`: The Eye of the Citadel, a Sky Citadel boss alternative to level 24: Storm Sovereign in a roofed pocket behind a wood grille, a Storm Mage on the roof shielding it, a balanced beam with two archers on a post above, a crystal perch with a third archer, two harpies.
- Tested with `tools/gate_file.mjs`: v1 (three slats) 6 shots and the boss lived with 75 hp; v2 (two slats) stands still, 90% collapse, solver wins in 5 shots. Screenshot `docs/handoff/shots/concept_boss_v2.png`. Not wired into the campaign.

## Round 4 (same 24 levels after the big-heavy fixes): 22/24
- Pass 22/24. Failures: `frost_tower_s2` (solved in 1 shot: the whole crystal frame falls on everything) and `sky_bomber_relay_s1` (6 shots: an ogre plus the chain).
- Reading the sheet: every level reads well (frames, post-and-beam, hanging slab, bomber satellites); the screens appear only where there is flat ground; flyers keep clear of the structures.
- Fixes for round 5: at difficulty 3 the tower always gets its separate satellite spire (a second structure means a second shot); in the bomber relay an ogre-class heavy only appears at difficulty 3, otherwise the supporter stands in its place.

## Round 5 (frost, ember, sky; tower and bomber relay; seeds 1 to 3; difficulty 3): 15/18
- Failures: `frost_tower_s2` still solved in 1 shot (the tower is too wide for the right-hand satellite, so the whole level is one frame), `ember_tower_s3` (two imps dead at spawn although both were clear of every block: they were 38 px apart and each sways 22 px, so they hit each other), `sky_bomber_relay_s1` (6 shots: the ogre allowed at difficulty 3).
- Fixes: flyers keep 56 px between them; a wide tower gets a small satellite on the left flat edge (x 166 to 184) at difficulty 3; the bomber relay never uses an ogre-class heavy.

## Round 6 (frost, ember, sky; tower and bomber relay; seeds 1 to 3; difficulty 3)
- First pass: bomber relay 9/9, but **every tower failed to generate**: the left satellite spire overlapped the tower (the pillar widths are random up to 12 px), and the stability check treated every block above the spire's floor as load, including the tower's upper tiers. Mistake in my own status: I reported "all nine generate" without reading the output of the check. Fixed by checking each touching group of blocks on its own (`clusters()` in `level_gen.py`) and moving the tower right.
- Second pass (towers only): 5/9. Failures: the satellite spire's two posts lean at spawn on frost seed 3, sky seeds 2 and 3 (the left post stood on the plateau's slope edge at x 160 to 172); `ember_tower_s3` collapses only 20% and is not won in 6 shots (thick iron and stone frame).
- Fixes: tower moves to x 212 and the spire stands at x 174 and 192, away from the slope edge. A bad seed like `ember_tower_s3` is not a generator bug: the intended use is "generate several seeds, keep the ones that pass the gate", which `tools/level_review.mjs` already does.

## Round 7 (fresh seeds 4 and 5, all four archetypes, three realms): 22/24
- Not tuned against these seeds. Failures: `frost_tower_s5` (one block of the satellite spire moved at spawn), `ember_tower_s4` (collapse 20%, not won in 6 shots).
- Cause of the ember failures across rounds 6 and 7 (`ember_tower_s3`, `s4`): iron posts on the ground tier made the frame too hard to topple. Fix: ember towers use stone feet. Re-test on ember seeds 3, 4 and 5 (round 8): 3/3 pass (5, 2 and 2 shots, collapse 100%).

## Summary
| Round | Levels | Pass | Main finding |
|---|---|---|---|
| 1 | 12 | 8 | tower too narrow for ogres; test used a one-weapon loadout |
| 2 | 24 | 4 | flyers dying at spawn, screen on the slope, frame on the slope |
| 3 | 24 | 18 | two ogres in one structure too hard; hanging weight too easy |
| 4 | 24 | 22 | frost tower one-shot; ogre on the bomber chain |
| 5 | 18 | 15 | flyers colliding with each other |
| 6 | 18 (9 + 9) | 9 + 5 | stability check counted other structures as load; satellite on the slope edge |
| 7 | 24 (fresh seeds) | 22 | iron feet on ember towers |
| 8 | 3 | 3 | after the ember fix |

## How to use it
1. `python scripts/level_gen.py --realm frost --archetype balanced_beam --seed 7 --difficulty 3 --out scripts/generated_levels/x.json`
2. Gate and screenshot: `node tools/gate_file.mjs scripts/generated_levels/x.json shot.png 2 5` (needs the dev server), or run a batch with `node tools/level_review.mjs <round> <realms> <archetypes|all> <seeds> <difficulty or arch:d,...>`.
3. Look at the screenshot (the solver cannot tell if a level is fun), keep the passing ones you like, and copy the JSON into `game/public/data/levels/level_NN.json` with the right `id`, `realm`, `scoreTarget` (about 85% of the solver's score) and, if it has a chest, the chest entry. Add the level number to `config.json` `levels`, a realm row and a band in `scripts/balance_bands.json`. Not done for any generated level yet: the campaign is unchanged.
4. Known limits: five layout types only (tower, balanced beam, hanging weight, bomber relay, plus the hand-written boss concept in `scripts/concepts/`), no pits or ramps, no chests, no runners, no bosses. About 90% of seeds pass the gate; the rest are simply skipped.
