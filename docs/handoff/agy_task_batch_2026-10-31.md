# Task batch (owner feedback 2026-10-31)

**Do not run the game, a dev server, a browser or any tests; the owner tests on their phone.** Work in `game/`. Read
`AGENTS.md` first. Keep the code style; every number in a data file with a schema entry; gameplay deterministic (fixed
steps, `ctx.rng` / `b.rng`, no `Math.random` in gameplay) so the Arena verifier replays turns exactly. Visual effects may
use tweens.

## 1. Bulwark Disc: 20 bounces, grows stronger with every block it breaks

`src/content/weapons/bulwarkDisc.ts` (light-mirror version, params in `content.json` `w_bulwark_disc`).
- `maxBounces` 6 -> **20** (the shield blast still plays on the last bounce).
- Remove the per-bounce softening (`ricochetFalloff`) for light mode. Instead: **every block the disc destroys raises its
  damage by 50 percent** for everything it hits afterwards (multiplier x1.5 per destroyed block, compounding: 1, 1.5,
  2.25, ...), up to a cap in the params (`maxDamageMult`, 12). Count a block as destroyed by the disc when the disc's own
  hit kills it (the existing damage/kill path knows the weapon id; add a hook or check `wid` on block kills).
- Show the current multiplier above the disc (small "x2.3" text next to the bounce pips) and pulse the disc brighter each
  time it grows.
- Update its `tap` text: "Aims at the nearest monster. Bounces up to 20 times between the mirrors; every block it breaks
  makes it hit 50% harder. The last bounce rings out as a shield blast."

## 2. Builder pieces: thinner and smaller

`content.json` `builder.presets` (and anything that assumes the old sizes, e.g. the builder's grid/snap step): make the
builder's pieces about a quarter smaller and planks thinner so bigger designs fit the frame. For example planks 8 thick
-> 6, post 8x64 -> 6x48, plank 64x8 -> 48x6, short plank 32x8 -> 24x6, square 32 -> 24, long beam scaled the same way,
wedges/circles/balls/wheels about 25 percent smaller. Saved drafts and Global Challenges keep the sizes they were made
with (each block stores its own w/h), and campaign levels are not touched. Grid snapping should still line pieces up
(halve the grid step if needed). Block textures must exist for the new sizes (see `ensureBlockTextures` /
`makeBattleTextures`).

## 3. Burning: flames on things hit by lightning or fire

When a monster or a block is hit by a lightning or fire attack, it **burns** for a short time: small animated pixel flames
(2-3 flickering flame tongues in yellow/orange/red, rising embers) on top of the sprite, following it as it moves and
rotates, fading out at the end. Duration and size in data. Apply it to: lightning strikes (Skyforge Maul bolts, Chain
Rod chains, any `fx.bolt` / electric hit), fire (Horned Scepter fire pool, Blast Tube fireball/nuke, Comet Fists comet,
`flameBlast`, burn status from Scattergun pellets, enemies with fire attacks), and the `hellfire` element in general. If
the existing `burn` status already deals damage over time, keep its damage and only add the visual; otherwise this is
visual only. Do not double-draw flames if a target is already burning (refresh the timer).

## 4. Frost wolf run animation

Claude generated a run cycle: `public/sprites/monsters/frost_wolf_run.png`, a horizontal strip of equal square frames
(frame size = image height; frame count = width / height). Load it in `BootScene` (spritesheet, key `frost_wolf_run`) and
play it as a looping animation (about 10-12 fps, value in data) whenever a frost wolf moves (runner behaviour), and the
still `frost_wolf` sprite when it stands. Flip with its direction like today. If the file is missing, keep today's look.

## 5. Every weapon and artifact matters somewhere, with a tip on its levels

Go through all campaign levels (`public/data/levels/level_*.json`, realms in `content.json` `realms`) and the 22 weapons
and all artifacts (`content.json` `weapons`, `artifacts`). Make sure **each weapon and each artifact has at least one level
(after it unlocks) where it is clearly the best answer**, by adjusting those levels' layouts, monster mix or materials, for
example: armoured stacks for the Pike's pierce, tall towers for the Drill, scattered enemies for the Scattergun, hexer
shields for the Silkline/Boomerang interrupt, ice for fire weapons, many targets in a line for the Chain Rod, a hanging
fort for the Black Hole, rows of standing posts for dominoes. Keep each level beatable with the loadout a player plausibly
has by then, keep monster counts and star thresholds sane, and do not delete levels.
For each such level add a short **weapon tip** to its `hint` (shown today) like "Tip: the Hunters Pike pierces wood: aim
through the planks." (one sentence). Write the mapping weapon/artifact -> level(s) into `docs/handoff/WEAPON_LEVELS.md`.

## 6. Two losses in a row make forging dearer

When the player **loses 2 campaign levels in a row**, forge **ability** prices (`forge.json` `costs.abilities`) go up by a
data percentage (`forge.json` `lossStreak`: `{ "after": 2, "abilityMarkup": 0.25 }`) until the player wins a level, then
they return to normal. Track the loss streak in the profile (add an optional field with a safe default in
`src/core/save.ts` `sanitize`; do **not** change `SAVE_VERSION`). The Forge screen shows a short note when the markup is
active ("Prices +25% after two losses. Win a level to reset.").

## 7. Slingshots: upgrades, pros and cons, new unique slingshots

Today the campaign slingshots are cosmetics in `content.json` `cosmetics` (`kind: "sling_skin"`): `s_quicksilver`
(+25% launch speed), `s_gemini` (twin shot), `s_skin_bone`, `s_skin_iron` (looks only), bought in the Shop's Slingshots
tab, effects applied in `src/battle/setup.ts` via `mods`.
- **Every slingshot gets small pros and cons** (very low differences, a few percent) on these stats, applied through the
  existing `mods` path: damage, launch speed, aim preview length, and an elemental bonus (hex/curse chance, explosion
  radius, poison chance...). Give the existing four slingshots one small con each (e.g. Quicksilver: -5% damage; Gemini:
  -10% aim preview; Bone: +5% curse chance but -5% launch speed; Iron Ballista: +5% damage but -5% launch speed).
- **Add 4 new unique slingshots** with a clear identity and a matching con, e.g. Ember Fork (+explosion radius, -aim),
  Venom Coil (+poison chance, -damage), Hexwood (+curse chance, -speed), Titan Brace (+damage, -launch speed). Use the
  existing sling drawing code to give each its own look (colours/shape), no new art files needed.
- **Upgrades:** each slingshot can be upgraded with campaign coins in the Shop, 3 levels, each level improving its pro a
  little (data: per-level amount and prices; not cheap, rising per level). Store owned upgrade levels in the profile
  (optional field, safe default in `sanitize`, no `SAVE_VERSION` change).
- The Shop's Slingshots tab shows for each: name, look, pro and con lines (green / red), upgrade level pips, Buy /
  Equip / Upgrade buttons. Loadout screen shows the equipped slingshot's pro/con.
- Arena slingshots (`content.json` `arena`) stay separate and unchanged.

## Report

List files changed per numbered item, the new data values, and the weapon/artifact -> level mapping file.
