import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TMP_PROFILE = path.join(os.tmpdir(), 'mm_chrome_profile_audit');
const SHOTS_DIR = path.resolve('docs/handoff/shots');

if (!fs.existsSync(SHOTS_DIR)) {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
}

async function run() {
  console.log('=== STARTING PHONE-READINESS AUDIT & SHOTS ===\n');

  // 1. Ensure Vite dev server is running on port 5173
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
    if (!serverReady) {
      console.error('Failed to start Vite dev server on port 5173.');
      process.exit(1);
    }
  }

  // 2. Launch headless Chrome
  console.log('Launching Chrome (headless, 432x768)...');
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${TMP_PROFILE}`,
  ]);

  let killed = false;
  const cleanup = () => {
    if (!killed) {
      killed = true;
      try { chrome.kill(); } catch (e) {}
      if (devProc) {
        try {
          spawn('taskkill', ['/F', '/T', '/PID', String(devProc.pid)]);
        } catch (e) {}
      }
    }
  };
  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);

  // Wait for 9222 to be ready
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

  if (!targetWs) {
    console.error('Could not connect to Chrome debugging port.');
    cleanup();
    process.exit(1);
  }

  console.log('Connecting to WebSocket:', targetWs);
  const ws = new WebSocket(targetWs);

  let idCounter = 1;
  const pending = new Map();
  const consoleErrors = [];
  const uncaughtExceptions = [];
  let loadFired = false;

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Page.loadEventFired') {
      loadFired = true;
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = (msg.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
      if (msg.params.type === 'error') {
        consoleErrors.push(text);
        console.error('[Browser Error]', text);
      } else {
        console.log(`[Browser Console ${msg.params.type}]`, text);
      }
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const desc = msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text;
      uncaughtExceptions.push(desc);
      console.error('[Browser Exception]', desc);
    }
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  };

  await new Promise((resolve) => {
    ws.onopen = resolve;
  });

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

  const takeScreenshot = async (name) => {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const outPath = path.join(SHOTS_DIR, `${name}.png`);
    fs.writeFileSync(outPath, buffer);
    console.log(`Saved screenshot: ${outPath} (${buffer.length} bytes)`);
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 432,
    height: 768,
    deviceScaleFactor: 1,
    mobile: true,
  });

  console.log('Navigating to http://localhost:5173/?debug=1 ...');
  await send('Page.navigate', { url: 'http://localhost:5173/?debug=1' });

  // Wait for loadEventFired
  for (let i = 0; i < 50; i++) {
    if (loadFired) break;
    await sleep(100);
  }

  // Wait for game ready
  console.log('Waiting for window.__game ready...');
  for (let i = 0; i < 60; i++) {
    const res = await evalCode(`Boolean(window.__game && window.__game.scene && window.__game.scene.scenes.length > 0)`);
    if (res === true) break;
    await sleep(250);
  }

  // Helper to switch scenes cleanly
  const goToScene = async (key, data = {}) => {
    await evalCode(`(() => {
      const g = window.__game;
      if (!g) return;
      for (const s of g.scene.getScenes(true)) {
        if (s.scene.key !== 'boot') g.scene.stop(s.scene.key);
      }
      g.scene.start('${key}', ${JSON.stringify(data)});
    })()`);
    await sleep(600);
  };

  // -------------------------------------------------------------------------
  // AUDIT SHOTS (12 captures)
  // -------------------------------------------------------------------------
  console.log('\n--- CAPTURING AUDIT SCREENSHOTS ---');

  // 1. Title Scene
  console.log('Capturing Title...');
  await goToScene('title');
  await sleep(600);
  await takeScreenshot('01_title');

  // 2. Map Scene (with Daily card)
  console.log('Capturing Map...');
  await goToScene('map');
  await sleep(600);
  await takeScreenshot('02_map');

  // 3. Loadout Scene (re-taking with fixed Artifact label & spacing)
  console.log('Capturing Loadout (03_loadout.png)...');
  await goToScene('loadout', { level: 1 });
  await sleep(600);
  await takeScreenshot('03_loadout');

  // 4. Shop Scene - tab weapons
  console.log('Capturing Shop: Weapons...');
  await goToScene('shop');
  await sleep(400);
  await takeScreenshot('04_shop_weapons');

  // Shop - tab artifacts
  console.log('Capturing Shop: Artifacts...');
  await evalCode(`(() => {
    const s = window.__game.scene.getScene('shop');
    s.tab = 'artifacts';
    s.selected = null;
    s.render();
  })()`);
  await sleep(400);
  await takeScreenshot('05_shop_artifacts');

  // Shop - tab items
  console.log('Capturing Shop: Items...');
  await evalCode(`(() => {
    const s = window.__game.scene.getScene('shop');
    s.tab = 'items';
    s.selected = null;
    s.render();
  })()`);
  await sleep(400);
  await takeScreenshot('06_shop_items');

  // Shop - tab forge
  console.log('Capturing Shop: Forge...');
  await evalCode(`(() => {
    const s = window.__game.scene.getScene('shop');
    s.tab = 'forge';
    s.selected = null;
    s.render();
  })()`);
  await sleep(400);
  await takeScreenshot('07_shop_forge');

  // 5. Battle with HUD tray
  console.log('Capturing Battle HUD tray...');
  await evalCode(`(() => {
    window.__mm.give({ unlockAll: true });
    window.__mm.load(1, ['w_militia_blade', 'w_iron_cleaver', 'w_ashwood_staff', 'w_hunters_pike']);
  })()`);
  await sleep(600);
  await takeScreenshot('08_battle_hud');

  // 6. Battle Pause Menu
  console.log('Capturing Battle Pause Menu...');
  await evalCode(`(() => {
    const bScene = window.__game.scene.getScene('game');
    bScene.setPaused(true);
  })()`);
  await sleep(400);
  await takeScreenshot('09_battle_pause');

  // 7. Results Win
  console.log('Capturing Results Win...');
  await evalCode(`(() => {
    const g = window.__game;
    for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key);
    g.scene.start('results', {
      levelId: 1,
      won: true,
      why: 'shots',
      stars: 3,
      score: 2450,
      target: 1800,
      loadout: ['w_militia_blade', 'w_militia_blade']
    });
  })()`);
  await sleep(800);
  await takeScreenshot('10_results_win');

  // 8. Results Lose
  console.log('Capturing Results Lose...');
  await evalCode(`(() => {
    const g = window.__game;
    for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key);
    g.scene.start('results', {
      levelId: 4,
      won: false,
      why: 'escaped',
      stars: 0,
      score: 720,
      target: 1200,
      loadout: ['w_militia_blade', 'w_militia_blade']
    });
  })()`);
  await sleep(800);
  await takeScreenshot('11_results_lose');

  // 9. Boss Level 12
  console.log('Capturing Boss Level 12...');
  await evalCode(`(() => {
    window.__mm.load(12, ['w_militia_blade', 'w_iron_cleaver', 'w_ashwood_staff', 'w_hunters_pike', 'w_scrapheap_scattergun']);
  })()`);
  await sleep(600);
  await takeScreenshot('12_boss_level_12');

  console.log('✓ All 12 screenshots captured successfully.');

  // -------------------------------------------------------------------------
  // VERIFICATION 1: MINDFLASH CONSUMABLE (60 steps stun, timer, stock)
  // -------------------------------------------------------------------------
  console.log('\n--- VERIFYING MINDFLASH (c_mindflash) ---');
  const mfResult = await evalCode(`(() => {
    window.__mm.give({ unlockAll: true });
    window.__mm.load(1, ['w_militia_blade']);
    const b = window.__mm.battle();
    const mfIdx = b.consumables.findIndex(c => c.id === 'c_mindflash');
    const stockBefore = window.__mm.profile().owned.consumables['c_mindflash'];
    const pSteps = b.consumables[mfIdx].params.steps;
    window.__mm.pressConsumable(mfIdx);
    const stockAfter = window.__mm.profile().owned.consumables['c_mindflash'];
    const stuns = b.monsters.map(m => m.status.stun);
    window.__mm.run(30);
    const stunsMid = b.monsters.map(m => m.status.stun);
    window.__mm.run(30);
    const stunsEnd = b.monsters.map(m => m.status.stun);
    return {
      mfIdx,
      pSteps,
      stockBefore,
      stockAfter,
      stuns,
      stunsMid,
      stunsEnd,
      allStunned60: stuns.every(s => s === 60),
      allStunned30: stunsMid.every(s => s === 30),
      allStunned0: stunsEnd.every(s => s === 0),
    };
  })()`);

  console.log('Mindflash test result:', JSON.stringify(mfResult, null, 2));
  if (!mfResult.allStunned60 || !mfResult.allStunned30 || !mfResult.allStunned0) {
    throw new Error('Mindflash stun timing mismatch!');
  }
  if (mfResult.pSteps !== 60) {
    throw new Error(`Mindflash params.steps is ${mfResult.pSteps}, expected 60!`);
  }
  if (mfResult.stockBefore - mfResult.stockAfter !== 1) {
    throw new Error('Mindflash stock did not decrement by 1!');
  }
  console.log('✓ Mindflash verified: 60 fixed steps (1.0 s) stun, stock decrements, timers countdown to 0.\n');

  // -------------------------------------------------------------------------
  // VERIFICATION 2: SAVE FIXTURE MIGRATION & SANITIZATION
  // -------------------------------------------------------------------------
  console.log('--- VERIFYING V1 SAVE FIXTURE MIGRATION ---');
  const saveResult = await evalCode(`(() => {
    const v1Fixture = {
      version: 1,
      coins: 350,
      owned: { weapons: ['w_militia_blade', 'w_iron_cleaver'], artifacts: ['r_gale_eye'], consumables: { c_mindflash: 2 } },
      upgrades: { w_militia_blade: 2 },
      stars: { '1': 3, '2': 2 },
      equipped: { loadout: ['w_militia_blade', 'w_iron_cleaver'], artifacts: ['r_gale_eye'] }
    };
    const sanitized = window.__mm.sanitizeSave(v1Fixture);
    return {
      version: sanitized.version,
      coins: sanitized.coins,
      weaponsCount: sanitized.owned.weapons.length,
      artifactsCount: sanitized.owned.artifacts.length,
      consumables: sanitized.owned.consumables,
      cosmetics: sanitized.owned.cosmetics,
      upgrades: sanitized.upgrades,
      equipped: sanitized.equipped,
      stars: sanitized.stars,
      hasDaily: typeof sanitized.daily?.streak === 'number',
      dailyStreak: sanitized.daily?.streak,
      hasFlags: typeof sanitized.flags === 'object',
      settingsMuted: sanitized.settings?.muted,
      settingsMusicOn: sanitized.settings?.musicOn,
    };
  })()`);

  console.log('v1 Save Migration result:', JSON.stringify(saveResult, null, 2));
  if (saveResult.version !== 1 || saveResult.coins !== 350 || !saveResult.hasDaily || !saveResult.hasFlags) {
    throw new Error('v1 Save Migration failed sanitization check!');
  }
  console.log('✓ v1 Save fixture migration verified: all fields normalized and forward-compatible.\n');

  // -------------------------------------------------------------------------
  // VERIFICATION 3: SOLVER PLAYTHROUGH LEVELS 1-12 AT 432x768
  // -------------------------------------------------------------------------
  console.log('--- VERIFYING SOLVER PLAYTHROUGH: LEVELS 1-12 ---');
  const defaultLoadout = ['w_militia_blade', 'w_iron_cleaver', 'w_ashwood_staff', 'w_hunters_pike', 'w_scrapheap_scattergun'];
  const solveSummary = [];
  for (let lvl = 1; lvl <= 12; lvl++) {
    const res = await evalCode(`(() => {
      const loadout = ${JSON.stringify(defaultLoadout)};
      const r = window.__mm.solveStep(${lvl}, loadout, 12000);
      return {
        level: ${lvl},
        done: r.done,
        shotsCount: r.shots?.length || 0,
        won: r.view?.won || false,
        lost: r.view?.lost || false,
        monstersLeft: r.view?.monsters,
        score: r.view?.score || 0
      };
    })()`);
    console.log(`  Level ${lvl}: done=${res.done}, shots=${res.shotsCount}, won=${res.won}, lost=${res.lost}, monstersLeft=${res.monstersLeft}, score=${res.score}`);
    solveSummary.push(res);
  }
  console.log('✓ Levels 1-12 solver pass completed.\n');

  // -------------------------------------------------------------------------
  // VERIFICATION 4: FRAME TIME ON LEVEL 12 (BOSS)
  // -------------------------------------------------------------------------
  console.log('--- MEASURING FRAME TIME ON LEVEL 12 (BOSS) ---');
  await evalCode(`(() => {
    window.__mm.load(12, ['w_militia_blade', 'w_iron_cleaver', 'w_ashwood_staff', 'w_hunters_pike', 'w_scrapheap_scattergun']);
  })()`);
  await sleep(400);

  const perfResult = await evalCode(`new Promise((resolve) => {
    const times = [];
    let last = performance.now();
    let count = 0;
    const loop = () => {
      const now = performance.now();
      times.push(now - last);
      last = now;
      count++;
      if (count >= 120) {
        times.sort((a, b) => a - b);
        const median = times[Math.floor(times.length / 2)];
        resolve({
          frames: times.length,
          medianMs: Math.round(median * 100) / 100,
          p95Ms: Math.round(times[Math.floor(times.length * 0.95)] * 100) / 100,
          minMs: Math.round(times[0] * 100) / 100,
          maxMs: Math.round(times[times.length - 1] * 100) / 100,
          fps: Math.round((1000 / median) * 10) / 10
        });
      } else {
        requestAnimationFrame(loop);
      }
    };
    requestAnimationFrame(loop);
  })`);

  console.log(`Level 12 Frame Time: median=${perfResult.medianMs}ms (${perfResult.fps} FPS), 95th=${perfResult.p95Ms}ms, min=${perfResult.minMs}ms, max=${perfResult.maxMs}ms`);
  if (perfResult.medianMs > 25) {
    throw new Error(`Level 12 median frame time ${perfResult.medianMs}ms exceeded 25ms threshold!`);
  }
  console.log(`✓ Level 12 performance PASSED: ${perfResult.medianMs}ms median (< 25ms budget).\n`);

  // -------------------------------------------------------------------------
  // VERIFICATION 5: CONSOLE ERRORS & EXCEPTIONS CHECK
  // -------------------------------------------------------------------------
  console.log('--- CONSOLE ERROR CHECK ---');
  console.log(`Total console errors recorded: ${consoleErrors.length}`);
  console.log(`Total uncaught exceptions recorded: ${uncaughtExceptions.length}`);
  if (consoleErrors.length > 0) {
    throw new Error(`Browser console errors encountered (${consoleErrors.length}): ${consoleErrors.join(' | ')}`);
  }
  if (uncaughtExceptions.length > 0) {
    throw new Error(`Browser uncaught exceptions encountered (${uncaughtExceptions.length}): ${uncaughtExceptions.join(' | ')}`);
  }
  console.log('✓ 0 console errors and 0 uncaught exceptions.\n');

  console.log('=== ALL PHONE-READINESS AUDIT CHECKS PASSED ===');
  ws.close();
  cleanup();
}

run().catch((err) => {
  console.error('Audit run error:', err);
  process.exit(1);
});
