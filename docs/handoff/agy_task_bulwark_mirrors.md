# Task: Bulwark Disc ricochets like light between two vertical mirrors

Owner: "I want Bulwark Disc to ricochet like a light trapped between two vertically parallel mirrors, up to 6 max
bounces only." **Do not run the game, a dev server, a browser or any tests; the owner tests.** Work in `game/`. Keep
the code style; every number in the weapon's `params` in `public/data/content.json`.

## Today

`src/content/weapons/bulwarkDisc.ts`: after each real knock the disc lobs toward the next monster in range and homes
in on it (`ricochet`, `home`, `ricochetGravity`, `ricochetLift`, `homingTurn`...), up to `maxBounces` (6); the sixth
bounce plays the shield-blast set piece (dome, shards, flash). Its physics: gravity 0.9, restitution 0.6.

## New behaviour

1. **Launch** is unchanged (it flies the normal arc with its normal physics until its first real knock).
2. **First real knock** (same test as today: relative speed at least `minBounceSpeed`, counts as bounce 1): the disc
   enters "light mode" and two **mirrors** appear: vertical lines from the ground up to the top of the screen at
   `x = hitX - mirrorSpan / 2` and `x = hitX + mirrorSpan / 2` (new param `mirrorSpan`, about 140 px), so the fort it hit
   sits between them. Clamp both inside the level's world width.
3. **Light mode** (until the end of the shot):
   - no gravity, no air friction; the disc moves in straight lines at a constant speed (new param `lightSpeed`, about
     7 px/step). Its first light-mode direction: horizontal component reversed from its velocity at the first knock,
     vertical component kept, then normalised to `lightSpeed` (if the result is almost flat or almost vertical, clamp the
     angle to between 20 and 60 degrees from horizontal so it zigzags visibly).
   - **reflection like a mirror:** reaching a mirror line reverses the horizontal velocity and keeps the vertical one;
     hitting a monster or a block reflects it the same way (horizontal reversed) unless the contact is clearly on the
     top or bottom of the thing, then the vertical component reverses instead; the ground and the top of the screen
     reverse the vertical component. Speed never changes.
   - **every reflection counts as one bounce** (mirror, monster, block, ground or top), with the existing
     `bounceGapSteps` guard so one contact is never counted twice. Hard cap: **6 bounces in total** (`maxBounces`).
   - each bounce keeps today's bounce feedback (ping sound, sparks, rune ring) and the mirror it hit flashes.
   - the disc still does its normal impact damage to monsters and blocks it touches; keep today's per-bounce softening
     (`ricochetFalloff`) so a 6-bounce run is not stronger than before.
   - set the velocity after the physics step (in `onUpdate`, as today's ricochet does), never inside the collision
     callback, so the solver does not cancel it. Use step counters only (deterministic for the Arena verifier).
4. **Bounce 6** plays the existing shield-blast set piece at the disc's position, the mirrors fade out, and the shot
   ends (`ctx.endProj`). If the shot otherwise times out or leaves the world before 6, the mirrors fade out too.
5. **Remove** the old lob and homing logic (`ricochet`, `home`, `homingDelay`, `homingSteps`, `homingTurn`,
   `ricochetGravity`, `ricochetLift`, `ricochetJumps`, `ricochetRange`, `ricochetSpeed`) and their params, and the faint
   homing aim line in `drawFx`. Keep the trail and bounce-counter pips.
6. **Tap ability** stays: it aims the disc at the nearest monster (before or during light mode; in light mode it keeps
   `lightSpeed`).
7. **Mirrors look:** two thin glowing vertical lines (light cyan core, soft blue glow, a few rune marks along them, gently
   pulsing), drawn in `drawFx` or as a small actor, behind the disc.
8. **Texts in `content.json`:** `launch`: "Concentric rune shield. On its first hit two light mirrors appear and it
   zigzags between them like a beam of light." `tap`: "Aims at the nearest monster. The sixth bounce rings out as a
   shield blast."

## Report

List the files you changed and the new params with their values.
