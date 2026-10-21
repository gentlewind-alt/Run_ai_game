# 09 Expansion design (owner goal, 2026-10-22)

Scope of this pass: bigger weapon abilities (Pocket Tanks style), new weapons, six weapon slots, damage-versus-HP balance, more realms and levels, score leaderboards, a sound plan, and clean art for every relic. The concept does not change: portrait-free landscape 16-bit siege launcher, weapons are the ammo, monsters mash and chain, Monster Mash theme.

## 0. Tool routing (owner rule)

1. **RUN CLI first** for anything it can do: `rundot generate sprite` (hero art, 90 credits), `animate-sprite` (100), `generate sfx`/`music` (estimate with `rundot generate estimate <kind>` first), `rundot deploy`. Credits: about 109k left at the time of writing. Calls are rate-limited (about 24 s apart): use `tools/gen_relic_sprites.sh` as the pattern.
2. **agy with `gemini-3.8-flash-high`** for code, levels, data, tests and docs, one brief per task in `docs/handoff/agy_task_*.md`.
3. **agy with `claude-sonnet-4-6`** (the Claude model agy offers) when Gemini fails or stops early.
4. **Claude directly** only if both fail, or for a small fix.
`tools/agy_chain.sh` runs briefs in order and applies steps 2 and 3 automatically; a brief counts as finished only when it appends `DONE <brief-name>` to `docs/handoff/agy_done.txt`.

## 1. Six weapon slots

- `economy.loadoutSize` goes from 4 to 6 (Gold Quiver adds +1 as before). Loadout UI: two rows of three slots. Queue beside the sling shows up to 7.
- `level.shots` stays the authority for how many shots a level allows: levels 1-3 keep 4 (tutorial pace), levels 4-12 move to 5-6, new levels use 6. The player never gets more shots than `min(loadout, level.shots)`.
- More shots must not make levels trivial. Rule: **total monster HP and fort HP rise about 35% from 4 to 6 shots**, and score targets rise with them. Re-run `tools/regress.mjs`; the greedy solver must still need 3-5 shots on levels 4+ (bands in `game/scripts/balance_bands.json`).
- Save: no shape change needed (loadout is already an array), but old saves with 4 ids must still load (pad with the starter weapon).

## 2. Damage versus HP (the balance model)

Facts from the data (2026-10-22):
- Effective hit damage = `baseDamage x globalScale (2) x impactFactor (0.5-1.5) x element x combo x forge`.
- Monster HP: imp 15, skeleton runner 20, goblin bomber 25, goblin grunt 30, dark elf archer 35, hexer 40, orc brute 120, troll 160, mini-bosses goblin chief 70 / dark elf matron 120, Iron Warlord 680.
- Material HP: crystal 30, wood 40, stone 120, iron 250.
- Weapons now: commons 11-35, uncommons 12-19, rares 24-26, legendaries 38.

Target "hits to kill" at impact 1.0 (nominal damage = base x 2):

| Target | Common 14-35 | Rare 24-42 | Legendary 38-60 |
|---|---|---|---|
| Imp / runner / grunt / bomber (15-30) | 1 | 1 | 1 |
| Archer / hexer (35-40) | 1-2 | 1 | 1 |
| Wood block (40) | 1-2 | 1 | 1 |
| Orc brute (120) | 4-5 | 2-3 | 2 |
| Stone block (120) | 4-5 | 2-3 | 2 |
| Troll (160) | 5-6 | 3-4 | 2-3 |
| Iron block (250) | 8+ | 5 | 3-4 |

Rules for tuning (data only, never code): (a) raise rare base damage to 28-42 and legendary to 44-60 so the table holds; (b) abilities carry the rest: an ability may add at most 1.5x the weapon's nominal damage as extra effect damage, area effects fall off with distance; (c) a legendary ability is limited to one charge per level; (d) per level, **supply/demand = (sum of loadout nominal damage x 0.6 hit rate) / (monster HP + needed fort HP) is 1.2-1.5** for a first clear and 2.0+ for a 3-star solver run; (e) new relic weapons must never one-shot any level (existing regress rule).

## 3. Pocket Tanks pass: ability redesign

