# Task: make the domino chain actually chain

Follow-up to `agy_task_domino_balance_wands.md` item 1 (stand resistance, already implemented: `physics.stand` in the
data, the restoring torque in the battle loop and the builder's Test physics). **Do not run the game, a dev server, a
browser or any tests; the owner tests.** Work in `game/`. Keep it deterministic.

## What happens now (measured by Claude)

A row of 5 wooden posts (8 x 64) standing 50 px apart on flat ground:
- a small knock on the first post: it rocks 2 degrees and settles back (good, keep this);
- a hard knock on the first post: it tips to about 51 degrees and **leans on the second post, which stays upright**
  (tilted 5 degrees) because its stand resistance holds the weight of the first. The chain stops after one piece.

## Wanted

A falling piece passes the fall on, like real dominoes:
- When a piece whose stand resistance is already off (it has tipped past `tipAngleDeg`, i.e. it is falling or has
  fallen) **touches** a piece that is still standing, the standing piece's resistance switches off for good as well (it
  is being pushed by a falling neighbour). Detect it from the collision pairs (the same place the battle already reads
  contacts, `src/battle/damage.ts` `onCollide`, or a dedicated collision listener for blocks), for blocks only, and do
  the same in the builder's Test physics so Test matches Play.
- A projectile, a blast or a monster hitting a standing piece keeps today's rule (resistance switches off only once
  the tilt passes `tipAngleDeg`), so single light knocks are still resisted.
- Result to aim for: the hard knock above topples all 5 posts in order; the small knock still leaves all 5 standing;
  forts that stand at level start still stand (nothing is falling at the start, so nothing changes there).

## Report

List the files you changed.
