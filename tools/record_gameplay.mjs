#!/usr/bin/env node
// Records real gameplay (headless Chrome screencast) into numbered segments for a trailer: levels, a boss citadel, the builder and a
// Global Challenge. Needs the dev server on :5212. usage: node tools/record_gameplay.mjs <outDir>
// Each segment becomes <outDir>/<name>/frames.txt (an ffconcat list with real frame times) plus the JPEG frames.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const outDir = path.resolve(process.argv[2] ?? 'trailer_raw');
const BASE = process.env.BASE || 'http://localhost:5212';
const CHROME = process.env.CHROME_BIN || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9366;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null; // e.g. ONLY=03 records just that segment
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run', '--window-size=960,540', '--hide-scrollbars',
  '--autoplay-policy=no-user-gesture-required', `--user-data-dir=${path.join(os.tmpdir(), 'mm_rec_profile')}`, 'about:blank'], { stdio: 'ignore' });
const stop = () => { try { spawn('taskkill', ['/F', '/T', '/PID', String(chrome.pid)]); } catch { /* ignore */ } };
process.on('exit', stop);
let ws;
for (let i = 0; i < 40 && !ws; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
    const page = list.find((t) => t.type === 'page');
    if (page) ws = new WebSocket(page.webSocketDebuggerUrl);
  } catch { await sleep(250); }
}
await new Promise((r) => { ws.onopen = r; });
let id = 1;
const pending = new Map();
let segment = null; // { dir, frames:[{file,t}], n }
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? m.error); pending.delete(m.id); return; }
  if (m.method === 'Page.screencastFrame') {
    send('Page.screencastFrameAck', { sessionId: m.params.sessionId });
    if (segment) {
      const file = path.join(segment.dir, `f${String(segment.frames.length).padStart(5, '0')}.jpg`);
      fs.writeFileSync(file, Buffer.from(m.params.data, 'base64'));
      segment.frames.push({ file, t: m.params.metadata.timestamp });
    }
  }
};
const send = (method, params = {}) => new Promise((r) => { const i = id++; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const js = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400));
  return r.result?.value;
};
await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 960, height: 540, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: `${BASE}/?mock=1&debug=1` });
for (let i = 0; i < 120; i++) { await sleep(500); if (await js("!!(window.__game && window.__mm && window.__game.scene.isActive('title'))")) break; }
await send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 960, maxHeight: 540, everyNthFrame: 1 });

const rec = async (name, ms, action) => {
  if (ONLY && !ONLY.test(name)) return;
  const dir = path.join(outDir, name);
  fs.mkdirSync(dir, { recursive: true });
  segment = { dir, frames: [] };
  const t0 = Date.now();
  if (action) await action();
  const left = ms - (Date.now() - t0);
  if (left > 0) await sleep(left);
  const s = segment;
  segment = null;
  let list = 'ffconcat version 1.0\n';
  s.frames.forEach((f, i) => {
    const dur = i < s.frames.length - 1 ? s.frames[i + 1].t - f.t : 0.05;
    list += `file '${path.basename(f.file)}'\nduration ${Math.max(0.01, dur).toFixed(4)}\n`;
  });
  list += `file '${path.basename(s.frames.at(-1).file)}'\n`;
  fs.writeFileSync(path.join(dir, 'frames.txt'), list);
  console.log(name, s.frames.length, 'frames');
};

const LOADOUT = ['w_iron_cleaver', 'w_ashwood_staff', 'w_hunters_pike', 'w_blast_tube', 'w_scrapheap_scattergun', 'w_hunters_boomerang'];
const DISCS = Array(6).fill('w_bulwark_disc');
const stopAll = "{ const g=window.__game; g.scene.getScenes(true).forEach(s=>{ if(s.scene.key!=='boot') g.scene.stop(s.scene.key) }); } ";

await js(`window.__rec = {
  until: async (states, t) => { const s = Date.now(); while (Date.now() - s < t) { const st = window.__mm.battle().state; if (states.includes(st)) return st; await new Promise(r => setTimeout(r, 100)); } return 'timeout'; },
}; 1`);

// a level played in real time with the solver's winning shots
const level = async (name, n, loadout, ms) => {
  if (ONLY && !ONLY.test(name)) return;
  const shots = JSON.parse(await js(`(()=>{ const mm = window.__mm; let solved; for (let i = 0; i < 12; i++) { solved = mm.solveStep(${n}, ${JSON.stringify(loadout)}, 15000); if (solved.done) break; } return JSON.stringify(solved.shots) })()`));
  await js(`window.__mm.load(${n}, ${JSON.stringify(loadout)}); 1`);
  await sleep(300);
  await rec(name, ms, async () => {
    await sleep(1100);
    for (const shot of shots) {
      if ((await js("window.__rec.until(['ready','won','lost'], 9000)")) !== 'ready') break;
      await js(`window.__mm.fire(${JSON.stringify(shot)}); 1`);
      await sleep(900);
    }
    await js("window.__rec.until(['won','lost'], 12000)");
    await sleep(1600);
  });
};

