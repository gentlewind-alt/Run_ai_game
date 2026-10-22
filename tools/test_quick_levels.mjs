import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TMP_PROFILE = path.join(os.tmpdir(), 'mm_chrome_profile_quick');

const levelsToTest = process.argv.slice(2).map(Number).filter(n => !isNaN(n) && n > 0);
if (levelsToTest.length === 0) levelsToTest.push(7, 12);

async function main() {
  let devProc = null;
  let serverReady = false;
  try {
    const res = await fetch('http://localhost:5173/?debug=1');
    if (res.ok) serverReady = true;
  } catch (e) {}

  if (!serverReady) {
    devProc = spawn('npx.cmd', ['vite', '--port', '5173'], {
      cwd: path.resolve(__dirname, '../game'),
      stdio: 'pipe',
      shell: true,
    });
    for (let i = 0; i < 40; i++) {
      try {
        const res = await fetch('http://localhost:5173/?debug=1');
        if (res.ok) {
          serverReady = true;
          break;
        }
      } catch (e) {
        await new Promise((r) => setTimeout(r, 250));
      }
    }
  }

  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--disable-extensions',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${TMP_PROFILE}`,
  ]);

  const cleanup = () => {
    if (chrome && chrome.pid) {
      try { spawn('taskkill', ['/F', '/T', '/PID', String(chrome.pid)]); } catch (e) {}
    }
    try { chrome.kill(); } catch (e) {}
    if (devProc) {
      try { spawn('taskkill', ['/F', '/T', '/PID', String(devProc.pid)]); } catch (e) {}
    }
  };
  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);

  let targetWs = null;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch('http://localhost:9222/json');
      const list = await res.json();
      if (list && list.length > 0) {
        const page = list.find((t) => t.type === 'page') || list[0];
        targetWs = page.webSocketDebuggerUrl;
        break;
      }
    } catch (e) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  const { default: WebSocket } = await import('ws').catch(async () => {
    return { default: globalThis.WebSocket };
  });

  const ws = new WebSocket(targetWs);
  await new Promise((r) => ws.on('open', r));

  let msgId = 1;
  const pending = new Map();
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  });

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = msgId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });

  const evalCode = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    }
    return r.result.value;
  };

  await send('Page.navigate', { url: 'http://localhost:5173/?debug=1' });
  await new Promise((r) => setTimeout(r, 2000));

  for (let i = 0; i < 40; i++) {
    const ready = await evalCode('Boolean(window.__game && window.__mm && typeof window.__mm.solveStep === "function")');
    if (ready) break;
    await new Promise((r) => setTimeout(r, 250));
  }

  const defaultLoadout = ['w_militia_blade', 'w_iron_cleaver', 'w_ashwood_staff', 'w_hunters_pike', 'w_scrapheap_scattergun', 'w_blast_tube'];
  const l6Loadout = ['w_militia_blade', 'w_iron_cleaver', 'w_scrapheap_scattergun', 'w_ashwood_staff', 'w_hunters_pike', 'w_blast_tube'];
  const l12Loadout = ['w_iron_cleaver', 'w_horned_scepter', 'w_hunters_pike', 'w_ashwood_staff', 'w_blast_tube', 'w_scrapheap_scattergun'];

  for (const lvl of levelsToTest) {
    const loadout = lvl === 12 ? l12Loadout : lvl === 6 ? l6Loadout : defaultLoadout;
    console.log(`\nEvaluating Level ${lvl}...`);
    const sweepRes = await evalCode(`window.__mm.sweep(${lvl}, ${JSON.stringify(loadout)})`);
    console.log(`  Sweep: bestScore=${sweepRes.best.score}, kills=${sweepRes.best.kills}, oneShots=${sweepRes.oneShotWins}, unreachable=${sweepRes.unreachable}`);

    let solveRes = null;
    let attempts = 0;
    while ((!solveRes || !solveRes.done) && attempts < 8) {
      attempts++;
      solveRes = await evalCode(`(() => {
        const r = window.__mm.solveStep(${lvl}, ${JSON.stringify(loadout)}, 20000);
        return {
          done: r.done,
          shotsCount: r.shots?.length || 0,
          shots: r.shots,
          won: r.view?.won || false,
          lost: r.view?.lost || false,
          monstersLeft: r.view?.monsters,
          ents: (r.view?.ents || []).filter(e => e.kind === 'monster'),
          score: r.view?.score || 0
        };
      })()`);
    }

    console.log(`  Solver: won=${solveRes.won}, shots=${solveRes.shotsCount}, score=${solveRes.score}, monstersLeft=${solveRes.monstersLeft}`);
    for (let s = 1; s <= solveRes.shots.length; s++) {
      const v = await evalCode(`window.__mm.play(${lvl}, ${JSON.stringify(loadout)}, ${JSON.stringify(solveRes.shots.slice(0, s))})`);
      console.log(`    Shot ${s} (${loadout[s-1]}): monstersLeft=${v.monsters}, score=${v.score}`);
      for (const e of (v.ents || []).filter(e => e.kind === 'monster')) {
        console.log(`      - ${e.type} (dead=${e.dead}, hp=${e.hp?.toFixed?.(1) ?? e.hp})`);
      }
    }
  }

  cleanup();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
