# Handoff log

Newest at the top. Use the template in `docs/blueprint/WORKFLOW.md`. Don't edit old entries; add a new one.

## 2026-10-21 · cloud · Blueprint added
- **What:**
  - `AGENTS.md` (root entry point) and `docs/blueprint/{ARCHITECTURE,DATA,STAGES,RECIPES,WORKFLOW}.md`.
  - JSON Schemas in `game/schemas/` for content, level, config and save.
  - `game/scripts/check-data.mjs`, a no-dependency validator with cross-reference checks, wired into `npm run check`, `npm run check:data` and `npm run build`.
  - The Four Realms item catalogue copied into `catalogue/`.
  - This board and log.
- **Removed:** `docs/monster_mash/content.json`. `game/public/data/content.json` is now the only copy (they had drifted: the game copy has `tuning`).
- **Superseded:** `docs/monster_mash/03_stage_prompts.md`, replaced by `docs/blueprint/STAGES.md`. Numbered `0x_` reply files are replaced by this log.
- **Checks:** `npm run check` and `npm run build` pass on `ce5f90e` plus this change. `check-data` prints 0 errors and 13 warnings, which are expected (no config.json yet, `level.weapon` deprecated, levels 2-12 missing). A negative test with injected typos and bad references catches all 7.
- **For the next agent:** start with **S2-01** (split GameScene, about 800 lines, with no behaviour change), then S2-02 and S2-03. Everything else builds on that layout. The local session's notes in `07_local_reply.md` still apply: tweens are wall-clock, so scripted tests must skip the intro pan.
- **Questions for owner:** see "Waiting on owner" in STATUS.md.
