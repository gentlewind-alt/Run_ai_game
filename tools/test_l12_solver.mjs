import { spawn } from 'child_process';
import path from 'path';
import os from 'os';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TMP_PROFILE = path.join(os.tmpdir(), 'mm_chrome_profile_test12');

async function main() {
  console.log('Ensuring Vite server is running...');
  let devProc = null;
  let serverReady = false;
  try {
    const res = await fetch('http://localhost:5173/?debug=1');
    if (res.ok) serverReady = true;
  } catch (e) {}

  if (!serverReady) {
    console.log('Launching Vite dev server on port 5173...');
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

  console.log('Vite server ready, launching Chrome...');
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
  await send('Page.navigate', { url: 'http://localhost:5173/?debug=1' });

  for (let i = 0; i < 50; i++) {
    if (loadFired) break;
    await new Promise((r) => setTimeout(r, 100));
  }

  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      const r = await evalCode(`Boolean(window.__game && window.__mm && typeof window.__mm.platform === 'function' && typeof window.__mm.solveStep === 'function')`);
      if (r === true) {
        ready = true;
        break;
      }
    } catch (e) {}
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!ready) throw new Error('__mm not ready after timeout');

  console.log('Game ready with __mm.');

  const defaultLoadout = ['w_militia_blade', 'w_iron_cleaver', 'w_ashwood_staff', 'w_hunters_pike', 'w_scrapheap_scattergun'];
  const l12Loadout = ['w_iron_cleaver', 'w_horned_scepter', 'w_hunters_pike', 'w_ashwood_staff', 'w_blast_tube'];

  // Test L12 without artifacts first
  console.log('\n=== LEVEL 12 (NO ARTIFACTS, BASE PROFILE) ===');
  await evalCode(`(() => {
    const p = window.__mm.profile();
    p.equipped.artifacts = [];
    p.upgrades = {};
  })()`);

  const swDef = await evalCode(`window.__mm.sweep(12, ${JSON.stringify(defaultLoadout)})`);
  console.log('Sweep L12 (default loadout):', JSON.stringify(swDef, null, 2));

  const solDef = await evalCode(`window.__mm.solveStep(12, ${JSON.stringify(defaultLoadout)}, 20000)`);
  console.log('Solve L12 (default loadout): shots=' + solDef.shots?.length + ', won=' + solDef.view?.won + ', score=' + solDef.view?.score);

  const swLvl = await evalCode(`window.__mm.sweep(12, ${JSON.stringify(l12Loadout)})`);
  console.log('Sweep L12 (level loadout):', JSON.stringify(swLvl, null, 2));

  const solLvl = await evalCode(`window.__mm.solveStep(12, ${JSON.stringify(l12Loadout)}, 20000)`);
  console.log('Solve L12 (level loadout): shots=' + solLvl.shots?.length + ', won=' + solLvl.view?.won + ', score=' + solLvl.view?.score);

  // Now test with the phone pass save fixture (r_gale_eye + upgrade 2)
  console.log('\n=== LEVEL 12 WITH PHONE PASS FIXTURE (r_gale_eye + upgrade 2) ===');
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

  const swGale = await evalCode(`window.__mm.sweep(12, ${JSON.stringify(defaultLoadout)})`);
  console.log('Sweep L12 (r_gale_eye): best kills=' + swGale.best.kills + ', score=' + swGale.best.score + ', 1-shot wins=' + swGale.oneShotWins + ', unreachable=' + JSON.stringify(swGale.unreachable));

  const solGale = await evalCode(`window.__mm.solveStep(12, ${JSON.stringify(defaultLoadout)}, 20000)`);
  console.log('Solve L12 (r_gale_eye): shots=' + solGale.shots?.length + ', won=' + solGale.view?.won + ', score=' + solGale.view?.score);

  // Test across each artifact
  console.log('\n=== TESTING ALL ARTIFACTS ON L12 ===');
  const artifacts = ['r_gale_eye', 'r_echo_stone', 'r_lodestone_bracer', 'r_analyst_lens', 'r_stormcaller_torc', 'r_gamblers_charm'];
  for (const a of artifacts) {
    const swA = await evalCode(`(() => {
      const p = window.__mm.profile();
      p.owned.artifacts = ['${a}'];
      p.equipped.artifacts = ['${a}'];
      return window.__mm.sweep(12, ${JSON.stringify(defaultLoadout)});
    })()`);
    const solA = await evalCode(`(() => {
      const p = window.__mm.profile();
      p.owned.artifacts = ['${a}'];
      p.equipped.artifacts = ['${a}'];
      return window.__mm.solveStep(12, ${JSON.stringify(defaultLoadout)}, 20000);
    })()`);
    console.log(`Artifact ${a.padEnd(20)}: sweep 1-shot wins=${swA.oneShotWins}, bestScore=${swA.best.score} | solve shots=${solA.shots?.length}, won=${solA.view?.won}, score=${solA.view?.score}`);
  }

  // Level 10 test
  console.log('\n=== LEVEL 10 TESTS ===');
  const sw10 = await evalCode(`(() => {
    const p = window.__mm.profile();
    p.owned.artifacts = ['r_gale_eye'];
    p.equipped.artifacts = ['r_gale_eye'];
    return window.__mm.sweep(10, ${JSON.stringify(defaultLoadout)});
  })()`);
  const sol10 = await evalCode(`(() => {
    const p = window.__mm.profile();
    p.owned.artifacts = ['r_gale_eye'];
    p.equipped.artifacts = ['r_gale_eye'];
    return window.__mm.solveStep(10, ${JSON.stringify(defaultLoadout)}, 20000);
  })()`);
  console.log(`L10 (r_gale_eye): sweep bestScore=${sw10.best.score}, 1-shot wins=${sw10.oneShotWins} | solve shots=${sol10.shots?.length}, won=${sol10.view?.won}, score=${sol10.view?.score}`);

  ws.close();
  cleanup();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
