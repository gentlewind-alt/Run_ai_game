# Design direction: Monster Mash

Written by the local session as designer and instructor. The cloud session reviews it; the user has the final say. Each stage in `03_stage_prompts.md` carries a **Design pass** that points back here.

## Brief in one line

A portrait 16-bit slingshot game for phone players and jam judges. In five seconds it must say: funny, physical, and the monsters are having a party.

## Where we are (honest critique of Stage 1)

Works: readable silhouettes, a clear aiming line, juicy hits. Weak:
- The UI text is a 3x5 caps-only font. M, N and O blur together ("MNNSTER" on the thumbnail), and everything shouts.
- Sprites and blocks are flat. Outlines are consistent, but nothing has a light direction, and the sky is two hard bands.
- Hits are loud in sound but quiet on screen: no flash, no shock ring, damage numbers all look alike.
- The monsters bob, but nothing else shares their rhythm. The theme ("mash", a dance) is only in the name.

## The one memorable thing: the beat

The whole game runs on a 120 BPM metronome, two beats a second. Monsters bob on the beat, the ability button pulses on the beat, and the MASH banner lands on the next beat. A combo of 3 or more kills freezes the screen for a beat, flashes it, then drops. Everything else stays quiet so the beat stands out. That is the "Monster Mash" in the game, not only in the title.

## Tokens

Colour: the Mash32 palette stays (all art must use it). Roles:

| Name | Hex | Used for |
|---|---|---|
| Ink | `#1a1c2c` | every outline and shadow; never pure black |
| Bone | `#f4f4f4` | text, highlights, clouds |
| Mash Yellow | `#ffcd75` | score, stars, weak-hit numbers, the one thing to look at |
| Slime Green | `#38b764` | go and confirm buttons, positive feedback |
| Berry | `#b13e53` | ability button, danger, MASH banner shadow |
| Ghost Cyan | `#73eff7` | echo and ghost effects, aim dots on the Analyst Lens |

Realm skies (each realm has its own light, not just its own tint):
- Goblin Hills: daylight, blue to cyan sky, warm brown earth, green hills.
- Dark Elf Wood: dusk, plum `#5d275d` and navy `#29366f` sky, teal `#257179` trees, cyan firefly sparks.
- Iron Keep: fire glow, slate `#333c57` walls, berry and orange `#ef7d57` light from below.

Type, two faces, both drawn in code:
- **Mash Sans**, a 5x7 pixel face with lowercase. Every UI sentence is in sentence case: "Fling", "Next level", "Out of shots". It replaces the 3x5 caps font for words.
- The 3x5 face stays for numbers only (score, coins, damage numbers), where it reads well.
- **Block title**: hand-drawn 9px letters for "MASH" and the banner, each letter bouncing on its own beat offset.

Shape and light:
- 1px Ink outline on every sprite, block and button. No glow, no CRT scanlines, no neon.
- Light comes from the top left. Each material has 3 tones: highlight, base, shade (wood, stone, iron, skin).
- Buttons are chunky bevelled sticker panels: 1px Ink outline, a 1px highlight on top, a 2px shade underneath. They sink 1px when pressed.

Layout (216x384 internal, three bands):

```
+----------------------+  y 0
| coins 120   [?] [s]  |  HUD: 24px, safe-area aware. Only coins, view-all, sound.
+----------------------+  y 28
|                      |
|     play area        |  Sky, fort, monsters. Nothing UI lives here except short hints.
|                      |
+----------------------+  y 330
| queue  >sling<  [ABL]|  Ground band: waiting weapons left, ability button right (thumb zone).
+----------------------+  y 384
```

Alignment: HUD and buttons are edge-aligned to an 8px margin, titles and banners are centred, and body copy in panels is left-aligned with lines under 28 characters.

## Review against the generic pixel-game look

Checked the plan against what a "pixel game" brief usually gets: dark purple CRT, scanlines, neon cyan and magenta, caps everywhere, glowing UI.

