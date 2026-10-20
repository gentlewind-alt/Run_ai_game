# Paste this into the cloud session

The local session followed `00_local_kickoff.md`. Please check what it did against your brief and tell me what is wrong or missing. Here is what happened.

**Setup**
- `rundot` 7.18.0 installed manually on Windows (downloaded `rundot-windows-x64.zip` from the release, copied `rundot.exe` to `%LOCALAPPDATA%\Programs\Rundot`). `install.ps1` was read first; it failed to parse under PowerShell 5.1 (UTF-8 encoding), so the install was done by hand. The CLI is not on PATH.
- `rundot download-docs` does not exist in 7.18.0. SDK docs ship in `node_modules/@series-inc/rundot-game-sdk/docs`. `rundot skills list` shows `rundot-sdk`, `rundot-feature-save`, `rundot-feature-daily-rewards`, `rundot-feature-ads`, `rundot-feature-tutorial`, `rundot-polish-feel`. They are NOT installed.
- Template `run-template-2d-phaser` is in `game/`. Game registered with `rundot init --orientation Portrait`. Game ID `801iibtm8zry2bD7JX0m`.

**Step 0 report:** `docs/monster_mash/04_platform_report.md`. Please check these decisions:
1. Portrait, internal 216x384 (the brief's 384x216 landscape was swapped).
2. Mute state goes through `RundotGameAPI.appStorage` (localStorage is blocked in the iframe).
3. Daily Mash seed/streak should use `requestTimeAsync()` server time, not the device clock.
4. Purchases are RUN Bits (`iap.spendCurrency`), not cash. Gold Quiver and skins need a `rundot/shop.config.json` upload.
5. Rewarded ads do not run on desktop.
6. The palette is "Mash32": Sweetie 16 plus 16 extra earth/stone tones, not Resurrect 32.

**Stage 1 built and deployed privately** (`game/src/scenes/GameScene.ts`):
- Matter.js physics (Phaser built-in), manually stepped at a fixed 60 Hz with a hit-stop of 3 frames.
- Militia Blade with the tap spin-saw, 3 goblin grunts, a wood and stone fort, particles, damage numbers, coins, win/lose screens, restart, mute.
- Data loaded from `public/data/content.json` and `public/data/level_01.json`.
- Tuning knobs at the top of the file: `LAUNCH_K` 0.22, `DMG_SCALE` 2.0, blade density 0.03.
- `DMG_SCALE` is a global multiplier added on top of the brief's damage formula.
- Verified only through scripted shots in a desktop browser pane. Not yet tested on a phone.

**Side effects to know about**
- The deploy failed on the default thumbnail. A placeholder 512x512 `public/thumbnail.jpg` was rendered from the game.
- The deploy auto-created `rundot/textGen.config.json` (about $500/day AI cap). The local session lowered it to 1000 and 100 credits. The game never calls AI.

**Questions**
1. Is the portrait decision right for the jam, or should it stay landscape?
2. Is `DMG_SCALE` acceptable, or should the formula and HP numbers be left untouched?
3. Anything in Stage 2 (`03_stage_prompts.md`) that should change given RUN's real SDK? Check `docs/monster_mash/04_platform_report.md`.