// Title
await rec('01_title', 3000);
// Levels
await level('02_level_2', 2, LOADOUT, 7500);

await level('04_level_31', 31, LOADOUT, 9000);
await level('05_boss_35', 35, LOADOUT, 10500);

// Builder: a fort goes up block by block
await js(stopAll + "window.__game.scene.start('builder'); 1");
await sleep(2500);
const lv = JSON.parse(fs.readFileSync(path.resolve('game/public/data/levels/level_31.json'), 'utf8'));
const blocks = lv.blocks.map((b, i) => ({ id: `b${i}`, m: b.m, x: b.x, y: b.y, w: b.w, h: b.h, shape: 'rectangle', angle: 0, static: false }));
const mons = lv.monsters.filter((m) => !['imp', 'lava_imp', 'cloud_harpy'].includes(m.t)).map((m) => ({ t: m.t, x: m.x, y: m.y })).filter((m) => ['goblin_grunt', 'goblin_bomber', 'dark_elf_archer', 'orc_brute'].includes(m.t));
await rec('06_builder', 9000, async () => {
  const step = Math.max(1, Math.floor(blocks.length / 14));
  for (let i = step; i <= blocks.length + step; i += step) {
    const n = Math.min(i, blocks.length);
    await js(`window.__game.scene.getScene('builder').setDocument(${JSON.stringify({ schema: 'monster-mash-builder', version: 1, name: 'My level', blocks: blocks.slice(0, n), monsters: n === blocks.length ? mons.slice(0, 1) : [], connections: [] })}); 1`).catch(() => {});
    await sleep(380);
    if (n === blocks.length) break;
  }
  await sleep(600);
  await js("window.__game.scene.getScene('builder').simulate(true); 1").catch(() => {});
});

// Global Challenges: list -> a challenge -> pick weapons -> fling
await js(stopAll + "window.__game.scene.start('challenges'); 1");
await sleep(2500);
await rec('07_challenges', 3500);
await js(stopAll + "window.__game.scene.start('challenge',{id:'seed_1'}); 1");
await sleep(2500);
await rec('08_challenge_detail', 3500);
// a challenge played from the weapon pick to the score screen. Dry-run first (not recorded) to find a winning shot.
await js(stopAll + `(async () => { const m = await import('/src/core/challenges.ts'); window.__c = await m.getChallenge('seed_1'); window.__m = m; })(); 1`);
await sleep(600);
const picks = JSON.parse(await js("JSON.stringify([0,1,2,0,1].map(i => window.__c.allowed[i % window.__c.allowed.length]))"));
const winShot = await js(`(async () => {
  const g = window.__game, mm = window.__mm, loadout = ${JSON.stringify(picks)};
  for (const power of [0.8, 0.95, 0.65]) for (let angle = 20; angle <= 60; angle += 4) {
    g.scene.getScenes(true).forEach(s => { if (s.scene.key !== 'boot') g.scene.stop(s.scene.key); });
    g.scene.start('game', { level: 1000, loadout, customLevel: window.__m.challengeLevel(window.__c, loadout), challenge: window.__c });
    mm.run(4); g.scene.getScene('game').skipToReady(); mm.run(20);
    mm.fire({ angleDeg: angle, power }); const v = mm.settle();
    if (g.scene.getScene('game').getBattle().state === 'won') return JSON.stringify({ angleDeg: angle, power });
  }
  return 'none';
})()`);
console.log('challenge winning shot', winShot);
await js(stopAll + "window.__game.scene.start('challengeWeapons', { mode: 'play', challenge: window.__c }); 1");
await sleep(2500);
await rec('09_challenge_play', 15000, async () => {
  await sleep(800);
  for (const w of picks) { await js(`window.__game.scene.getScene('challengeWeapons').pick(${JSON.stringify(w)}); 1`); await sleep(450); }
  await sleep(700);
  await js("window.__game.scene.getScene('challengeWeapons').fling(); 1");
  await sleep(2600);
  if (winShot !== 'none') await js(`window.__mm.fire(${winShot}); 1`);
  await js("window.__rec.until(['won','lost'], 14000)");
  await sleep(3500);
});
console.log('done');
stop();
process.exit(0);
