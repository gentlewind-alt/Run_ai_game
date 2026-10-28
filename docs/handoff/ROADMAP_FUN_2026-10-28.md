# MONSTER MASH: what to build next (fun, retention and playing with friends)

Written 2026-10-28 from a player's-eye review of the current build. The problem to solve: the game is easy to learn and the physics are satisfying, but **it gets boring over time** because every level asks the same thing (knock it all down), nothing surprises you, progress feels flat, there is no reason to come back tomorrow, and it feels solo.

Ratings today (opinion, not measured): visual design 7/10, menus 5/10, battle HUD 6/10, technical 7/10, playability 6/10, overall 6.5/10.

## How to read this

| Label | Meaning |
|---|---|
| **P0** | Do first. Biggest effect on "it gets boring", cheap, mostly data or small code. |
| **P1** | Do next. Gives players a reason to come back and share. |
| **P2** | Do when P0 and P1 are in. Polish and depth. |
| **P3** | Later or nice to have. |

Effort: **S** = about a day, **M** = a few days, **L** = a week or more. "Builds on" names what already exists in the game, so nothing starts from zero.

---

## P0: fix the boredom

| # | Item | What it is | Why it matters | Effort | Builds on |
|---|---|---|---|---|---|
| P0-1 | **New level goals** | Mix level types into every realm: *Rescue* (do not hit the caged prisoner), *Escape* (runners flee, stop them), *One shot* (clear it with exactly one weapon), *Defend* (enemies shoot your sling), *Boss phases* (boss changes halfway). | Every level stops asking the same question. This is the main fix for "boring". | M | Level kinds (`content/levelKinds/`), runner monsters, enemy shots, boss levels |
| P0-2 | **Three star goals per level** | Each level shows three small goals, e.g. "Clear in 2 shots", "Don't break the gold block", "Defeat the boss first". | Gives a reason to replay old levels; completionists love it. | M | Existing star rating and level data |
| P0-3 | **Hype pop-ups** | Big, bold call-outs for multi-kills ("TRIPLE!"), chain collapses, perfect clears and one-shot clears, with a short slow-motion beat and screen shake. | Makes each good shot feel rewarding. Today the HUD is clean but quiet. | S | Combo system, `fx.popWord`, hit-stop |
| P0-4 | **Clearer menus** | Bigger buttons, icons instead of words where possible, fewer grey boxes, a larger readable font on phones. Start with Shop, Forge, Armory and Builder. | Menus currently look like spreadsheets and lose new players. | M | `ui/widgets.ts` |
| P0-5 | **Faster start** | Load the heavy art (legendary set pieces, all weapon sprites) after the title screen instead of before it. Boot is about 10 s now. | Phone players leave if the first screen is slow. | S | `BootScene`, `art/generatedSprites.ts` |

## P1: reasons to come back, and friends

| # | Item | What it is | Why it matters | Effort | Builds on |
|---|---|---|---|---|---|
| P1-1 | **Daily reward and streak** | A visible daily gift (coins, a chest, or a legendary weapon to try for that day) with a streak counter. | A reason to open the game every day. | S | Daily Mash streak, economy |
| P1-2 | **Weekly boss event** | One giant fort for everyone for a week, its own leaderboard and a reward tier for taking part. | A shared goal; something to talk about. | M | Challenges + leaderboards, the Ultra Grand Castle style of fort |
| P1-3 | **Share my best shot** | One tap after a great shot makes a short clip or GIF to share. | Free marketing; this is how a game spreads on social apps. | M | The step-based replay (shots are already recorded as actions) |
| P1-4 | **Friend modes (see below)** | Simple ways to play with friends, no complex Arena. | Turns a solo game into a social one. | S-M each | Share links, challenge leaderboards, practice pass-the-device |
| P1-5 | **Arena never feels empty** | When nobody is online, offer a "ghost" match against a recorded run by a real player instead of only the bot. | An empty lobby makes the game feel dead. | M | Arena replays (already recorded and verified) |

## P2: depth and polish

| # | Item | What it is | Effort | Builds on |
|---|---|---|---|---|
| P2-1 | **Weapon combos** | Effects that react: freeze then shatter, oil then fire, web then pull into a blast. Discovering combos is fun on its own. | M | Status effects (burn, slow, chain, curse) |
| P2-2 | **Surprises inside levels** | Random wind that pushes shots, rain that makes wood slippery, a rare golden monster with a big reward. | M | Level data, physics tuning |
| P2-3 | **Monsters that react** | They panic when the tower shakes, run, duck, or rebuild a block. | M | Monster behaviours (`content/monsters/`) |
| P2-4 | **Season track of cosmetics** | Slingshot skins, shot trails and hit effects unlocked by playing. Looks, not power. | L | Cosmetics, sling skins |
| P2-5 | **Badges and profile** | "10,000 blocks destroyed", "Beat the Matron in one shot", shown on a small profile card. | S | Stats in the save |
| P2-6 | **More destructible ground** | Bring the Ember Forge sand terrain to a few more levels once it is polished. | M | `experiment-sand-terrain` branch |
| P2-7 | **Earthworm Drill really tunnels** | It digs a short tunnel and erupts under the fort instead of at first contact. | S | Drill weapon, sand carve |

