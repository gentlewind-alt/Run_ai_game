# Local kickoff: paste this into your local AI coding tool

Use this in a coding tool that runs on **your own computer** (Claude Code, Cursor, etc.), opened on an empty folder you chose. You sign in to RUN yourself in the browser. No API key is needed; that is only for headless setups.

## Get the planning files first

Put the planning files in the folder, next to where the project will go:

```
git clone -b claude/brave-johnson-j555ql https://github.com/gentlewind-alt/Run_ai_game.git monster-mash-plan
```

(or download the `docs/monster_mash/` folder from that branch on GitHub).

## Paste this prompt

---

Set me up to build games on RUN.world by following the instructions at https://events.run.world/events/cli-setup/agent.md. Work inside the folder I selected.

Notes from an earlier attempt:
- The RUN CLI for Linux/macOS installs with `curl -fsSL https://github.com/series-ai/rundot-cli-releases/releases/latest/download/install.sh | bash` (Windows: the `install.ps1` in the same release). I have already checked that script, and it only downloads a release into `~/.local/bin`.
- In CLI version 7.18.0, `rundot download-docs` was **not** a command. Run `rundot update`, then `rundot --help`, and find out how to get the SDK docs. If there is no docs command, find them at series-1.gitbook.io and save what you need into the project.
- Use the `run-template-2d-phaser` template (https://github.com/series-ai/run-template-2d-phaser). Copy it into the selected folder, with no extra directory level, then `npm install`.
- Run `rundot predeploy` before each deploy, and fix what it reports.

Then build me this game: **MONSTER MASH: Slingshot Siege**, a 16-bit physics launcher for the RUN "Monster Mash" jam (entries close Mon 2 Nov, 12:00 noon PT).

The full design is in `monster-mash-plan/docs/monster_mash/`:
- `02_master_brief.md` is the brief. Read it completely, and do its Step 0 now. Report to me what the RUN SDK actually provides (orientation and screen size, saved data, leaderboards, share/invite, ads, purchases) and which of the brief's features you will cut or replace because of it. Update the brief in the project to match.
- `content.json` is the game data. Load it as data, and don't hard-code the numbers.
- `03_stage_prompts.md` holds the six build stages. Do Stage 1 first, deploy it, and give me the URL. Then wait for me to say "next stage" before starting the next one.

Deploy as private first. When I confirm the build works on my phone, run `rundot game set-public` for the final build only. Ask me before doing that.

---

## Checklist for you

1. Install Node 20+ if `node --version` is older.
2. When the tool runs `rundot login`, finish signing in in your browser.
3. After Stage 1 deploys, open the URL on your phone and tell the tool if the shot feels good.
4. After the final stage, set the game public, then fill in "Enter the jam" in Creator Hub before **Mon 2 Nov, 12:00 PT**. I don't know if public games go through a review first (the setup page says `set-public` submits the game for review). **Set it public by Thu 30 Oct at the latest**, so review doesn't catch you at the deadline.
5. If you are stuck on a RUN-specific question, the setup page points to series-1.gitbook.io and the Discord at discord.gg/XY2ynd3gn3.
