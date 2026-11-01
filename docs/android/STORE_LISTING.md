# Play Console answers: Monster Smash: Siege Slingshot

Paste-ready text for the store listing, Data safety, content rating and target audience.
Facts checked against the 1.2 (4) build: 20 monsters, 22 weapons, 36 level files, no in-app purchases,
no typed text from players (names are generated), Firebase anonymous sign-in, AdMob ads.

## Store listing (Grow → Store presence → Main store listing)

**App name** (30 max)
```
Monster Smash: Siege Slingshot
```

**Short description** (80 max)
```
Fling weapons, topple forts and smash monsters in a pixel-art physics siege!
```

**Full description** (4000 max)
```
Load the slingshot, pull back, and let fly!

Monster Smash: Siege Slingshot is a 16-bit physics game where you smash monster forts apart. Every tower wobbles, every beam can snap, and every shot can bring the whole fort crashing down.

SMASH YOUR WAY THROUGH
• 30+ hand-built levels across fantasy realms
• 20 monsters, from goblins and skeletons to trolls, wolves and flying foes
• 22 weapons to fling, each with its own ability: tap the screen mid-flight to trigger it
• Real physics: aim for the weak spot and watch the fort fall

MAKE IT YOURS
• Forge and upgrade weapons, collect relics and power-ups
• Build your own forts in the level builder
• Hit "Surprise me" for a brand-new level every time

PLAY WITH FRIENDS
• Beat a level, then send a friend a challenge code to beat your score
• Climb the leaderboards
• Daily challenge for a fresh puzzle every day

No account needed. Online play uses a random, game-made name, so you never have to share your real one.

Free to play with optional ads for bonus coins. No purchases.
```

**Category:** Game → Puzzle (or Casual). **Tags:** Physics, Puzzle, Casual, Pixel art, Offline.
**Contact email:** samarthrawat18@gmail.com
**Privacy policy:** https://github.com/gentlewind-alt/monstersmash_privacy_policy

**Graphics needed**
- App icon 512×512 PNG (no transparency in corners is fine; Play rounds it)
- Feature graphic 1024×500 PNG/JPG: logo + a fort mid-collapse; keep text inside the middle 80%
- Phone screenshots: 2–8, landscape 16:9 (e.g. 1920×1080). Suggested: aiming the sling, fort collapsing, level map, forge/shop, level builder, challenge code screen

## Data safety (Policy → App content → Data safety)

**Does your app collect or share any of the required user data types?** Yes
**Is all of the user data collected by your app encrypted in transit?** Yes
**Do you provide a way for users to request that their data is deleted?** Yes (by email, see privacy policy)

| Data type | Collected | Shared | Optional? | Purposes |
|---|---|---|---|---|
| Location → Approximate location | Yes (AdMob, from IP) | Yes | Required | Advertising or marketing, Fraud prevention |
| Device or other IDs | Yes (AdMob advertising ID, Firebase anonymous ID) | Yes (ad ID, by AdMob) | Required | App functionality, Advertising or marketing, Analytics, Fraud prevention |
| App activity → App interactions | Yes (AdMob ad interactions) | Yes | Required | Advertising or marketing, Analytics |
| App activity → Other user-generated content | Yes (scores, shared levels, reports) | No | Optional | App functionality |
| App info and performance → Diagnostics | Yes (AdMob SDK diagnostics) | No | Required | Analytics, Fraud prevention |

Answer **No** for everything else: personal info (name, email, user IDs tied to identity), financial info,
health, messages, photos/videos, audio, files, calendar, contacts, web browsing, precise location.

"Processed ephemerally": No. Shared data note: AdMob is a Google service; Firebase is a service provider (not "sharing").

## Content rating (Policy → App content → Content rating, IARC questionnaire)

- Category: **Game**
- Violence: **Yes**, fantasy/cartoon violence against non-human creatures; no blood, gore or realistic violence
- Fear/horror: monsters are cartoon pixel art → No (or "mild" if asked)
- Sexuality, language, drugs, alcohol, tobacco, crude humour: **No**
- Gambling or simulated gambling: **No**
- Users interact or exchange content: **Yes** (players share levels and scores; no chat, names are generated)
- Shares user location: **No**
- Digital purchases: **No**
- Ads: declared separately (below)

Expected result: roughly PEGI 7 / ESRB Everyone 10+.

## Target audience and ads (Policy → App content)

- **Contains ads:** Yes
- **Target age groups:** 13–15, 16–17, 18+ for a general-audience release.
  Adding **9–12** puts the app under the Families policy: allowed (AdMob is a certified families SDK and
  the game already serves child-safe ads to players who say they are under 13), but expect stricter review.
  Do not pick 8 and under.
- **Appeals to children?** If asked, "Yes, unintentionally" is honest for a cartoon game for 10+.
- **App access:** All functionality available without special access (no login).
- **Government app / Financial / Health / News / COVID:** No.
