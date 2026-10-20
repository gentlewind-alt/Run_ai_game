# Task: Stage 4 (Iron Keep, boss, Daily Mash)

Follow `docs/handoff/AGY_BRIEF.md`. Cards S4-01..S4-05 are in `architecture/STAGES.md`; follow their acceptance checks exactly. Claim each row in `docs/handoff/STATUS.md` as `doing | agy`, set to `review` when its checks pass.

Order: S4-01 Iron Keep levels 9-11 (new realm with its own `keep` background style already in `art/backgrounds.ts`; terrain and distances per the reach facts in the S3 balance notes in LOG.md; hard but fair, verified with `__mm.sweep` and `__mm.solveStep`, scoreTargets about 70% of best), then S4-02, S4-03, S4-04, S4-05. Follow `docs/monster_mash/08_design_direction.md` for every visual: no unstyled UI, use the Px kit, Mash32 palette, bevelled buttons.

Per card: implement through registries and data (RECIPES.md), add schema and DATA.md updates, run `npm run check` and `npm run build`, test in the browser with `window.__mm`, append a LOG.md entry, then `node tools/merkle.mjs seal`. Do not deploy, commit, or touch IAP/RUN Bits prices (owner approves; leave those as flagged TODO in LOG.md questions). Stop at any card that needs an owner decision and list it under "Questions for owner".
