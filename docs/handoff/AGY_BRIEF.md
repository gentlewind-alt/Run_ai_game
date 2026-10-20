# agy standing brief (read first, every run)

You are the worker agent for MONSTER MASH: Slingshot Siege. Claude only plans and reviews; you write the code.

1. Read `AGENTS.md`, then `docs/handoff/STATUS.md`, `architecture/WORKFLOW.md`, `architecture/ARCHITECTURE.md`, `architecture/RECIPES.md`.
2. Read `docs/monster_mash/08_design_direction.md` before touching any visual (palette Mash32, 5x7 font, bevelled buttons, beat clock, sticker panels, dusk realm lighting). Never ship placeholder art or unstyled UI.
3. Golden rules in AGENTS.md are binding: numbers in data, content through registries, systems never import scenes, only `src/platform/` imports the RUN SDK, features behind flags, 60 Hz steps.
4. Use the Merkle index: run `node tools/merkle.mjs changed` first to see what changed since the last sealed state; read only those paths. Run `node tools/merkle.mjs seal` after your work passes checks.
5. Before finishing: in `game/` run `npm run check` and `npm run build`. Fix every error. Do not commit. Do not deploy. Do not run `rundot game set-public`. Never touch `node_modules`, `dist`, `.env*`.
6. Finish by appending a short entry to `docs/handoff/LOG.md` (what, checks run, open questions) and updating the card row in `docs/handoff/STATUS.md`.
7. Edit with minimal diffs; match surrounding style; no unrequested features.
