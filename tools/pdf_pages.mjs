#!/usr/bin/env node
// Renders pages of a PDF to PNGs with headless Chrome's built-in viewer (no poppler needed).
// usage: node tools/pdf_pages.mjs <file.pdf> <outDir> <page> [page ...]
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';

const [pdf, outDir, ...pages] = process.argv.slice(2);
const CHROME = process.env.CHROME_BIN || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9356;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, '--disable-gpu', '--no-first-run', '--window-size=1100,1500',
  `--user-data-dir=${path.join(os.tmpdir(), 'mm_pdf_profile')}`, 'about:blank'], { stdio: 'ignore' });
process.on('exit', () => { try { spawn('taskkill', ['/F', '/T', '/PID', String(chrome.pid)]); } catch (e) { /* ignore */ } });
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
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1100, height: 1500, deviceScaleFactor: 1, mobile: false });
fs.mkdirSync(outDir, { recursive: true });
const base = pathToFileURL(path.resolve(pdf)).href;
for (const p of pages) {
  await send('Page.navigate', { url: 'about:blank' });
  await sleep(400);
  await send('Page.navigate', { url: `${base}#page=${p}&zoom=page-fit&toolbar=0&navpanes=0&view=Fit` });
  await sleep(2500);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const f = path.join(outDir, `p${String(p).padStart(3, '0')}.png`);
  fs.writeFileSync(f, Buffer.from(shot.data, 'base64'));
  console.log('saved', f);
}
process.exit(0);
