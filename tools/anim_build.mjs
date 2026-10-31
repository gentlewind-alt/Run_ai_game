// Builds every enemy's animation strip and keeps the best candidate that meets the quality bar (tools/lib/anim.mjs):
//   1. the AI animation (tools/anim_sheets/<id>.png), converted several ways,
//   2. an animation computed from the enemy's own still sprite (tools/lib/procedural.mjs), at several strengths.
// The first AI candidate that passes wins; otherwise the best passing procedural one; a strip that nothing can fix is reported and fails the check.
//   node tools/anim_build.mjs            all enemies          node tools/anim_build.mjs goblin_grunt   one enemy
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng } from './lib/png.mjs';
import { analyze } from './lib/anim.mjs';
import { convert } from './anim_convert.mjs';
import { procedural } from './lib/procedural.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'game', 'public', 'sprites', 'monsters', 'anim');
const content = JSON.parse(fs.readFileSync(path.join(root, 'game', 'public', 'data', 'content.json'), 'utf8'));
const only = process.argv[2];
// Decisions from looking at the frames, which no metric catches: the AI version redraws these badly, so the computed one is used.
const FORCE_COMPUTED = { dark_elf_archer: 'the white headband flickers and changes shape', troll: 'the face is redrawn between frames' };
const report = [];

for (const m of content.monsters) {
  if (only && m.id !== only) continue;
  for (const kind of Object.keys(m.anim ?? {})) {
    const still = decodePng(fs.readFileSync(path.join(root, 'tools', 'anim_stills', `${m.id}.png`)));
    const forced = FORCE_COMPUTED[m.id];
    const own = path.join(root, 'tools', 'anim_sheets', `${m.id}_${kind}.png`); // a sheet made for one kind (the wolf's run) wins over the enemy's main sheet
    const sheetPath = fs.existsSync(own) ? own : path.join(root, 'tools', 'anim_sheets', `${m.id}.png`);
    const candidates = [];
    if (!forced && fs.existsSync(sheetPath)) {
      const sheet = decodePng(fs.readFileSync(sheetPath));
      for (const dup of [0.03, 0.06, 0.1]) for (const plant of [true, false]) {
        try { const c = convert(sheet, still, kind, { dupThreshold: dup, plant }); candidates.push({ source: `ai (dup ${dup}${plant ? '' : ', unplanted'})`, strip: c.strip, result: c.result }); } catch { /* a variant that cannot be built is skipped */ }
      }
    }
    for (const gain of [0.5, 0.7, 1, 1.4, 1.8, 2.3, 3]) {
      const strip = procedural(still, kind, gain);
      candidates.push({ source: `procedural x${gain}`, strip, result: analyze(strip, still, kind) });
    }
    const score = (c) => c.result.fails.length * 10 - (c.result.m.likeness ?? 0);
    const passingAi = candidates.filter((c) => c.source.startsWith('ai') && c.result.ok && !c.result.flickers).sort((a, b) => score(a) - score(b));
    const passing = candidates.filter((c) => c.result.ok).sort((a, b) => score(a) - score(b));
    const pick = passingAi[0] ?? passing[0] ?? [...candidates].sort((a, b) => score(a) - score(b))[0];
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, `${m.id}_${kind}.png`), encodePng(pick.strip));
    report.push({ id: m.id, kind, source: pick.source, ok: pick.result.ok, fails: pick.result.fails, metrics: Object.fromEntries(Object.entries(pick.result.m).map(([k, v]) => [k, Math.round(v * 1000) / 1000])), frames: pick.strip.w / pick.strip.h });
    console.log(`${pick.result.ok ? 'ok  ' : 'FAIL'} ${`${m.id}_${kind}`.padEnd(24)} ${pick.source.padEnd(26)} ${pick.strip.w / pick.strip.h}f${pick.result.ok ? '' : '  <- ' + pick.result.fails.join('; ')}`);
  }
}
if (!only) fs.writeFileSync(path.join(root, 'tools', 'anim_report.json'), JSON.stringify(report, null, 1) + '\n');
console.log(`${report.filter((r) => r.source.startsWith('ai')).length} AI, ${report.filter((r) => r.source.startsWith('proc')).length} procedural, ${report.filter((r) => !r.ok).length} failing`);
