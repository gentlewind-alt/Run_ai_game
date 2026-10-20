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

## 6. Stage 1.5 (user feedback after playing Stage 1), deployed as version 1.1.0
- Weapon queue: waiting weapons idle beside the sling and the next one hops onto it (loading state), the rest shuffle up.
- Camera: pinch zoom, one-finger pan, mouse wheel, and a view-all button (top right). A second UI camera keeps the HUD fixed while the world zooms. Aiming works at any zoom.
- Abilities are an on-screen button (bottom right, space on desktop) instead of tap anywhere. Registry fields: `ability: 'button' | 'impact' | 'both'`, `abilityLabel`, `onAbility`, optional `onImpact` (fires once on the first hit, ground included). A lightning-hammer style weapon is one registry entry plus a content.json row.
- Sling moved to x=56 to make room for the queue. Re-swept level 1: a plain shot kills 0 to 2 monsters, nothing clears it in one shot.
- Untested on a real device: pinch (only the shared zoom function was exercised, via wheel and the button), two-finger input.

## 7. Stage 2 build (deployed as version 1.2.0)
What is in: all 8 core weapons in the registry (`game/src/weapons.ts`), each with its own gravity, mass and ability (button, impact or both); 8 monster types with behaviour (grunt dance, bomber chain blast, archer arrows at the pad, hexer 50-point shields that drop when the hexer is hit, orc brute, troll regeneration unless burning, imp sine flight, skeleton runners with an exit door); element weakness and resist with icons that appear after the first hit; combo chain (3+ kills in 2 s, multipliers from `damageRules.comboMultipliers`), MASH banner on the next beat; score, stars (win, shot left, score target); loadout picker (4 slots, order matters, weapons unlock by level); levels 1 to 4 plus a sandbox level 99 (`?sandbox=1`); `?debug=1` unlocks everything; `?level=N` jumps to a level.

Damage changes you asked for: monsters now take fall damage (`(impact speed - fallThreshold) x fallK`, so a 280 px drop kills a goblin) and impact damage from debris (`debrisK` 9, `fallK` 6, both in `content.json` `tuning`). A monster landing on a block takes the larger of the two.

Design pass (see `08_design_direction.md`): beat clock at 120 BPM (monsters bob, ability button pulses, MASH lands on a beat), Mash Sans 5x7 font with lowercase and sentence case copy, bevelled button kit, impact kit (white flash, shock ring, onomatopoeia popups, yellow big numbers for weak hits, grey for resisted), 3-tone sprites with auto Ink outline, dithered sky and 3-layer parallax.

Things that differ from the stage prompt, on purpose:
- The Iron Warlord (9th type) is left for Stage 4 with the boss fight.
- Home camera framing is computed per level so the sling and every monster are in the first frame (zoom between 0.62 and 1).
- `shotBonusPoints` (300 per leftover shot) made the score target trivial, so targets are now 1200, 1800, 2000, 3000. These need a real playtest in Stage 5.

Found while testing (fixed): Matter here ignores `body.gravityScale`; weapons use a manual per-step force instead. Tweens run on wall-clock time, so tests use `skipToReady()`.

Not verified: any of this on a phone; pinch; sound; the MASH banner was only seen mid-flash; weapon balance beyond the aim sweeps (every weapon kills at least one goblin on level 1 with some aim, scattergun with its blast got a 3-kill combo).
