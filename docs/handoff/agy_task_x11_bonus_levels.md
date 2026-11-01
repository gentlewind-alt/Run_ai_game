# X11 · Two new bonus levels: Keg Cellar (36) and Glass House (37)

Read `AGENTS.md` first. Work in `game/`. Owner request: two new, original levels built around classic slingshot-genre ideas: a chain reaction of explosives, and a tall fragile tower that collapses when its supports go. Design them from the descriptions below. Do not copy any other game's level.

Reference for format: `public/data/levels/level_25.json` (bonus realm, siege, worldW 540). Powder kegs are material `keg` (hp 20, blast radius 34). Two kegs chain when their centres are 40 px apart or less.

## Level 36 · "Keg Cellar"
- `id 36`, `realm "bonus_yard"`, `kind "siege"`, `worldW 540`, `shots 5`, flat ground: `terrain [[0,320],[540,320]]`.
- A low stone bunker from x≈250 to x≈400: stone walls (w 10, h 30) at both ends and in the middle, roofed with stone planks (h 6) and one iron plank over the middle.
- Inside the bunker, on the ground: 4 kegs (10x12) in a row spaced 28-34 px apart so they chain, with monsters between them: 2 `orc_brute`, 1 `dark_elf_hexer`, 1 `lava_imp`.
- On the roof: 1 `dark_elf_archer` behind a short wood wall (w 6, h 18).
- The roof protects the kegs from a straight shot. The intended solve is breaking the end wall or lobbing through a gap so one keg goes off and the chain does the rest.
- `hints`: `["Hit one keg and they all go up.", "Open the bunker first."]`.

## Level 37 · "Glass House"
- `id 37`, `realm "bonus_yard"`, `kind "siege"`, `worldW 540`, `shots 5`, terrain with a low mound under the tower: `[[0,320],[220,320],[240,306],[360,306],[380,320],[540,320]]`.
- A three-storey tower centred at x≈300 on the mound: each storey is two `crystal` posts (w 8, h 30) under a `wood` plank (h 6, w ~56); the ground storey posts are `wood` (the supports to hit). Storeys sit flush on each other.
- One monster per storey (`dark_elf_hexer` bottom, `cloud_harpy` middle, `storm_mage` top) plus a `forge_ogre` on the ground beside the tower at x≈380 and a `dark_elf_archer` on a small stone stand (w 10, h 20) at x≈450.
- The tower is light and tall. The intended solve is knocking out the wood supports so it topples onto the ogre, then cleaning up.
- `hints`: `["Glass breaks easy. Go for the wooden legs.", "A falling tower crushes what is under it."]`.

## Placement rules (both levels)
- Every block rests flush on the terrain or on the top of another block (bottom y = surface y; block y is its centre). No overlaps between blocks, or between blocks and monsters.
- Monsters stand on a surface (monster y = surface y - half its height; read heights from existing levels using the same monster).
- Only monsters from the `bonus_yard` realm list in `content.json`.
- `scoreTarget`: set after the solver run (about 70% of the solver's winning score, rounded to 10).

## Wiring
- `content.json` → `realms` → `bonus_yard.levels`: append `36, 37`.
- `scripts/balance_bands.json`: add `"36": {"min": 3, "max": 5}` and `"37": {"min": 3, "max": 5}`.

## Checks
1. `npm run check`, `npm run build`.
2. Do not run the regression suite or take screenshots; Claude will run the solver and the one-shot gate.
3. LOG.md entry, STATUS.md card X11 `review`. Do not commit, push or deploy.

## Do not
Change any other level, weapon, monster, material or physics value; touch `src/`; generate images; spend credits.
