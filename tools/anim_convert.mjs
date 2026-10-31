// Turns a `rundot generate animate-sprite` sheet into a game strip, then scores it (tools/lib/anim.mjs).
//   node tools/anim_convert.mjs <enemy id> <idle|fly|run> [--sheet path] [--frames 6]    one enemy
//   node tools/anim_convert.mjs --all                                                      every enemy in game/public/data/content.json
// Reads tools/anim_sheets/<id>.png (the raw sheet) and tools/anim_stills/<id>.png (the enemy's still sprite at native size);
// writes game/public/sprites/monsters/anim/<id>_<kind>.png. No credits are spent: re-run it any time the settings change.
//
// What it does to keep an animation on-model and clean:
//  - colours are locked to the colours of the enemy's own still sprite (no off-palette pixels),
//  - every frame uses one shared scale, chosen so the animated enemy has the same size as its still,
//  - each target pixel takes the most common colour of the source pixels it covers (crisp, no blur),
//  - repeated frames are dropped (a duplicate makes the loop stall), stray pixels are removed, one-pixel holes are filled,
//  - idle and run frames are planted on the still's footing so the feet do not swim.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng } from './lib/png.mjs';
import { analyze } from './lib/anim.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const stillsDir = path.join(root, 'tools', 'anim_stills');
const sheetsDir = path.join(root, 'tools', 'anim_sheets');
const outDir = path.join(root, 'game', 'public', 'sprites', 'monsters', 'anim');

const opaque = (d, i, t = 128) => d[i + 3] >= t;

function splitSheet(sheet, n) {
  const F = Math.floor(sheet.w / n);
  return Array.from({ length: n }, (_v, k) => {
    const data = new Uint8Array(F * sheet.h * 4);
    for (let y = 0; y < sheet.h; y++) for (let x = 0; x < F; x++) data.set(sheet.data.subarray((y * sheet.w + k * F + x) * 4, (y * sheet.w + k * F + x) * 4 + 4), (y * F + x) * 4);
    return { w: F, h: sheet.h, data };
  });
}

function rawDiff(a, b) {
  let diff = 0, union = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    const oa = opaque(a.data, i), ob = opaque(b.data, i);
    if (!oa && !ob) continue;
    union++;
    if (oa !== ob || Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]) > 90) diff++;
  }
  return union ? diff / union : 0;
}

/** Drops frames that repeat the previous one (and a last frame that repeats the first), so the loop never holds still. */
function dedupe(frames, threshold) {
  const kept = [];
  for (const f of frames) if (!kept.length || rawDiff(kept[kept.length - 1], f) > threshold) kept.push(f);
  while (kept.length > 3 && rawDiff(kept[kept.length - 1], kept[0]) <= threshold) kept.pop();
  return kept;
}

function stillPalette(still) {
  const seen = new Map();
  for (let i = 0; i < still.data.length; i += 4) if (opaque(still.data, i)) seen.set((still.data[i] << 16) | (still.data[i + 1] << 8) | still.data[i + 2], [still.data[i], still.data[i + 1], still.data[i + 2]]);
  return [...seen.values()];
}

/** One frame at a given scale: majority vote of palette colours per target pixel, placed with the bbox bottom on `bottom` and centred on `cx`. */
function renderFrame(f, crop, scale, S, palette, cache, cx, bottom) {
  const tw = Math.max(1, Math.round(crop.w * scale)), th = Math.max(1, Math.round(crop.h * scale));
  const dx = Math.min(Math.max(0, Math.round(cx - tw / 2)), S - tw), dy = Math.max(0, Math.round(bottom - th));
  const K = palette.length;
  const cnt = new Int32Array(S * S * (K + 1));
  for (let y = 0; y < crop.h; y++) {
    const ty = Math.min(S - 1, dy + Math.floor(y * th / crop.h));
    for (let x = 0; x < crop.w; x++) {
      const tx = Math.min(S - 1, dx + Math.floor(x * tw / crop.w));
      const i = ((crop.y + y) * f.w + crop.x + x) * 4;
      const slot = (ty * S + tx) * (K + 1);
      if (!opaque(f.data, i)) { cnt[slot + K]++; continue; }
      const key = (f.data[i] << 16) | (f.data[i + 1] << 8) | f.data[i + 2];
      let c = cache.get(key);
      if (c === undefined) {
        let best = 0, bd = Infinity;
        for (let p = 0; p < K; p++) { const q = palette[p]; const d = 2 * (f.data[i] - q[0]) ** 2 + 4 * (f.data[i + 1] - q[1]) ** 2 + 3 * (f.data[i + 2] - q[2]) ** 2; if (d < bd) { bd = d; best = p; } }
        c = best; cache.set(key, c);
      }
      cnt[slot + c]++;
    }
  }
  const out = new Uint8Array(S * S * 4);
  for (let p = 0; p < S * S; p++) {
    const slot = p * (K + 1);
    let op = 0, best = -1, bn = 0;
    for (let c = 0; c < K; c++) { const n = cnt[slot + c]; op += n; if (n > bn) { bn = n; best = c; } }
    if (best >= 0 && op * 2 >= op + cnt[slot + K]) { out[p * 4] = palette[best][0]; out[p * 4 + 1] = palette[best][1]; out[p * 4 + 2] = palette[best][2]; out[p * 4 + 3] = 255; }
  }
  return out;
}

