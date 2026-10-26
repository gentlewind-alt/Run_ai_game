#!/usr/bin/env node
// End-to-end test of the Global Arena with two simulated players against the local multiplayer server (npm run dev on :5212).
// Alice invites Bob to a 10-coin match, both play one full attempt each in a real browser, and the room replays and verifies the results.
// usage: node tools/arena_e2e.mjs
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const BASE = process.env.BASE || 'http://localhost:5212';
const CHROME = process.env.CHROME_BIN || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9388;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run', '--window-size=960,540', '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', `--user-data-dir=${path.join(os.tmpdir(), 'mm_arena_e2e')}`, 'about:blank'], { stdio: 'ignore' });
const stop = () => { try { spawn('taskkill', ['/F', '/T', '/PID', String(chrome.pid)]); } catch { /* ignore */ } };
process.on('exit', stop);

async function target(url) {
  let page;
  for (let i = 0; i < 40 && !page; i++) {
    try {
      const made = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json();
      page = made;
    } catch { await sleep(250); }
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => { ws.onopen = r; });
  let id = 1;
  const pending = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? m.error); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise((r) => { const i = id++; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable');
  const js = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300));
    return r.result?.value;
  };
  return { js, front: () => send('Page.bringToFront') };
}

const ready = "!!(window.__game && window.__mm && window.__game.scene.isActive('title'))";
const A = await target(`${BASE}/?mock=1&arenaDevId=aaaa1111&arenaName=Alice`);
const B = await target(`${BASE}/?mock=1&arenaDevId=bbbb2222&arenaName=Bob`);
for (const c of [A, B]) for (let i = 0; i < 120 && !(await c.js(ready)); i++) await sleep(500);

const log = (...a) => console.log(...a);
const connect = async (c, name) => {
  await c.js("(async()=>{ const { arena } = await import('/src/core/arena.ts'); window.__arena = arena; await arena.connect(); })()");
  for (let i = 0; i < 60; i++) { if (await c.js("window.__arena.status === 'online' && !!window.__arena.snapshot")) break; await sleep(500); }
  await c.js("(()=>{ const a = window.__arena, orig = a.submit.bind(a); a.submit = (setup, replay) => { window.__replays = (window.__replays || []).concat([JSON.stringify({ setup, replay })]); return orig(setup, replay); }; })()");
  log(name, 'connected:', await c.js("window.__arena.status + ' me=' + window.__arena.snapshot?.me + ' coins=' + window.__arena.snapshot?.coins"));
};
await connect(A, 'Alice');
await connect(B, 'Bob');
for (let i = 0; i < 40 && !(await A.js("window.__arena.snapshot.players.length > 0")); i++) { await A.js('window.__arena.sync()'); await sleep(500); }
log('Alice sees players:', await A.js("JSON.stringify(window.__arena.snapshot.players.map(p => p.name))"));

await A.js("(()=>{ const a = window.__arena; a.send({ type: 'arena:invite', targetId: a.snapshot.players[0].id, challengeId: 'seed_1', wager: 10 }); })()");
for (let i = 0; i < 40 && !(await B.js("window.__arena.snapshot.invitations.length > 0")); i++) { await B.js('window.__arena.sync()'); await sleep(500); }
log('Bob invitations:', await B.js("JSON.stringify(window.__arena.snapshot.invitations.map(i => ({ from: i.fromName, wager: i.wager, title: i.title })))"));
await B.js("(()=>{ const a = window.__arena; const inv = a.snapshot.invitations[0]; a.send({ type: 'arena:respond', inviteId: inv.id, accept: true, wager: inv.wager }); })()");
for (let i = 0; i < 40 && !(await A.js("window.__arena.snapshot.match?.state === 'ready'")); i++) { await A.js('window.__arena.sync()'); await sleep(500); }
log('Match:', await A.js("JSON.stringify({ state: window.__arena.snapshot.match?.state, wager: window.__arena.snapshot.match?.wager, coins: window.__arena.snapshot.coins })"));

const playTurn = async (c, name, angle, power) => {
  await c.front(); // a tab in the background does not run the game loop
  await sleep(500);
  await c.js("(()=>{ const g = window.__game; g.scene.getScenes(true).forEach(s => { if (s.scene.key !== 'boot') g.scene.stop(s.scene.key); }); g.scene.start('arena'); })()");
  await sleep(2500);
  await c.js('window.__arena.startTurn()');
  for (let i = 0; i < 80 && !(await c.js("window.__game.scene.isActive('game')")); i++) await sleep(500);
  if (!(await c.js("window.__game.scene.isActive('game')"))) throw new Error(`${name}: the battle never started: ` + await c.js("JSON.stringify({ error: window.__arena.error, pending: window.__arena.pendingStart, compatible: window.__arena.compatible(), match: window.__arena.snapshot.match && { state: window.__arena.snapshot.match.state, turn: window.__arena.snapshot.match.turn, players: window.__arena.snapshot.match.players, rev: window.__arena.snapshot.match.revision }, me: window.__arena.snapshot.me, scenes: window.__game.scene.getScenes(true).map(s => s.scene.key), status: window.__arena.status })"));
  for (let i = 0; i < 40; i++) {
    const st = await c.js("window.__mm.battle().state");
    if (st === 'ready') { await c.js(`window.__mm.fire({ angleDeg: ${angle}, power: ${power} }); 1`); await sleep(800); }
    else if (st === 'won' || st === 'lost') break;
    else await sleep(500);
  }
  for (let i = 0; i < 60 && !(await c.js("window.__arena.snapshot.match?.results?.some(r => r)")) ; i++) await sleep(500);
  log(name, 'turn done:', await c.js("JSON.stringify({ battle: window.__game.scene.isActive('game') ? window.__mm.battle().state : 'left', error: window.__arena.error })"));
};
await playTurn(A, 'Alice', 20, 0.95);
for (let i = 0; i < 40 && !(await B.js("window.__arena.snapshot.match?.turn === 1 && window.__arena.snapshot.match?.state === 'ready'")); i++) { await B.js('window.__arena.sync()'); await sleep(500); }
log('Bob sees turn:', await B.js("JSON.stringify({ turn: window.__arena.snapshot.match?.turn, state: window.__arena.snapshot.match?.state })"));
await playTurn(B, 'Bob', 35, 0.6);
for (let i = 0; i < 60 && !(await A.js("window.__arena.snapshot.match?.state === 'finished'")); i++) { await A.js('window.__arena.sync()'); await sleep(500); }
const final = JSON.parse(await A.js("JSON.stringify({ match: window.__arena.snapshot.match, coins: window.__arena.snapshot.coins, wins: window.__arena.snapshot.wins, losses: window.__arena.snapshot.losses })"));
const bobCoins = await B.js("(window.__arena.sync(), 0)").then(async () => { await sleep(1000); return B.js('window.__arena.snapshot.coins'); });
if (process.env.DUMP) { const fs = await import('node:fs'); fs.writeFileSync(process.env.DUMP, JSON.stringify({ alice: await A.js('window.__replays'), bob: await B.js('window.__replays') })); }
log('FINAL', JSON.stringify({ state: final.match.state, resolution: final.match.resolution, winner: final.match.winnerId, results: final.match.results, aliceCoins: final.coins, bobCoins }));
const ok = final.match.state === 'finished' && final.match.results.every((r) => r && !r.forfeit) && final.coins + bobCoins === 200;
log(ok ? 'PASS: two players played a full verified match; coins add up to 200' : 'FAIL');
stop();
process.exit(ok ? 0 : 1);
