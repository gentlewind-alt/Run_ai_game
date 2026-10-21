# MONSTER MASH: Slingshot Siege — Release Checklist (Card S6-01)

This checklist tracks the production release status of **MONSTER MASH: Slingshot Siege** for the RUN.world "Monster Mash" Jam (game id: `83DTzRcGtCh99lCAuhBn`).

---

## 1. Release Verification Matrix

| Area | Item | State | Evidence / Notes |
|---|---|---|---|
| **Build & Test** | `npm run check` | `done` | Data schemas valid, cross-refs clean, 30 days daily check 100% deterministic, `tsc` clean (0 errors). |
| **Build & Test** | `npm run build` | `done` | Vite production bundle generated in `game/dist/` (440 kB gzip chunked, es2022). |
| **Build & Test** | `npm run regress` | `done` | Headless Chrome CDP suite passes: 30-day variety, v1 migration, levels 1-12 in balance band, 0 one-shot wins, 0 console errors. |
| **Build & Test** | `rundot predeploy` | `done` | RUN SDK CLI tool: all 20 checks passed with 0 defects. |
| **Gameplay** | Levels 1-12 Balance | `done` | All 12 levels beaten by greedy solver; shots strictly within authored balance bands (`game/scripts/balance_bands.json`); 0 one-shot wins. |
| **Gameplay** | Boss Level 12 Retune | `done` | Iron Warlord boss (`hp: 680`, `armour: 14`, `maxHitDamage: 272`, stone roofs) beaten in 2 shots with Torc, 3-4 with standard loadout; 0 one-shot wins. |
| **Gameplay** | Torc Multiplier | `done` | `r_stormcaller_torc` multiplier restored to design value `1.6`; effective across all levels without breaking L12. |
| **Gameplay** | Daily Mash Variety | `done` | Template rotation ensures 0 consecutive shared fort archetypes (`pillars`, `towers`, `bunker`) and 0 consecutive shared monster mixes across 30 days. |
| **Gameplay** | Scene Flow & Iris | `done` | Title → Map → Loadout → Battle → Results → Map star iris transitions fully functional; Retry and Next work without page reload. |
| **Storage** | Fresh Save Behavior | `done` | Clean profile initializes with Militia Blade, 0 coins, realm 1 unlocked, modern default fields. |
| **Storage** | v1 Save Migration | `done` | Legacy v1 saves migrate cleanly with 350 coins and stars 1-4 preserved; zero data loss. |
| **Storage** | Mid-Level & Tab Safety | `done` | Save writes debounced (500 ms) on level win and purchase; audio suspends on tab away/host pause. |
| **Storage** | Mute Persistence | `done` | Audio toggle stored in save settings (`settings.muted`), persists across reloads. |
| **Performance** | Framerate Budget | `done` | 60 FPS verified on desktop and simulated 432x768 mobile view; median frame time < 17ms on L12 and Daily Mash. |
| **Performance** | Particle & Draw Budget | `done` | Particle pool capped at 90; `roundPixels: true` enabled; textures procedurally generated at boot. |
| **Cleanliness** | Git Repository Hygiene | `done` | Zero secrets or keys; `dist/` and `node_modules/` strictly untracked in `git ls-files`. |
| **Configuration** | `game.config.json` | `done` | Present and matches `game.config.prod.json`: gameId `83DTzRcGtCh99lCAuhBn`, portrait, `maxDpr: 1.5`, fullscreen enabled. |
| **Configuration** | Feature Flags | `done` | Shipped features enabled (`map`, `shop`, `forge`, `artifacts`, `consumables`, `combo`, `daily`, `leaderboard`, `share`, `tutorial`, `music`, `zoom`). Unapproved/unpriced features safely off (`ads: false`, `iap: false`). |
| **Configuration** | Shop Tab Safety | `done` | `ShopScene` hides `Skins` tab dynamically when `features.iap === false` or `features.skins === false`. Tabs center symmetrically (4 tabs). |
| **Configuration** | Leaderboard Config | `done` | `game/rundot/leaderboard.config.json` configured with `requiresToken: false` for open score submission. |
| **Store & Assets** | Store Thumbnail | `done` | 512x512 rendered graphic present at `game/public/thumbnail.jpg` and `game/public/thumbnail.png`. |
| **Store & Assets** | Jam Description | `done` | 2-sentence description ready in `docs/release/DESCRIPTION.txt`. |
| **Store & Assets** | Release Screenshots | `done` | 4 gameplay screenshots (battle, shop, boss, victory) present in `docs/release/`. |
| **Store & Assets** | Credits Scene | `done` | In-game `CreditsScene` accessible from Title and Map scenes. |
| **Store & Assets** | Player Guide | `done` | Comprehensive mechanics and controls guide authored in root `README.md` and `game/README.md`. |
| **Owner Actions** | Deploy Build | `needs owner` | Execute private deployment via `rundot deploy`. |
| **Owner Actions** | RUN Bits Shop Pricing | `needs owner` | Review/edit prices in `game/rundot/shop.config.json` (currently 0) and upload server config. |
| **Owner Actions** | Set Game Public | `needs owner` | Execute `rundot game set-public` by Thursday 30 Oct. |
| **Owner Actions** | Jam Form Submission | `needs owner` | Submit game in Creator Hub before Monday 2 Nov 12:00 PT. |

