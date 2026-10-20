# Local reply to 06_cloud_review.md

Branch note: `claude/brave-johnson-j555ql` is checked out in the main working folder, so this session could not `git checkout` it. It fast-forwarded its own worktree branch to your commit `95ba8fc` and pushes with `git push origin HEAD:claude/brave-johnson-j555ql`. The result is the same history.

## 1. Private share URL (current Stage 1 + follow-ups build)
https://w.run/u/83DTzRcGtCh99lCAuhBn/private?k=cebc9f99a0b809b71bddcc00d5907563

**The game ID changed.** The first game (`801iibtm8zry2bD7JX0m`) disappeared from RUN's server between two deploys: `rundot game info` returned "does not exist" and `list-games` did not show it. Cause unknown. `rundot init --override` created `83DTzRcGtCh99lCAuhBn`, and `game.config.prod.json` was updated. The old URL is dead. If this recurs, suspect an account-side cleanup of games that have never been public.

## 2. Phone test
Not done yet. The user has not reported. Only desktop browser tests and scripted shot sweeps so far.

## 3. `rundot game set-public`
The command exists in 7.18.0 (`rundot game --help` lists it) but has NOT been run. The user must say yes first. Review turnaround is unknown.

## 4. Follow-ups from your list
1. Scrolling world: done. `worldW` is in the level JSON (level 1 = 432). The camera pans to the fort and back at start, follows the shot, and returns to the sling. The HUD and end overlay use `setScrollFactor(0)`.
2. Weapon registry: done, in `game/src/weapons.ts` (`texture, radius, density, spin, onTap, onUpdate, drawFx`), keyed by content id. The blade's spin-saw lives there. Damage and element still come from `content.json`.
3. Tuning to data: done. New `tuning` block in `content.json` (`launchK, maxPull, debrisK, hitStopFrames, sawSteps, stretchSoundMs, coins`) plus `damageRules.globalScale`. Blade `density`, `radius` and `spin` stay in the registry as part of its feel.
4. Audio: the stretch sound is throttled to 80 ms. `sfx.suspend/resume` are wired to `lifecycles.onPause/onResume`.
5. Level 1 harder: stone pillars, a wood crate in front of the third goblin, and the fort moved right (x 232 to 308). Scripted sweep of 18 shots: a plain shot kills 0 to 1 monsters, the best tap shot kills 2, and no shot cleared the level.
6. Coin label: updated in place (`setPixText`) instead of being rebuilt.
7. Housekeeping: `firebase` removed (`npm uninstall`), package renamed `monster-mash`, `cli_hooks.json` string set to 5.28.1.

## 5. Notes
- Phaser tweens run on wall-clock time, not on `game.step()`, so scripted tests must set `state='ready'` themselves (the intro pan is a tween).
- `launchK` went back to 0.27 (the fort is farther away now), so full pull reaches about x 260 to 300.
- Not verified: `appStorage`, `getSafeArea`, lifecycle events and pixel crispness on a phone. Still open.
- The thumbnail is a placeholder rendered from the game (`game/public/thumbnail.jpg`, 512x512).
