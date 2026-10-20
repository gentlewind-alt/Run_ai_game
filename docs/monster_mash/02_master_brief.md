# MASTER BRIEF: paste this once, at the start of the Game Studio chat

You are building a game for the RUN "Monster Mash" jam. Read this whole brief, then do **Step 0** before writing game code.

## 0. Before any code: learn the platform and report back

I don't have the RUN SDK docs, so don't guess. Read the RUN docs and tell me, in a short list:

1. Which stack and project template Game Studio expects (HTML5/TypeScript? a specific engine?), and the build and publish steps.
2. Screen orientation and size on RUN (portrait, landscape or both), and the size limit for the bundle.
3. What the platform provides for: saved player data, leaderboards, sharing or inviting friends, ads, in-app purchases, daily-reset or notification hooks, and the player's name or avatar.
4. Anything that is not allowed.

Then **publish a one-screen "hello" build to RUN as a public game right now**, so the publish pipeline is proven early. We replace it with each new version. Tell me the URL.

Wherever this brief names a feature and the platform has no support for it, say so, cut it, and move on. Never fake it.

## 1. The game in one paragraph

**Monster Mash** is a 16-bit physics launcher. A goblin horde, dark elves and an orc warband have built wobbly forts. You fire real weapons from a slingshot to mash them. There are no characters or avatars: the weapon is mounted on the slingshot, and each weapon is the ammo. You pull back, aim, release, and **tap once in flight** to trigger the weapon's special move. Monsters are alive. They dance when idle, panic when hit, and some **run** for an exit, so you have to stop them. Kill monsters fast and chain them for a **MASH combo**.

Name on screen: **MONSTER MASH: Slingshot Siege**.

## 2. The theme must be obvious (this wins the Best Use of Theme prize)

- The first screen shows the monsters doing a conga-line dance to a chiptune "mash" tune.
- Chaining 3+ kills inside 2 s pops a big **MASH!** banner with screen shake and a combo multiplier (x1.5, x2, x2.5, x3).
- Surviving monsters keep dancing and bob to the beat. When you win, every dead monster's ghost joins a victory dance.
- **Runner** levels: skeleton runners sprint along a path toward an exit door. The player has to catch them first. This is the "monsters on RUN" part.
- The word "RUN" and "MASH" appear in the title, the combo banner and the share text.

## 3. Platform, look and feel

- Pixel art, 16-bit. Internal resolution 384x216 (landscape), scaled up with nearest-neighbour only, no smoothing. If RUN needs portrait, use 216x384 and move the layout, but keep the same art.
- One fixed palette of 32 colours (e.g. the free "Resurrect 32" or "Sweetie 16" palette). Every sprite uses only that palette.
- You may not have an art tool. Draw sprites as palette-indexed text grids in code and render them to textures at startup. 16x16 for monsters, weapons and blocks, 32x32 for the troll and orc, 48x48 for the Iron Warlord. Make 2 animation frames per monster (idle bob, hurt). Palette-swap for rarity tints.
- Backgrounds: 3 parallax layers per realm, generated from simple shapes in the palette (hills, forest, keep walls). Day, dusk, fire-glow.
- Sound: synthesise all sound with WebAudio (blips, thuds, crunch, coin ding, "MASH!" sting). Two short chiptune loops (map, battle) built from note arrays. A mute button that remembers its state.
- Do not use anything you can't license. Use CC0 or your own generated assets only. List any external asset in a CREDITS screen.
- This must be **original**. Don't copy another game's art, characters, UI, levels or names. The slingshot-physics genre is fine; the monsters, weapons, theme and systems below are ours.

## 4. Core gameplay

**Controls:** one finger or mouse. Drag back from the slingshot to aim, release to fire, tap/click anywhere in flight to trigger the "tap" move. The aim preview is a dotted line for the first part of the arc.

**Physics:** use the engine's built-in 2D rigid-body physics. Fort blocks have material, HP and weight. Damage comes from direct hits plus collision force. Make hits feel good: hit-stop of 3 frames, screen shake scaled to damage, dust and wood-chip particles, floating damage numbers.

**Shots:** before each level the player picks a loadout of 4 weapons from the ones they own. Each shot uses one weapon in order. The level ends in a win when every monster is dead. It ends in a loss when shots run out and any monster remains, or when more skeleton runners escape than the level allows. Leftover shots give bonus coins and stars.

**Damage:** `damage = baseDamage × (1 + 0.08 × upgradeLevel) × elementMultiplier × impactFactor × comboMultiplier`.
- `elementMultiplier` is 1.5 when the weapon's element matches the target's weak element, 0.6 when it matches the resist element, otherwise 1.
- `impactFactor` runs from 0.5 (slow scrape) to 1.5 (fast direct hit).
- Show a small element icon (physical, hellfire, radiant, void) over a monster when the player has the Analyst Lens or after the first hit.

