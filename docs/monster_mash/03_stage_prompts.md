# Stage prompts: send these one at a time, after the master brief

> **Superseded by `docs/blueprint/STAGES.md`** (task cards with acceptance checks). This file is kept for history. Agents should work from the blueprint and `docs/handoff/STATUS.md`.

Send the next stage only when the previous build runs and is published. Each one ends with the same instruction, which is already written at the bottom of each prompt.

---

## Stage 1: Proof of fun (target: Oct 21) **DONE, see 06_cloud_review.md for the follow-ups**

Do Step 0 from the brief if you haven't. Then build the smallest version that is fun to play:

- 384x216 pixel canvas, nearest-neighbour scaling, the 32-colour palette, procedural sprites.
- Slingshot with drag-to-aim, dotted preview, release, physics projectile.
- 1 weapon (Militia Blade) with its tap move (spin-saw).
- A fort of wood and stone blocks with 3 Goblin Grunts, hit-stop, shake, particles, floating damage numbers, coins.
- Win and lose screens, restart button.
- A mute button and the first chiptune blips.

Don't build menus yet. Publish to RUN and tell me the URL. I want to feel the shot. If the shot isn't satisfying, tune mass, gravity, launch speed and hit-stop until it is, before moving on.

*(End of stage: run it, fix what's broken, publish to RUN, reply with the URL and a 3-line status.)*

---

## Stage 2: All weapons and monsters (target: Oct 23)

Before anything else, do the **Stage 1 follow-ups in `06_cloud_review.md`** (scrolling world, weapon registry, tuning moved to data, audio throttle).

Load `content.json` as data (`game/public/data/content.json` is the only copy). Build the other 7 core weapons with distinct launch feel and tap moves, the damage formula with elements, and all 9 monster types, including skeleton runners (path and exit door), goblin bomber chain explosions, the dark elf hexer shield, the imp sine flight and the troll regeneration. Add the combo system and the MASH! banner. Add the loadout picker (4 weapons, order matters). Make 4 levels in Goblin Hills, each with a `worldW` and the camera pan. Level 1 must teach drag and release, level 2 the tap in flight. Run `rundot predeploy` before every deploy.

*(End of stage: run it, fix what's broken, publish to RUN, reply with the URL and a 3-line status.)*

---

## Stage 3: Map, shop, save (target: Oct 25)

Title screen with the dancing conga line, map screen with 3 realms, star counts, shop and forge (weapons, artifacts, consumables, upgrades), the 6 artifacts as data-driven modifiers, the 4 consumables, cloud save through `RundotGameAPI.appStorage` (install and read the `rundot-feature-save` skill first; mute state goes there too), and levels 5-8 in Dark Elf Wood. Add the pause menu. Pause audio and physics from `RundotGameAPI.lifecycles.onPause`, not only the browser's visibility event.

*(End of stage: run it, fix what's broken, publish to RUN, reply with the URL and a 3-line status.)*

---

## Stage 4: Boss, finale, Daily (target: Oct 27)

Levels 9-12 in Iron Keep, including the Iron Warlord boss fight with the visor weak point. Then the Daily Mash: a seeded fort generated from the UTC date of `requestTimeAsync()` (never the device clock) with a streak counter and a reward on day 7, a countdown to the next daily, the `leaderboard` (period `daily`, with `rundot/leaderboard.config.json`) and `social.shareLinkAsync` as in section 6 of the brief. Install and read `rundot-feature-daily-rewards` first.

*(End of stage: run it, fix what's broken, publish to RUN, reply with the URL and a 3-line status.)*

---

## Stage 5: Polish and monetization (target: Oct 29, feature freeze)

First-time experience hints, victory dance, screen transitions, the second chiptune loop, the Gold Quiver and cosmetic skins as RUN Bits items (`rundot/shop.config.json`, config upload; fall back to disabled UI if it fights us), the rewarded-ad hook (`rundot-feature-ads`, hidden on desktop), the tutorial hints (`rundot-feature-tutorial`), a feel pass (`rundot-polish-feel`), the `?debug=1` mode, performance pass on a phone-sized viewport, CREDITS and README. Playtest every one of the 12 levels start to finish and fix any that can't be won or are trivial. **No new features after this stage.**

*(End of stage: run it, fix what's broken, publish to RUN, reply with the URL and a 3-line status.)*

---

## Stage 6: Release (target: Oct 30 to Nov 1)

Bug-fix only. Check: first load time, mute persistence, save and reload, resize, tab-away, and a fresh-player run from the title. Write a store-page description (2 sentences, mention monsters on the run and the MASH combo), a list of 4 screenshots to capture, and a short changelog. Deploy the final build, then ask me before running `rundot game set-public` (it submits the game for review). Send me the URL. Then I submit the "Enter the jam" form.

*(End of stage: run it, fix what's broken, publish to RUN, reply with the URL and a 3-line status.)*

---

## If something goes wrong

- **Out of time on a stage:** cut in this order: stretch weapons, the second artifact slot, boss polish, levels 10 and 11 (go to 9 levels, boss last), Daily leaderboard, cosmetic skins. Never cut: the shot feel, the MASH combo, the dancing monsters, the runner levels, the save.
- **Platform has no API for X:** say so, use the fallback in the brief, move on.
- **Physics unstable (jitter, blocks exploding):** raise solver iterations, lower the time step, make blocks heavier, put bodies to sleep at rest.
