# Step 0: RUN platform report

Source: SDK 5.28.1 docs shipped in `game/node_modules/@series-inc/rundot-game-sdk/docs`, CLI 7.18.0. Not yet verified on a device.

## Stack and workflow
- Template: `run-template-2d-phaser` (Phaser 3 + Vite + TypeScript), copied to `game/`. Build output goes to `./dist`. Vite target es2022.
- Flow: `rundot login` → `rundot init --name ... --description ...` → `npm run build` → `rundot predeploy` → `rundot deploy` (private, unlisted, returns share URL). `rundot game set-public` submits for review.
- Docs: no `rundot download-docs` in 7.18.0. Docs ship inside the npm package (path above). `rundot skills list` offers `rundot-sdk`, `rundot-feature-save`, `rundot-feature-daily-rewards`, `rundot-feature-ads`, `rundot-feature-tutorial`, `rundot-polish-feel`.
- Bundle limit: 100 MB zipped. No problem for a procedural-art game.
- Only own-origin and Google Fonts can be loaded. No external servers. `localStorage`/`IndexedDB` are NOT available in the iframe.

## Screen
- Orientation is reported at runtime (`system.getDevice().orientation`, `viewportSize`). Docs and skills push **portrait-first** (`rundot-polish-feel`). Host UI sits inside the viewport; use `system.getSafeArea()` (read after init, not at module top level).
- Decision: **landscape, internal 480x270 (16:9)** (owner decision S8-landscape). Measured high-lob apex and fort heights confirmed 480x270 framing with open sky. Full-screen Rotate Device overlay for portrait viewports.

## Features
| Brief feature | RUN support | Plan |
|---|---|---|
| Save data | `appStorage` (cloud, ~977 KiB/value, 10 MiB/bucket) | Use it. One versioned JSON blob. |
| Server time | `requestTimeAsync()` | Daily Mash seed + streak + "next daily in" use this, not the device clock. |
| Leaderboard | `leaderboard.submitScore / getPagedScores / getMyRank`, default periods alltime + daily | Use it for the Daily Mash board (period `daily`). Config in `rundot/leaderboard.config.json`. |
| Share / challenge | `social.shareLinkAsync` (native share sheet on mobile, clipboard on web) with `shareParams` + title/description | Use it. Challenge text carries MASH + RUN. |
| Player name/avatar | `getProfile()` → `id`, `username`, `avatarUrl?` | Use for leaderboard rows. |
| Rewarded ad | `ads.isRewardedAdReadyAsync / showRewardedAdAsync`. **Not on desktop.** | Use for "double coins". Hide on desktop. |
| Purchases | `iap.spendCurrency` with **RUN Bits** (not cash). Shop catalog via `rundot/shop.config.json` + `upload-server-config` + tag. Entitlements API for ownership. | Gold Quiver + skins as RUN Bits items. Needs server config upload; do last. If it fights us, ship disabled buttons as the brief says. |
| Notifications | `submitMessageAsync` (local reminders) | Optional daily reminder. Cut if short on time. |
| Haptics | Haptics API | Optional, cheap. |

## Not allowed / watch out
- No own backend, no third-party auth, no `window.open`, no `requestFullscreen`.
- All SDK calls can reject: wrap each in try/catch.
- Browser storage unavailable: the brief's "mute remembers state" must go through `appStorage`.

## Brief changes to apply
1. Portrait 216x384 layout (move the sling to bottom-left, forts upward-right).
2. Save and mute state use `appStorage`.
3. Daily seed and streak use server time (UTC date from `serverTime`).
4. Purchases are RUN Bits, not cash. Rewrite section 6 wording accordingly.
5. Ads hidden on desktop.
