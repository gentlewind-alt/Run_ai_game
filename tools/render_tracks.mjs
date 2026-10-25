#!/usr/bin/env node
// Renders the soundtrack (game/public/data/music.json through game/src/audio/trackgen.ts) to WAV files and checks every track.
// usage: node tools/render_tracks.mjs [outDir=docs/music]
// Writes <theme>.wav, <theme>_boss.wav and level_NN.wav (one file per level, with its key and tempo variant). Node 22.6+ (runs the TypeScript directly).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] ?? path.join(root, 'docs/music'));
fs.mkdirSync(out, { recursive: true });
const { buildPhrase } = await import(pathToFileURL(path.join(root, 'game/src/audio/trackgen.ts')).href);
const music = JSON.parse(fs.readFileSync(path.join(root, 'game/public/data/music.json'), 'utf8'));
const content = JSON.parse(fs.readFileSync(path.join(root, 'game/public/data/content.json'), 'utf8'));
const config = JSON.parse(fs.readFileSync(path.join(root, 'game/public/data/config.json'), 'utf8'));

const SR = 22050;
const wave = (kind, ph) => {
  const x = ph - Math.floor(ph);
  if (kind === 'square') return x < 0.5 ? 1 : -1;
  if (kind === 'sawtooth') return 2 * x - 1;
  if (kind === 'triangle') return 4 * Math.abs(x - 0.5) - 1;
  return Math.sin(2 * Math.PI * ph);
};
let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;

function render(themeId, variant, boss, phrases = 2) {
  const all = [];
  let offset = 0;
  for (let p = 0; p < phrases; p++) {
    const ph = buildPhrase(music, themeId, variant, boss, p);
    for (const e of ph.events) all.push({ ...e, t: e.t + offset });
    offset += ph.seconds;
  }
  const total = Math.ceil((offset + 0.3) * SR);
  const buf = new Float32Array(total);
  for (const e of all) {
    if (!(e.freq > 0) || !Number.isFinite(e.t) || !Number.isFinite(e.dur)) throw new Error(`bad event ${JSON.stringify(e)}`);
    const s0 = Math.floor(e.t * SR), n = Math.floor(e.dur * SR);
    for (let i = 0; i < n && s0 + i < total; i++) {
      const t = i / SR, k = i / n;
      let v;
      if (e.kind === 'note') v = wave(e.wave, e.freq * t) * Math.exp(-3.2 * k) * e.vol * 0.35;
      else if (e.kind === 'kick') v = Math.sin(2 * Math.PI * (40 * t + (e.freq * 1.8 - 40) * 0.035 * (1 - Math.exp(-t / 0.035)))) * Math.exp(-6 * k) * 0.8;
      else if (e.kind === 'snare') v = rnd() * Math.exp(-7 * k) * 0.3;
      else v = (rnd() - rnd()) * Math.exp(-9 * k) * 0.12;
      buf[s0 + i] += v;
    }
  }
  return { buf, seconds: offset };
}

function wav(buf) {
  const pcm = Buffer.alloc(buf.length * 2);
  let peak = 0;
  for (const v of buf) peak = Math.max(peak, Math.abs(v));
  const g = peak > 0.9 ? 0.9 / peak : 1;
  buf.forEach((v, i) => pcm.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * g * 32767))), i * 2));
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

let files = 0;
const write = (name, themeId, variant, boss, phrases) => {
  const r = render(themeId, variant, boss, phrases);
  fs.writeFileSync(path.join(out, name), wav(r.buf));
  files++;
  return r.seconds;
};
for (const id of Object.keys(music.themes)) {
  write(`${id}.wav`, id, 0, false, 2);
  if (music.themes[id].boss) write(`${id}_boss.wav`, id, 0, true, 2);
}
// determinism: the same request gives the same notes
const a = JSON.stringify(buildPhrase(music, 'ember', 21, false, 0)), b = JSON.stringify(buildPhrase(music, 'ember', 21, false, 0));
if (a !== b) throw new Error('buildPhrase is not deterministic');
const levelKinds = {};
for (const id of config.levels) {
  if (id >= 90) continue;
  const lv = JSON.parse(fs.readFileSync(path.join(root, `game/public/data/levels/level_${String(id).padStart(2, '0')}.json`), 'utf8'));
  const realm = (content.realms.find((r) => r.levels.includes(id)) ?? content.realms.find((r) => r.id === lv.realm))?.music ?? 'hills';
  const boss = lv.kind === 'boss';
  write(`level_${String(id).padStart(2, '0')}.wav`, realm, id, boss, 1);
  levelKinds[id] = `${realm}${boss ? ' (boss)' : ''}`;
}
for (const r of content.realms) if (!music.themes[r.music]) throw new Error(`realm ${r.id} uses unknown theme ${r.music}`);
console.log(`${files} files in ${out}`);
console.log(Object.entries(levelKinds).map(([k, v]) => `${k}:${v}`).join('  '));
