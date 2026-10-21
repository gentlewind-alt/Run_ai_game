# Task x4: score leaderboards

Follow `docs/handoff/AGY_BRIEF.md`. Log entry first. Design source: `docs/monster_mash/09_expansion_design.md` section 6. `regress:quick` is the loop, the full `regress` once at the end. Only `src/platform/` talks to the RUN SDK; everything else uses the platform adapter (mock for local dev). The leaderboard config is already at `game/rundot/leaderboard.config.json` (do NOT upload it or change `requiresToken`; those are owner decisions).

1. **Boards**: `daily` (exists), `level_<n>` (best score per level, all-time) and `overall` (sum of each level's best score). Extend `platform.leaderboard` (`submit(board, score)`, `top(board, n)`, `myRank(board)`) in both `mock.ts` and `rundot.ts`; the mock keeps scores in memory plus a few believable fake rows so the UI can be tested.
2. **Submit** on every win with the level's best score only (compare with `profile.best[level]`), and recompute `overall` from the profile when a best improves. Never block or throw into the game loop: catch errors, show a quiet "Scores unavailable" line.
3. **Results panel**: after a win show your rank and the top 5 for that level (name, score), your row highlighted, fitting 480x270 beside the stars and coins without overlap; Daily keeps its top 10.
4. **Map**: a Leaderboards button opens a screen with three tabs (Daily, This level, Overall), 10 rows each, your own row highlighted and scrolled into view, names truncated cleanly, designed to the style of the Shop and Loadout (`docs/monster_mash/08_design_direction.md`), a Back button, no overlaps at 480x270 or at any viewport. Refresh button with a short cooldown.
5. **Tests**: regress assertions with the mock for submit-best-only, overall recompute, rank display, tabs, and failure handling (mock throws). Screenshots of Results (win with ranks) and the Leaderboards screen (all tabs) into `docs/handoff/shots/leaderboards/`.
6. **Docs**: `architecture/ARCHITECTURE.md` platform adapter section, `architecture/DATA.md` board names, `docs/handoff/LOG.md` owner question about `requiresToken` stays open.

Done means: `npm run check`, `npm run build`, `npm run regress:quick` and the full `npm run regress` pass; `node tools/merkle.mjs seal`; append `DONE agy_task_x4_leaderboards` to `docs/handoff/agy_done.txt`. No commit or deploy.
