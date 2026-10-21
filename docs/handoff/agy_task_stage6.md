# Task: fix the Torc nerf, add a regression suite, tighten daily variety

Follow `docs/handoff/AGY_BRIEF.md`. Write the LOG.md entry FIRST (draft, then update), seal at the end.

1. **Torc.** `r_stormcaller_torc` `mult` was cut to 0.3 only to stop the L12 iron-roof collapse (989 dmg) one-shotting the boss. Restore the torc to its design value (git history / `content.json` before commit aebf025) and instead fix L12: lower the roof mass or add boss `maxHitDamage` cap (data-driven, in the boss params) so no single event removes more than about 40% of boss HP. Re-verify L12 at 3-4 shots with no artifact and with every artifact incl. torc, and torc still useful on other levels.
2. **Regression suite.** Add `tools/regress.mjs` plus `npm run regress` in `game/package.json`: headless Chrome via the existing CDP helpers; for each level 1-12 run the greedy solver, assert win, shots within the per-level band recorded in a new `game/scripts/balance_bands.json` (L1-3: 2, L4-12: 3-4/5 max), 0 one-shot wins, 0 console errors; assert the 30-day daily check and the v1 save migration. Exit non-zero on failure. Document in WORKFLOW.md.
3. **Daily variety.** In `content/levelKinds/daily.ts` make sure the 30-day check also asserts no two consecutive days share the same fort archetype and monster mix; fix the generator if they do.
4. `npm run check`, `npm run build`, `npm run regress`, `node tools/merkle.mjs seal`. No commit or deploy.
