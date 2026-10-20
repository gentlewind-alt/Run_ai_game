# AGENTS.md: start here

This repo builds **MONSTER MASH: Slingshot Siege**, a 16-bit physics launcher for the RUN.world "Monster Mash" jam. It is written in Phaser 3, Vite and TypeScript, uses the RUN SDK, and runs portrait at 216x384. Entries close **Mon 2 Nov 2026, 12:00 PT**.

Any coding agent (Claude Code, Cursor, Codex, Gemini, the RUN Game Studio AI) can pick up work here. Read the files in this order, then take a task card.

| # | File | Why |
|---|---|---|
| 1 | `docs/handoff/STATUS.md` | What is done, who is on what, what's next |
| 2 | `architecture/WORKFLOW.md` | How to claim a card, commit, test, deploy, hand off |
| 3 | `architecture/ARCHITECTURE.md` | Module layout, import rules, registries, events, settings |
| 4 | `architecture/DATA.md` | Every data file and its conventions (schemas in `game/schemas/`) |
| 5 | `architecture/STAGES.md` | All task cards, stage by stage, with acceptance checks |
| 6 | `architecture/RECIPES.md` | Step-by-step guides for common changes (add a weapon, monster, level, setting...) |
| 7 | `docs/monster_mash/02_master_brief.md` | The game design (what, why). The blueprint is the how |
| 8 | `docs/monster_mash/04_platform_report.md` | RUN SDK facts and limits |

## Golden rules

1. **Data owns numbers, code owns behaviour.** Balance and feel values go in `game/public/data/*.json`, never as literals in `src/`. Every data file has a schema in `game/schemas/`.
2. **Add content through registries.** A new weapon, monster, artifact or consumable is one data row plus, when it has custom behaviour, one registry entry. Never add `if (id === 'w_x')` branches to scenes or systems.
3. **Systems never import scenes.** Content code receives a `BattleCtx` interface, and systems talk through the typed event bus.
4. **Only `src/platform/` imports the RUN SDK.** Everything else calls the `platform` adapter, which has a mock for local dev.
5. **Every optional system sits behind a flag** in `config.json` (`features.*`), so it can be cut or shipped on its own.
6. **Gameplay time is fixed 60 Hz steps.** Use step counters for gameplay timing. Tweens are for visuals only.
7. **The save is versioned.** Any change to its shape needs a migration in `src/core/save.ts` and a schema update.
8. **`npm run check` and `npm run build` must pass** before every commit. The build runs the data check first.
9. **Ask the owner first** before: `rundot game set-public`, IAP or RUN Bits prices, deleting content or levels, changing the save version, spending RUN AI credits, or anything that touches the jam form.
10. Never commit `node_modules`, `dist`, `.env*`, API keys or tokens.

## Commands (run in `game/`)

```
npm ci                 # install
npm run dev            # local dev server (platform mock)
npm run check          # data schemas + cross-refs + TypeScript
npm run build          # check-data, tsc, vite build -> dist/
rundot predeploy       # RUN's own checks on source and build
rundot deploy          # private deploy, prints the share URL
```

## Repo map

```
AGENTS.md                 this file
architecture/             how to build and change the game (stable)
docs/handoff/             STATUS.md (live board) and LOG.md (append-only notes between sessions)
docs/monster_mash/        design brief, plan, platform report, review history
catalogue/                Four Realms item catalogue (source material, not loaded)
game/                     the RUN project (template run-template-2d-phaser)
  public/data/            content.json, config.json, levels/level_NN.json
  schemas/                JSON Schemas for every data file
  scripts/check-data.mjs  data validator (no dependencies)
  src/                    TypeScript source (layout in ARCHITECTURE.md)
  rundot/                 RUN config (leaderboard, shop, hooks)
```

`catalogue/` holds the full item catalogue from the parked Four Realms project: `weapons.json` (101 weapons), `gear.json` (17 armour, 53 relics, 21 consumables) and the `.xlsx` version. The game does not load them. Port items with `RECIPES.md` → "Port an item from the catalogue".
