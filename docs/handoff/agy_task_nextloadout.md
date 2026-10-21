# Task: Next level goes through the Loadout screen

Follow `docs/handoff/AGY_BRIEF.md`. Log entry first.

In `game/src/scenes/ResultsScene.ts` the Next button now calls `go('game', ...)`. Change it back to open the Loadout screen for the next level: `go('loadout', { level: next })`. Keep the `core/flow.ts goTo` fix (it must still stop the paused BattleScene so the battle that follows is fresh). Retry stays direct to the battle; Map stays Map.

Update the Bug 1 assertion in `tools/regress.mjs`: L1 win -> Next -> assert the Loadout scene is active and shows level 2 ("Level 2: ..." header) -> press Fling -> assert the battle is level 2 with fresh state reaching `ready`; repeat L2 -> L3. Check the Loadout header text and that the previously equipped weapons are preselected (do not reset the player's loadout).

Run `npm run check`, `npm run build`, `npm run regress`, `node tools/merkle.mjs seal`. No commit or deploy.
