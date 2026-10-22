# Task x3b: headless tests and docs for realm 4 (Claude built realm 4 directly while agy was out of credits)

Follow `docs/handoff/AGY_BRIEF.md`. Log entry first. Run tests one at a time (`regress:quick` loop, the full `regress` once at the end). Read the LOG.md entry "X3 realm 4 Frost Peaks built directly" first. Do NOT change gameplay numbers unless a test proves a bug.

Add deterministic headless assertions to `tools/regress.mjs` (quick mode must stay under 5 minutes):
1. **Brahmastra Arrow**: tap fires the beam; over 90 steps the damage tick count matches `beamSteps / tickSteps`; an armoured target (Frost Giant, armour 16) takes the full tick damage (`ignoreArmour`), wood takes x1.5 and crystal x3 compared with stone; `ability.charges: 1` disables the ability on the second shot; the arrow hangs in place (velocity 0) and the projectile ends after the beam; no console errors.
2. **Frost Giant**: weak point opens on the `weakEvery`/`weakDuration` schedule and hits during it do `weakMult` damage; outside it armour applies; death grants the Brahmastra Arrow (`unlock.boss: frost_giant`) once and shows the "RELIC FOUND!" toast; after Retry it is not granted twice.
3. **Ice Golem shatter**: on death an explosion damages a neighbouring monster within `shatterRadius`.
4. **Frost Wolf** runs to the exit like the other runners (escape counts, level 14 loses when the limit is exceeded).
5. **Map page 2**: "More realms >" opens realm 4 (levels 13-16 visible with correct lock state), "< First realms" returns; a profile with `reachedLevel` 13+ opens on page 2 by default; node taps start the right level.
6. **Save**: a profile with `reachedLevel` 16 and the Brahmastra owned loads, and a v-previous save still migrates.
7. Real peak-frame screenshots of the beam (at step 30), the Frost Giant with its chest open, an ice golem shatter, and Map page 2 into `docs/handoff/shots/realm4/`, reviewed against `docs/monster_mash/08_design_direction.md`; list anything ugly in LOG.md under "Visual issues" (do not leave it unfixed if it is a small change: fix it).
8. **Docs**: `architecture/DATA.md` (monster `sprite` field, `frost` background, realm 4, `ignoreArmour`, beam params), `architecture/ARCHITECTURE.md` (`fx.beam`), STATUS row X3 to `done`.

Done means: `npm run check`, `npm run build`, `npm run regress:quick` and the full `npm run regress` pass; `node tools/merkle.mjs seal`; append `DONE agy_task_x3b_tests` to `docs/handoff/agy_done.txt`. No commit or deploy.
