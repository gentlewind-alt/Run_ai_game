// Scores every enemy animation strip against its enemy's still sprite (tools/lib/anim.mjs sets the limits).
// `node scripts/check-anims.mjs` fails on any strip below the bar (runs in `npm run check`); add --report to print the numbers and not fail.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng } from '../../tools/lib/png.mjs';
import { analyze } from '../../tools/lib/anim.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const stills = path.join(root, '..', 'tools', 'anim_stills');
const content = JSON.parse(fs.readFileSync(path.join(root, 'public', 'data', 'content.json'), 'utf8'));
const report = process.argv.includes('--report');
let bad = 0, count = 0;
for (const m of content.monsters) {
  for (const kind of Object.keys(m.anim ?? {})) {
    const file = path.join(root, 'public', 'sprites', 'monsters', 'anim', `${m.id}_${kind}.png`);
    const still = path.join(stills, `${m.id}.png`);
    if (!fs.existsSync(file) || !fs.existsSync(still)) { console.log(`MISSING ${m.id}_${kind}`); bad++; continue; }
    const r = analyze(decodePng(fs.readFileSync(file)), decodePng(fs.readFileSync(still)), kind);
    count++;
    const x = r.m;
    if (report) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${`${m.id}_${kind}`.padEnd(24)} motion ${x.motion?.toFixed(2)} seam ${x.seam?.toFixed(1)} stall ${x.stall?.toFixed(2)} area ${x.areaVar?.toFixed(2)} size ${x.size?.toFixed(2)} feet ${x.bottomDrift} cx ${x.centroidX?.toFixed(2)} cy ${x.centroidY?.toFixed(2)} noise ${x.noise?.toFixed(1)} pal ${x.palette?.toFixed(2)} like ${x.likeness?.toFixed(2)}${r.ok ? '' : '  <- ' + r.fails.join('; ')}`);
    else if (!r.ok) console.log(`check-anims: ${m.id}_${kind}: ${r.fails.join('; ')}`);
    if (!r.ok) bad++;
  }
}
console.log(`check-anims: ${count} strips, ${bad} below the bar`);
process.exit(report || !bad ? 0 : 1);
