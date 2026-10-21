# Task: Relic framework (wave 1, part 1): rarity, unlock sources, mini-bosses, treasure chests, pity shop

Follow `docs/handoff/AGY_BRIEF.md` and `architecture/RECIPES.md` (add content through data + registries; numbers in data; flags in config.json; save changes need a migration + schema update + SAVE_VERSION bump with owner-safe migration). Write the LOG.md entry first. Claim rows `S7-01..S7-03` in STATUS.md.

Design source of truth: Claude's proposal in this conversation, summarised here.

## 1. Rarity and loadout rules
- Add `rarity` values `rare` and `legendary` (existing: common, uncommon) with colours in the Mash32 palette (rare blue, legendary gold) used for card borders in Loadout, Shop and Results unlock toast.
- Loadout rule: at most 1 legendary per loadout (enforce in LoadoutScene + `setLoadout`).
- Legendary abilities have `charges: 1` per level (data field `ability.charges`, default unlimited for others): the ability button shows a charge pip and disables after use.
- Forge cost multiplier by rarity in data: rare x1.5, legendary x2.5 (still max level 5).

## 2. Unlock sources (data driven)
- New content.json rows can carry `unlock: { "boss": "<monsterId>" }`, `{ "chest": "<chestId>" }` or `{ "shop": true }`. Weapons not yet owned are hidden in the Shop weapons tab except when their `unlock.shop`/pity applies, and appear as locked silhouettes with a hint ("Defeat the Goblin Chief").
- Save: `profile.owned.weapons` gains the id; add `profile.stats.bossLosses[levelId]` counter (migration; default {}), reset on first clear.
- Unlock toast: on Results after a level that granted something, show a sticker panel "RELIC FOUND!" with the icon, name, rarity colour, and a one-line effect text, with the beat-synced sparkle/pop and a synth fanfare.

## 3. Mini-bosses (levels 4 and 8) + Iron Warlord reward
- New monster rows `goblin_chief` (scaled-up grunt, 1.5x, helmet, armour 8, HP ~3x grunt, `boss: true`, simple behaviour: stomps every 4 s causing small ground shake) and `dark_elf_matron` (scaled-up hexer, 1.4x, periodic shield aura that blocks damage to herself and nearby monsters for 2 s: the player must wait or use pierce/ability). Draw them with the Px kit in the existing art style (new 24x24 sprites, 3-tone + outline). Place one in L4 (`level_04.json`) and one in L8 via `scripts/build_levels.py`; re-tune L4 and L8 so the solver still wins in 3-4 shots and keeps no one-shot wins; update `balance_bands.json` if needed.
- Killing the boss grants the relic once (first kill). L12 Iron Warlord grants `w_skyforge_maul`, L4 `w_comet_fists`, L8 `w_bulwark_disc` (these weapons are created in the next task; for now use placeholder ids registered in content.json `weapons` with `unlock` set and a stub behaviour that behaves like the Militia Blade so the pipeline can be tested; the next task replaces the behaviour).
- Boss HP bar at the top of the battle HUD with the boss name.

## 4. Treasure chests
- New level object type `chests: [{ id, x, y, hp, reward }]` (schema + level loader): a breakable wooden chest block with a gold clasp (new sprite 14x12), HP ~40, gives its reward weapon id when destroyed (once per save; if already owned, gives 150 coins instead). Place chests: L3 (`w_steersong_arrow`), L5 (`w_silkline_shooters`), L7 (`w_kinetic_palms`), each in a skill-shot spot (high ledge or behind the fort) with reach verified with `__mm.sweep` (reachable but not on the greedy path).
- Chest break: wood chips + golden sparkle, ding sound, "Relic found!" toast.

## 5. Pity shop (Relic Market)
- Shop gets a "Relic Market" tab behind `features.relics`: after 3 losses on a boss level (stats.bossLosses >= 3) that boss's weapon appears for coins (`economy.relicMarketPrice: {legendary: 1500}`), never free. Show the loss counter ("Lose 3 times to unlock: 2/3").

## Checks
- Extend `tools/regress.mjs`: boss reward granted once; chest reward granted once and coin fallback if owned; loadout rejects a second legendary; pity appears only at >= 3 losses; v-previous save migrates; levels 1-12 bands still pass.
- Run `npm run check`, `npm run build`, `npm run regress`, `node tools/merkle.mjs seal`. No commit or deploy.

## 6. Speed (do this FIRST, before the feature work)
`npm run regress` now takes about 24 minutes (viewport matrix and per-level solver runs). Add `npm run regress:quick` (target under 4 minutes): levels 1, 4, 8, 12 only, the three bug assertions, camera return on one level, one viewport (432x768) and the save fixtures; keep full `npm run regress` for releases. Find why the full run grew (profile per section, print section timings) and cut obvious waste (reuse one browser page, no 2x screenshots in assertions, parallelise viewports) without dropping assertions. Use `regress:quick` during development and run the full one once at the end.
