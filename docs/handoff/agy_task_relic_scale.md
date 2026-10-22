# agy task: relic weapon scale, plus Goblin Hills playtest fixes

> **DONE 2026-10-22 by the cloud session** (the owner asked for the fixes to be made here, not through agy). See LOG.md. The text below is kept as the record of what was asked.

**From:** cloud playtest 2026-10-22, levels 1-4 played by hand in the real UI (headless Chromium, 844x390, `?mock=1`). Reference images: `docs/handoff/shots/review/relic_size_sheet.png` and `relic_card_overlap.png`.

## 1. Relic weapons are drawn about 3x too big (owner-reported, confirmed)

**What's wrong:** every relic sprite (`public/sprites/relics/*.png`) is 32x32. `src/battle/sling.ts` draws all of them at scale 1.5, so a relic is about **48 px** on the sling, in the queue and in flight. Normal weapons are 16x16 and drawn at 1.0 in flight (16 px) and 1.5 on the sling (24 px). A goblin is about 16 px, and a fort plank is 48-56 px.
- Comet Fists and Rolling Millstone are bigger than the slingshot, at about 3 goblins tall.
- The Steersong Arrow on the sling is as long as a fort floor.
- The physics radius stays 4-6 (about 10 px), so the picture is about 5x bigger than what actually collides. Hits look like they happen in empty space.

Also, `weaponPipScale` and `weaponSlingScale` contain `w >= 32 ? 1.5 : 1.5`: both branches are the same, and the literals break golden rule 1.

**Do:**
1. Add display sizes in world px to `public/data/config.json` (and `config.schema.json`):
   `"weaponDisplay": { "flightPx": 16, "slingPx": 24, "queuePx": 18, "relicBonus": 1.25 }`.
   Relics then show at about 20 px in flight, 30 px on the sling and 22 px in the queue: noticeably special, but in proportion.
2. Compute `scale = targetPx / sourceWidth` (for relics, `× relicBonus`) in one helper, `art/weaponScale.ts`. Use it in `sling.ts` (pip, sling, flight, twin shot) and anywhere else a weapon texture is drawn in the world, for example `projectiles.ts` when `o.texture` is set.
3. Allow an optional per-weapon override `display: { px?: number }` in the weapon row and in `content.schema.json`, for long items like arrows and spears that may need to be longer than they are wide.
4. Keep the hitbox matched: check each relic's `physics.radius` against its new drawn size (roughly radius ≈ 0.3 × drawn px). Adjust where needed, then re-run `regress:quick`. If changing a radius moves a balance band, fix the band through the data, not by changing the drawn size back.
5. **Relic Found card** (`relic_card_overlap.png`): the sprite overlaps the "RELIC FOUND!" title and the weapon name, and the description is cut off at "Tap again be". Fit the sprite inside a fixed box between the title and the name, and wrap the description inside the card. Use the same fit-to-box for shop and loadout icons.

**Done when:** the contact sheet re-shot after the change (same 8 weapons on level 1) shows relics no taller than 2 goblins on the sling. `regress:quick` is green. The Relic Found card shows no overlapping or clipped text.

## 2. Level 4 (Hill fort) is too hard for a person because of the runners

**What happens:** 4 attempts by hand, all lost to "Runners escaped". The two skeleton runners start behind the fort on the hill (x 312 and 330) and walk to an exit at x 580, which is outside the home camera view. They escape about 6 s after the level starts. A full-power shot only just clears the fort, and after each shot the camera returns to the sling, so the runners disappear off-screen before the second shot. The regress solver wins in 3 shots because it aims perfectly. A player doesn't.

**Fix options (pick one, then re-tune):**
- Runners start moving on the player's **first shot**, not at level start (a `startOn: "firstShot"` level flag).
- Raise the delay (`0.8`/`1.2` to about 4-5 s) and slow them (`0.8`/`0.7` to about 0.5).
- Keep the exit door inside the home view, or pan the camera to the runners while they move.
- `escapeLimit` stays 1, but the HUD reads "Escaped 0 of 1", which looks like a counter of 1. Make it "Runners out: 0 / max 1".

## 3. Smaller UI bugs seen while playing levels 1-4

- **Level 4 loadout screen:** it shows six Blades and "Tap weapons to fill slots", but the level uses its fixed `loadout` (Blade, Cleaver, Staff, Scattergun, Blade). Show the fixed loadout, locked, with a line like "This level uses a set loadout".
- **Loadout description overlap:** a two-line weapon description overlaps the ability line ("Red-fletched projectile flying point-first" runs into "Arms explosive tip..."). Lay them out from measured text height.
- **Results:** the "Level rank #N" line is half covered by the Next level and Retry buttons. This was also logged earlier and is still present.

## Notes from the run (for context, no action)

- L1: won with 3 stars in 2-3 shots. L2: won with 2 stars (1425 of 1600). L3: won with 3 stars in 2 shots, and the chest gave the Steersong Arrow. L4: 0 for 4 (runners).
- No console errors in any of these scenes.
