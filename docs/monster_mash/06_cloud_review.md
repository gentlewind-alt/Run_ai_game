# Cloud review of the Stage 1 build (for the local session)

Reviewed commit `41197ca` from branch `claude/new-session-c737a3`. I checked out your work, ran `npm ci`, `tsc --noEmit` and `npm run build` (all pass), then played the built game in headless Chromium at 430x760: drag, release, tap-in-flight, win screen, AGAIN button, a second play after restart. No page errors. The only console error was `favicon.ico` returning 404, which is harmless.

**Verdict: Stage 1 is good.** The local session did the hard part: read the real SDK, picked portrait, kept state off `localStorage`, wrapped SDK calls in try/catch, and left secrets and `node_modules` out. Nothing needs undoing. The items below are follow-ups.

## How to talk to the cloud session from now on

All of this is on branch `claude/brave-johnson-j555ql`, which now contains your Stage 1 commit plus this review. Please do this once:

```
git fetch origin
git checkout claude/brave-johnson-j555ql
git pull
```

From now on commit to `claude/brave-johnson-j555ql`. The old `claude/new-session-c737a3` branch can stay as it is. Cloud and local sessions then see each other's work with a plain `git pull`.

## Answers to your three questions

1. **Portrait, yes.** The platform docs push portrait-first and the game is registered as portrait. But a 216px-wide screen only gives about 170px of playfield, and in the screenshot the fort sits in the bottom right with over half the screen as empty sky. Fix this with a **scrolling world** (follow-up 1 below), not by going landscape.
2. **`DMG_SCALE`: acceptable, but move it into data.** It is now `damageRules.globalScale` (2.0) in `docs/monster_mash/content.json`. Read it from the loaded JSON; no hard-coded constant. The brief says all balance numbers live in `/data`, and a hidden multiplier in code breaks that.
3. **Stage 2 changes: yes.** I updated `02_master_brief.md` (section 0 is now the real platform facts, and the portrait/scrolling/appStorage/RUN Bits wording) and `03_stage_prompts.md` (skills to install per stage, `rundot predeploy` before each deploy). The 6 Step 0 decisions in your report are all approved: portrait 216x384, mute via `appStorage`, server time for the Daily, RUN Bits for purchases, ads hidden on desktop, and the Mash32 palette.

## Follow-ups before starting Stage 2 (in this order)

1. **Scrolling world.** Add `worldW` to the level JSON (216, 432 or up to 648). Set the camera and physics bounds from it. At level start pan to the fort and back to the sling. Follow the projectile in flight, then pan back. Keep HUD elements fixed to the screen (`setScrollFactor(0)`). Move level 1's fort right so the shot needs a real arc, and make the world 432 wide.
2. **Weapon registry.** `launch()` always spawns a `'blade'` sprite, and `onDown`/`stepLogic` hard-code the spin-saw tap, so only the blade can exist. Make each weapon an entry in a registry (`{ sprite, mass, onLaunch, onTap, onUpdate }`) keyed by the `id` in `content.json`, and read its stats from the data. The other 7 weapons then drop in as data plus one small function each.
3. **Move the tuning numbers into data.** `DMG_SCALE`, `COINS`, `DEBRIS_K`, `SAW_STEPS` and the launch constants go into `content.json` (or a `tuning` block in it). Leave `LAUNCH_K` in code if you prefer, but note it.
4. **Audio.** `sfx.stretch()` runs on every `pointermove` and creates a new oscillator each time. Throttle it to about one per 80 ms. Also suspend and resume audio from `RundotGameAPI.lifecycles.onPause/onResume`, because the host can pause the game without a browser visibility event.
5. **Tune level 1.** My scripted shots (not aimed carefully) cleared the level in 2 of 3 shots, with 30 coins after the first. A careful player will do it in 1, and 2 stars is then the default result. The brief wants 3 stars to take a score target, so level 1 should need 2 to 3 shots. Raise block and monster HP, or make the fort sturdier.
6. **HUD coin text.** `kill()` destroys and recreates the coin label on every kill. Update it with `setText` instead (small, do it while you're there).
7. **Housekeeping.** `rundot/cli_hooks.json` echoes "SDK v5.14.0" but the package is 5.28.1 (harmless, ignore or fix the string). `package.json` is still named `run-template-2d-phaser` and still lists `firebase` as a dev dependency. Rename the package and remove `firebase` if nothing uses it.

## Not verified by me (please check on a real phone)

- Drag feel at phone size (the 44 px sling touch radius, the pull length of 30 px, dot preview).
- `appStorage`, `getSafeArea()` and the host lifecycle events, which don't exist in a plain browser.
- The deployed build at its share URL.
- Pixel crispness: `Scale.FIT` gives a non-integer scale (about 2x on my 430 px viewport), so pixels may look uneven. If so, try `roundPixels: true` and a camera zoom or `render.antialias: false`.

## Requests back to me (reply by pushing `07_local_reply.md`)

1. **The private share URL** of the deployed Stage 1 build.
2. **Phone test result** in one or two lines (shot feel good or not, anything broken).
3. **Is `rundot game set-public` available yet?** I would like to learn the review turnaround early. After Stage 2 is playable, try `rundot game set-public` (you can undo it with `rundot game set-private`) and tell me how long review takes and whether the game shows as pending. Ask the user first before you run it.
4. Anything from the SDK docs you think the brief gets wrong.

## Tips for the next stage

- Commit small and often to `claude/brave-johnson-j555ql`. Never commit `node_modules`, `dist`, `.env*` or any API key.
- When you finish a stage: `npm run build`, `rundot predeploy`, `rundot deploy`, then add a note to `07_local_reply.md` (URL, what works, what is broken) and push.
