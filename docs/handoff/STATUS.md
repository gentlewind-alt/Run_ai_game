# Status board

States: `todo` · `doing` (claimed) · `review` (waiting for a check) · `done` · `cut` (behind a flag, not shipping). Claim rules are in `architecture/WORKFLOW.md`. Cards are defined in `architecture/STAGES.md`.

**Deadline:** jam entry by **Mon 2 Nov 12:00 PT**, go public by **Thu 30 Oct**, feature freeze **Wed 29 Oct**.
**Current build:** v1.32.0 (music on/off toggle; levels 15, 17, 22 from thesis archetypes; generated boss forts 4, 8, 16), private

| Card | Title | Depends on | State | Owner | Updated | Notes |
|---|---|---|---|---|---|---|
| S1 | Proof of fun + follow-ups + 1.5 | | done | local | 10-21 | queue, zoom, ability button |
| S2-01 | Split GameScene into target layout | | review | claude | 10-21 | see LOG 10-21 refactor entry; check hosted platform adapter after a deploy |
| S2-02 | config.json, data migration, settings merge | S2-01 | review | claude | 10-21 | see LOG 10-21 refactor entry; check hosted platform adapter after a deploy |
| S2-03 | Event bus, BattleCtx, RNG, platform adapter | S2-01 | review | claude | 10-21 | see LOG 10-21 refactor entry; check hosted platform adapter after a deploy |
| S2-04 | Test hook + shot sweep | S2-03 | done | agy | 10-21 | window.__mm test hook, sweep and greedy solver built & tested |
| S2-05 | Cleaver, Staff, Pike | S2-03 | review | local | 10-21 | behaviour done; now on the S2-01..03 layout |
| S2-06 | Scattergun, Boomerang, Blast Tube, Scepter | S2-03 | review | local | 10-21 | same; boomerang and scepter tuned from sweeps |
| S2-07 | Monster behaviours + iron/crystal | S2-03 | review | local | 10-21 | all behaviours but iron/crystal materials; runners use dir+speed, not path |
| S2-08 | MASH combo, score, stars | S2-03 | review | local | 10-21 | combo, MASH banner on the beat, score, stars; no features.combo flag yet |
| S2-09 | Goblin Hills levels 1-4 | S2-04..08 | review | local | 10-21 | levels 1-4 + sandbox 99; scoreTargets tuned from solver/sweeps |
| S3-01 | Scene flow Boot/Title/Map/Results | S2-03 | review | local | 10-21 | Stage 3 in one run with terrain + hard levels; see LOG |
| S3-02 | Save system | S2-03, S3-01 | review | local | 10-21 | Stage 3 in one run with terrain + hard levels; see LOG |
| S3-03 | Loadout scene | S3-01 | review | local | 10-21 | Stage 3 in one run with terrain + hard levels; see LOG |
| S3-04 | Shop and forge | S3-02 | review | local | 10-21 | Stage 3 in one run with terrain + hard levels; see LOG |
| S3-05 | Artifacts (6) | S2-03, S3-03 | done | agy | 10-21 | all 6 verified in headless browser; actor spawn bug in loop.ts fixed |
| S3-06 | Consumables (4) | S2-03, S3-03 | done | agy | 10-21 | all 4 verified with targeting, effect & stock decrement |
| S3-07 | Dark Elf Wood 5-8 + pause | S2-09, S3-01 | done | agy | 10-21 | balanced via build_levels.py; solver clears in 3 shots; scoreTargets ~70% |
| S4-01 | Iron Keep 9-11 | S3-07 | review | agy | 10-21 | levels 9-11 tuned, verified with test solver (L10 won in 4 shots, targets ~70%) |
| S4-02 | Iron Warlord boss | S2-07 | review | agy | 10-21 | Iron Warlord boss tuned (HP 1070, armour 26, visor 2x, 3-4 shots across all artifacts, scoreTarget 850) |
| S4-03 | Daily Mash generator | S2-03, S3-01 | review | agy | 10-21 | daily generator (mulberry32 UTC date seed, fort templates, 30-day test passes) |
| S4-04 | Streak, countdown, day-7 reward | S4-03, S3-02 | review | agy | 10-21 | profile daily tracking, consecutive streaks, day-7 +500 coin reward, MapScene countdown |
| S4-05 | Leaderboard and share | S4-03 | review | agy | 10-21 | leaderboard.config.json, mock/rundot platform adapter, Results top 10 & rank, share text |
| S5-01 | Tutorial hints | S3-02 | review | agy | 10-21 | hints from level.hints shown once via profile.flags in monster speech sticker |
| S5-02 | Theme pass: conga, dance, music | S3-01 | review | agy | 10-21 | 120 BPM beat sync, title conga line, dancing ghost sprites on win, procedural Web Audio chiptune music (cheerful + dusk) |
| S5-03 | Rewarded ad: double coins | S3-01 | review | agy | 10-21 | rewarded ads behind features.ads, platform mock + rundot adapter (desktop-safe), double coins button in ResultsScene |
| S5-04 | Gold Quiver + skins (RUN Bits) | S3-04 | review | agy | 10-21 | Gold Quiver + sling skins in shop.config.json & content.json, 5th Skins tab in ShopScene, prices set to 0 pending owner approval |
| S5-05 | Feel + performance pass | S2-S4 | review | agy | 10-21 | roundPixels: true, 90-particle cap, MASH haptics, phone-readiness pass verified (432x768, L1-12 solved, L12 & daily <17ms median, v1 migration ok) |
| S5-06 | Credits, README, thumbnail | | review | agy | 10-21 | CreditsScene, player README.md guide, 512x512 rendered store thumbnail.jpg/.png, 4 release screenshots & description |
| S6-01 | Release checklist + regression suite | S5 | review | agy | 10-21 | release verification matrix & CHECKLIST.md complete, check/build/regress/predeploy 20/20 pass, 0 console errors |
| S6-02 | Go public | S6-01 | todo | | | OWNER APPROVAL, by 30 Oct |
| S6-03 | Jam entry form | S6-02 | todo | owner | | owner only |

