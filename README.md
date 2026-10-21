# MONSTER MASH: Slingshot Siege

A fast, tactile 16-bit physics launcher built in Phaser 3, Matter.js, and TypeScript for the RUN.world **Monster Mash** game jam. Runs portrait at native 216x384 (retro Mash32 palette, 5x7 typography, and custom chiptune audio).

---

## Game Overview

In **MONSTER MASH: Slingshot Siege**, enemy monster hordes have built fortified camps across three distinct realms: **Goblin Hills**, **Sunken Mire**, and the **Iron Keep**. Armed with an oversized siege slingshot, your objective is to fling real fantasy weapons with unique active mid-flight powers, collapse wood, stone, and iron structures, and eliminate all monsters before they escape.

---

## How to Play & Core Controls

- **Aim & Sling:** Tap or drag back from the slingshot pocket, pull to set launch power, angle your trajectory, and release to fire.
- **Weapon Abilities (Tap in Flight):** Every weapon has a unique tactical power. Tap anywhere on screen while the weapon is mid-flight to trigger it:
  - **Militia Blade:** *Spin-saw* — Spins rapidly, carving through wood and flesh with high momentum.
  - **Iron Cleaver:** *Downward Slam* — Stops horizontal flight and slams downward with heavy impact to crush foundations.
  - **Ashwood Staff:** *Arcane Lightning* — Detonates in a flash, casting chain lightning bolts to strike nearby enemies.
  - **Hunter's Pike:** *Armor-Piercing Thrust* — Surges forward at triple velocity, piercing through stone and deep fortifications.
  - **Scrapheap Scattergun:** *Cluster Shrapnel* — Splits into five ricocheting iron scrap pellets.
  - **Gatebreaker Ram:** *Siege Ram* — Massive kinetic force designed to topple heavy iron towers and boss shields.
- **Consumables Tray:** Tap an equipped consumable in your HUD tray before launching to apply tactical battle buffs:
  - **Goblin Firepot:** Ignite obstacles and set structures ablaze.
  - **Wind Rune:** Tailwinds that accelerate projectile speed and distance.
  - **Monster Snack:** Lure stubborn monsters out of protected bunkers.
  - **Jury-Rigged Bomb:** Adds explosive shockwaves to your impact.

---

## Monsters & Hazards

- **Goblin Grunt:** Weak baseline infantry, easily crushed by debris or direct hits.
- **Goblin Bomber:** Carries explosive kegs; triggering them causes chain reactions inside enemy forts.
- **Dark Elf Archer:** Fortified sniper behind elevated parapets.
- **Dark Elf Hexer:** Shields nearby allies until struck.
- **Skeleton Runner:** Agile sprinters that dash towards the retreat border when disturbed. If too many escape, the level is lost!
- **Imp:** Flying aerial pests bobbing in the sky.
- **Orc Brute:** Armored heavy infantry requiring multiple impacts or heavy weapon slams.
- **Troll:** Massive regenerating creature; requires high-damage combos to topple.
- **The Iron Warlord (Boss):** Level 12 titan wearing heavy plate armor. Wait for his visor to open to land a critical strike!

---

## Progression & The Forge

- **Gold Coins:** Earn coins by defeating monsters, completing levels with remaining shots, and pulling off high-scoring combos.
- **The Forge:** Upgrade weapon base damage, power, and ability radius up to +3.
- **Artifacts:** Equip relics like the *Heavy Counterweight*, *Lodestone Bracer*, or *Stormcaller Torc* for passive bonuses.
- **Skins & Gold Quiver:** Customize your slingshot with bone or iron cosmetic carvings, and unlock the 5-slot Gold Quiver.

---

## Daily Mash & Social

- **Daily Mash:** A fresh, procedurally generated fortress every single day seeded by UTC calendar date. Everyone in the world faces the exact same layout!
- **Daily Streak:** Complete consecutive daily challenges to earn escalating coin rewards.
- **Leaderboards:** Compete against other players for the highest score on the daily siege.

---

## Development & Technical Details

- **Engine:** Phaser 3 (Canvas/WebGL, `roundPixels: true`)
- **Physics:** Matter.js (rigid-body physics with deterministic 60 Hz steps)
- **Palette:** Mash32 (strict 32-color retro palette)
- **Audio:** Web Audio procedural chiptune engine (120 BPM *Cheerful* and *Dusk March* loops) + procedural retro sound effects
- **Platform:** RUN Game SDK integration with offline development mock

### Commands (in `game/`)

```bash
npm install            # Install dependencies
npm run dev            # Start local development server with mock platform
npm run check          # Run data schema validators and TypeScript checks
npm run build          # Validate data and produce production build in dist/
```
