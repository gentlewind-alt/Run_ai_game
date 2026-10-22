# X9 · Omnitrix Dial: the four-armed alien drop

Read `AGENTS.md` first. Work in `game/`. Owner request: replace the five falling forearms with **one giant four-armed alien that falls from the sky, slams down with an impact and an earthquake, deals splash damage, then bounces back up into the sky.**

## References
- Concept: `docs/concepts/weapons/w_omnitrix_dial.png` (falling alien, green shockwave rings, cracked ground, debris, alien leaping away).
- Sprite (already generated, do not generate another): `docs/handoff/shots/gen/omni_alien.png` (red four-armed brute, arms raised).
- Current code: `src/content/weapons/omnitrixDial.ts`, `src/art/omnitrixTextures.ts`, data row `w_omnitrix_dial` in `public/data/content.json`. Quake pattern to reuse: `src/content/weapons/cometFists.ts` (`onImpact`: `quakeRings`, block hop, monster knock and stun). Landing helper: `src/content/weapons/util.ts` `landingY`.

## 1. Sprite
Add `'omni_alien' = 'omni_alien.png'` to the `$arms` map in `tools/process_sprites.ps1` and run it (`powershell -NoProfile -File tools/process_sprites.ps1`); it writes `game/public/sprites/arms/omni_alien.png`. In the `w_omnitrix_dial` row set `"extraSprites": ["sprites/arms/omni_alien"]` (texture key `omni_alien`). Keep a fallback: if the texture is missing, draw the old `omni_arm_brute` hand-drawn texture scaled up (it is registered by `registerOmnitrixTextures`).

## 2. Behaviour (`omnitrixDial.ts`, rewrite `onAbility`)
Sequence, all timing in steps (60 Hz), all numbers from `p.def.params`:
1. **Tap**: green flash (`ctx.flash(0x38b764, 80)`), `sfx.omnitrix()`, dial sprite fades (alpha 0.4) and stops (velocity 0, gravity 0 via `ctx.setGravity`).
2. **Target**: x = nearest monster's x (`ctx.nearestMonsters`), else the projectile x + 60. Landing y = `landingY(ctx, x)`.
3. **Fall**: alien image (origin 0.5, 1; height `alienHeight` px; depth 12) starts at y = -alienHeight and falls at `fallSpeed` px/step with a few green and red motion sparks behind it.
4. **Impact** (once, when it reaches the landing y):
   - Splash: `ctx.blast(x, landY, splashRadius, splashMult, p.wid)` (hits monsters and blocks).
   - Earthquake (as Comet Fists): blocks within `quakeRangeX` along x hop (`vy = quakeHopVy`) and take `quakeMult` of base damage; monsters in range take the same, get `stun` for `stunSteps` and are knocked sideways (`knockX`, away from x) and laid flat.
   - Visuals: `ctx.fx.quakeRings(x, landY, quakeRangeX)`, three green rings (`C('6')`) of growing radius, debris sparks (`['6','5','k','m']`), `ctx.fx.shake(0.03)`, `ctx.hitStop(4)`, a squash of the alien image (scaleY to 0.8 and back, visual tween only), `sfx.quake()`.
5. **Bounce away**: after `holdSteps` on the ground the alien leaps up with `bounceSpeed` px/step, decelerating by `bounceGravity` per step but never below 2 px/step, slightly rotating, until it is above y = -alienHeight; then destroy it and `ctx.endProj(p)` exactly once.
6. The actor's `destroy()` must clean up the image if the battle ends mid-sequence.

New params (numbers only; replace all the old arm params in the data row): `alienHeight 64`, `fallSpeed 9`, `splashRadius 40`, `splashMult 1.4`, `quakeRangeX 110`, `quakeMult 0.35`, `quakeHopVy -4`, `stunSteps 60`, `knockX 3`, `holdSteps 18`, `bounceSpeed 9`, `bounceGravity 0.15`. Update `tap` to: "A giant four-armed alien crashes down: splash damage and an earthquake, then it leaps back into the sky." Keep `ability.charges = 1`, rarity, unlock and price.

## 3. Clean up
Remove code that only served the five arms (`makeArm`, `KINDS`, per-kind colours) and, if nothing else uses them, the five `omni_arm_*` hand-drawn textures except `omni_arm_brute` (kept as fallback). Leave the five generated arm PNGs on disk.

## Checks
1. `npm run check`, `npm run build`.
2. `bash tools/test_weapons.sh` (from repo root; dev server on 5212): `w_omnitrix_dial` must score > 0.
3. Screenshots with `tools/probe.mjs` on level 5 with a loadout of six `w_omnitrix_dial` (`fire({angleDeg:40,power:0.8,abilityAfterSteps:30})`): during the fall, at impact, and during the leap away (`docs/handoff/shots/x9/fall.png`, `impact.png`, `leap.png`). Look at them: one big alien, green rings, debris, alien leaving upward.
4. `npm run regress:quick` passes (relic check: 0 one-shot wins). If the Omnitrix causes a one-shot win, lower `splashMult` first, then `quakeMult`.
5. LOG.md entry, STATUS.md card X9 `review`. Commit `X9 Omnitrix alien drop via agy`. Do not push or deploy.

## Do not
Change any other weapon, level, monster or physics value; generate images; spend credits; touch `src/platform/`.