**Stars:** 1 star for winning, 2 for winning with at least one shot left, 3 for beating the level's score target.

**Coins:** monsters, crystals and wooden debris drop coins. Coins buy things in the shop. The upgrade cost to go from level N to N+1 is `50 × 1.6^N`, max level 5.

## 5. Content

All numbers are in the attached `content.json`. Treat it as the source of truth, and load it as data. **Don't hard-code the numbers in the game code.**

- **8 core weapons**, each with a distinct launch feel and tap move: Militia Blade, Iron Cleaver, Ashwood Staff, Scrapheap Scattergun, Hunters Pike, Hunters Boomerang, Blast Tube, Horned Scepter. Build these first. The 4 stretch weapons come only if everything else is done.
- **6 artifacts**: pick 1 to equip (2 after level 8). Gale Eye, Echo Stone, Lodestone Bracer, Analyst Lens, Stormcaller Torc, Gamblers Charm. They change how shots behave. **Echo Stone** is the signature artifact: a ghost copy of your shot follows 0.3 s behind.
- **4 consumables**, one use per level, bought in the shop: Jury-Rigged Bomb (1 in 5 fizzles, on purpose), Prime Serum, Mindflash, Chainward Talisman.
- **9 monster types** and 4 block materials with weak elements, as in the file.
- **3 realms of 4 levels = 12 levels**: Goblin Hills (1-4), Dark Elf Wood (5-8), Iron Keep (9-12). Level 12 is the **Iron Warlord** boss, a big sprite with a visor weak point that opens every few seconds. Beating him unlocks the Gatebreaker Ram as a bonus weapon if you built it, otherwise a big coin and star reward.
- Levels are data (a JSON list of blocks, monsters and positions). Build a **tiny in-game debug level editor or at least a hot-reload of level JSON**, so levels can be fixed fast.
- If time runs short, cut to **9 levels** (3 per realm, boss at the end of the third) rather than shipping broken levels.

## 6. Meta loop (this is what the Special Categories judge)

- **Map screen:** a scrolling map with 3 realms and level nodes, star counts, a locked-node look, and a conga line of monsters on the title.
- **Shop and forge:** buy weapons, artifacts and consumables, and upgrade weapons (max level 5). Show before and after numbers.
- **Save:** use the platform's saved-data API (never localStorage alone if the platform offers a cloud save). Save coins, owned items, upgrade levels, star ratings, streak, and daily best.
- **Most Sticky: Daily Mash.** A new seeded fort every day, the same for every player (seed from the UTC date). One free attempt per day plus a **streak counter** with a day-7 reward (a cosmetic slingshot skin or bonus coins). The map shows "next daily in HH:MM:SS".
- **Best Social Features: Challenge a friend.** After a Daily Mash, a **Share** button creates a text/link like "I mashed 12 monsters for 8,430 on today's Daily. Beat me!" using the platform's share or invite API. Show a leaderboard of the day's scores using the platform leaderboard if there is one. If the platform has no social API, tell me and we show a local "your best" and a copy-text share only.
- **Best Monetization:** nothing in the core game is locked behind payment. Offer, via the platform's store only if it exists: (a) **Gold Quiver**, a one-time purchase that adds a 5th shot slot to every loadout; (b) cosmetic slingshot skins (wood, bone, gold, void); (c) an optional rewarded ad for "double coins after a win". Don't use any timers or walls. If there is no purchase API, build the UI for (a) and (b) with the buttons disabled and a note, and tell me.
- First-time experience: no text walls. Level 1 teaches drag-and-release, level 2 teaches tap-in-flight, level 3 shows element weaknesses with a single hint, each in one line.

## 7. Quality bar

- Runs at 60 fps on a mid-range phone. Cap particles. Pool objects. Sleep physics bodies at rest.
- Touch and mouse both work. No hover-only UI. Tap targets at least 44 px at device scale.
- No crash on resize, tab-away, or double-tap. Pause on tab hidden. A pause menu with resume, restart, mute and quit-to-map.
- Everything readable on a small screen: UI text at least 8 px in internal units, high contrast outlines.
- Add a `?debug=1` mode that gives 99,999 coins and unlocks all levels, for testing. Off by default.
- A short **README** and **CREDITS** in the project.

## 8. Order of work (don't skip ahead)

Work in the stages I send next. After each stage: run the game, fix what's broken, **publish to RUN**, and tell me the URL plus a 3-line status (done, broken, next). If something isn't working after two attempts, simplify it instead of looping.
