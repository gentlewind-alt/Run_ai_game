# Task: makeover follow-up (shop pillars, title consistency)

Owner feedback on the makeover (`agy_task_makeover.md`): "it's good but there are some inconsistencies in the title,
plus these vertical pillars in the shops are distracting and lowering the visibility. Fix it by removing it."
**Do not run the game, a dev server, a browser or any tests; the owner tests.** Work in `game/`, keep the code style,
numbers in data files.

## 1. Shop: remove the pillars, make rows readable

What the owner sees (Shop upgrade and item lists): grey ribbed vertical strips ("pillars") inside every item card,
behind the name and the "Dmg 14 -> 15" text, plus wooden corner braces showing as brown ">" marks on the cards' edges.

Cause: small cards and list rows are drawn with the ornate `ui_panel` NineSlice (`panel()` / card code in
`src/ui/widgets.ts`, `src/ui/cards.ts`, `src/scenes/ShopScene.ts`). At small sizes its carved stone border and wooden
braces stretch and repeat across the card.

Fix:
- Item cards, list rows, slots and any panel smaller than about 140x80 px use a **plain card**: a flat dark navy fill
  (palette `'f'`/`'8'`) with a single 1 px light border (`'9'` or the rarity colour where cards already use one) and a
  1 px dark outline. No texture, no braces, no rivets.
- Keep the ornate `ui_panel` only for big framing panels (the main panel of a screen, dialogs, the title menu plate).
  Put the size threshold in `config.json` `display.ui` (with a schema entry).
- Behind list-heavy screens (Shop, Loadout, Forge, Challenges, Leaderboard), dim the castle-hall `ui_backdrop` with a
  dark overlay (about 70 percent, value in `display.ui`) so its torch columns no longer compete with the cards. Keep
  the backdrop as it is elsewhere.
- Text on cards: high contrast (light text with the dark shadow), names never cut by the price button.

## 2. Title screen: make it consistent (`src/scenes/TitleScene.ts`)

Fix these inconsistencies in the right-hand menu plate:
1. The bottom utility row (Music, Fullscreen, Credits) overlaps the plate's bottom frame and the screen edge. Move it
   fully inside the plate with the same margin as the other rows.
2. "Fullscr…" is cut off. Use the short label "Full screen" at a size that fits, or an icon plus a short label; every
   button in that row the same width and height.
3. The music button only says "On"/"Off" with a note icon. Make it read "Music on" / "Music off" (or the music icon
   with a clear on/off state); same style as its neighbours.
4. The captions under the four tiles ("Player levels", "Build and share", "Duel players", "Craft weapons") are bigger
   and heavier than the tile labels and "Build and share" touches the plate's right edge. Use one smaller caption style
   for all four, centred under their tile, inside the plate.
5. Tile icons sit in different places (Challenges' icon at the far left, the others beside the text). Every tile: icon
   at the same offset left of a centred label, same icon size.
6. The PLAY icon is tiny next to the big PLAY text. Scale the icon to match the text height, or drop it.
7. The `?` help button overlaps the plate's top-right corner ornament. Move it just outside or inside the frame so it
   does not cover the corner.
8. Equal vertical spacing between the emblem, PLAY, the two tile rows and the utility row; nothing touches the frame.

Do not change what any button does.

## Report

List the files you changed and what you did for each numbered item.
