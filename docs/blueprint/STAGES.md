# Stages and task cards

Each card is one commit (or one PR), around 400 changed lines or fewer, and it leaves the game buildable and playable. Cards list what they depend on. Cards without a dependency between them can run in parallel in different sessions. Track status in `docs/handoff/STATUS.md`, not here.

**Card format:** **ID** · title · *depends on* · size (S < 150 lines, M < 400, L = split it if you can) · Do · Done when · Data · Flags.

"Done when" always includes the **standard checks**, so they aren't repeated per card: `npm run check` and `npm run build` pass, the game plays from load to a win and a loss with no console errors, and STATUS.md plus LOG.md are updated.

Schedule: S2 by 23 Oct · S3 by 25 Oct · S4 by 27 Oct · S5 by 29 Oct (feature freeze) · S6 by 1 Nov (submitted).

---

## Stage 1: Proof of fun (DONE)

S1 built the sling, the Militia Blade, level 1, the scrolling world, the weapon registry, pinch zoom, the weapon queue and the ability button. Deployed as v1.1.0. History is in `docs/monster_mash/06_cloud_review.md` and `07_local_reply.md`.

---

## Stage 2: Foundation, weapons, monsters, combo (target 23 Oct)

### S2-01 · Split GameScene into the target layout · *none* · L
- **Do:** move code from `scenes/GameScene.ts` into `config/constants.ts`, `data/{types,load,lookup}.ts`, `battle/{world,loop,sling,camera,damage,rules,score}.ts`, `ui/hud.ts`, `art/*`, `audio/sfx.ts` and `content/weapons/{index,blade}.ts`, following ARCHITECTURE.md section 2. Rename the scene to `BattleScene`. **No behaviour change.**
- **Done when:** `BattleScene.ts` is under 300 lines. Level 1 plays the same: same launch arc for the same pull, same damage numbers on a direct hit. Run a scripted shot before and after the change and compare the results (they should match).
- **Data:** none. **Flags:** none.

### S2-02 · config.json, data migration, settings merge · *S2-01* · M
- **Do:** create `public/data/config.json` (starter in DATA.md). Write `config/settings.ts` with the merge order from ARCHITECTURE.md section 9, including the `?debug=1` URL overrides. Move the levels into `public/data/levels/` and use `loadout` instead of `weapon`. Move the blade's radius, density, spin, ability and `sawSteps` into its data row (`physics`, `ability`, `params`). Read the sling position and ground from `config.world`. Keep reading the old fields as a fallback for one card, then delete them.
- **Done when:** `check-data` reports no deprecation warnings, and `?debug=1&tune.launchK=0.35` visibly changes the shot.
- **Data:** config.json (new), content.json weapon row, level_01. **Flags:** `zoom: true`.

### S2-03 · Event bus, BattleCtx, seeded RNG, platform adapter · *S2-01* · M
- **Do:** `core/events.ts` (typed, with `clearBattle()`), `battle/BattleCtx.ts` implemented by the battle modules, `core/rng.ts` (mulberry32, seeded per level). `platform/{types,index,rundot,mock}.ts` with the Platform interface. Move every SDK call (appStorage mute, safe area, lifecycle, analytics) behind it. Change `WeaponImpl` methods to take `(ctx: BattleCtx, p: Proj)`.
- **Done when:** `grep -rn "rundot-game-sdk" src | grep -v platform/rundot.ts` prints nothing, no file in `content/` imports from `scenes/`, and `npm run dev` works without the RUN host through the mock.

