#!/usr/bin/env node
// Opens a scene from the title screen in headless Chrome the way a player would and saves a screenshot.
// usage: node tools/scene_shot.mjs <scene> [json data] [out.png] [baseUrl]
// e.g.   node tools/scene_shot.mjs leaderboards '{"tab":"overall"}' docs/handoff/shots/lb_overall.png
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const scene = process.argv[2] || 'map';
const sceneData = process.argv[3] ? JSON.parse(process.argv[3]) : {};
const out = process.argv[4] || `docs/handoff/shots/scene_${scene}.png`;
const base = process.argv[5] || 'http://localhost:5212';
const CHROME = process.env.CHROME_BIN || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9344;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, '--disable-gpu', '--no-first-run', '--window-size=960,540',
  `--user-data-dir=${path.join(os.tmpdir(), 'mm_sceneshot_profile')}`, 'about:blank'], { stdio: 'ignore' });
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
const errors = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? m.error); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push((m.params.args || []).map((a) => a.value ?? a.description).join(' '));
};
const send = (method, params = {}) => new Promise((r) => { const i = id++; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evalJs = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); return r.result?.value ?? r; };

await send('Runtime.enable');
await send('Page.enable');
await send('Page.navigate', { url: `${base}/?debug=1${process.env.QS || ''}` });
let ready = false;
for (let i = 0; i < 60 && !ready; i++) { await sleep(500); ready = await evalJs("!!(window.__game && window.__game.scene.isActive('title'))"); }
await evalJs(`(()=>{window.__game.scene.getScene('title').scene.start(${JSON.stringify(scene)},${JSON.stringify(sceneData)});return 1})()`);
await sleep(Number(process.env.WAIT_MS || 3500));
const shot = await send('Page.captureScreenshot', { format: 'png' });
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(path.resolve(out), Buffer.from(shot.data, 'base64'));
console.log('saved', out, '| title ready:', ready, '| errors:', JSON.stringify(errors.slice(0, 4)));
stop();
process.exit(0);
