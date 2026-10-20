# Monster Mash: plan (for the owner)

Status 20 Oct 2026. This replaces the Four Realms stage plan for the jam. Four Realms stays parked: its server, ledger, PvP and story are all out of scope here.

## Read this first: the real deadline

The jam page says entries close **Mon 2 Nov, 12:00 noon PT**. From 20 Oct that is **13 days**, not three weeks. The 3 Nov date is the end of the jam, and judging runs to 7 Nov. Plan to be submitted by **Sat 1 Nov**, and treat 2 Nov morning as an emergency buffer only.

Voting runs from 15 Oct, so a playable public build early gets more votes. Publish something on day 2 and keep replacing it.

## What I could not verify

I searched for RUN's docs (rundot CLI, Game Studio, Creator Hub) and found nothing. So I don't know the stack, screen orientation, save/leaderboard/share/purchase APIs, or whether you can update a game after entering the jam. The master brief makes the builder AI check this as Step 0 and report back, and it tells it to cut any feature the platform can't support. **Please check three things yourself on the jam page or Creator Hub:** (1) can an entered game be updated after entering, (2) portrait or landscape, (3) does the platform have a leaderboard/share/purchase API.

## The game

**MONSTER MASH: Slingshot Siege.** A 16-bit physics launcher. No avatars: weapons are the ammo, mounted on the slingshot. Pull back, release, tap once in flight for the weapon's special move. Goblins, dark elves, orcs, trolls, skeleton runners and imps hide in wobbly forts. 12 levels in 3 realms, ending with the Iron Warlord.

## How the existing data was reused

| Four Realms | Monster Mash |
| --- | --- |
| 101 weapons | **8 core** (+4 stretch). Chosen to cover 8 of the 15 archetypes, 4 elements, each with a distinct launch and tap move |
| 17 armour | **Cut.** No avatar, so defence and HP mean nothing |
| 53 relics | **6 artifacts** that modify shots. Echo Stone (ghost shot) reuses the Echo idea |
| 21 consumables | **4 one-use boosts** |
| Elements and 1.5 / 0.6 multipliers | Kept as is |
| Forge: +8% per step, cost x1.6 | Kept, max level 5 |
| Rift Shrine, Echo coins, ledger, PvP, story | Cut |
| Iron Warlord | Final boss of level 12 |

Everything is in `content.json` and loaded as data. Effects are rewritten for projectile play, so `launch` and `tap` text replace the old melee `effect` text.

## Why these choices

- **Best Use of Theme:** dancing monsters on the title, MASH! combo banner, victory dance, and "monsters on RUN" as a literal mechanic (skeleton runners sprint for an exit).
- **Most Sticky:** Daily Mash (seeded fort, same for everyone), streak with a day-7 reward.
- **Best Social:** Share a daily score; leaderboard if the platform has one.
- **Best Monetization:** nothing gated. One-time Gold Quiver (5th shot), cosmetic slingshot skins, optional rewarded ad. Built only if the platform has a purchase API.
- **Original ideas only:** the physics-launcher genre is fine, but there are no birds, pigs or any other game's look. Sprites are generated in code, sound is synthesised, so there are no licence problems.

## Schedule (13 days)

| Dates | Stage | Exit check |
| --- | --- | --- |
| 20-21 Oct | 1. Proof of fun, published hello build | The shot feels good. URL is live |
| 22-23 Oct | 2. All weapons, monsters, combo, 4 levels | Public build v0.2 |
| 24-25 Oct | 3. Map, shop, forge, save, levels 5-8 | A player can progress and keep progress |
| 26-27 Oct | 4. Boss, levels 9-12, Daily Mash, share | Full loop playable |
| 28-29 Oct | 5. Polish, monetization, tutorial hints. **Feature freeze 29 Oct** | Every level beaten by hand |
| 30 Oct - 1 Nov | 6. Bug-fix, final publish, **submit form** | Entered by 1 Nov |
| 2 Nov before 9:00 PT | Emergency buffer only | Do not add features |

Your time: about 30-60 min a day testing on a real phone and sending the next stage prompt. The AI does the build.

## Cut order if time runs out

Stretch weapons, second artifact slot, boss polish, levels 10-11 (go to 9 levels with the boss last), Daily leaderboard, skins. Never cut: shot feel, MASH combo, dancing monsters, runner levels, save.

## How to use these files

1. Open Game Studio (or the rundot CLI), start a new project.
2. Paste `02_master_brief.md`, and attach `content.json` if uploads are allowed. If not, paste its contents as a second message.
3. Wait for the Step 0 report. Answer anything it asks, and check the three items above.
4. Send the stage prompts in `03_stage_prompts.md` one at a time.
5. Test each published build on your phone before sending the next stage.
6. After Stage 6, fill in "Enter the jam" in Creator Hub before **2 Nov, 12:00 PT**.