## New cards from the local session

| Card | Title | State | Notes |
|---|---|---|---|
| S2-new1 | Refactor the Stage 2 code into the S2-01..03 layout | done | merged into S2-01..03 (review); BattleScene is 92 lines |
| S2-new2 | Design ladder per `docs/monster_mash/08_design_direction.md` | doing | Stage 2 pass done; Stage 3 pass is title, map, shop |
| S2-new3 | Fall and impact damage for monsters | review | tuning.fallThreshold/fallK/debrisK |
| S-merkle | Merkle-tree repo index (`tools/merkle.mjs`) | done | agy | 10-21 | seal, changed, verify, MERKLE.json/md |
| S6-bugs1 | Three phone-test bugs (v1.7.0) | done | agy | 10-21 | next level stuck, weapon text overlap, sling/fort framing |
| S6-loadout | Next level goes through Loadout screen | done | agy | 10-21 | results Next -> loadout, preselected weapons preserved, regress assertion updated |
| S6-camera | Camera return to sling frame after shot | done | agy | 10-21 | ease to homeCx and homeZoom after shot/consumable/toggleView, regress check |
| S6-resp | Responsive phone / tablet / desktop shell (phase 1) | review | agy | 10-21 | scaling, backdrop, desktop controls, live resize, 35 shots, 7-viewport regress |
| S7-01 | Relic framework: rarity, loadout rules, unlock sources, toast, save migration | review | agy | 10-21 | wave 1 part 1; 1-legendary rule, charges pip, rarity colors, toast, save v2 migration verified |
| S7-02 | Mini-bosses (L4 goblin chief, L8 dark elf matron), boss HP bar, L12 warlord reward | review | agy | 10-21 | wave 1 part 1; L4 & L8 bosses, HP bars, L4 tuned to 4 shots in band [2,4] |
| S7-03 | Treasure chests (L3, L5, L7) & pity shop (Relic Market) | review | agy | 10-21 | wave 1 part 1; chests grant relic or 150 coins fallback, pity unlocks at >= 3 boss losses |
| S8-landscape | Convert game from portrait 216x384 to LANDSCAPE (16:9) | review | agy | 10-21 | 480x270 measured & built; all scenes re-laid, rotate overlay, full regress passes |
| S8-refine | Code-quality review and refinement pass | done | agy | 10-21 | Golden rules 1&2, listener hygiene, split modules, boundary errs, types, docs |
| S9-weapons-a | Relic weapons batch A (6 weapons) & 2 slingshots | review | agy | 10-22 | Task x1 art fixes complete (scale, poses, shop info clearance, silhouettes, real sheet & compare) |
| x2-slots6-balance | Six weapon slots + damage vs HP balance pass | done | agy | 10-22 | loadoutSize 6, 2-rows-of-3 UI, shots L1-3:4/L4-7:5/L8-12:6, rare baseDamage 28-42, legendary 44-60, level HP +35%, balance_bands updated, regress passes |

## Parallel lanes (once S2-03 is done)

