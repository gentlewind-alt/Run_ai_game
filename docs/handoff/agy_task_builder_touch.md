# Task: builder canvas touch controls (pinch zoom, two-finger pan, tap selects)

Owner (testing on an Android phone): "work on build canvas: both finger drag on canvas zoom in/out, on canvas click
select option is automatically picked." **Do not run the game, a dev server, a browser or any tests; the owner tests.**
Work in `game/`, file `src/scenes/BuilderScene.ts` (and helpers it uses). Keep the code style; numbers in data.

## Today

- Zoom is only the `-`/`+`/`Fit` buttons and the mouse wheel (`wheel()` → `zoomBy()`); levels `ZOOMS`. Moving the zoomed
  view needs the `Hand` toggle (`panMode`) or the middle mouse button, then a one-finger drag.
- A tap on the canvas does what the current tool does: with the default `piece` tool it places a new piece, so tapping
  an existing piece to pick it up first needs the `Select` button.

## Wanted

1. **Two-finger pinch zoom:** with two fingers on the canvas, spreading them zooms in and pinching zooms out,
   continuously (not only the fixed `ZOOMS` steps; clamp between the smallest and largest zoom), centred on the point
   between the fingers so that point stays under the fingers.
2. **Two-finger pan:** moving both fingers together pans the zoomed view (same limits as today's Hand pan). Pinch and pan
   work together in one gesture.
3. A two-finger gesture never places, selects, moves or deletes anything, and cancels any one-finger action that had just
   started from the first finger (undo a piece placed in the last few frames by that touch, or better: delay placing a
   piece until the finger lifts or moves less than a few px, so a second finger can still turn it into a gesture).
   Enable Phaser's second pointer (`this.input.addPointer(1)`).
4. **Tap selects automatically:** a tap (or click) on an existing piece or target switches the tool to `Select` and
   selects that piece (same as if Select had been pressed first), and a drag from it moves it. A tap on empty canvas keeps
   doing what the current tool does (placing the chosen piece). Glue and Rope keep their own behaviour (they need taps on
   pieces). Show the Select button as active when this happens and say so in the status line ("Selected. Drag to move").
5. The mouse keeps working exactly as today (wheel zoom, middle-drag pan, right-click rotate, Hand toggle, buttons).

## Report

List the files you changed and what you did for each numbered item.