### S2-04 · Test hook and shot sweep · *S2-03* · M
- **Do:** `debug/testHook.ts` (ARCHITECTURE.md section 10) and `scripts/sweep.mjs`. The sweep uses playwright-core with Chromium (on the cloud box, the executable is at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`; locally, any Chrome). For each level it fires a grid of 8 angles × 4 powers, with and without the ability, and prints best kills per single shot and whether any one shot clears the level.
- **Done when:** `node scripts/sweep.mjs --level 1` prints a table, and `--all` exits non-zero if a level can be cleared in one shot or no sweep shot damages any monster.

### S2-05 · Weapons: Iron Cleaver, Ashwood Staff, Hunters Pike · *S2-03* · M
- **Do:** one file per weapon in `content/weapons/`, plus a data row (`physics`, `ability`, `params`) and a sprite in `art/sprites/`.
  - **Cleaver:** heavy, short arc. Ability: dive straight down plus a shockwave (`params.shockRadius`, `knockdown`).
  - **Staff:** light, radiant. Ability: a homing bolt at the nearest monster (`params.boltDamageMult`, `turnRate`); every 5th bolt splits.
  - **Pike:** flat and fast. Ability: a speed boost and pierces up to `params.pierce` = 3 wood blocks or monsters.
- **Done when:** each weapon is reachable through a debug loadout (`?debug=1&loadout=w_iron_cleaver,...`). The sweep shows each one killing at least one monster in some shot on level 1.

### S2-06 · Weapons: Scrapheap Scattergun, Hunters Boomerang, Blast Tube, Horned Scepter · *S2-03* · M
- **Do:**
  - **Scattergun:** 5 pellets in a cone, each rolling burn, slow or knockback (`params.pellets`, `coneDeg`).
  - **Boomerang:** curves back. Ability: recall early; the return pass deals double damage and interrupts a hexer.
  - **Blast Tube:** detonates in the air, with damage falling off over `params.radius`.
  - **Horned Scepter:** a curse burst that adds the `curse` status, +15% damage for 240 steps.
  - Add the needed statuses to `battle/status.ts`.
- **Done when:** the same check as S2-05.

### S2-07 · Monster behaviours and materials · *S2-03* · L (split runner off if needed)
- **Do:** behaviours in `content/monsters/`:
  - `basic`: dance idle and panic when hit.
  - `bomber`: explode on death; chains with other bombers.
  - `archer`: stands on towers, visual arrows only.
  - `hexer`: shields neighbours, absorbing `params.shield` = 50.
  - `brute`: heavy.
  - `runner`: walks its `path` to the `exit` and emits `runner:escaped`.
  - `imp`: sine flight.
  - `troll`: regenerates `params.regenPerSec` unless burning.
  - Add `iron` and `crystal` (drops coins) to the world builder. Add the runner kind's lose rule to `battle/rules.ts`.
- **Done when:** a debug level `levels/level_90.json` (ids 90+ are test levels and not in a realm) contains one of each monster and both new materials, and each behaviour is visible.

### S2-08 · MASH combo, score, stars · *S2-03* · S
- **Do:** `battle/combo.ts` counts kills within `damageRules.comboWindowSeconds` and uses `comboMultipliers`. At 3+, show the big MASH! banner with shake and a sting. `battle/score.ts`: points per kill and per block, times the combo, plus leftover shots. Stars: 1 win, 2 with a shot left, 3 at `level.scoreTarget`.
- **Done when:** 3 quick kills show MASH! x1.5; the results show score and stars. **Flags:** `combo: true`.

### S2-09 · Goblin Hills levels 1-4 · *S2-04, S2-05, S2-06, S2-07, S2-08* · M
- **Do:**
  - **Level 1** teaches drag and release (fixed loadout of blades).
  - **Level 2** teaches the ability button (the hint says so).
  - **Level 3** shows weaknesses (wood vs the Horned Scepter).
  - **Level 4** is the first runner level.
  - Set each `scoreTarget` from sweep data, at about 70% of the best sweep score.
- **Done when:** `sweep --all` passes for levels 1-4, and a person beat each one with 3 stars at least once.

---

## Stage 3: Meta loop (target 25 Oct)

### S3-01 · Scene flow: Boot, Title, Map, Battle, Results · *S2-03* · M
- **Do:** `core/flow.ts`. BootScene loads data and save, then builds textures. TitleScene shows the conga-line dance and a Play button. MapScene shows realm strips, level nodes with stars and locked nodes. ResultsScene shows stars, coins, score, Retry, Next and Map.
- **Done when:** a fresh player can go Title → Map → Level 1 → Results → Level 2 without reloading. **Flags:** `map: true`.

### S3-02 · Save system · *S2-03, S3-01* · M
- **Do:** `core/save.ts` with `save.schema.json` v1, a `migrations` array, debounced writes (500 ms) on `profile:changed` and `level:won`, a load at boot, and corrupt-save recovery (keep a backup key, start fresh with a warning in the log). Move mute into `settings.muted`.
- **Done when:** progress survives a reload in dev (mock storage) and in the RUN host. A hand-edited corrupt blob doesn't crash the game.

### S3-03 · Loadout scene · *S3-01* · S
- **Do:** pick up to 4 owned weapons (5 with Gold Quiver) in order, 1 artifact (2 after level 8), and consumables. Show `launch` and `tap` text.
- **Done when:** the chosen order is the in-battle queue order.

### S3-04 · Shop and forge · *S3-02* · M
- **Do:** ShopScene with tabs for weapons, artifacts, consumables and forge. Prices come from data, and items lock by `unlock`. Forge cost is `upgradeBaseCost × upgradeCostMultiplier^level`, up to `maxUpgradeLevel`, and shows before/after damage.
- **Done when:** buying and upgrading change coins and owned items, persist in the save, and change in-battle damage. **Flags:** `shop: true`, `forge: true`.

### S3-05 · Artifacts (6) · *S2-03, S3-03* · M
- **Do:** `content/artifacts/` using `install(ctx, params)` and `modifyDamage`:
  - **Gale Eye:** the ability also bursts wind.
  - **Echo Stone:** a ghost shot 0.3 s behind for 50% damage.
  - **Lodestone Bracer:** pulls coins.
  - **Analyst Lens:** longer preview, shows HP and weakness.
  - **Stormcaller Torc:** every 5th hit calls lightning.
  - **Gamblers Charm:** +20% coins.
- **Done when:** each artifact's effect is visible in the debug level with that artifact equipped. **Flags:** `artifacts: true`.

### S3-06 · Consumables (4) · *S2-03, S3-03* · S
- **Do:** Jury-Rigged Bomb (targeted; 1 in 5 fizzles, using the level RNG), Prime Serum (next 2 shots +20%), Mindflash (stun all for 60 steps), Chainward Talisman (targeted chain). Show them in a HUD tray, one use per level.
- **Done when:** each one works and is consumed from the save. **Flags:** `consumables: true`.

### S3-07 · Dark Elf Wood levels 5-8 + pause menu · *S2-09 tooling, S3-01* · M
- **Do:** 4 levels featuring archers, hexers and imps, with a new background generator and music key. Add a pause menu (resume, restart, mute, map) and pause on `platform.lifecycle.onPause`.
- **Done when:** `sweep --all` passes for 1-8.

---

## Stage 4: Finale, Daily, social (target 27 Oct)

### S4-01 · Iron Keep levels 9-11 · *S3-07* · M
- **Do:** levels with brutes, trolls, iron blocks and runners, using a 648-wide world.
- **Done when:** `sweep --all` passes.

### S4-02 · Iron Warlord boss (level 12) · *S2-07* · M
- **Do:** `levelKinds/boss.ts` and a `iron_warlord` behaviour. The visor weak point opens every `params.visorOpenEvery` steps and takes 2x damage while open. He throws boulders for screen shake only. The win unlocks the Gatebreaker Ram (if built) or gives a big coin reward.
- **Done when:** the boss can be beaten with the level loadout, and not in fewer than 3 shots.

### S4-03 · Daily Mash generator · *S2-03, S3-01* · M
- **Do:**
  - `levelKinds/daily.ts` builds a level from `rng(seed = YYYYMMDD of platform.serverTime() in UTC)`, using fort templates (pillars, towers, bunkers) and a monster mix by weekday.
  - The output must pass `level.schema.json`; add a unit check in `scripts/check-daily.mjs` that generates 30 days and validates them.
  - One attempt per day.
- **Done when:** two devices on the same day get the same fort. **Flags:** `daily: true`.

### S4-04 · Streak, countdown, day-7 reward · *S4-03, S3-02* · S
- **Do:** `save.daily` tracks `lastDay`, `streak` and `best`. A streak breaks after a missed day. On day 7, grant `economy.dailyStreakRewardCoins` or a cosmetic. The map shows "next daily in HH:MM:SS" from server time.
- **Done when:** faking the server time in the mock moves the streak correctly across 1, 2 and 8 days.

### S4-05 · Leaderboard and share · *S4-03* · S
- **Do:** submit the daily score through `platform.leaderboard` (board `daily`) and add `rundot/leaderboard.config.json`. ResultsScene shows the top 10 and my rank. The share button calls `platform.share` with text containing MASH and RUN.
- **Done when:** it works in the RUN host. The mock shows fake rows. **Flags:** `leaderboard: true`, `share: true`.

---

## Stage 5: Polish and monetization (target 29 Oct, FEATURE FREEZE)

### S5-01 · Tutorial hints · *S3-02* · S
- **Do:** one-line hints from `level.hints`, each shown once (`save.flags`). Install and read the `rundot-feature-tutorial` skill. **Flags:** `tutorial: true`.

### S5-02 · Theme pass: conga, victory dance, music · *S3-01* · M
- **Do:** monsters bob to the beat, the conga line on the title, ghosts dance on a win, two chiptune loops. **Flags:** `music: true`.

### S5-03 · Rewarded ad: double coins · *S3-01* · S
- **Do:** read the `rundot-feature-ads` skill, then add a Results button shown only when `platform.ads.rewardedReady()`, which is never on desktop. **Flags:** `ads: true`.

### S5-04 · Gold Quiver and skins (RUN Bits) · *S3-04* · M
- **Do:** `cosmetics[]` and `rundot/shop.config.json`, then upload the config. Buying goes through `platform.iap`. If it fights us after 2 attempts, ship the disabled buttons with a "coming soon" note. **Owner approval for prices.** **Flags:** `iap: true`.

### S5-05 · Feel and performance pass · *all S2-S4* · M
- **Do:** read the `rundot-polish-feel` skill. Test at 4x CPU throttle, check pooling and particle caps, use `roundPixels`, and add haptics on a MASH.
- **Done when:** 60 fps in the throttled test on the boss level.

### S5-06 · Credits, README, thumbnail · *none* · S
- **Do:** a credits screen, a README for players, and a real 512x512 thumbnail rendered from the title scene.

---

## Stage 6: Release (30 Oct to 1 Nov)

### S6-01 · Release checklist · *S5 done* · S
- **Do:** check with a fresh save; reload mid-level; tab away; mute persistence; slow network first load; every level beaten by hand. Bug fixes only.

### S6-02 · Go public · *S6-01* · S · **OWNER APPROVAL**
- **Do:** `rundot game set-public` **by 30 Oct**, because review time is unknown. Record the review status in LOG.md.

### S6-03 · Jam entry · *S6-02* · **OWNER ONLY**
- **Do:** the owner fills in "Enter the jam" in Creator Hub before **2 Nov 12:00 PT**. The agent prepares a 2-sentence description and 4 screenshots in `docs/release/`.

---

## After the jam (scaling path)

These cards reuse the same registries and recipes. None of them needs an architecture change.

- **S7-xx · More weapons:** port from `catalogue/weapons.json`, 15 archetypes → one behaviour each, with variants as data only (RECIPES.md → "Port an item").
- **S7-xx · More realms:** add a realm row, a background generator, a music key and level files.
- **S7-xx · Events and seasons:** use `config.features` plus a dated `events[]` section in content.json.
- **S7-xx · Async PvP / ghost replays:** the fixed step and seeded RNG make a shot replayable from `(levelId, seed, angle, power, abilityStep)` on the same build. Physics floats can differ across devices, so compare scores from the submitted result and use replays for show, not for anti-cheat.
