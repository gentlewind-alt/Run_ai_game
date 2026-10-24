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

## Task B — procedural fort candidates

`game/scripts/fort_gen.py` builds bottom-up frame forts from seeded rows of pillars and thin floors. Its static check rejects overlaps, unsupported blocks, and tiers whose upper mass falls outside the supporting pillar span. `generate_fort` tries the requested seed and the next 49. This check is a geometry filter; it cannot prove Matter.js stability, collapse, or solvability. `tools/gate_level.mjs` checks the actual game simulation for those three conditions.

The design follows Stephenson's thesis, Chapter 2: support blocks at both ends or through their centre of mass, and keep each tier's upper mass within its support span.

### Visual references

The attached p025 level uses separate structures and uneven terrain; that informed the opt-in satellite frame, which can sit on another flat terrain shelf. p044 and p060 show varied, layered generated frames; these informed the seeded tier offsets, differing pillar heights, and mixed materials. p052 illustrates the support tradeoff behind the centre-of-mass check, while p070–p072 show distinct generator layouts. p102 and p106–p108 show the deceptive-level archetypes and examples; this Task B generator borrows their compact construction vocabulary without adding deception mechanics. Candidate blocks use Monster Mash dimensions and materials rather than copying the pictures.

Generate six candidates without touching committed levels (run from `game/`):

```powershell
python scripts/build_levels.py --candidates --seed 101 --satellites
```

Change `--seed` to create another deterministic set. Candidate JSON files go to `game/scripts/generated/` and are git-ignored. To gate one candidate, temporarily copy it over its level file and restore the tracked file even if the gate fails:

```powershell
$level = 4
$path = "public/data/levels/level_{0:D2}.json" -f $level
$candidate = "scripts/generated/level_{0:D2}_candidate.json" -f $level
Copy-Item -LiteralPath $candidate -Destination $path -Force
try {
    node ../tools/gate_level.mjs $level
} finally {
    git checkout -- $path
}
```

Repeat with each seed and keep the first three candidates per boss level for which the gate exits 0. The gate requires 0 blocks moved and 0 monsters dead after 300 steps, at least 40% of blocks moved or broken by the best single shot, and a solver win within that level's shot band.

### Candidate gate results

The local environment could not start Vite: esbuild was denied access while resolving `game/vite.config.ts`. A gate attempt on the level 4 candidate also stalled in `tools/probe.mjs` before `Runtime.enable` returned. No headless gate result is claimed, so there are no passing-candidate rows yet. Run the command sequence above from an environment where Vite and the headless Chrome probe can complete.

| Boss level | Seed | Stand-still (moved/dead) | Collapse | Solver shots |
|---:|---:|---:|---:|---:|
| 4 | not run | not run | not run | not run |
| 8 | not run | not run | not run | not run |
| 12 | not run | not run | not run | not run |
| 16 | not run | not run | not run | not run |
| 20 | not run | not run | not run | not run |
| 24 | not run | not run | not run | not run |
