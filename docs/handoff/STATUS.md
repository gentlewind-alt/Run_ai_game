# Status board

States: `todo` · `doing` (claimed) · `review` (waiting for a check) · `done` · `cut` (behind a flag, not shipping). Claim rules are in `architecture/WORKFLOW.md`. Cards are defined in `architecture/STAGES.md`.

**Deadline:** jam entry by **Mon 2 Nov 12:00 PT**, go public by **Thu 30 Oct**, feature freeze **Wed 29 Oct**.
**Current build:** v1.1.0 (Stage 1.5), private, game id `83DTzRcGtCh99lCAuhBn`. The URL is in `docs/monster_mash/07_local_reply.md`.

| Card | Title | Depends on | State | Owner | Updated | Notes |
|---|---|---|---|---|---|---|
| S1 | Proof of fun + follow-ups + 1.5 | | done | local | 10-21 | queue, zoom, ability button |
| S2-01 | Split GameScene into target layout | | todo | | | do first; no behaviour change |
| S2-02 | config.json, data migration, settings merge | S2-01 | todo | | | |
| S2-03 | Event bus, BattleCtx, RNG, platform adapter | S2-01 | todo | | | |
| S2-04 | Test hook + shot sweep | S2-03 | todo | | | cloud session can do this |
| S2-05 | Cleaver, Staff, Pike | S2-03 | todo | | | |
| S2-06 | Scattergun, Boomerang, Blast Tube, Scepter | S2-03 | todo | | | |
| S2-07 | Monster behaviours + iron/crystal | S2-03 | todo | | | split runner off if large |
| S2-08 | MASH combo, score, stars | S2-03 | todo | | | |
| S2-09 | Goblin Hills levels 1-4 | S2-04..08 | todo | | | |
| S3-01 | Scene flow Boot/Title/Map/Results | S2-03 | todo | | | |
| S3-02 | Save system | S2-03, S3-01 | todo | | | |
| S3-03 | Loadout scene | S3-01 | todo | | | |
| S3-04 | Shop and forge | S3-02 | todo | | | |
| S3-05 | Artifacts (6) | S2-03, S3-03 | todo | | | |
| S3-06 | Consumables (4) | S2-03, S3-03 | todo | | | |
| S3-07 | Dark Elf Wood 5-8 + pause | S2-09, S3-01 | todo | | | |
| S4-01 | Iron Keep 9-11 | S3-07 | todo | | | |
| S4-02 | Iron Warlord boss | S2-07 | todo | | | |
| S4-03 | Daily Mash generator | S2-03, S3-01 | todo | | | |
| S4-04 | Streak, countdown, day-7 reward | S4-03, S3-02 | todo | | | |
| S4-05 | Leaderboard and share | S4-03 | todo | | | |
| S5-01 | Tutorial hints | S3-02 | todo | | | |
| S5-02 | Theme pass: conga, dance, music | S3-01 | todo | | | |
| S5-03 | Rewarded ad: double coins | S3-01 | todo | | | |
| S5-04 | Gold Quiver + skins (RUN Bits) | S3-04 | todo | | | owner approves prices |
| S5-05 | Feel + performance pass | S2-S4 | todo | | | |
| S5-06 | Credits, README, thumbnail | | todo | | | |
| S6-01 | Release checklist | S5 | todo | | | |
| S6-02 | Go public | S6-01 | todo | | | OWNER APPROVAL, by 30 Oct |
| S6-03 | Jam entry form | S6-02 | todo | owner | | owner only |

## Parallel lanes (once S2-03 is done)

- **Lane A (weapons):** S2-05, S2-06, then S3-05, S3-06
- **Lane B (monsters and levels):** S2-07, S2-09, S3-07, S4-01, S4-02
- **Lane C (meta):** S2-08, S3-01, S3-02, S3-03, S3-04, S4-03, S4-04, S4-05
- **Lane D (tooling, cloud-friendly):** S2-04, then review of every `review` card

## Waiting on owner

- Phone test of v1.1.0: does the shot feel good? Does pinch zoom work?
- Approve: try `rundot game set-public` after S2 to learn the review turnaround (it can be undone with `set-private`).

## Not built yet (cut first if late, in this order)

stretch weapons → 2nd artifact slot → boss polish → levels 10-11 → leaderboard → skins/IAP
