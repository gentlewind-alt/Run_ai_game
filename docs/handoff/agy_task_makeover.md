# Task: design makeover, interface fixes, weapons roll again, dearer forging

Owner's request: "increase forging price, bring back weapon rolling on the ground after launch, give the entire game a
make over for design (except the weapons), button overlaps and other interface fixes." **Do not run the game, the dev
server, a browser or any tests. Implement what is described below; the owner tests it.** Read `AGENTS.md` and
`architecture/ARCHITECTURE.md` first. Work in `game/`. Keep the existing code style; numbers go in data files.

## 1. Forging costs more

`game/public/data/forge.json` `costs`: multiply every price in `weapons`, `abilities`, `traits` and `radiances` by 1.5
and round to the nearest 10 (`balanced` stays 0). Keep `reforgeFactor` at 0.5. Nothing else in the forge changes.

## 2. Weapons roll on the ground again

After a shot lands, the weapon should visibly roll and tumble along the ground with the physics, like it used to.
What broke it: `src/battle/weaponAnim.ts` `animateProj` sets the sprite rotation itself every frame for the flight
styles `tumble`, `rock`, `aim`, `flip`, `frisbee`, `corkscrew`, `twirl` and `windmill` (see `flightMove`), so once the
weapon is on the ground the sprite no longer turns with its body. Also `src/battle/loop.ts` forces `align` weapons
(arrows, the pike) to point along their velocity every step, which stops them tumbling after a landing.

Fix:
- Track "has touched the ground" on the projectile (the ground bodies are labelled `'ground'`; `impactAnim` is called
  from `src/battle/damage.ts` `projContact` for every contact; pass whether the other body is ground).
- From the first ground contact on, the sprite follows the physics: rotation = `body.angle` plus the offset it had at
  that moment (so there is no visible snap), for every flight style. The frisbee/corkscrew fake 3D squash stops too.
  The launch pop, impact squash, ability punch and trail keep working.
- From the first ground contact on, `align` weapons are no longer forced to face their velocity (they tumble freely).
- Do not change physics values (friction, density, spin, gravity): only stop the visual and alignment overrides.

## 3. Interface fixes (found by the alpha test, see `docs/handoff/ALPHA_REPORT_2026-10-28.md` and its screenshots in `docs/handoff/alpha/`)

1. **Shop:** the "+300 coins" rewarded-ad button at the top right is partly covered by the `?` help button. Move it so
   they never touch (e.g. below the tabs or left of `?`) at 480x270.
2. **Loadout:** the "Tap weapons to fill slots." prompt stays visible when all slots are already filled. Show it only
   while at least one slot is empty; otherwise show nothing or a short "Ready: tap Fling!" line. The aiming hint at the
   top must not wrap into the slot rows: give it a max width and a single line (shorten or ellipsize).
3. **Loadout:** a long weapon description (for example Forge Cleaver's ability text) runs into the Artifact row. Give the
   description area a fixed box: wrap to at most 2 lines, then ellipsize, so it never overlaps the rows below.
4. **Loadout, forged weapon limit:** tapping a second forged weapon when the level's forged limit is reached changes the
   detail panel to that weapon but silently does nothing else. Show a clear message in the panel
   (e.g. "Only 1 forged weapon in this level") and keep the slot and the detail panel on what is actually equipped.
5. **Every scene:** go through the layout code of every scene in `src/scenes/` and the HUD in `src/ui/` and fix any text
   or button that overlaps another, is cut off, or sits partly off the 480x270 screen. Long labels get a max width and
   shrink or ellipsize (see `fitText` in `src/art/font5x7.ts`). Keep every existing button and action.

## 4. Design makeover (everything except the weapon art)

New RUN-generated UI art (made by Claude; do not call `rundot`) will be in `game/public/sprites/ui/` (snapped to the
Mash32 palette):

| File | Size | Use |
|---|---|---|
| `ui_button_go.png` | 96x32 | green "go" button skin |
| `ui_button_plain.png` | 96x32 | stone "plain" button skin |
| `ui_button_gold.png` | 96x32 | gold "ability"/special button skin |
| `ui_panel.png` | 96x96 | ornate panel frame (stone border, wooden corners, navy centre) |
| `ui_emblem.png` | 96x96 | title-screen crest (goblin, slingshot, tower, banner) |
| `ui_backdrop.png` | 480x270 | dark castle-hall backdrop for menu screens |
| `ui_icon_play/shop/forge/build/arena/challenge/daily/coin/star/back/settings/lock/music/help/map.png` | 24x24 | icons |

If any file is missing when the game runs, fall back to the current drawn look for that element (never show Phaser's
green missing-texture box).

- **Load** the kit in `BootScene` `preload` (texture key = file name without `.png`).
- **Buttons:** `makeButton` in `src/ui/widgets.ts` draws the matching skin as a Phaser `NineSlice` (corner sizes in
  `config.json` under a new `display.ui` block with a schema entry, e.g. buttons 10 px, panels 24 px) for its style
  (`go` → green, `plain` → stone, `ability` → gold). Keep the label text, hit area and every method (`setLabel`,
  `setEnabled`, etc.) exactly as they are so every scene gets the new look with no other changes. Pressed: sink 1 px and
  darken; disabled: grey tint and lower alpha. Keep the click sound.
- **Panels:** `panel()` in `src/ui/widgets.ts` uses `ui_panel` as a NineSlice at any size (small panels shrink the corner
  size so it never breaks).
- **Menu backdrop:** draw `ui_backdrop` behind the menu screens (map, loadout, shop, forge, challenges, leaderboard,
  credits, arena, practice, results). Not behind the title (keep its painted background), the battle, or the builder grid.
- **Icons:** title tiles and main buttons get their icon left of the label (Play, Shop, Forge, Create level/Build, Global
  Arena, Challenges, Daily Mash, Map, Back, Help `?`, Music, Settings). Coin counts show the coin icon; star ratings use
  the star icon; locked levels show the lock icon.
- **Title screen:** place the emblem above the PLAY button, keep the existing background and menu plate layout tidy
  around it.
- **Text:** headings bigger (scale 2 where they fit), body text high-contrast (light on dark with a dark shadow, as
  `text(..., shade)` already supports), consistent spacing between rows.
- Do **not** change weapon sprites, weapon icons in cards, monster art, or battle effects.

## Rules

- No testing, no dev server, no browser, no `rundot`, no commits, no pushes. Only edit files in `game/` (and this brief
  if you need to note something). Numbers in data files with schema entries (`npm run check` will be run by Claude
  afterwards, so keep schemas consistent).
- Keep the Arena verifier bundle working: `scripts/build-arena-headless.mjs` shims `src/art/*`, `src/ui` is not part of
  it; do not import UI code from battle systems.

## Report

When done, list every file you changed and, per numbered item above, what you did.
