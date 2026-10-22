#!/usr/bin/env node
// Evaluates a JS expression inside the running game (headless Chrome) and prints the result.
// usage: node tools/probe.mjs "<async js expression using window.__mm / window.__game>" [baseUrl]
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const expr = process.argv[2];
const base = process.argv[3] || 'http://localhost:5212';
const CHROME = process.env.CHROME_BIN || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9355;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, '--disable-gpu', '--no-first-run', '--window-size=960,540',
  `--user-data-dir=${path.join(os.tmpdir(), 'mm_probe_profile')}`, 'about:blank'], { stdio: 'ignore' });
const stop = () => { try { spawn('taskkill', ['/F', '/T', '/PID', String(chrome.pid)]); } catch (e) { /* ignore */ } };
process.on('exit', stop);
let ws;
for (let i = 0; i < 40 && !ws; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
    const page = list.find((t) => t.type === 'page');
    if (page) ws = new WebSocket(page.webSocketDebuggerUrl);
  } catch (e) { await sleep(250); }
}
await new Promise((r) => { ws.onopen = r; });
let id = 1;
const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? m.error); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = id++; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evalJs = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); return r.result?.value ?? r; };
await send('Runtime.enable');
await send('Page.enable');
await send('Page.navigate', { url: `${base}/?debug=1` });
let ready = false;
for (let i = 0; i < 160 && !ready; i++) { await sleep(500); ready = await evalJs("!!(window.__game && window.__mm && window.__game.scene.isActive('title'))"); }
const out = await evalJs(expr);
console.log(typeof out === 'string' ? out : JSON.stringify(out));
if (process.env.SHOT) {
  await sleep(Number(process.env.SHOT_WAIT || 150));
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.mkdirSync(path.dirname(path.resolve(process.env.SHOT)), { recursive: true });
  fs.writeFileSync(path.resolve(process.env.SHOT), Buffer.from(shot.data, 'base64'));
  console.log('screenshot saved', process.env.SHOT);
}
stop();
process.exit(0);
