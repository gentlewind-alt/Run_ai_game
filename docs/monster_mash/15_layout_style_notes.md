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
