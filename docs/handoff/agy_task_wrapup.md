# Task: wrap-up fixes, agy-share tracker, phone-readiness pass

Follow `docs/handoff/AGY_BRIEF.md`.

1. **Mindflash mismatch.** `content.json` consumable `c_mindflash` params say `steps: 60`; an earlier verification claimed 240. Read `content/consumables/index.ts`, decide which is intended from `docs/monster_mash/02_master_brief.md` and the item's description text, make data, code and description agree (data owns the number), re-verify with `window.__mm`, log the outcome.
2. **Loadout label.** In `scenes/LoadoutScene.ts` the "Artifact:" label touches the first artifact icon. Add a gap (or shorten the label) without moving other rows; re-take `docs/handoff/shots/03_loadout.png`.
3. **Agy-share tracker.** Add `tools/agy_share.mjs`: from `git log --no-merges --numstat`, excluding MERKLE.*, images, lock files and `docs/handoff/shots`, sum added lines for commits whose subject contains `via agy` or starts with `tools:` and `agy:`, versus all others; print the percentage and per-commit table. Add `npm run agy:share` in `game/package.json`. Document in `architecture/WORKFLOW.md` (new rule: Claude plans and reviews; all feature code, level content, data and docs go through agy with a brief in `docs/handoff/agy_task_*.md`; commit subjects of agy work end in `via agy`; target 70-80% of added lines going forward) and add the same rule as one line to `AGENTS.md`.
4. **Phone-readiness pass.** Using the headless Chrome tooling you wrote (`tools/audit_shots.mjs`), play levels 1-12 with the solver at 432x768 and fail on any console error or any frame time over 25 ms median on L12; run the v1 save-fixture migration; run `npm run check` and `npm run build`. Report in LOG.md. Fix anything found.
5. `node tools/merkle.mjs seal`. Do not commit or deploy.