Changed after the check:
- Dropped scanlines and neon glow. The game is lit like a sunny sticker book, not a cabinet in a dark room.
- Moved the accent away from orange. A pale orange accent looks like a template, so Mash Yellow is the accent and Berry marks the ability.
- Replaced caps-only labels with sentence case in Mash Sans.
- Put one idea in charge (the beat) instead of spreading small effects over every screen.

## Principles for whoever builds a screen

1. One thing moves on the beat per screen, and it is the thing the player should look at.
2. One accent colour per screen (usually Mash Yellow). Berry only for the ability and danger.
3. Every sprite has an Ink outline and 3 tones. If it can't be read at 2x zoom, redraw it bigger.
4. Words are sentence case, active verbs, and the same word for the same action everywhere ("Fling" is always "Fling").
5. Empty and failure screens tell the player what to do next: "Out of shots. Try a different order." Never a bare "Game over".
6. Tap targets are at least 44 css pixels; the ability and Fling buttons are bigger.
7. Before finishing a screen, remove one decoration (the "Chanel check").

## Upgrade ladder: what each stage adds to the design

| Stage | Design pass | Done when |
|---|---|---|
| 2 | Ink and beat: 120 BPM clock, new impact language (white flash, shock ring, onomatopoeia popups, yellow big numbers for weak hits, grey small for resisted), Mash Sans with lowercase, button kit, redrawn goblin and 7 new monsters in 3 tones, 3 weapon-ready sprites per weapon, 3-layer parallax for Goblin Hills, MASH banner with beat freeze | A screenshot of a mid-combo frame reads as "party" without any text |
| 3 | Rooms: title screen conga line on the beat, map with realm lighting (day, dusk, fire), shop and forge as sticker panels with before/after numbers, screen transitions (a star-shaped iris), Dark Elf Wood dusk palette with cyan sparks | Title, map and shop look like one family and share the button kit |
| 4 | Light: Iron Keep fire glow (additive sprites under the walls), boss entrance (shake, vignette, name card), the Daily Mash "poster" card (date, streak flames, share button) | The boss and the daily card are the most memorable frames after the combo |
| 5 | Warmth: victory dance of ghosts, first-time hints as speech bubbles from a monster, second chiptune loop on the beat, skins that actually change the sling silhouette, contrast and tap-size audit | Phone playtest with no unreadable text and no missed taps |
| 6 | Store art: redraw the 512x512 thumbnail with the Block title, capture 4 screenshots (combo, runner level, boss, shop), final Chanel check per screen | A stranger can say what the game is from the thumbnail alone |

## Stage 2 art checklist (what to build, in order)

1. `beat.ts`: `beat(t)` returns phase 0..1 at 120 BPM from server-synced time; the scene calls it, nothing else keeps its own clock.
2. `font5x7.ts` with upper and lowercase, plus a `text()` helper that replaces `pixText` for words.
3. Button kit: `button(scene, x, y, w, h, label, kind)` with bevel, press-down, and a minimum 44 css px hit area.
4. Impact kit: white flash on hit (2 frames), shock ring sized by damage, onomatopoeia popups (bonk, crunch, boom) for big hits, damage number styles.
5. Sprites: redraw the goblin and draw the 7 other monsters and 7 weapons in 3 tones with Ink outlines; troll and orc are 32x32.
6. Goblin Hills: 3 parallax layers (far hills, near hills, treeline) that scroll slower than the camera.
7. MASH banner: block letters, drops in on the next beat, beat freeze plus flash, multiplier shown as "x2".

## Stage 2 status
Done: beat clock, Mash Sans, button kit, impact kit, 3-tone sprites for 8 monsters and 8 weapons, dithered sky and 3 parallax layers, MASH banner on the beat. Not done: the hand-drawn 9px block title (the banner uses Mash Sans scaled up), per-letter beat bounce on the title screen (Stage 3), a second look at Stage 1 blocks and sling for tone consistency.
