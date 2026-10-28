# Alpha test report — 2026-10-28

## Findings

1. **Minor — Loadout guidance conflicts with the displayed state.**
   - **Steps:** From Title, choose Play, open Level 1, and leave the default loadout untouched.
   - **Expected:** The empty-slot prompt should disappear when every slot is filled, and the aiming hint should stay clear of the slot icons.
   - **Actual:** “Tap weapons to fill slots.” remains while all six slots contain weapons. The hint wraps into the top slot row.
   - **Screenshot:** `01_loadout_guidance.png`

2. **Minor — The one-forged-weapon limit has no feedback.**
   - **Steps:** Forge and save a Sword and a Cleaver. Open the Level 1 loadout, clear one slot, add Forge Sword, then tap Forge Cleaver from arsenal page 3.
   - **Expected:** The second forged weapon should be rejected with a clear one-per-loadout message.
   - **Actual:** The slot remains Forge Sword, but the detail panel changes to Forge Cleaver and shows its normal description. No limit message appears.
   - **Screenshot:** `02_forge_limit_feedback.png`

3. **Minor — Rewarded-ad controls appear on desktop and collide with Help.**
   - **Steps:** Open Shop or a win-results screen at 1440×810 with `?mock=1&debug=1`.
   - **Expected:** Rewarded-ad controls are hidden on desktop, as specified in the master brief.
   - **Actual:** Shop shows an active “+300 coins” ad button, partly covered by the `?` Help button. Results also offer “2× coins (Ad)”; the mock rewarded flow grants the simulated reward.
   - **Screenshot:** `03_desktop_ad_button.png`

## Worked well

- Title, music toggle, fullscreen, credits, back navigation, map, and first-realms navigation worked.
- Level 1 mouse aiming, battle, win and loss results, stars, coins, retry, extra-shot selection, and next-level navigation worked.
- Shop purchases, consumable stack limit, Gold Quiver, cosmetic equip, Forge saves, and a forged weapon in battle worked.
- Daily Mash seeded for 2026-10-28, challenge list/detail/play, and leaderboard flows worked.
- The builder selected all 14 piece presets, placed all four materials and a target, and exercised glue, rope, pin, anchor, unlink, rotation, zoom, Fit, Test, Play, Save, and the import parser.
- Practice against the bot completed. A two-page local Arena invite and full match also completed; both players cleared at 710, producing a draw. A 60-coin Power boost deducted correctly, and unaffordable purchases stayed disabled.
- Landscape touch input launched a battle shot. Portrait emulation showed the rotate-device prompt. Observed gameplay frame rate was roughly 56–61 FPS.

## Coverage

- **Campaign:** Played Level 1 through win and loss. Loaded Levels 5, 9, and 12 for a one-shot sample; Level 12 initialized with its boss encounter. The remaining campaign stages and full boss fights were not played through.
- **Weapons:** All 22 content weapons received one normal launch and one ability trigger through the fixed-step test hook on Level 1. This checked launch/ability paths for exceptions; it was not a visual review of every weapon effect. Legendary effects were not exhaustively stress-tested for leaving mid-animation, stacking, or long-run leftovers.
- **Builder files:** Save persisted to mock storage and Import accepted that saved JSON through a test `File` event. Export displayed its success message, but headless Chrome produced no file in the configured workspace download directory, so a native download-and-file-picker round trip could not be verified.
- **Platform limits:** Live RUN-host matchmaking, IAP, paid prices, and real rewarded ads were not available under `mock=1`. The Arena match used the local mock server and a second page.
- **Stress:** Extreme tower/cart builds and memory growth over many rendered battles were not measured.
- **Console:** Startup logged the Chromium deprecation warning for `apple-mobile-web-app-capable`. The repeated `__mm.load()` weapon sweep produced Phaser “Cannot pause non-running Scene game” warnings. One uncaught Promise exception came from my own probe treating `window.__mm.platform` as an object instead of calling its getter; no app-origin exception was observed during UI flows.

No game code, game data, or other documentation was changed.
