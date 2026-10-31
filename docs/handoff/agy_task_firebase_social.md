# Task: Firebase backend for the Android app (leaderboards, shared levels, Challenge a friend)

Owner: "add multiplayer support". Plan: **asynchronous** social play on Firebase, no live matches. The app's audience
starts at **age 10**, so no free-text chat, no free-text names, a Report button on shared content, nothing personal
collected. **Do not run the game, a dev server, a browser, npm scripts or any tests; Claude and the owner test.** Work
on the **`android` branch only** (`git switch android` is already done; check with `git branch --show-current`). Read
`AGENTS.md` first. Every number/text in `config.json` or data with a schema entry. Never commit
`google-services.json`, keys or keystores (it is git-ignored; do not print its contents).

## What exists (read these)

- `src/platform/types.ts`: the `Platform` interface. `leaderboard`, `ugc`, `profile`, `serverTime`, `share` are the
  seams. `src/platform/android.ts` currently spreads `noopPlatform` for them; RUN-only features are switched off for the
  Android target in `public/data/config.json` `targets.android.features` (arena, challenges, leaderboard, share,
  voteButton, iap), applied in `src/data/load.ts`.
- The game already has screens that use these seams: Global Challenges (builder levels shared through `platform.ugc`,
  per-challenge boards through `platform.leaderboard`), the Daily Mash board, result screens. Look at
  `src/core/challenges.ts`, `src/core/leaderboards.ts`, `src/core/identity.ts`, `src/platform/boards.ts`.
- Firebase is set up by the owner: project with an Android app `com.godspeedsamarth.monstermash`,
  `game/android/app/google-services.json` in place, **Anonymous sign-in enabled**, **Firestore created in production
  mode**. The packages are installed by Claude before you start: `@capacitor-firebase/authentication`,
  `@capacitor-firebase/firestore` (native Android SDKs; a WebView JS SDK would be rejected by the auto-created API
  key's Android restriction, so do not use `firebase/*` web packages). If an import is missing, say so; do not install.

## Wanted

1. **`src/platform/firebase.ts`**: implement, with the native plugins, `profile()` (anonymous sign-in on first use; id =
   Firebase uid; name = the player's generated display name, see 3), `serverTime()` (Firestore server timestamp via a
   tiny `serverTime` doc write/read, falling back to `Date.now()`), `leaderboard.{submit,top,myRank}` and the full
   `ugc` object, all catching their own errors and returning the safe defaults like the other adapters. Spread it into
   `androidPlatform` after `noopPlatform`. Everything must degrade silently when offline or when Firebase is
   unreachable (the game works exactly as today).
2. **Firestore data model + rules** (write `firestore.rules` and `docs/android/FIREBASE.md` explaining how the owner
   deploys them with the Firebase console, no CLI needed):
   - `boards/{board}/entries/{uid}`: `{ name, score, seconds?, updatedAt }`. Create/update only by the owner uid
     (`request.auth.uid == uid`), score a number between 0 and a per-board maximum stored in `boards/{board}.max`
     (rules read it), name 1 to 24 chars matching the allowed name pattern, only the player's own best (a new score
     must be higher than the stored one), `updatedAt == request.time`. Anyone signed in may read.
   - `ugc/{id}`: `{ type, authorId, authorName, title (1-40), data (map, size-limited), uses, createdAt, updatedAt,
     reports }`. Create/update/delete only by the author; anyone signed in reads; `uses` may be incremented by anyone by
     exactly 1 (recordUse); `reports` may be incremented by anyone by exactly 1 (report) once per uid via a
     `ugc/{id}/reports/{uid}` doc. Entries with `reports >= 5` are hidden by `browse` (the data decides, `config.json`
     `social.hideAfterReports`).
   - Deny everything else. Add a `rules unit test note` listing the cases you reasoned about (no emulator needed).
3. **Safe names**: no typing. On first launch the player gets a generated name "Adjective Animal 123" from two word
   lists in `config.json` `social.names` (about 40 words each, kid-safe), and may reroll it in Settings (Shop or title
   screen utility row) with a button, never edit freely. The name is what boards and shared levels show.
4. **Switch features on for Android** in `config.json` `targets.android.features`: `challenges`, `leaderboard`,
   `share` become true; `arena`, `iap`, `voteButton` stay false. A new `social` feature flag (`features.social`) gates
   everything new so it can be cut. When the player is offline the screens show a short "Offline" message instead of
   hanging (a 6 second timeout, value in config).
5. **Challenge a friend** (new, small): on the level result screen add a **Challenge a friend** button. It calls
   `platform.share` (Android share sheet; add `share` support to `androidPlatform` through `@capacitor/share` only if
   already installed, otherwise copy the text to the clipboard and say "Copied") with text: "I scored 4,200 on Monster
   Mash level 12 with 3 shots. Beat me! Challenge code: MM-X7K2-12-4200". The code is `MM-<4 chars>-<level>-<score>`
   (the 4 chars are a checksum of level and score, so typos are caught). Title screen → **Enter a challenge code**
   (a tiny on-screen keypad of A-Z and 0-9, no system keyboard): validates the checksum and opens that level's loadout
   screen with a banner "Beat 4,200!". After the player's run the result screen shows both scores side by side and the
   share button again ("Send it back"). Level codes use campaign levels 1 to 35 only. No server needed for this one.
6. **Friends' board** is NOT in this task. Leaderboards simply show the top N and the player's own rank.
7. **Report button**: on a shared level's detail screen in Challenges add **Report** (confirm dialog); it calls
   `ugc` report as in 2.
8. Add a short `check-social.mjs` to `npm run check` that validates the code format/checksum round trip for 200 random
   (level, score) pairs and that all name words are unique, 2 to 12 letters, no digits.

## Report

List the files changed, the new data values, and anything you could not finish. List every place you had to guess.
