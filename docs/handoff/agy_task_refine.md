# Task: code-quality review and refinement of agy's code (no behaviour change)

Follow `docs/handoff/AGY_BRIEF.md`. Log entry first. The owner asked Claude to review agy's code and have it refined. Do NOT touch the Retry-on-loss bug or the Steersong Arrow stub: those are tracked separately. Use `regress:quick` as your loop, one run at a time, and the full `regress` once at the end.

Claude's static review found these. Fix them, then do your own full review pass of all code added since commit 3ce282c (`git diff 3ce282c --stat`), looking for the same classes of problem:

1. Golden rule 2 violations (id-specific branches): `src/art/textures.ts:606` (`if (id === 'w_militia_blade')`), `src/scenes/ShopScene.ts:189` (`sk.id === 's_gold_quiver' || sk.id === 'gold_quiver'`), `src/scenes/TitleScene.ts:71` (`m.id === 'imp'`). Move each to data (an `art`, `flying` or `slot` field on the content row, with schema and validator updated) or to a registry entry.
2. Golden rule 1: numeric balance or feel literals in `src/` that belong in data. Grep scenes and battle for costs, thresholds, counts and gameplay-driving durations (relic market price, boss stomp interval, chest HP, the pity count of 3). Layout coordinates in scenes are fine only if derived from `W`/`H`; replace pixel literals that assume a 480x270 field with derived anchors where it is cheap.
3. Event and listener hygiene: scene restarts and `goTo` transitions must not leak listeners (keyboard handlers in `BattleScene.create`, `platform.lifecycle.onPause`, window resize listeners in `core/responsive.ts`, `events` bus subscriptions, `this.input.keyboard.on` in every create). Each must be registered once or removed on `shutdown`. Add a regress assertion: enter and leave Battle 5 times via Retry, Next and Map; listener counts must not grow and there must be no duplicate pause menus or toasts.
4. Dead and duplicated code: unused exports, helper copies (text-fitting, card layouts across Loadout and Shop, `shortWeaponName` duplicates), commented-out code, leftover debug helpers in `src/` (keep `debug/testHook.ts`). Remove or merge them; keep the public test hook API stable.
5. Large files: `art/textures.ts` (622 lines), `scenes/ShopScene.ts`, `core/profile.ts`, `battle/damage.ts`, `battle/sling.ts`. Split only where there is a clean seam (relic and economy functions out of `profile.ts`, per-realm art out of `textures.ts`). Do not churn.
6. Error handling at the boundaries only: save load of corrupt data, and platform adapter calls (ads, share, leaderboard, serverTime) must not throw into the game loop. Verify with the mock throwing.
7. Types: remove `any` and `as unknown as` casts introduced by agy where a proper type is easy.
8. Docs: `architecture/ARCHITECTURE.md` module list and event table must match the code now (landscape, relics, responsive). `architecture/DATA.md` must document `unlock`, `chests`, `ability.charges`, `rarity`, `stats.bossLosses`, `homeSlingFrac` and `homeMarginRight`.

Report in LOG.md a table: finding -> file -> fix -> how verified. Finish with `npm run check`, `npm run build`, `npm run regress` (full, once), `node tools/merkle.mjs seal`. No commit or deploy.
