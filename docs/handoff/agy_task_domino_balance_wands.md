# Task: domino physics with stand resistance, Iron Keep balance, shooters hold a wand

Owner's request: "domino effect on horizontal blocks and plank but not as they just fall easily (put some resistance to
their stand mechanism), revise weapon damage and enemy HP from iron keep realm, give a small wand to enemy shooter so
that when they roll on impact their wand direction change changing the shot trajectory with it, like by standing if
they are targeting us then on lay down position their weapon may face upwards based on how they hold it."
**Do not run the game, a dev server, a browser or any tests; the owner tests.** Work in `game/`. Keep the code style;
every number in a data file with a schema entry. Everything deterministic (fixed steps, no `Math.random` in gameplay,
use `ctx.rng` / `b.rng`), so the Arena verifier still replays turns exactly.

## 1. Dominoes: blocks and planks topple in a chain, but do not fall over easily

Today a standing plank or block tips over from a light nudge, and a row of them does not reliably chain.

Wanted: a **standing** piece (a block or plank taller than it is wide, standing upright) resists small knocks, like it
has a firm footing; once it is pushed past a tipping angle it falls freely and its weight knocks the next standing
piece over, so a row of standing planks falls like dominoes.

How (in the battle world: `src/battle/world.ts` where blocks are created, the per-step loop in `src/battle/loop.ts`,
and the builder's Test physics in `src/scenes/BuilderScene.ts` / `src/builder/physics.ts` so Test matches Play):
- A piece counts as standing when its height / width ratio is at least `standAspect` and its angle is within
  `tipAngleDeg` of upright (0 or 180 degrees), and it rests on something (low velocity is fine to approximate).
- While standing: each step apply a restoring torque toward upright proportional to the tilt (`restoreTorque` times
  mass times tilt), and damp its angular velocity a little (`standDamping`). This is the "resistance": small knocks
  wobble it and it settles back.
- Once its tilt passes `tipAngleDeg` (a hard hit, a blast, or another piece falling on it), the resistance switches off
  for that piece for good (it is falling) and normal physics takes over, so it falls and passes the push on.
- Also raise the static friction of standing pieces on what they stand on (`standFrictionStatic`) so they do not slide
  out instead of tipping.
- Data: a new `physics.stand` block in `public/data/content.json` `tuning` (or `config.json` `physics`, whichever fits
  how block physics is configured today), with `standAspect` (about 1.8), `tipAngleDeg` (about 14), `restoreTorque`,
  `standDamping` and `standFrictionStatic`, plus schema entries. Pick values so a fort that stands today still stands
  (no piece falls by itself at level start) and a single good hit on the first of a row of 5 standing planks spaced a
  little less than their height apart topples all 5.
- Levels must still settle at load exactly as before (builder `settle` and level load are unaffected).

## 2. Iron Keep balance (realm 3, levels 9 to 12)

Iron Keep jumps from realm 2's 15-40 HP enemies (Matron boss 120) to Orc Brute 120, Troll 160 and the Iron Warlord
340, while the weapons a player has by then hit for 11-35 (level 12 even forces a commons loadout). Change in
`public/data/content.json`:
- monster `hp`: `orc_brute` 120 -> 90, `troll` 160 -> 120, `iron_warlord` 340 -> 260.
- weapon `baseDamage`: `w_ashwood_staff` 11 -> 13, `w_horned_scepter` 11.7 -> 14, `w_hunters_boomerang` 15 -> 18,
  `w_hunters_pike` 19.1 -> 22.
Nothing else. (These monsters and weapons appear in later realms too; that is accepted.)

## 3. Enemy shooters hold a wand that turns with their body

Enemy shooters (every monster that fires enemy shots via `spawnEnemyAttack`: `src/content/monsters/archer.ts`,
`frostGiant.ts`, and any other caller; see `src/battle/enemyAttacks.ts`) today aim along a fixed direction chosen at
spawn (`m.aim`), regardless of how they lie.

Wanted:
- Each shooter visibly **holds a small wand**: a short stick (about 10-12 px, dark wood with a glowing tip in the
  monster's attack colour), drawn procedurally, attached at the monster's hand (an offset from its centre in the
  monster's own frame, slightly in front and above centre on the side facing the sling), rotating and moving with the
  monster's body every frame. Depth just above the monster sprite. Removed when the monster dies.
- When it spawns standing, the wand points at the player's sling (the direction it aims today).
- The wand is fixed in the monster's grip: if the monster is knocked over and rolls, the wand turns with it. Its world
  direction = spawn aim angle + (body angle now - body angle at spawn). Standing it aims at us; lying on its back the
  same grip points the wand upward, so it would shoot up into the air; upside down it shoots back toward its own fort
  (and can hit other monsters, as enemy shots already can).
- Shots leave from the **wand tip** along the wand's current direction (pass this direction as the existing `aim` option
  of `spawnEnemyAttack`, and the tip as the start position). Speed and damage unchanged.
- Numbers (wand length, hand offset, tip colour per monster or one default) in the monster data or `config.json`, with
  schema entries.
- Keep it deterministic and the Arena verifier happy (drawing code only in the visual path; the aim math uses body
  state only).

## Report

List the files you changed and the new data values.
