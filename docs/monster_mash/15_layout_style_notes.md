# Layout style notes from two Angry Birds screenshots

Source images (owner's references, not stored in the repo): a modern Angry Birds Friends level and a classic Angry Birds level.

## What both levels do
1. **The sling stands on a raised shoulder of terrain** on the far left; the whole level is read left to right.
2. **Terrain is a structure.** A pit between the sling and the target, a steep ramp up to a high shelf, an arch or hook of dirt overhead. Our level format already has terrain polylines; the generator only uses one flat plateau.
3. **Three heights, three distances.** A low cluster near the sling, a middle structure, and a tall or high one far away. No two structures share a height.
4. **Tall thin sticks** (1 block wide, 5 to 8 times as tall) carrying a lone target on top; they fall with one hit.
5. **Crates and low blocks on the floor of the pit**, heavy things (boulders) parked high so one hit sends them down onto a target.
6. **Hanging or floating platforms** with a target on them, not touching the ground.
7. **Many small targets spread over every height**, not a few large ones in one place.

## What we have, what we lack
- Have: separate structures (satellites), a balanced beam on a post, a hanging weight, tall frames.
- Lack: pits and ramps in generated levels, floating platforms, a tall single stick, low crate rows, a raised sling mound (our sling is fixed at x 56, y 262).

## Prototype
`game/scripts/concepts/ridge_and_valley.py`: Ridge and Valley (Ember Forge). Terrain: plateau, pit, steep ramp, high shelf. A two-tier fort on the plateau with an orc brute beside it, a tall wood stick with an archer on top and a crate in the pit, a balanced beam with an archer and a hexer on the high shelf, two lava imps above. Tested with `tools/gate_file.mjs`: stands still, 73% of blocks move or break from the best shot, solver wins in 2 shots. Screenshot `docs/handoff/shots/concept_ridge_v1.png`. Not wired into the campaign.

## Next for the generator
Add a `ridge` archetype: random pit width and ramp height, a stick in the pit, crates, a high-shelf beam; and a floating-platform piece (needs a block that does not fall: not supported by the current physics, so it would be a thin platform on two tall posts).

## Citadel Ridge, the grand version (`game/scripts/concepts/citadel_ridge.py`)
Ridge and Valley was too simple (two shots), so this one stacks everything at once: a three-tier fort on the plateau with a balanced beam and two shooters on its roof (near, low), a floating platform on two tall posts over a crate stack in the pit (middle, high), and a two-tier tower with a heavy block on the high shelf (far, highest). 23 blocks, 12 monsters (orc brute, archers, hexers, three lava imps overhead). Tested: stands still, 48% of blocks move or break from the best shot, solver wins in 4 shots. Screenshot `docs/handoff/shots/concept_citadel_v3.png`.
Lessons from building it: tall 6 px posts topple (use 8 px and at most 64 px); a tower must stand well inside a flat shelf: a post near the foot of a steep rise or the end of a steep ramp slides off within a second (first versions had 11 to 14 blocks drifting at spawn).

## Bastion Ridge, the big and tough version (`game/scripts/concepts/bastion_ridge.py`)
Asked for "bigger, thicker, tougher" and "more distance between the sling and the structures". A pit in front of the sling (x 110 to 168) and a long plateau starting at x 184, so the bastion's left wall stands at x 198 instead of x 152 (the gap from the sling grew from about 100 px to about 140 px). Four tiers of 12 px posts (stone below, stone and wood above, wood on the top tier), 94 px floors, three battlements and two iron lintels on the roof, a brute and a hexer on the ground, shooters on every floor, a thick iron post (14 x 46) carrying a stone platform with two more targets, three imps overhead. 23 blocks, 13 monsters. Gate: stands still, 74% of blocks move or break from the best shot, solver wins in 5 shots.
What went wrong on the way (each is a rule for the generator): two heavies in one bay (brute 22 plus troll 24 in a 26 px gap) made the whole upper stack creep 3 px left within five seconds, so bays are 30 px or wider; an all-stone-and-iron version was not solvable in 6 shots (13 to 16 monsters behind 120 to 250 hp posts), so the upper tiers use wood floors and a wood top tier; a heavy block on a one-post platform tilts it (no off-centre weights on a single post).