Pocket Tanks works because every weapon has a loud, readable signature: area nukes, splitting warheads, rolling and burrowing shots, rains of projectiles, fire that lingers, craters. Our abilities were mostly "small bonus on tap". Each existing weapon gets one memorable behaviour, bigger visuals and an obvious payoff. All effects stay deterministic (seeded RNG) and inside the particle cap.

| Weapon | Now | New signature (tap) |
|---|---|---|
| Militia Blade | Saw for 0.6 s | **Whirlwind roll**: lands and rolls along the ground as a sawblade for 1.4 s, carving through wood and monsters in its path (Roller). |
| Iron Cleaver | Slam | **Crater slam**: dive-slam with a visible crater and shock ring, radius 60, blocks crumble with distance falloff (Heavy missile). |
| Ashwood Staff | Homing bolt | **Ember volley**: 3 homing bolts, each splits in two on hit (MIRV). |
| Scrapheap Scattergun | 5 pellets | **Cluster burst**: 5 pellets, each pops into a small blast, every 3rd one leaves a fire spark (Cluster). |
| Hunters Pike | Pierce 3 | **Driller**: pierces and bores through up to 3 blocks or monsters and leaves splinters that keep hurting for 1 s (Tunneler). |
| Hunters Boomerang | Recall | **Rebound**: two passes, the return pass at 2x, and it ricochets once off a block (Skipper). |
| Blast Tube | Air burst | **Nuke lob**: big airburst, wide radius with long falloff, white flash, shock ring and heavy shake (Nuke). |
| Horned Scepter | Curse +15% | **Hellbrand**: curse zone plus a fire pool that burns for 4 s and spreads along wood (Napalm). |
| Skyforge Maul | Bolt and field | adds **chain lightning** to up to 5 targets while the field is up. |
| Comet Fists | Quake | adds **rising stone spikes** along the quake line that hit monsters and block shots for 3 s. |
| Bulwark Disc | 6 bounces | each bounce adds a **shield ring** that knocks back; the 6th bounce explodes. |

Implementation notes: Roller and Driller need a body that follows terrain or ignores some collisions (`ctx.groundAt`, per-body collision masks); fire pools are a new actor type with a timed damage tick; MIRV and Cluster use the existing pellet system; Nuke and Crater use the explosion kit with a bigger `explosionFalloff`.

## 4. New weapons (design only, build in this order)

1. **Brahmastra Arrow** (legendary, boss reward of the new realm 4). A golden arrow with a ring of faint glyphs. Tap: it becomes a **focused beam of light**, a thin white-gold beam 6 px wide and 240 px long fired along its flight line for 1.5 s, sweeping 10 degrees: damages everything on the line every 6 steps, ignores armour, scorches wood, shatters crystal. Visuals: beam with a bright core, soft halo, lens-flare star at the muzzle and a faint glyph ring around the arrow; screen dims 15% during the beam. Sound: deep sustained synth chord that rises, a bright shimmer layer, a low boom at the end. One charge per level.
2. **Omnitrix Dial** (legendary, treasure of the new realm 5). A green-and-black hourglass dial. Tap: a green flash, then **five giant forearms fall from the sky** across a 150 px band, each one a different alien arm (red fire claw: burns, green brute fist: knocks flat, cyan crystal arm: shatters, grey stone arm: heavy damage, yellow lightning arm: stuns). Each arm hits, **bounces once** off the ground or a block (second hit at 60%), then **retracts back up into the sky**. Visuals: dial flash, arms with motion streaks, impact rings, tiny hourglass sparks. Sound: a dial click and rising whine, five staggered thuds with a rubbery bounce, a whoosh as they leave. One charge per level.
3. **Hailstorm Cauldron** (rare). Tap: the sky opens and 12 stew drops rain across a 120 px band (Hail Storm).
4. **Rolling Millstone** (rare). Lands and rolls up to 1.5 s along the terrain, crushing blocks and monsters, then cracks (Roller, stone).
5. **Pinata MIRV** (rare). Splits mid-air into 5 candy bombs that fan out and explode (MIRV).
6. **Earthworm Drill** (rare). Burrows through terrain and blocks for 1 s, then erupts with a blast under the fort (Digger).
7. **Black Hole Marble** (legendary). Tap: a singularity pulls monsters and blocks in 90 px for 1.5 s, then collapses with a shock wave. One charge.
8. **Chain Rod** (rare). Lightning that jumps up to 5 monsters.
Slingshots still to come: Skipstone and Thunderstring (see the earlier batch notes).

