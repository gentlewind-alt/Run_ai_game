# Workflow: how agents work together

Several agents may work on this repo at once. Typical setup: a **local session** on the owner's PC (it can run `rundot`, log in and deploy), a **cloud session** (it reviews code, writes docs and data, and runs headless tests, but cannot deploy), and possibly others. They coordinate only through git and two files in `docs/handoff/`.

## Start of every session

1. `git fetch origin && git pull origin claude/brave-johnson-j555ql`. If the branch is checked out in another worktree, work on your own branch and push with `git push origin HEAD:claude/brave-johnson-j555ql`.
2. Read `docs/handoff/STATUS.md`, then the newest entries at the top of `docs/handoff/LOG.md`.
3. In `game/`, run `npm ci` (if `package-lock.json` changed), then `npm run check`. If it fails on a clean pull, fixing it is your first task. Log it.

## Claim a card

1. Pick the first card in STATUS.md whose state is `todo` and whose dependencies are `done`. Prefer the lowest stage.
2. Set it to `doing` with your agent name and today's date, commit only that change (`status: claim S2-05`), and push **before** starting. If the push conflicts, pull. Someone else may have claimed it, so pick another card.
3. One card at a time per agent. If you stop halfway, set it back to `todo` and log where you stopped.

## While working

- Stay inside the card's scope. If you find other work, add it as a new card at the bottom of STATUS.md (`S?-new`) instead of doing it.
- Follow the recipes. If a recipe is wrong or missing, fix RECIPES.md in the same commit.
- Commit small. Message format: `S2-05: add Hunters Pike pierce ability`. Add the attribution lines your tool requires.
- Pull and rebase or merge before pushing. Never force-push a shared branch. Never rewrite someone else's commits.

## Definition of done

A card is `done` when:
1. `npm run check` and `npm run build` pass.
2. Its "Done when" checks in STAGES.md pass. Say how you checked them.
3. The game still goes from load to a win and a loss, with no console errors.
4. Data changes have schema updates, and code has no new balance literals.
5. STATUS.md is set to `done` (or `review` if a human or the cloud session should look first). LOG.md has an entry.
6. If you can deploy: deploy, and put the URL and version in LOG.md.

## LOG.md entry template (newest at the top)

```
## 2026-10-22 14:05 · local · S2-05 done
- What: Cleaver, Staff, Pike weapons + statuses knockdown/home.
- Checks: check+build ok; sweep level 1: pike best 2 kills, staff 1, cleaver 2.
- Deployed: v1.2.0 https://w.run/... (private)
- Notes / for the next agent: staff homing turnRate feels high on phones, maybe 0.08.
- Questions for owner: none.
```

Questions for the owner go in a **Questions for owner** line and in STATUS.md's "Waiting on owner" list. Don't block on them. Pick another card.

## Reviews

- The cloud session reviews `review` cards. It pulls, builds, runs headless play and the sweep, then writes findings in LOG.md (or a `docs/handoff/review_<card>.md` for long ones) and sets the card to `done` or back to `doing` with a reason.
- Reviews check: the import rules (ARCHITECTURE.md section 2), no literals that belong in data, schemas updated, events documented, flags present, and the standard checks.

## Needs the owner (don't do these alone)

- `rundot game set-public` / `set-private`
- Real-money or RUN Bits prices, shop config uploads
- Deleting or renaming shipped ids, levels, or save fields; save version bumps that reset progress
- Spending RUN AI credits (`textGen`, `image` commands) beyond a quick test
- The jam entry form, and anything in Creator Hub
- Changing the game orientation or registered game id

## When things break

- **Build broken on the main branch:** fixing it beats any card. Log it.
- **Deploy fails:** run `rundot predeploy`, read its output, fix, retry once. Then log it and move on.
- **The game disappeared on RUN** (happened once): `rundot game info`, then `rundot init --override` only with owner approval, then update `game.config.prod.json`. Log the new id.
- **Stuck after two tries:** simplify (cut the sub-feature behind its flag), log what failed, move on. A smaller working game beats a bigger broken one.