- **Lane A (weapons):** S2-05, S2-06, then S3-05, S3-06
- **Lane B (monsters and levels):** S2-07, S2-09, S3-07, S4-01, S4-02
- **Lane C (meta):** S2-08, S3-01, S3-02, S3-03, S3-04, S4-03, S4-04, S4-05
- **Lane D (tooling, cloud-friendly):** S2-04, then review of every `review` card

| S9-weapons-a | Relic weapons batch A (6) + Quicksilver/Gemini slingshots | S7 | review | agy | 10-22 | mechanics + tests pass; visuals below the approved bar |
| S9-polish | Visual polish of batch A (sprite size, effects, icons, real contact sheet) | S9-weapons-a | todo | | | blocked: agy weekly limit reached 10-22; brief ready in agy_task_weapons_polish.md |

| X1 | Image fixes: relic sprite size, shop info panel, locked silhouettes | S9 | done | agy | 10-22 | see LOG |
| X2 | Six weapon slots + damage vs HP balance | X1 | review | agy+claude | 10-22 | loadoutSize 6, levels 4-12 shots 5-6, regress bands 3-5; agy stopped at its quota, docs/tests partly unverified |
| X3 | Realm 4 Frost Peaks (levels 13-16) + Brahmastra Arrow | X2 | review | claude | 10-22 | built directly (agy out of credits); beam, boss drop and map page 2 not yet covered by headless assertions |
| X4 | Score leaderboards (daily, per level, overall) | X2 | review | claude | 10-22 | Scores screen, rank on Results, board routing; host boards untested until deploy |
| X5 | Pocket Tanks ability pass | X2 | doing | claude | 10-22 | batch 1 done (Blade, Cleaver, Blast Tube, Staff); Pike, Boomerang, Scepter, Scattergun and relic add-ons remain |
| X6a | Realm 5 Ember Forge (levels 17-20) + Omnitrix Dial | X3 | review | claude | 10-22 | built directly; arms use hand-drawn sprites until the generated ones are swapped in |
| X6b | Realm 6 Sky Citadel (21-24) + Hailstorm Cauldron, Millstone, Pinata MIRV, Drill, Chain Rod, Black Hole Marble | X6a | review | claude | 10-22 | built directly (agy out of credits); L21 band 2-5; all six checked on screen and by `tools/test_weapons.sh` |
| X7 | Sound pass (RUN `generate sfx` plus WebAudio) | X5 | todo | | | plan in `09_expansion_design.md` section 7 |
| X8a | Concept-art look: realm backdrop plates (RUN generated) and brick / rivet / plank block textures | X6b | review | agy | 10-22 | brief `agy_task_x8a_concept_art.md`; visual only |
| X8b | Collapsible boss fortresses for levels 4, 8, 12, 16, 20, 24 | X8a | review | agy | 10-22 | brief `agy_task_x8b_boss_fortresses.md`; frames not slabs, stand-still and collapse checks |
| X9 | Omnitrix Dial: one four-armed alien drops, splash + earthquake, leaps back to the sky | X8b | review | agy | 10-22 | brief `agy_task_x9_omnitrix_alien.md`; sprite `shots/gen/omni_alien.png` |
| X8 | Relic scale + L4 runners + loadout/results UI (playtest 10-22) | | review | claude | 10-22 | done in the cloud session at the owner's request; see LOG |
| PCG-A | Design note for physics PCG ideas | | review | codex | 10-25 | Deferred; only Task B was implemented in this run. |
| PCG-B | Procedural fort generator and solver gate | | review | codex | 10-25 | Generator, static stability check, candidate-only mode and gate added; in-game candidate runs need Vite/headless Chrome. |
| PCG-C | Level archetype concepts for later realms | | review | codex | 10-25 | 12 buildable alternatives for levels 13–24; Chapter 8 archetypes and thesis visual references documented in `docs/monster_mash/12_level_archetypes.md`. |
| PCG-D | Daily Mash difficulty tiers | | review | codex | 10-25 | Deferred; only Task B was implemented in this run. |

## Waiting on owner

- **Review 10-22 (`docs/handoff/review_2026-10-22.md`):** approve renaming "Omnitrix Dial" (B1). Decide whether to fix the boss re-hit damage and retune, or keep it (B2).

- Phone test of v1.3.0: does the shot feel good? Does pinch zoom work? Does the ability button feel natural? Is the zoomed-out home view readable?
- Approve: try `rundot game set-public` after S2 to learn the review turnaround (it can be undone with `set-private`).

## Not built yet (cut first if late, in this order)

stretch weapons → 2nd artifact slot → boss polish → levels 10-11 → leaderboard → skins/IAP
