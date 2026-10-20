# Task: Stage 5 (polish) and a design audit

Follow `docs/handoff/AGY_BRIEF.md`. Cards S5-01..S5-06 are in `architecture/STAGES.md`; follow their acceptance checks. Claim each row in STATUS.md as `doing | agy`, set `review` when done.

1. **Design audit first.** Run the dev server (`npx vite`), drive every scene at 216x384 portrait scaled to 432x768 (Title, Map, Loadout, Shop all four tabs, Battle with HUD tray and pause menu, Results win and lose, Daily card, boss level). Take screenshots to `docs/handoff/shots/` and compare each against `docs/monster_mash/08_design_direction.md`. Fix every clipped text, overlap, tiny touch target (< 24 CSS px at 432 wide), unreadable contrast, and any unstyled element. Note each fix in LOG.md.
2. **S5-01 tutorial hints, S5-02 theme pass (conga, dance on the beat, music if the sfx kit allows a procedural loop), S5-04 skins** (RUN Bits prices are owner-approved only: wire the flow behind a feature flag with price fields set to 0 and list as an owner question), **S5-03 rewarded ad** (behind a flag, through the platform adapter only, mock in dev), **S5-05/06** as written in STAGES.md.
3. **Perf and safety:** hold 60 fps in the heaviest level (L12 boss and a big daily) in headless Chrome; check no console errors across a full playthrough of levels 1-12 with the solver; confirm the save migrates from a v1 save fixture.
4. Per card: `npm run check`, `npm run build`, LOG.md entry, `node tools/merkle.mjs seal`. Do not deploy or commit. Questions for the owner go at the end of LOG.md.
