# Task: visual polish of the batch A relic weapons (they work; they do not yet look like the approved designs)

Follow `docs/handoff/AGY_BRIEF.md`. Log entry first. The owner's bar is the three reference images in `docs/handoff/ref/` and the approved designs in `docs/handoff/relic_art_reference.js`: detailed, readable, big, with strong effects. Use `regress:quick` as the loop and the full `regress` once at the end. Delete any scratch folders you create (no `brain/`, `tmp_diag_chrome/`, one-off test scripts) before finishing.

Findings from Claude's review of your screenshots in `docs/handoff/shots/weapons/`:
1. **In-battle sprites are too small.** The Skyforge Maul on the field is about 16 px, the size of a goblin, so the knot plate, hatched end caps and rope handle do not read. The fist in flight is a small green blob. Fix: draw every relic weapon's in-flight sprite at its true 32x32 hero size (physics radius stays the same, only the visual changes), also the loaded-on-sling sprite and queue pips at 24 px or more. The Maul, Fists and Disc in flight should read at 480x270 shown at 2x.
2. **Effects are faint or missing from the captures.** Lightning was not visible; the quake rings were pale. Make each effect big, saturated, and held at peak for at least 24 steps:
   - Maul: full-height bolt 3 px wide with a white core and cyan halo, 6-frame white screen flash, a visible electric field (radius ring plus crackling arcs) for the full 3 s, thunder, shake.
   - Comet Fists: three thick expanding ground rings, visible ground crack lines, rubble and dust for about 40 steps, blocks visibly hopping, monsters visibly knocked flat.
   - Disc: dithered ghost trail, a 12-16 px ping star at every bounce, bounce counter pips.
   - Arrow: blast ring at radius 38 with orange/yellow/white flame frames and smoke for 30 steps; the split-tip arrows clearly visible as three fanned arrows.
   - Shooters: 2 px strand with a white outline, 24 px splat, slowed monsters tinted.
   - Palms: three 3 px bolts with white cores, a cyan muzzle flash at the palm and a visible recoil.
3. **Three icons do not read as the object.** Steersong Arrow looks like a magic wand (no fletching visible); Silkline Shooters looks like a blaster; the Bulwark Disc crown reads as a face. Draw dedicated 24x24 card icons (not a downscale) where needed: the arrow must show red fletching, a diagonal shaft, a grey head and an orange bulb; the shooters must show a strapped wrist bracer with web spokes; the disc emblem must not read as a face (flat 3-point crown on a plain gold centre, or a rune/chevron).
4. **The contact sheet was text cards.** `docs/handoff/shots/weapons/sheet.png` must contain the real hero sprites at 4x and REAL captured action frames (not text boxes). Fix `tools/weapon_shots.mjs` to capture each effect at its peak step (poll the battle state, capture on the effect step, crop around the action, 2x) and recapture until each frame clearly shows its effect; review every capture yourself.
5. **Side-by-side with the references.** Produce `docs/handoff/shots/weapons/compare.png`: each of our hero sprites at 4x beside the matching reference (hammer sheet, fist, reactor) and iterate until our tone count, highlight and detail level is comparable (not copied). More tones and texture on the maul head, rope and fist knuckles; sharper emblem on the reactor core.

Done means: `npm run check`, `npm run build`, `npm run regress:quick` pass and the full `npm run regress` passes once; the sheet and compare images are real; `node tools/merkle.mjs seal`. No commit or deploy.
