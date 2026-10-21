# Task: convert the game from portrait 216x384 to LANDSCAPE (16:9)

Owner decision: the game is landscape now, not portrait. Follow `docs/handoff/AGY_BRIEF.md` (design direction binding). WRITE THE LOG.md ENTRY FIRST and update as you go. Claim row `S8-landscape`. Use `npm run regress:quick` as your loop (the full one once at the end). Git is the undo, but do not leave the game half-converted between runs.

## 1. Logical size
- Choose the logical field size by measurement, not guess: candidates 384x216 (the original brief's size) and 480x270. Fire the steepest, highest shots (angle 75, power 1, every weapon incl. Blast Tube lob) with `__mm` and measure apex height above the sling and the tallest forts (L5/L6/L9/L12). Pick the smaller size only if apex and fort tops stay visible at home zoom with no clipping; otherwise 480x270. Record the table in LOG.md.
- Put `W`/`H` in `config/constants.ts` as the only source (replace the 140 uses of `W` and the hardcoded `H`/`384`/`216` literals; no magic numbers in scenes; derive anchors from W/H). Physics, reach, weapon stats and level JSON world units stay UNCHANGED so the balance bands still hold (the solver ignores the view).
- `game.config.json` and `game.config.prod.json`: `"orientation": "landscape"`. Check `rundot predeploy` still passes and note in LOG.md anything the CLI says about orientation or registration. DO NOT run `rundot deploy`, `rundot init`, or `set-public`.

## 2. Scenes re-laid for landscape (all of them, designed, not stretched)
Title (logo left or top-centre, conga line along the bottom, buttons right), Map (three realms as three side-by-side or stacked panels that fit 16:9, with nodes, stars, Daily card, Shop/Credits/Title buttons), Loadout (weapon grid on the left, slots/artifacts/items on the right, Fling button), Shop (tabs on top, wider card grid: 4 per row), Results (win/lose panel centred, wider layout, leaderboard to the side for Daily), Pause overlay, Credits, boss HUD bar, consumable tray (bottom-left row), mini-hints, unlock toast. Re-take every layout fix from earlier phone tests (no text over icons, 24px touch targets at 480-wide scaled down to a 667x375 phone landscape, safe-area insets on left/right for notches).
- Battle: sling at about 14-18% from the left, fort centred in the remaining width with right margin, ground visible at both ends; update `tuning` data (`homeSlingFrac`, `homeMarginRight`, `homeZoomMin`, `homeLeft`); ensure the camera follow, return-home, view-all, pinch/wheel zoom and pan still work; `groundFrac`/`zoomOutRise` re-tuned so ground sits in the lower third with open sky above for lobs.
- Backgrounds/parallax: rebuild `art/backgrounds.ts` and terrain textures for the new aspect so nothing is stretched or blank at the edges (realm sky, hills, wood, keep). Title/Map artwork re-composed for 16:9.

## 3. Responsive shell for landscape
- `core/responsive.ts`: fit/integer-scale the 16:9 field on phone landscape (e.g. 667x375, 812x375, 915x412), tablet landscape (1024x768, 1180x820), desktop 1920x1080 and ultrawide; backdrop fills any leftover bars (decorative side panels no longer needed; keep the controls hint only if there is room).
- Portrait devices/windows (e.g. 375x812): do NOT show a tiny letterboxed strip. Show a full-screen styled "Rotate your device" overlay (pixel art phone-rotate icon in Mash32, the game title) while in portrait, hide it in landscape, and pause the battle while it shows. (If `rundot`/host locks orientation this overlay is simply never seen.)

## 4. Verification
- Update the responsive viewport matrix (`tools/responsive_shots.mjs`) to landscape sizes: 568x320, 667x375, 812x375, 915x412, 1024x768, 1180x820, 1920x1080, 2560x1080, plus portrait 375x812 (assert the rotate overlay). Screenshots of Title, Map, Loadout, Shop (all tabs), Battle (L1, L5, L12 boss, Daily), Results win/lose, Pause, Credits into `docs/handoff/shots/land/`. Review each against `docs/monster_mash/08_design_direction.md` and fix ugly results before finishing.
- Update all regress assertions that hardcode 216/384 or the 22-26% sling fraction to the new targets (derive from constants). Level bands L1-12 must pass unchanged. Camera return, Next->Loadout, no-overlap, relic checks all still pass.
- `npm run check`, `npm run build`, `npm run regress:quick`, then the full `npm run regress` once, `node tools/merkle.mjs seal`. No commit or deploy.
- Update `architecture/ARCHITECTURE.md`, `AGENTS.md` (portrait 216x384 -> landscape new size) and `docs/monster_mash/04_platform_report.md` decision line.

## 5. Known defect to fix while re-laying the cards
In Loadout, "Steersong Arrow" renders clipped as "Steersong Arr". Make every weapon name (including the long relic names that will arrive: Skyforge Maul, Comet Fists, Bulwark Disc, Silkline Shooters, Kinetic Palms, Gatewright Pistol, Unmaker Scythe, Conqueror's Wand) fit its card: wider text area in landscape, `shortWeaponName` fallback, or two-line wrap. Add a regress assertion that no card text exceeds its card bounds.

## 6. Do not run tests while another agy/regress run shares the machine
Headless Chrome and the Vite port are shared; concurrent runs make `window.__mm` undefined and fail everything. Run one at a time.
