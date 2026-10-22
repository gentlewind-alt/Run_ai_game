# Task x6b: realm 6 "Sky Citadel" (levels 21-24) and the Pocket Tanks style weapons

Follow `docs/handoff/AGY_BRIEF.md` and `architecture/RECIPES.md`. Log entry first. Design source: `docs/monster_mash/09_expansion_design.md` sections 3, 4 and 5. Copy the realm 4 and realm 5 patterns (see the LOG entries). `regress:quick` is the loop, the full `regress` once at the end.

Art is already generated and processed by Claude with the RUN CLI (do NOT call `rundot generate`): monsters `cloud_harpy`, `storm_mage`, `storm_sovereign` in `game/public/sprites/monsters/`, weapon icons `w_hailstorm_cauldron`, `w_rolling_millstone`, `w_pinata_mirv`, `w_earthworm_drill`, `w_black_hole_marble`, `w_chain_rod` in `game/public/sprites/relics/`. If a processed file is missing, add the ids to `tools/process_sprites.ps1` and run it (sources are in `docs/handoff/shots/gen/`).

1. **Realm 6** `sky_citadel`, levels 21-24, background `sky` (bright sky, floating islands, clouds drifting, white-gold stone terrain texture), Map page 2 or a page 3 as the layout needs.
2. **Monsters**: `cloud_harpy` (flying, HP 40, swoops), `storm_mage` (HP 60, casts a shield on a neighbour every 5 s like the hexer), boss `storm_sovereign` (HP 1300, armour 20, `boss: true`, lightning strikes the ground in a band every 6 s (visual and a damage tick on blocks), a glowing eye weak point for 2x for 2 s every 7 s). Drops the Black Hole Marble (unlock `{ boss: "storm_sovereign", level: 24 }`).
3. **Levels 21-24**: floating platforms (several terrain shelves), wind gusts on some levels (a data-driven horizontal push on projectiles in a band, `level.wind`), `shots: 6`, recommended commons loadout, solver 3-5 shots, no one-shot wins, nothing unreachable, targets about 70% of the solver score.
4. **Six new weapons**, each: one file in `src/content/weapons/`, registry entry, content row (damage per the design doc rarity bands: rares 28-42, legendary 44-60, `ability.charges: 1` for legendaries, numbers in `params`), card text, synthesized placeholder sound in `audio/sfx.ts`, unlock source, deterministic seeded RNG, effects inside the particle cap:
   - **Hailstorm Cauldron** (rare, unlock chest in level 21): the tap opens the sky and 12 stew drops rain across a 120 px band (Hail Storm).
   - **Rolling Millstone** (rare, chest in level 22): lands and rolls up to 1.5 s along the terrain crushing blocks and monsters, then cracks (Roller; use `ctx.groundAt`).
   - **Pinata MIRV** (rare, chest in level 23): splits mid-air into 5 candy bombs that fan out and explode (MIRV).
   - **Earthworm Drill** (rare, chest in level 24): burrows through terrain and blocks for 1 s, then erupts with a blast under the fort (Digger).
   - **Chain Rod** (rare, chest in level 22): lightning that jumps up to 5 monsters.
   - **Black Hole Marble** (legendary, boss drop): a singularity pulls monsters and blocks within 90 px for 1.5 s, then collapses with a shock wave; one charge.
   Keep the balance model in section 2 of the design doc: no weapon one-shots a level; verify with `tools/balance_table.mjs` and the solver bands.
5. **Tests and screenshots**: assertions per weapon effect, the boss weak point and drop, levels 21-24 bands, Map paging; real peak-frame screenshots into `docs/handoff/shots/realm6/`, reviewed against `08_design_direction.md`; fix anything ugly.

Done means: `npm run check`, `npm run build`, `npm run regress:quick` and the full `npm run regress` pass; `node tools/merkle.mjs seal`; append `DONE agy_task_x6b_realm6_weapons` to `docs/handoff/agy_done.txt`. No commit or deploy.
