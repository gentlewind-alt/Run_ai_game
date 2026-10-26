#!/usr/bin/env node
// Plays a full offline practice match in a real browser: you take one attempt, the Rival Bot takes its own (on screen, in real time),
// and the two results are compared. Needs the dev server on :5212. usage: node tools/practice_e2e.mjs [stake]
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const BASE = process.env.BASE || 'http://localhost:5212';
const CHROME = process.env.CHROME_BIN || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9399;
const STAKE = Number(process.argv[2] ?? 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run', '--window-size=960,540', `--user-data-dir=${path.join(os.tmpdir(), 'mm_practice_e2e')}`, 'about:blank'], { stdio: 'ignore' });
const stop = () => { try { spawn('taskkill', ['/F', '/T', '/PID', String(chrome.pid)]); } catch { /* ignore */ } };
process.on('exit', stop);
let page;
for (let i = 0; i < 40 && !page; i++) {
  try { page = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(`${BASE}/?mock=1&debug=1`)}`, { method: 'PUT' })).json(); } catch { await sleep(250); }
}
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });
let id = 1;
const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? m.error); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = id++; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable');
await send('Page.bringToFront');
const js = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300));
  return r.result?.value;
};
for (let i = 0; i < 120 && !(await js("!!(window.__game && window.__mm && window.__game.scene.isActive('title'))")); i++) await sleep(500);

const log = (...a) => console.log(...a);
await js(`(async () => {
  const p = await import('/src/core/practice.ts'); window.__p = p;
  const g = window.__game; g.scene.getScenes(true).forEach(s => { if (s.scene.key !== 'boot') g.scene.stop(s.scene.key); });
  g.scene.start('practice');
  await new Promise(r => setTimeout(r, 1500));
  p.startMatch(p.practiceConfig().levels[0], true, ${STAKE});
  g.scene.getScene('practice').draw();
})()`);
log('match started', await js("JSON.stringify({ coins: window.__p.practiceCoins(), match: window.__p.currentMatch() })"));

const playHuman = async () => {
  await js("(()=>{ const g = window.__game, m = window.__p.currentMatch(); g.scene.stop('practice'); g.scene.start('game', { level: 1000, loadout: window.__p.practiceConfig().loadout, practice: window.__p.turnFor(m) }); })()");
  for (let i = 0; i < 60 && !(await js("window.__game.scene.isActive('game')")); i++) await sleep(300);
  await sleep(1500);
  await js("window.__game.scene.getScene('game').skipToReady()");
  for (let i = 0; i < 80; i++) {
    const st = await js("window.__mm.battle().state");
    if (st === 'ready') { await js("window.__mm.fire({ angleDeg: 32, power: 0.8 }); 1"); await sleep(700); }
    else if (st === 'won' || st === 'lost') break;
    else await sleep(400);
  }
  for (let i = 0; i < 40 && !(await js("window.__game.scene.isActive('practice')")); i++) await sleep(400);
};
await playHuman();
log('after your turn', await js("JSON.stringify(window.__p.currentMatch().results)"));

// the bot plays by itself
await js("(()=>{ const g = window.__game, m = window.__p.currentMatch(); g.scene.stop('practice'); g.scene.start('game', { level: 1000, loadout: window.__p.practiceConfig().loadout, practice: window.__p.turnFor(m) }); })()");
const t0 = Date.now();
let shots = 0, last = '';
for (let i = 0; i < 160; i++) {
  await sleep(500);
  const s = await js("JSON.stringify({ practice: window.__game.scene.isActive('practice'), state: window.__game.scene.isActive('game') ? window.__game.scene.getScene('game').getBattle().state : 'gone', shotIdx: window.__game.scene.isActive('game') ? window.__game.scene.getScene('game').getBattle().shotIdx : -1 })");
  const v = JSON.parse(s);
  if (v.shotIdx >= 0) shots = Math.max(shots, v.shotIdx);
  last = s;
  if (v.practice) break;
}
log(`bot turn took ${Math.round((Date.now() - t0) / 1000)}s, shots fired ${shots}`);
log('final', await js("JSON.stringify({ results: window.__p.currentMatch().results, outcome: window.__p.matchOutcome(), coins: window.__p.practiceCoins(), record: window.__p.practiceRecord() })"));
const ok = await js("(()=>{ const m = window.__p.currentMatch(); return !!(m.results[0] && m.results[1] && window.__p.matchOutcome()) })()");
log(ok ? 'PASS: a full practice match finished and was settled' : 'FAIL: ' + last);
stop();
process.exit(ok ? 0 : 1);
