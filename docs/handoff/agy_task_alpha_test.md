# Task: alpha test the whole game and report every unusual thing

You are an alpha tester for MONSTER MASH: Slingshot Siege (Phaser 3 + Matter slingshot game, 480x270 landscape). Play and probe everything; write down every bug, glitch, oddity, confusing UI, ugly visual, balance surprise, slow screen or console error. **Do not change any game code, data or docs except the files listed under Output.** This is a testing job, not a fixing job.

Read `AGENTS.md` and `docs/monster_mash/02_master_brief.md` first so you know what the game is meant to do.

## How to drive the game

- The dev server is running at `http://localhost:5173/?mock=1&debug=1` (debug gives 99,999 coins and unlocks levels; `mock=1` uses a fake platform). Do not start or stop it. If it is down, say so in the report and stop.
- **Do not launch Chrome yourself** (your sandbox blocks its GPU process). A headless Chrome is already running for you with its DevTools endpoint at `http://127.0.0.1:9333`. Open pages with `PUT http://127.0.0.1:9333/json/new?<url-encoded game url>`, connect to the returned `webSocketDebuggerUrl`, and close them with `GET /json/close/<id>` when done. Do not close the browser itself (`Browser.close`). `tools/probe.mjs` shows how to talk CDP (`Runtime.evaluate` etc.); write your driver script(s) in `.codex-test/` (repo root).
- Capture screenshots with `Page.captureScreenshot` at 1440x810 (`Emulation.setDeviceMetricsOverride`) and also test a phone size (e.g. 844x390 landscape and 390x844 portrait).
- In the page: `window.__game` is the Phaser game (scenes: title, map, loadout, game (battle), shop, forge, builder, arena, practice, challenges, ...), `window.__mm` is the test hook (`load(levelNumber, loadout)`, `fire({angleDeg, power, abilityAfterSteps})`, `settle(steps)`, `activateAbility()`, `state()`, `battle()`), `window.__dbg` has `win()`, `lose()`, `goto(n)`, `unlockAll()`. Wait until the title scene is active before acting (boot takes about 10 s). Also click real buttons (Input.dispatchMouseEvent at canvas coordinates) for the UI tests, not only the hooks, because players click.
- Read console errors and warnings (`Runtime.consoleAPICalled`, `Runtime.exceptionThrown`, `Log.entryAdded`) the whole time; every error is a finding.

## What to cover (aim for breadth first, then depth)

1. Boot and title: load time, menu buttons, music toggle, fullscreen, credits, back navigation from every screen.
2. Campaign: the map, a sample of levels from every realm (1-35 and the boss citadels), win and lose screens, stars, coins, retry, next level, level hints and tutorials (do they show once and stay skipped?).
3. Loadout and shop: buying weapons/artifacts/consumables/cosmetics, equipping, slot limits, the forged-weapon limit text, prices vs balance.
4. Battle: fire every one of the 22 weapons (`content.json` weapons) with and without their ability; check launch speed, flight motion, trails, the ability animation, damage numbers, camera, the aim preview vs where the shot really lands, shots that get stuck, physics explosions, blocks that sink or jitter, monsters that die by themselves, enemy shots (archers, frost giant), boss levels.
5. Legendary set pieces (Comet Fists, Bulwark Disc incl. the sixth-bounce shield dome, Skyforge Maul, Brahmastra Arrow, Alien Dial, Black Hole Marble): do they play fully, are they readable, do they ever freeze, stack, leave leftovers on screen, or crash if you leave the battle mid-effect?
6. Weapon Forge: create and save weapons, costs, the preview art, sounds, using forged weapons in battle.
7. Level builder (Create level): every piece and material, Glue (including rotated pieces), wheel/ball axles (carts should roll), Rope, Pin, Anchor, Unlink, Delete, rotate, zoom/pan/Fit, Test physics, Play, Save, Export/Import, Challenge. Try silly builds (towers, carts, huge stacks) and see what breaks.
8. Challenges and Daily Mash.
9. Global Arena (local mock server): connect, Practice match vs the bot, the Slingshot armory (buy/equip/boost with Arena coins, prices, errors when broke), invite flow with a second browser page (`?mock=1&arenaDevId=bbbb2222&arenaName=Bob`), a full match, results.
10. Text and layout: overlaps, text cut off, unreadable colours, buttons off screen, at desktop and phone sizes.
11. Performance: frame drops or long freezes (measure `game.loop.actualFps` during heavy moments), memory growth over many battles.

## Output

- `docs/handoff/ALPHA_REPORT_2026-10-28.md`: a numbered list of findings. For each: severity (Blocker / Major / Minor / Polish), area, exact steps to reproduce, what you expected, what happened, and the screenshot file name. Put the most severe first. Then a short "worked well" list and a coverage list (what you tested and what you could not test, with why).
- Screenshots in `docs/handoff/alpha/` (PNG, named `NN_short_name.png` to match finding numbers).
- Keep your driver scripts in `.codex-test/` (they will be deleted afterwards).

Do not commit, push, deploy or call `rundot`. Do not edit anything else.