function cleanup(px, S) {
  const at = (x, y) => (x >= 0 && y >= 0 && x < S && y < S ? (y * S + x) * 4 : -1);
  const solid = (x, y) => { const i = at(x, y); return i >= 0 && px[i + 3] === 255; };
  const del = [], fill = [];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const n = [solid(x - 1, y), solid(x + 1, y), solid(x, y - 1), solid(x, y + 1)].filter(Boolean).length;
    if (solid(x, y) && n === 0) del.push(at(x, y));
    if (!solid(x, y) && n >= 3) fill.push([x, y]);
  }
  for (const i of del) px[i + 3] = 0;
  for (const [x, y] of fill) {
    const votes = new Map();
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const i = at(x + dx, y + dy); if (i >= 0 && px[i + 3] === 255) { const k = (px[i] << 16) | (px[i + 1] << 8) | px[i + 2]; votes.set(k, [(votes.get(k) ?? [0, i])[0] + 1, i]); } }
    const [, i] = [...votes.values()].sort((a, b) => b[0] - a[0])[0];
    const j = at(x, y);
    px[j] = px[i]; px[j + 1] = px[i + 1]; px[j + 2] = px[i + 2]; px[j + 3] = 255;
  }
}

function bounds(px, S) {
  let minX = S, maxX = -1, minY = S, maxY = -1, area = 0, sx = 0;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (px[(y * S + x) * 4 + 3] === 255) { area++; sx += x; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  return { minX, maxX, minY, maxY, area, cx: area ? sx / area : 0 };
}

function shift(px, S, dx, dy) {
  const out = new Uint8Array(px.length);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= S || ny >= S) continue;
    out.set(px.subarray((y * S + x) * 4, (y * S + x) * 4 + 4), (ny * S + nx) * 4);
  }
  return out;
}

export function convert(sheet, still, kind, opts = {}) {
  const S = still.w;
  const palette = stillPalette(still);
  let frames = dedupe(splitSheet(sheet, opts.frames ?? 6), opts.dupThreshold ?? 0.03);
  // one crop box over every frame, so the creature keeps one scale through the loop
  let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
  for (const f of frames) for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (opaque(f.data, (y * f.w + x) * 4, 16)) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  const crop = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  const sb = bounds(new Uint8Array(still.data.map((v, i) => (i % 4 === 3 ? (v >= 128 ? 255 : 0) : v))), S);
  const stillCx = (sb.minX + sb.maxX + 1) / 2, stillBottom = sb.maxY + 1;
  const cache = new Map();
  // pick the scale whose mean size best matches the still (within what fits in the square)
  const base = Math.min((sb.maxY - sb.minY + 1) / crop.h, S / crop.w);
  let best = null;
  for (let f = 0.7; f <= 1.45; f += 0.02) {
    const s = base * f;
    if (Math.round(crop.w * s) > S || Math.round(crop.h * s) > S) continue;
    const px = frames.map((fr) => renderFrame(fr, crop, s, S, palette, cache, stillCx, stillBottom));
    const area = px.reduce((a, p) => a + bounds(p, S).area, 0) / px.length;
    const err = Math.abs(area / sb.area - 1);
    if (!best || err < best.err - 1e-9) best = { err, s, px };
  }
  let px = best.px;
  px.forEach((p) => cleanup(p, S));
  if (opts.plant !== false && kind !== 'fly') {
    // idle and run: feet and body line up with the still, so the creature breathes or runs on the spot instead of swimming
    const bs = px.map((p) => bounds(p, S));
    const wantBottom = Math.round(bs.map((b) => b.maxY).sort((a, b) => a - b)[Math.floor(bs.length / 2)]);
    const wantCx = bs.map((b) => b.cx).sort((a, b) => a - b)[Math.floor(bs.length / 2)];
    px = px.map((p, k) => shift(p, S, kind === 'idle' ? Math.round(wantCx - bs[k].cx) : 0, wantBottom - bs[k].maxY));
  }
  const strip = { w: S * px.length, h: S, data: new Uint8Array(S * px.length * S * 4) };
  px.forEach((p, k) => { for (let y = 0; y < S; y++) strip.data.set(p.subarray(y * S * 4, (y + 1) * S * 4), (y * strip.w + k * S) * 4); });
  return { strip, result: analyze(strip, still, kind), frames: px.length, scale: best.s };
}

// ------------------------------------------------------------------ command line

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
  const jobs = [];
  if (args.includes('--all')) {
    const content = JSON.parse(fs.readFileSync(path.join(root, 'game', 'public', 'data', 'content.json'), 'utf8'));
    for (const m of content.monsters) for (const kind of Object.keys(m.anim ?? {})) jobs.push({ id: m.id, kind });
  } else jobs.push({ id: args[0], kind: args[1] });
  for (const { id, kind } of jobs) {
    const own = path.join(sheetsDir, `${id}_${kind}.png`);
    const sheetPath = opt('--sheet') ?? (fs.existsSync(own) ? own : path.join(sheetsDir, `${id}.png`));
    const { strip, result, frames, scale } = convert(decodePng(fs.readFileSync(sheetPath)), decodePng(fs.readFileSync(path.join(stillsDir, `${id}.png`))), kind, { frames: Number(opt('--frames') ?? 6) });
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, `${id}_${kind}.png`), encodePng(strip));
    const m = result.m;
    console.log(`${result.ok ? 'ok  ' : 'FAIL'} ${`${id}_${kind}`.padEnd(24)} ${frames}f x${scale.toFixed(2)} motion ${m.motion?.toFixed(2)} stall ${m.stall?.toFixed(2)} seam ${m.seam?.toFixed(1)} size ${m.size?.toFixed(2)} noise ${m.noise?.toFixed(1)} acc ${m.accent?.toFixed(2)} like ${m.likeness?.toFixed(2)}${result.ok ? '' : '  <- ' + result.fails.join('; ')}`);
  }
}
