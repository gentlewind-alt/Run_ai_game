# Status board

States: `todo` · `doing` (claimed) · `review` (waiting for a check) · `done` · `cut` (behind a flag, not shipping). Claim rules are in `architecture/WORKFLOW.md`. Cards are defined in `architecture/STAGES.md`.

**Deadline:** jam entry by **Mon 2 Nov 12:00 PT**, go public by **Thu 30 Oct**, feature freeze **Wed 29 Oct**.
**Current build:** v2.0.0 (Stages 3-6, private), private, game id `83DTzRcGtCh99lCAuhBn`. The URL is in `docs/handoff/LOG.md`.

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

## Parallel lanes (once S2-03 is done)

- **Lane A (weapons):** S2-05, S2-06, then S3-05, S3-06
- **Lane B (monsters and levels):** S2-07, S2-09, S3-07, S4-01, S4-02
- **Lane C (meta):** S2-08, S3-01, S3-02, S3-03, S3-04, S4-03, S4-04, S4-05
- **Lane D (tooling, cloud-friendly):** S2-04, then review of every `review` card

## Waiting on owner

- Phone test of v1.3.0: does the shot feel good? Does pinch zoom work? Does the ability button feel natural? Is the zoomed-out home view readable?
- Approve: try `rundot game set-public` after S2 to learn the review turnaround (it can be undone with `set-private`).

## Not built yet (cut first if late, in this order)

stretch weapons → 2nd artifact slot → boss polish → levels 10-11 → leaderboard → skins/IAP
