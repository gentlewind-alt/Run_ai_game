# Task: the Android app fills the whole screen (no "windowed" look)

Owner: "the game opens up in Android like a windowed version instead of a full screen."
**Do not run the game, a dev server, a browser, Gradle or any tests; the owner tests on their phone.** Branch: `android`.
Work in `game/`. Keep the code style; numbers in data files.

## Why it looks windowed

- The game has a fixed logical size `W x H` = 480 x 270 (16:9, `src/config/constants.ts`) and Phaser `Scale.FIT`
  (`src/main.ts`). Phones in landscape are about 20:9 (for example 915 x 412 CSS px), so the game is scaled to the full
  height and leaves wide bands left and right.
- `src/core/responsive.ts` lays the canvas out like the desktop web page: it fills those bands with the patterned
  `#backdrop`, may add the `beveled-frame` border and the desktop side HUD, and only goes edge-to-edge when
  `platform.fullscreen.active()` is true. The Android platform (`src/platform/android.ts`) inherits `fullscreen` from
  `noopPlatform`, where `active()` is false.

## What to do

1. **The app is always full screen.** In `src/platform/android.ts` give `androidPlatform` its own `fullscreen`:
   `available()` false (so the title's and pause menu's "Full screen" buttons do not show in the app), `active()` true,
   `toggle()` resolves true, `note()` '', `onChange()` returns a no-op. Then `responsive.ts` never adds the frame or the
   desktop HUD in the app.
2. **Wider logical width on Android.** At startup, before any scene is created, the Android build picks the logical
   width from the screen's landscape aspect: `W = round(H * longSide / shortSide)` using the real screen (window or
   `screen` size, landscape), clamped between 480 and a maximum in `config.json` (new `display.androidMaxWidth`, about
   640, with a schema entry). `H` stays 270. The RUN web build keeps W = 480 exactly as today. `W` is currently a
   module constant imported everywhere; make it settable once at boot for the Android target (for example a
   `setLogicalWidth()` in `src/config/constants.ts` called from `main.ts` before `new Phaser.Game`, with `W` exported as a
   live binding (`export let W`), or a getter), and use it for the Phaser game config width. With `Scale.FIT` the canvas
   then fills the phone edge to edge.
3. **Every screen uses the real width.** Go through every scene in `src/scenes/`, the HUD and widgets in `src/ui/`,
   tutorials, the battle camera (`src/battle/camera.ts`) and the builder (`src/scenes/BuilderScene.ts` and its grid and
   palette) and replace layout literals that assume 480 with positions derived from `W`:
   - things that belong to the left edge stay at their left offset; things on the right edge use `W - offset`; centred
     things use `W / 2`; full-width backgrounds, backdrops, overlays, dimmers and panels that span the screen use `W`.
   - the title screen: the menu plate stays anchored to the right edge, the logo and tagline to the left half.
   - the battle: the camera viewport and its zoom/home logic use the wider width (more of the level is visible; keep
     clamping to the level's world width), the HUD (coins, score, pause, sound, consumables, ability button) anchors to
     the corners.
   - the builder: its canvas and controls anchor to the edges; the build area itself does not change size (levels and
     Global Challenges stay compatible).
   Keep everything working unchanged at W = 480.
4. **Bands, if any remain** (a tablet wider than the max): plain background colour `#111322` behind the canvas in the
   app instead of the dithered pattern.
5. **Safe areas:** the Android activity draws under the status/navigation bars and display cut-outs. Keep the HUD's
   corner buttons at least 8 px (logical) inside the edges so a cut-out never hides them.

## Report

List the files you changed and what you did for each numbered item, and any screen you think the owner should check
first on a wide phone.
