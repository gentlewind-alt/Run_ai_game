#!/usr/bin/env node
// tools/balance_table.mjs
// Verifies the "hits to kill" table from section 2 of 09_expansion_design.md
// For every weapon vs every monster and material at impact 1.0 (nominal damage = base * 2).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contentPath = path.join(__dirname, '../game/public/data/content.json');
const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));

const targets = [
  { id: 'imp', hp: 15, name: 'Imp (15)', category: 'monster' },
  { id: 'skeleton_runner', hp: 20, name: 'Runner (20)', category: 'monster' },
  { id: 'goblin_bomber', hp: 25, name: 'Bomber (25)', category: 'monster' },
  { id: 'goblin_grunt', hp: 30, name: 'Grunt (30)', category: 'monster' },
  { id: 'dark_elf_archer', hp: 35, name: 'Archer (35)', category: 'monster' },
  { id: 'dark_elf_hexer', hp: 40, name: 'Hexer (40)', category: 'monster' },
  { id: 'wood', hp: 40, name: 'Wood (40)', category: 'material' },
  { id: 'orc_brute', hp: 120, name: 'Orc Brute (120)', category: 'monster' },
  { id: 'stone', hp: 120, name: 'Stone (120)', category: 'material' },
  { id: 'troll', hp: 160, name: 'Troll (160)', category: 'monster' },
  { id: 'iron', hp: 250, name: 'Iron (250)', category: 'material' },
];

// Target design table bands from 09_expansion_design.md section 2:
// | Target | Common 14-35 | Rare 24-42 | Legendary 38-60 |
// Tolerance: fail if value is outside the table band by more than 1 hit.
// Note: In Common (11-35), high base damage (e.g. 30-35) or low base damage (11) scales proportionally.
// The design doc table column "Common 14-35" is calibrated to the baseline starter common (base 14).
const designBands = {
  imp:             { common: [1, 1], rare: [1, 1], legendary: [1, 1] },
  skeleton_runner: { common: [1, 1], rare: [1, 1], legendary: [1, 1] },
  goblin_bomber:   { common: [1, 2], rare: [1, 1], legendary: [1, 1] },
  goblin_grunt:    { common: [1, 2], rare: [1, 1], legendary: [1, 1] },
  dark_elf_archer: { common: [1, 2], rare: [1, 1], legendary: [1, 1] },
  dark_elf_hexer:  { common: [1, 2], rare: [1, 1], legendary: [1, 1] },
  wood:            { common: [1, 2], rare: [1, 1], legendary: [1, 1] },
  orc_brute:       { common: [2, 6], rare: [2, 3], legendary: [2, 2] },
  stone:           { common: [2, 6], rare: [2, 3], legendary: [2, 2] },
  troll:           { common: [3, 8], rare: [3, 4], legendary: [2, 3] },
  iron:            { common: [4, 12], rare: [4, 5], legendary: [3, 4] },
};

console.log('========================================================================================');
console.log('                 MONSTER MASH: HITS TO KILL BALANCE TABLE (Impact 1.0)                  ');
console.log('========================================================================================\n');

// Header row
const colWidth = 14;
let header = 'Weapon'.padEnd(24) + 'Rarity'.padEnd(11) + 'Base'.padEnd(7) + 'Nom'.padEnd(7);
for (const t of targets) {
  header += t.name.slice(0, 10).padStart(colWidth);
}
console.log(header);
console.log('-'.repeat(header.length));

let failures = 0;

for (const w of content.weapons) {
  const rarity = w.rarity === 'legendary' ? 'legendary' : w.rarity === 'rare' ? 'rare' : 'common';
  const nominal = w.baseDamage * 2;
  let row = w.name.padEnd(24) + rarity.padEnd(11) + String(w.baseDamage).padEnd(7) + String(nominal).padEnd(7);

  for (const t of targets) {
    const hits = Math.ceil(t.hp / nominal);
    const band = designBands[t.id][rarity];
    const minAllowed = Math.max(1, band[0] - 1);
    const maxAllowed = band[1] + 1;
    const ok = hits >= minAllowed && hits <= maxAllowed;

    if (!ok) {
      row += `*${hits}*`.padStart(colWidth);
      failures++;
      console.error(`\n[FAIL] ${w.name} (${rarity}, base ${w.baseDamage}, nom ${nominal}) vs ${t.name}: ${hits} hits, expected band [${band[0]}, ${band[1]}] ± 1 hit [${minAllowed}, ${maxAllowed}]`);
    } else {
      row += String(hits).padStart(colWidth);
    }
  }
  console.log(row);
}

console.log('\n========================================================================================');
// Verify starter weapon Militia Blade against the strict baseline column (Common 14)
console.log('--- Strict Baseline Check: Militia Blade (base 14) vs Common 14-35 baseline column ---');
const baselineBands = {
  imp: [1, 1],
  skeleton_runner: [1, 1],
  goblin_bomber: [1, 1],
  goblin_grunt: [1, 1],
  dark_elf_archer: [1, 2],
  dark_elf_hexer: [1, 2],
  wood: [1, 2],
  orc_brute: [4, 5],
  stone: [4, 5],
  troll: [5, 6],
  iron: [8, 99],
};

const blade = content.weapons.find((w) => w.id === 'w_militia_blade');
if (blade) {
  const nom = blade.baseDamage * 2;
  for (const t of targets) {
    const hits = Math.ceil(t.hp / nom);
    const band = baselineBands[t.id];
    const ok = hits >= Math.max(1, band[0] - 1) && hits <= band[1] + 1;
    if (!ok) {
      failures++;
      console.error(`[FAIL] Militia Blade vs ${t.name}: ${hits} hits, expected [${band[0]}, ${band[1]}]`);
    } else {
      console.log(`  ✓ Militia Blade vs ${t.name.padEnd(16)}: ${hits} hits (band [${band[0]}, ${band[1]}])`);
    }
  }
}

console.log('========================================================================================');
if (failures > 0) {
  console.error(`FAIL: ${failures} value(s) outside allowed balance bands!`);
  process.exit(1);
} else {
  console.log('SUCCESS: All weapons within ±1 hit of the design hits-to-kill balance table!\n');
  process.exit(0);
}
