// Contact sheet of animation strips for eyeballing: one row per strip, the still first, then every frame magnified.
//   node tools/anim_preview.mjs out.png id:kind id:kind ... [--old dir]   (with --old each id gets a second row from that folder)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng } from './lib/png.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const out = args.shift();
const oi = args.indexOf('--old');
const oldDir = oi >= 0 ? args.splice(oi, 2)[1] : null;

const di = args.indexOf('--dir');
const dir = di >= 0 ? args.splice(di, 2)[1] : path.join(root, 'game', 'public', 'sprites', 'monsters', 'anim');
const rows = [];
for (const spec of args) {
  const [id, kind] = spec.split(':');
  const still = decodePng(fs.readFileSync(path.join(root, 'tools', 'anim_stills', `${id}.png`)));
  rows.push({ still, strip: decodePng(fs.readFileSync(path.join(dir, `${id}_${kind}.png`))) });
  if (oldDir) rows.push({ still, strip: decodePng(fs.readFileSync(path.join(oldDir, `${id}_${kind}.png`))), old: true });
}
const pad = 8, bg = [40, 44, 70], rowPx = 104;
const kOf = (r) => Math.max(2, Math.floor((rowPx - 8) / r.still.h));
const W = Math.max(...rows.map((r) => (r.still.w + r.strip.w) * kOf(r) + 3 * pad));
const H = rows.length * rowPx + pad;
const img = { w: W, h: H, data: new Uint8Array(W * H * 4) };
for (let i = 0; i < W * H; i++) { img.data[i * 4] = bg[0]; img.data[i * 4 + 1] = bg[1]; img.data[i * 4 + 2] = bg[2]; img.data[i * 4 + 3] = 255; }
const put = (x, y, rgb) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const d = (y * W + x) * 4; img.data[d] = rgb[0]; img.data[d + 1] = rgb[1]; img.data[d + 2] = rgb[2]; img.data[d + 3] = 255; };
const blit = (src, ox, oy, k) => {
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    const s = (y * src.w + x) * 4;
    if (src.data[s + 3] < 128) continue;
    for (let dy = 0; dy < k; dy++) for (let dx = 0; dx < k; dx++) put(ox + x * k + dx, oy + y * k + dy, [src.data[s], src.data[s + 1], src.data[s + 2]]);
  }
};
rows.forEach((r, i) => {
  const k = kOf(r), oy = pad + i * rowPx, S = r.strip.h;
  if (!r.old) blit(r.still, pad, oy, k);
  const x0 = pad + r.still.w * k + pad;
  blit(r.strip, x0, oy, k);
  // thin divider between frames
  for (let f = 1; f < r.strip.w / S; f++) for (let y = 0; y < S * k; y++) put(x0 + f * S * k - 1, oy + y, [70, 76, 110]);
  if (r.old) for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) put(pad + x, oy + y, [255, 120, 120]); // red dot marks the old version
});
fs.writeFileSync(out, encodePng(img));
console.log(`wrote ${out} (${rows.length} rows)`);
