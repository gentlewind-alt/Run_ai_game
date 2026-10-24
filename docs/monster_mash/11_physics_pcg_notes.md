# Physics PCG notes

Our 24 campaign levels are authored with `tower()`/`frame()` helpers; six boss forts stack frames. Daily Mash uses a UTC-date seed and weekday archetypes. `__mm.solveStep` tests 7 angles × 4 powers × 4 ability timings, then greedily keeps the shot leaving fewest monsters. A win confirms one tested sequence in this simulation; a miss does **not** prove unsolvability because the grid is sparse and the greedy choice can miss a non-greedy line. Neither proves human fairness.

| Thesis chapter | Idea | What we already do | What we could adopt | Cost | Risk |
|---|---|---|---|---|---|
| **2 — Stable structures** | Build rows from valid supports; reject overlaps and test global stability. | Tower/frame helpers; boss forts passed 300-step stillness and impact-collapse checks. | Generate bounded, seeded frame variants; require support geometry plus in-game stillness/collapse tests. | Low–medium. | Geometry misses engine settling and material effects. |
| **4 — Varied, stable, solvable levels** | Vary structures, terrain, materials and targets; use agents to estimate challenge and screen solvability. | 24 authored levels, varied terrain, solver bands and date-seeded Daily archetypes. | Generate opt-in candidates; gate on stability and solver band, then review by hand. | Medium–high. | Our greedy solver screens tested sequences only; it cannot establish solvability or balance. |
| **6 — Sketches to structures** | Convert rough orthogonal sketches into blocks, repairing the layout for support and stability. | Coordinates and helper calls; no sketch tool. | Defer; first expose existing templates as editable parameters. | High. | Snapping and repairs can change the intended silhouette. |
| **8 — Deceptive levels** | Use material choice, non-greedy shots, ability timing, rolling/falling objects, explosive chains and path clearing. | Weaknesses, timed abilities, rolling, bombs and Black Hole effects exist. | Author focused puzzles with existing content; compare solver results with human playtests. | Medium for authored puzzles; high to generate. | Deception is agent-specific; targeting our solver may frustrate players. |
| **9 — Adaptive difficulty** | Change generator parameters based on player performance. | Daily levels share a UTC-date seed and leaderboard challenge. | Prefer a date-seeded shared rotation or per-player hints; keep geometry shared. | Medium–high. | Personal geometry breaks daily comparability; weak skill estimates cause difficulty swings. |

## Recommended order around the 29 Oct freeze

1. **Before Wed 29 Oct:** build only Chapter 2’s bounded frame variants and simulation stability gate; keep output opt-in.
2. **Before freeze, if stable:** use Chapter 4’s solver band as a rejection signal, then review candidates by hand; it is not a solvability proof.
3. **At freeze:** lock gameplay content and defer new generation to post-jam work.
4. **After the jam:** try Chapter 8’s hand-authored patterns, revisit Chapter 9 with shared-daily fairness, and leave Chapter 6’s new authoring tool last.

**Source:** Matthew Stephenson, *Generation and Analysis of Content for Physics-Based Video Games* (PhD thesis, Australian National University, 2019), Chapters 2, 4, 6, 8 and 9.