Art and unlocks for these: hero sprites through `rundot generate sprite` (90 credits each). Unlocks follow the existing system: Brahmastra from the realm 4 boss, Omnitrix from a realm 5 chest vault, the rares from chests, the Black Hole Marble from the realm 6 boss.

## 5. More realms and levels (12 new levels)

| Realm | Levels | Look | New monsters | Terrain and hazards | Boss |
|---|---|---|---|---|---|
| 4 Frost Peaks | 13-16 | snowy blue dusk, aurora, ice blocks | frost wolf (runner, fast), ice golem (HP 220) | slippery ice slopes, icicles that fall when hit | L16 Frost Giant (HP 900) drops Brahmastra Arrow |
| 5 Ember Forge | 17-20 | red furnace caves, lava glow | lava imp (flying, fire), forge ogre (HP 260) | lava gaps (monsters that fall in die), rolling boulders | L20 Forge Tyrant (HP 1100), chest vault with Omnitrix Dial |
| 6 Sky Citadel | 21-24 | bright sky, floating islands, clouds | cloud harpy (flying), storm mage (shield caster) | floating platforms, wind gusts that push shots | L24 Storm Sovereign (HP 1300) drops Black Hole Marble |

Levels are generated by `game/scripts/build_levels.py` (never hand-edit the JSON) with terrain polylines, `shots: 6`, score targets about 70% of best sweep score, and the usual verification (`__mm.sweep`, greedy solver, no one-shot wins, nothing unreachable). Monster and boss sprites come from `rundot generate sprite`, processed with `tools/process_sprites.ps1`. Realm backgrounds are new entries in `art/backgrounds.ts`. Map screen gains a second page for realms 4-6.

## 6. Score leaderboards

- Boards (RUN `leaderboard`): `daily` (exists), `level_<n>` (best score per level, all-time), `overall` (sum of best scores). Config in `rundot/leaderboard.config.json`.
- Submit on every win (best only). Results panel shows rank and the top 5 for that level; Map gets a Leaderboards button with tabs Daily, This level, Overall and your own row highlighted. Offline or failure shows a quiet "scores unavailable" line and never blocks the game.
- Owner decision still open: `requiresToken` for signed submissions (see LOG).

## 7. Sound plan (build later)

Rule: use `rundot generate sfx` (estimate first) for the hero abilities, WebAudio synthesis for small utility sounds, mix at a shared ceiling with ducking so layered effects never clip, respect the mute setting, preload at Boot.
| Ability | Layers |
|---|---|
| Skyforge Maul | sky crack, thunder rumble with long tail, electric hum loop while the field is up |
| Comet Fists | deep thud, stone rumble, falling-rubble crackle |
| Bulwark Disc | bright metal ping per bounce rising in pitch, whoosh on redirect |
| Brahmastra Arrow | rising choral synth chord, sustained shimmer, low end boom |
| Omnitrix Dial | dial click, rising whine, five staggered rubbery thuds, whoosh as arms leave |
| Whirlwind, Crater, Nuke, Hellbrand | saw whine, ground crunch, sub boom with wide tail, fire crackle loop |
| Pocket Tanks style set | distinct short stingers for split, rain, roll, dig and collapse |

## 8. Execution order

1. Art: process and integrate the six relic sprites (done in this pass), fix the shop description overlap, set sprite scale, regenerate missing art.
2. Six slots and the damage/HP data pass, with regress bands.
3. Realm 4 (levels 13-16) with its monsters, boss and Brahmastra Arrow.
4. Leaderboards.
5. Ability redesign pass (section 3) in two batches.
6. Realms 5 and 6, Omnitrix Dial and the other new weapons.
7. Sound pass.
Each step ends with `check`, `build`, `regress:quick` and screenshots reviewed against `08_design_direction.md`.
