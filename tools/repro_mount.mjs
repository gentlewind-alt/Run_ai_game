#!/usr/bin/env node
// Repro helper: starts a level through the natural intro/loading path in headless Chrome and reports the sling-mounted sprite.
// usage: node tools/repro_mount.mjs <levelId> <weaponId,weaponId,...> [baseUrl]
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const level = Number(process.argv[2] || 4);
const loadout = (process.argv[3] || 'w_militia_blade,w_steersong_arrow,w_steersong_arrow,w_kinetic_palms').split(',');
const base = process.argv[4] || 'http://localhost:5212';
const CHROME = process.env.CHROME_BIN || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9333;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, '--disable-gpu', '--no-first-run', '--window-size=960,540',
  `--user-data-dir=${path.join(os.tmpdir(), 'mm_repro_profile')}`, 'about:blank'], { stdio: 'ignore' });
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
await send('Page.navigate', { url: `${base}/?debug=1&level=${level}` });
await sleep(6000);
await evalJs(`(async()=>{const g=window.__game;g.scene.stop('game');await new Promise(r=>setTimeout(r,300));g.scene.start('game',{level:${level},loadout:${JSON.stringify(loadout)}});return 1})()`);
if (process.argv.includes('--interrupt')) {
  // simulate an accidental screen slide while the camera is doing its intro pan
  await sleep(900);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 600, y: 200, button: 'left', clickCount: 1 });
  for (let x = 600; x >= 360; x -= 40) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y: 200, button: 'left' }); await sleep(30); }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 360, y: 200, button: 'left', clickCount: 1 });
}
const out = [];
for (let i = 0; i < 40; i++) {
  await sleep(500);
  const s = await evalJs(`(()=>{const b=window.__game.scene.getScene('game').b;if(!b)return null;const r=b.readySprite;return {state:b.state,steps:b.steps,shotIdx:b.shotIdx,queue:b.queue.length,vis:r&&r.visible,tex:r&&r.texture.key,x:r&&Math.round(r.x),y:r&&Math.round(r.y),sc:r&&r.scaleX,wpn:b.wpn&&b.wpn.texture,loadout:b.loadout,paused:b.paused}})()`);
  out.push(s);
  if (s && (s.state === 'ready' || s.state === 'aiming')) break;
}
console.log('last states:', JSON.stringify(out.slice(-3)));
const shot = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync(path.resolve('docs/handoff/shots/repro_mount.png'), Buffer.from(shot.data, 'base64'));
console.log('errors:', JSON.stringify(errors.slice(0, 5)));
const last = out[out.length - 1];
const ok = !!last && (last.state === 'ready' || last.state === 'aiming') && last.vis === true && errors.length === 0;
console.log(ok ? 'PASS: weapon mounted on the sling' : 'FAIL: weapon not mounted (state ' + (last && last.state) + ')');
stop();
process.exit(ok ? 0 : 1);
