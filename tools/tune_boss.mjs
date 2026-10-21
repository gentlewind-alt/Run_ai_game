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
      const pageTarget = list.find((t) => t.type === 'page') || list[0];
      if (pageTarget && pageTarget.webSocketDebuggerUrl) {
        targetWs = pageTarget.webSocketDebuggerUrl;
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
      const res = await evalCode(`Boolean(window.__game && window.__mm && typeof window.__mm.load === 'function' && typeof window.__mm.solveStep === 'function')`);
      if (res === true) {
        ready = true;
        break;
      }
    } catch (e) {}
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!ready) throw new Error('__mm not ready');

  console.log('Game ready with __mm.');

  console.log('\n=== TESTING HP & ARMOUR COMBINATIONS ON L12 ===');
  const l12Loadout = ['w_iron_cleaver', 'w_horned_scepter', 'w_hunters_pike', 'w_ashwood_staff', 'w_blast_tube'];
  const testArtifacts = ['none', 'r_gale_eye', 'r_echo_stone', 'r_lodestone_bracer', 'r_analyst_lens', 'r_stormcaller_torc'];

  const candidates = [
    { hp: 760, armour: 14, maxHit: 304 },
    { hp: 800, armour: 14, maxHit: 320 },
    { hp: 820, armour: 14, maxHit: 328 },
    { hp: 850, armour: 14, maxHit: 340 },
  ];

  for (const c of candidates) {
    console.log(`\n--- Candidate: HP ${c.hp}, Armour ${c.armour}, maxHit ${c.maxHit} ---`);
    let pass = true;
    for (const art of testArtifacts) {
      const res = await evalCode(`(async () => {
        window.__mm.load(12, ${JSON.stringify(l12Loadout)});
        const b = window.__mm.battle();
        const bDef = b.content.monsters.find(m => m.id === 'iron_warlord');
        bDef.hp = ${c.hp};
        bDef.params.armour = ${c.armour};
        bDef.params.maxHitDamage = ${c.maxHit};
        bDef.params.initialDelay = 180;
        bDef.params.visorOpenDuration = 24;

        const p = window.__mm.profile();
        if ('${art}' === 'none') {
          p.owned.artifacts = [];
          p.equipped.artifacts = [];
        } else {
          p.owned.artifacts = ['${art}'];
          p.equipped.artifacts = ['${art}'];
        }
        p.upgrades = {};

        const sw = window.__mm.sweep(12, ${JSON.stringify(l12Loadout)});
        const sol = window.__mm.solveStep(12, ${JSON.stringify(l12Loadout)}, 15000);
        return {
          shots: sol.shots?.length,
          won: sol.view?.won,
          score: sol.view?.score,
          sweepScore: sw.best.score,
          oneShotWins: sw.oneShotWins
        };
      })()`);
      console.log(`  Art: ${art.padEnd(20)} -> shots: ${res.shots}, won: ${res.won}, 1shotWins: ${res.oneShotWins}, score: ${res.score}`);
      if (!res.won || res.shots < 3 || res.shots > 4 || res.oneShotWins !== 0) {
        pass = false;
        break;
      }
    }
    if (pass) {
      console.log(`\n >>>>>> PERFECT CANDIDATE FOUND! HP ${c.hp}, Armour ${c.armour}, maxHit ${c.maxHit} passes all artifacts in 3-4 shots with 0 1-shot wins! <<<<<<\n`);
      break;
    }
  }

  ws.close();
  cleanup();
}

main().catch(console.error);