---

## 2. Owner Next Steps & Commands (In Order)

Follow these exact steps in sequence to ship the game:

### Step 1: Deploy Production Build to RUN Host
Run the deployment from the `game/` folder. This uploads the built `dist/` bundle to RUN's hosting infrastructure under private visibility.

```powershell
cd game
npm run build
rundot predeploy
rundot deploy
```

*Expected output:* A private share URL (e.g. `https://w.run/u/83DTzRcGtCh99lCAuhBn/private?k=...`). Verify on mobile and desktop browser that the game loads, audio plays, and daily leaderboard functions.

---

### Step 2: Set RUN Bits Prices & Upload Shop Server Config
Currently, catalog items (`gold_quiver`, `skin_bone`, `skin_iron`) have prices set to `0` in `game/rundot/shop.config.json`, and `features.iap` is `false` in `game/public/data/config.json`.

1. Review and set desired RUN Bits prices in `game/rundot/shop.config.json`:
   ```json
   {
     "itemId": "gold_quiver",
     "price": { "type": "bucks", "value": "100" }
   }
   ```
2. Mirror prices in `game/public/data/content.json` under `cosmetics[]` (`priceBits`).
3. Turn on the IAP feature flag in `game/public/data/config.json`:
   ```json
   "features": {
     ...
     "iap": true
   }
   ```
4. Upload the validated shop configuration to RUN:
   ```powershell
   cd game
   rundot game upload-server-config rundot/shop.config.json
   ```
5. Re-run `npm run build && rundot deploy` to publish the updated config.

*(Note: If you prefer to launch without RUN Bits microtransactions for the jam, keep `features.iap: false` and skip this step.)*

---

### Step 3: Make Game Public (By Thursday, 30 Oct 2026)
Make the game public ahead of the submission deadline to allow time for RUN platform review and turnaround:

```powershell
cd game
rundot game set-public
```

*Note:* If needed, you can revert visibility anytime using `rundot game set-private`.

---

### Step 4: Submit the Jam Entry Form (Before Mon, 2 Nov 2026 12:00 PT)
Go to the **RUN Creator Hub** dashboard (`https://creator.run.world`) and complete the "Enter the Jam" submission:

1. **Game Selection:** Select `MONSTER MASH: Slingshot Siege` (`83DTzRcGtCh99lCAuhBn`).
2. **Short Description:** Paste the 2-sentence description from `docs/release/DESCRIPTION.txt`:
   > MONSTER MASH: Slingshot Siege is a tactile 16-bit physics launcher where you fling genuine fantasy weapons with unique active powers to demolish monster fortresses.
   > Master trajectory calculations, chain multi-kill combos, upgrade your forge, and conquer daily siege challenges in a vibrant chiptune monster realm!
3. **Store Icon / Thumbnail:** Upload `game/public/thumbnail.jpg` (512x512).
4. **Screenshots:** Upload the 4 release images from `docs/release/`:
   - `screenshot_1_battle.png`
   - `screenshot_2_shop.png`
   - `screenshot_3_boss.png`
   - `screenshot_4_win.png`
5. **Tags / Keywords:** `physics`, `launcher`, `monsters`, `pixel`, `slingshot`, `retro`.
6. Confirm and submit before **Mon 2 Nov 2026, 12:00 PT**.
