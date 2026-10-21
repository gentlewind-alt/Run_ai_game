import { spawn } from 'child_process';
import path from 'path';
import os from 'os';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TMP_PROFILE = path.join(os.tmpdir(), 'mm_chrome_profile_tune_boss');

async function main() {
  let devProc = null;
  let serverReady = false;
  try {
    const res = await fetch('http://localhost:5173/?debug=1');
    if (res.ok) serverReady = true;
  } catch (e) {}

  if (!serverReady) {
    devProc = spawn('npx.cmd', ['vite', '--port', '5173'], {
      cwd: path.resolve('game'),
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
    if (!serverReady) throw new Error('Vite dev server failed to start');
  }

  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${TMP_PROFILE}`,
  ]);

  const cleanup = () => {
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
        targetWs = list[0].webSocketDebuggerUrl;
        break;
      }
    } catch (e) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  const ws = new WebSocket(targetWs);
  let idCounter = 1;
  const pending = new Map();
  let loadFired = false;

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Page.loadEventFired') loadFired = true;
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  };

  await new Promise((resolve) => { ws.onopen = resolve; });

  const send = (method, params = {}) => {
    const id = idCounter++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  const evalCode = async (expr) => {
    const res = await send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result?.value;
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 432,
    height: 768,
    deviceScaleFactor: 1,
    mobile: true,
  });

  await send('Page.navigate', { url: 'http://localhost:5173/?debug=1' });

  for (let i = 0; i < 50; i++) {
    if (loadFired) break;
    await new Promise((r) => setTimeout(r, 100));
  }

  for (let i = 0; i < 60; i++) {
    const res = await evalCode(`Boolean(window.__game && window.__game.scene && window.__game.scene.scenes.length > 0)`);
    if (res === true) break;
    await new Promise((r) => setTimeout(r, 250));
  }

  for (let i = 0; i < 60; i++) {
    const res = await evalCode(`Boolean(window.__mm && typeof window.__mm.solveStep === 'function')`);
    if (res === true) break;
    await new Promise((r) => setTimeout(r, 250));
  }

  console.log('Game ready with __mm.');

  // Set up save fixture as in audit_shots
  await evalCode(`(async () => {
    const v1Fixture = {
      version: 1,
      coins: 350,
      owned: { weapons: ['w_militia_blade', 'w_iron_cleaver'], artifacts: ['r_gale_eye'], consumables: { c_mindflash: 2 } },
      upgrades: { w_militia_blade: 2 },
      stars: { '1': 3, '2': 2, '3': 3, '4': 1 },
      equipped: { loadout: ['w_militia_blade', 'w_iron_cleaver'], artifacts: ['r_gale_eye'] }
    };
    await window.__mm.platform().storage.set('save', JSON.stringify(v1Fixture));
    await window.__mm.loadSave();
  })()`);

  const defaultLoadout = ['w_militia_blade', 'w_iron_cleaver', 'w_ashwood_staff', 'w_hunters_pike', 'w_scrapheap_scattergun'];

  // Test combinations
  const candidates = [
    { hp: 700, armour: 20 },
    { hp: 750, armour: 20 },
    { hp: 800, armour: 18 },
    { hp: 800, armour: 20 },
    { hp: 850, armour: 18 },
    { hp: 850, armour: 20 },
    { hp: 900, armour: 16 },
    { hp: 900, armour: 18 },
  ];

  for (const c of candidates) {
    const res = await evalCode(`(() => {
      window.__mm.load(12);
      const bDef = window.__mm.battle().content.monsters.find(m => m.id === 'iron_warlord');
      bDef.hp = ${c.hp};
      bDef.params.armour = ${c.armour};
      bDef.params.initialDelay = 180;
      bDef.params.visorOpenEvery = 220;
      bDef.params.visorOpenDuration = 24;

      const sw = window.__mm.sweep(12, ${JSON.stringify(defaultLoadout)});
      const sol = window.__mm.solveStep(12, ${JSON.stringify(defaultLoadout)}, 15000);
      return {
        sweep1ShotWins: sw.oneShotWins,
        sweepBestKills: sw.best.kills,
        sweepBestScore: sw.best.score,
        shots: sol.shots?.length,
        won: sol.view?.won,
        score: sol.view?.score
      };
    })()`);
    console.log(`HP ${c.hp}, Armour ${c.armour} -> 1shotWins: ${res.sweep1ShotWins}, bestScore: ${res.sweepBestScore} | solve shots: ${res.shots}, won: ${res.won}, score: ${res.score}`);
  }

  ws.close();
  cleanup();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
