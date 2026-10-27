# Task: Arena slingshot armory (choose a slingshot, boost it with Arena coins)

Owner's request: "add option to change slingshot in arena and boost its capacities using arena coins".

Read `AGENTS.md`, `architecture/ARCHITECTURE.md`, `architecture/DATA.md` and `architecture/RECIPES.md` first. Work in `game/`.

## How the Arena works today (read these)

- `src/arena/types.ts`: constants, `ArenaSnapshot` (what a player sees: `coins`, wins...), `ArenaCommand` (client -> server), `ArenaSetup` (what `arena:start` returns), `ArenaChallenge { doc, loadout }`.
- `src/arena/authority.ts`: `ArenaAuthority`, the server-owned state (`wallets`, invitations, matches). All Arena coins live here. It verifies each submitted turn by re-simulating it with `deps.verify(challenge, replay)`.
- `src/rooms/ArenaRoom.ts`: the RUN realtime room that hosts the authority (persists `ArenaState`, wires `verify` to the headless verifier).
- `src/arena/headless.ts` `verifyReplay`: runs the battle with a stub scene via `createBattle(scene, 1000, loadout, level, true)`. Bundled by `scripts/build-arena-headless.mjs`; `scripts/check-arena.mjs` tests the authority.
- `src/core/arena.ts`: client connection; `src/scenes/ArenaScene.ts`: the Arena screen.
- `src/battle/setup.ts` `createBattle`: for competitive battles the sling is forced to none (`slingSkin = competitive ? undefined : ...`). Sling effects come from `mods` (`launchSpeedMult`, `twinFraction`, `twinDelaySteps`; see how `content.json` `cosmetics` sling skins `s_quicksilver` / `s_gemini` use them, and `src/battle/sling.ts`).

## What to build

1. **Data** (`public/data/content.json`, schema in `schemas/content.schema.json`, types in `src/data/types.ts`, cross-refs in `scripts/check-data.mjs`): a new `arena` block with
   - `slings`: 4 Arena slingshots. Each has `id`, `name`, `desc`, `price` (Arena coins; the starter one is free and owned by everyone), `skin` (an existing sling skin cosmetic id for the look, or none for the default), and base `mods` built ONLY from effects the battle already supports (`launchSpeedMult`, `twinFraction`, `twinDelaySteps`, `previewMult`, `damageMult`). Suggested: Standard (free, no mods), Quicksilver (faster launch), Gemini (twin shot), Longsight (longer aim preview).
   - `boosts`: 3 upgrade tracks that stack on whichever slingshot is equipped, each with `id`, `name`, `desc`, the mod it raises, `perLevel` amount and a `prices` array (one price per level; 3 levels each). Suggested: Power (`damageMult` +5% per level), Draw (`launchSpeedMult` +4% per level), Aim (`previewMult` +20% per level).
   - Prices must not be cheap: players start with 100 Arena coins and stakes are 0/10/25/50. Suggested slings 150/250/400, boost levels 60/120/200. Keep every number in data.
2. **Server** (`authority.ts`, `types.ts`): extend `Wallet` with optional `slings` (owned ids), `sling` (equipped id) and `boosts` (track id -> level). Old saved wallets have none of these: treat missing as "Standard owned and equipped, all boosts 0". Do NOT change `ArenaState.v`. Pass the catalog to the authority through `ArenaDependencies` (do not import the data loader into authority.ts). New commands `arena:buy-sling` { slingId }, `arena:equip-sling` { slingId }, `arena:boost` { boostId }: validate everything (known ids, owned, max level, enough coins, not during your own playing turn), deduct coins server-side. Add the owned/equipped/boost info and the catalog prices to `ArenaSnapshot` so the client can draw the shop.
3. **Fair replays**: when a player starts their turn (`arena:start`), snapshot that player's equipped slingshot and boost levels into the match for that turn, return the resulting mods in `ArenaSetup`, and pass them to `deps.verify(...)` so the verifier re-simulates with the same mods. A mid-match purchase must not change a turn already started. Show both players' slingshot (name + boost levels) on the match screen so the opponent knows what they face.
4. **Battle**: `createBattle(..., competitive)` takes the Arena mods (from `ArenaSetup` on the client, from the verifier on the server) instead of forcing no sling; the visual skin follows the slingshot's `skin`. Single-player and practice behaviour stays exactly as it is.
5. **UI** (`ArenaScene.ts`, match with the existing look in `src/ui/widgets.ts`): a "Slingshot" button on the Arena screen opening a panel: Arena coin balance, the 4 slingshots (price / Buy / Equip / Equipped), the 3 boost tracks with level pips, next-level price and a Boost button (disabled when broke or maxed), short descriptions. Errors from the server show the existing way. Add one tutorials.json page explaining it (Arena section).
6. **Tests**: extend `scripts/check-arena.mjs`: buying deducts coins, can't buy twice or when broke, boost caps at max level, equip requires ownership, an old wallet without the new fields works, the verifier gets the turn's snapshotted mods (a boosted replay differs from an unboosted one where it should), and a purchase after `arena:start` does not affect that turn.

## Rules

- Server-authoritative: the client never decides prices, ownership or mods; it only sends commands and renders the snapshot.
- Everything stays deterministic (fixed steps). Content code reaches the battle only through `BattleCtx`. No `core/economy` import from battle/arena code (the headless bundle shims profile).
- Match the surrounding code style. `npm run check` and `npm run build` must pass. Do not commit, push, deploy, or call `rundot`. Only touch files in `game/` and this brief.

## Done when

check and build pass (including the new check-arena cases), and you report: the data you added, the new commands, how mods reach the verifier, and the UI.