## P3: later

| # | Item | Effort |
|---|---|---|
| P3-1 | Clans or crews with a shared weekly score | L |
| P3-2 | Remix button and "trending forts" in Create Level | M |
| P3-3 | Builder templates (castle, bridge, cart) so new builders get going fast | S |
| P3-4 | Photo mode: freeze a big collapse and save a picture | S |

---

## Playing with friends: simple modes

Goal: easy, fun, low pressure. No accounts to set up, no live matchmaking, nothing that needs both friends online at the same time unless they are sitting together. Ordered by priority.

### F1 (P1). "Beat my score" link

- After any level, tap **Challenge a friend**. It makes a link: "I scored 4,200 on Level 12 with 3 shots. Beat me."
- The friend opens it, plays the same level with the same weapons, and sees both scores side by side at the end, with a **Send it back** button.
- Why it works: one tap, asynchronous, and it naturally turns into a back-and-forth rivalry.
- Builds on: share links (`features.share`), level and loadout data, score. Effort: S-M.

### F2 (P1). "Wreck my fort"

- Build a fort in Create Level and send it to a friend. They get 3 shots to flatten it.
- Both see the result: "Your fort survived 2 shots, then fell." The friend can reply with a fort of their own.
- Why it works: building something and watching a friend struggle with it is a flex. The builder is already the game's best social feature.
- Builds on: the builder, Global Challenges (UGC) and per-challenge leaderboards. Effort: S, mostly a friend-only share and a result card.

### F3 (P1). Party mode on one device

- 2 to 4 players pass the phone. Everyone gets the same fort and one shot per round. Biggest wreck wins the round; best of 5 wins.
- Fun twists: a random weapon each round, or "everyone uses the Black Hole".
- Why it works: perfect for sitting together, with no internet needed.
- Builds on: the Practice match's pass-the-device option. Effort: S.

### F4 (P1). Friends' Daily Mash board

- The Daily Mash already gives everyone the same level each day. Add a small "Friends today" list under it: who played, who is ahead, streaks.
- Why it works: a tiny daily ritual with friends, no extra effort.
- Builds on: Daily Mash, leaderboards. Effort: S-M (needs a friends list or a shared group code).

### F5 (P2). Ghost race

- Play a level while your friend's best run plays as a faint "ghost" shot alongside yours, so you can see their trajectory and try to do better.
- Builds on: recorded shots (angle, power, timing), which the Arena already replays deterministically. Effort: M.

### F6 (P2). Tag team (co-op)

- Two friends alternate shots on one big fort, such as the Ultra Grand Castle, and share one score. Locally on one device, or asynchronously: "Your turn, I left the left tower standing."
- Builds on: party mode, plus the async link from F1. Effort: M.

### F7 (P2). Weekly "one shot, one chance"

- One fort a week, one shot each, no retries. Friends compare the single result.
- Builds on: the weekly boss event (P1-2). Effort: S once P1-2 exists.

### F8 (P3). Reactions

- After a friend's challenge result, send a quick reaction: "😂", "GG", "rematch?". Fixed stickers only, no free chat, which keeps it safe for younger players.
- Effort: S-M.

### What we deliberately avoid

- Live real-time duels that need both players online: the Arena already covers that, and it is the complex part.
- Free text chat: moderation burden and child-safety risk.
- Pay-to-win boosts in friend modes: friend modes should use the same weapons for both players.

---

## Suggested order of work

1. **P0-1 New level goals** and **P0-3 Hype pop-ups**: the boredom fix.
2. **F1 Beat my score** and **F3 Party mode**: friends, quick to build.
3. **P0-2 Star goals** and **P1-1 Daily reward**: replay value and the daily habit.
4. **F2 Wreck my fort** and **P1-2 Weekly boss event**: builder and community.
5. **P0-4 Clearer menus** and **P0-5 Faster start**: polish before a bigger push.
6. Everything in P2, then P3.

Ask the owner before anything that sets IAP or RUN Bits prices, changes the save version, or touches the jam form (see `AGENTS.md`).
