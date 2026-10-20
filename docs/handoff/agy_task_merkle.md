# Task: Merkle-tree repo index

Follow `docs/handoff/AGY_BRIEF.md`, except step 4 (the tool does not exist yet: you are building it).

Build `tools/merkle.mjs` (Node 18+, no dependencies, ESM) at the repo root:

- Walk files listed by `git ls-files` plus untracked non-ignored files (`git ls-files -co --exclude-standard`). Skip `MERKLE.json`/`MERKLE.md`.
- Leaf hash = SHA-256 of file bytes (normalise CRLF to LF so Windows and Linux agree). Directory hash = SHA-256 of sorted `name:type:hash` lines of its children. Root hash identifies the whole repo state.
- `node tools/merkle.mjs seal` writes `MERKLE.json` (nested tree: path, hash, children, file size) and `MERKLE.md` (human index: root hash, a table of every directory down to depth 3 with short hash, file count and a one-line purpose taken from a `PURPOSES` map in the script for known dirs, e.g. `game/src/battle`, `game/src/content`, `architecture`, `docs/handoff`).
- `node tools/merkle.mjs changed` compares the working tree to the sealed `MERKLE.json`, prints only the changed/added/removed files grouped by their highest changed directory, and exits 0 (print `clean` when nothing changed). `--json` flag for machine output.
- `node tools/merkle.mjs verify` exits 1 if any change is unsealed, 0 otherwise (for CI).
- `node tools/merkle.mjs diff-roots` is not needed.
- Add npm scripts `merkle:seal`, `merkle:changed`, `merkle:verify` in a new root `package.json` only if none exists; otherwise add them to `game/package.json` with paths `../tools/merkle.mjs`.
- Document usage in `architecture/WORKFLOW.md` (new short section "Merkle index": claim card, run `changed`, work, `check`+`build`, `seal`, commit `MERKLE.*` with the change) and add one line to AGENTS.md under the repo map.
- Run `node tools/merkle.mjs seal`, then `changed` (must print clean), then edit one file and confirm `changed` reports exactly it and its parent dirs, then revert that edit and reseal.
