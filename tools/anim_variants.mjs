// Writes the AI and the computed version of some enemies side by side into a folder, for comparing by eye.
//   node tools/anim_variants.mjs outdir id:kind id:kind ...
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng } from './lib/png.mjs';
import { convert } from './anim_convert.mjs';
import { procedural } from './lib/procedural.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const [out, ...specs] = process.argv.slice(2);
for (const spec of specs) {
  const [id, kind] = spec.split(':');
  const still = decodePng(fs.readFileSync(path.join(root, 'tools', 'anim_stills', `${id}.png`)));
  const sheet = decodePng(fs.readFileSync(path.join(root, 'tools', 'anim_sheets', `${id}.png`)));
  for (const [name, strip] of [['ai', convert(sheet, still, kind, { dupThreshold: 0.03 }).strip], ['proc', procedural(still, kind, 1.8)]]) {
    fs.mkdirSync(path.join(out, name), { recursive: true });
    fs.writeFileSync(path.join(out, name, `${id}_${kind}.png`), encodePng(strip));
  }
}
console.log('ok');
