# Task: camera must return to the sling frame after every shot

Follow `docs/handoff/AGY_BRIEF.md`. Log entry first.

Bug from phone test: after each shot the camera follows the projectile but does not return to the original sling framing. Root cause found by Claude: `battle/rules.ts` no longer waits for `atHome` before leaving `settling`, and `battle/camera.ts updateCamera` only eased home during `settling`; Claude already added `else if (b.state === 'loading' || b.state === 'ready') target = homeCx(b);` to `camera.ts`. Verify that this is enough and complete the fix:
- After a shot (any weapon, including boomerang, scatter and ability shots; also after a bomb/consumable use and after pinch/free view resets via the view-all button) the view must ease back to `homeCx(b)` and `homeZoom(b)` before the next aim. If the player pinched/panned (`view.free`), keep the current behaviour (no forced return), but starting the next drag from the sling must still be possible.
- Check the zoom as well as cx returns to `homeZoom`.
- Add a regress assertion in `tools/regress.mjs`: on L1, L3, L5 and L12 fire a shot, wait for the battle to reach `ready` again, wait up to 3 s, assert |view.cx - homeCx| < 3 and |view.z - homeZoom| < 0.02. Also assert the sling is still at 22-26% of the visible width.
- Do not change gameplay timing or balance bands.

Run `npm run check`, `npm run build`, `npm run regress`, `node tools/merkle.mjs seal`. No commit or deploy.
