# Task: L10/L12 retune and a since-goal agy share metric

Follow `docs/handoff/AGY_BRIEF.md`.

1. **L10.** With `r_gale_eye` and with no artifact, greedy solver must win L10 in 4 shots or fewer (it won in 5 before your last pass; now it does not win in 4). Re-measure with `tools/tune_boss.mjs`/`__mm`, adjust `scripts/build_levels.py` + data, regenerate.
2. **L12.** Currently 2 shots. Target 3-4 shots for the greedy solver with no artifact and with each artifact except Gambler's Charm (known solver weakness: confirm by checking its crit/coin logic does not break damage, fix if it does). Keep the visor 2x weak point rewarding. All numbers in data.
3. Set scoreTargets for L10 and L12 to about 70% of best sweep score. Log before/after in LOG.md.
4. **Tracker.** Extend `tools/agy_share.mjs` to also print the share since commit `3ce282c` (goal start) and add `--since <sha>`. Log the number.
5. `npm run check`, `npm run build`, `node tools/merkle.mjs seal`, then write the LOG.md entry BEFORE anything else you might run out of time on. No commit or deploy.
