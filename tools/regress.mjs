#!/usr/bin/env node
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CHROME_PATH = process.env.CHROME_BIN ||
  (process.platform === 'win32'
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
      ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
      : 'google-chrome');

const TMP_PROFILE = path.join(os.tmpdir(), 'mm_chrome_regress');

const repoRoot = fs.existsSync(path.resolve('game')) ? path.resolve('.') : path.resolve('..');
const gameDir = path.join(repoRoot, 'game');
const bandsPath = path.join(gameDir, 'scripts/balance_bands.json');
if (!fs.existsSync(bandsPath)) {
  console.error(`Error: balance_bands.json not found at ${bandsPath}`);
  process.exit(1);
}
const balanceBands = JSON.parse(fs.readFileSync(bandsPath, 'utf8'));

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  console.log('=== STARTING MONSTER MASH REGRESSION SUITE ===\n');

  // 1. Ensure Vite dev server is running on port 5173
  let devProc = null;
  let serverReady = false;
  try {
    const res = await fetch('http://localhost:5173/?debug=1');
    if (res.ok) serverReady = true;
  } catch (e) {}

  if (!serverReady) {
    console.log('Starting Vite dev server on port 5173...');
    const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    devProc = spawn(npxCmd, ['vite', '--port', '5173'], {
      cwd: gameDir,
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
        await sleep(250);
      }
    }
    if (!serverReady) {
      console.error('Failed to start Vite dev server on port 5173.');
      process.exit(1);
    }
  }

  // 2. Launch headless Chrome
  console.log('Launching Headless Chrome on CDP port 9222...');
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--disable-extensions',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${TMP_PROFILE}`,
  ]);

  let killed = false;
  const cleanup = () => {
    if (!killed) {
      killed = true;
      if (chrome && chrome.pid) {
        try { spawn('taskkill', ['/F', '/T', '/PID', String(chrome.pid)]); } catch (e) {}
      }
      try { spawn('taskkill', ['/F', '/IM', 'chrome.exe']); } catch (e) {}
      try { chrome.kill(); } catch (e) {}
      if (devProc && devProc.pid) {
        try { spawn('taskkill', ['/F', '/T', '/PID', String(devProc.pid)]); } catch (e) {}
      }
    }
  };
  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);

  // Connect to Chrome debugging port
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
      await sleep(200);
    }
  }

  if (!targetWs) {
    console.error('Could not connect to Chrome debugging port 9222.');
    cleanup();
    process.exit(1);
  }

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

  await send('Page.enable');
  await send('Runtime.enable');

  loadFired = false;
  console.log('Navigating to http://localhost:5173/?debug=1 ...');
  await send('Page.navigate', { url: 'http://localhost:5173/?debug=1' });

  for (let i = 0; i < 60; i++) {
    if (loadFired) break;
    await sleep(100);
  }

  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      const r = await evalCode(
        `Boolean(window.__game && window.__mm && typeof window.__mm.platform === 'function' && typeof window.__mm.solveStep === 'function')`
      );
      if (r === true) {
        ready = true;
        break;
      }
      if (i % 8 === 0) {
        const diag = await evalCode(`JSON.stringify({ game: !!window.__game, mm: !!window.__mm, url: window.location.href, title: document.title })`).catch(e => e.message);
        console.log('Waiting for __mm hook... attempt', i, diag);
      }
    } catch (e) {
      if (i % 8 === 0) console.log('Waiting for __mm hook... eval error:', e.message);
    }
    await sleep(250);
  }

  if (!ready) {
    console.error('Test hook __mm failed to initialize.');
    cleanup();
    process.exit(1);
  }
  console.log('Game test hook ready.\n');

  const failures = [];

  // =========================================================================
  // 1. ASSERT 30-DAY DAILY CHECK (Variety & Determinism)
  // =========================================================================
  console.log('--- 1. ASSERTING 30-DAY DAILY GENERATION & VARIETY ---');
  try {
    const dailyResult = await evalCode(`(() => {
      const errors = [];
      const start = Date.UTC(2026, 9, 1, 12, 0, 0);
      const MS_PER_DAY = 24 * 60 * 60 * 1000;
      let prevArch = '';
      let prevMix = '';
      let prevName = '';

      for (let i = 0; i < 30; i++) {
        const t = start + i * MS_PER_DAY;
        const levelA = window.__mm.dailyLevel(t);
        const levelB = window.__mm.dailyLevel(t);

        if (JSON.stringify(levelA) !== JSON.stringify(levelB)) {
          errors.push(\`Day \${i} (\${levelA.name}): nondeterministic output\`);
        }

        const currArch = levelA._archetype || '';
        const currMix = levelA.monsters.map(m => m.t).sort().join(',');

        if (i > 0) {
          if (currArch && prevArch && currArch === prevArch) {
            errors.push(\`Day \${i} (\${levelA.name}): consecutive shared fort archetype "\${currArch}" with Day \${i - 1} (\${prevName})\`);
          }
          if (currMix && prevMix && currMix === prevMix) {
            errors.push(\`Day \${i} (\${levelA.name}): consecutive shared monster mix [\${currMix}] with Day \${i - 1} (\${prevName})\`);
          }
        }

        prevArch = currArch;
        prevMix = currMix;
        prevName = levelA.name;
      }

      return { errors, passed: errors.length === 0 };
    })()`);

    if (!dailyResult.passed) {
      dailyResult.errors.forEach((e) => {
        console.error('  ERROR:', e);
        failures.push(`Daily check: ${e}`);
      });
    } else {
      console.log('  ✓ 30 days daily check passed: 100% deterministic, 0 consecutive shared fort archetypes, 0 consecutive shared monster mixes.\n');
    }
  } catch (err) {
    console.error('  Daily check threw exception:', err);
    failures.push(`Daily check exception: ${err.message}`);
  }

  // =========================================================================
  // 2. ASSERT V1 SAVE MIGRATION
  // =========================================================================
  console.log('--- 2. ASSERTING V1 SAVE FIXTURE MIGRATION ---');
  try {
    const saveResult = await evalCode(`(async () => {
      const v1Fixture = {
        version: 1,
        coins: 350,
        owned: { weapons: ['w_militia_blade', 'w_iron_cleaver'], artifacts: ['r_gale_eye'], consumables: { c_mindflash: 2 } },
        upgrades: { w_militia_blade: 2 },
        stars: { '1': 3, '2': 2, '3': 3, '4': 1 },
        equipped: { loadout: ['w_militia_blade', 'w_iron_cleaver'], artifacts: ['r_gale_eye'] }
      };
      const sanitized = window.__mm.sanitizeSave(v1Fixture);
      await window.__mm.platform().storage.set('save', JSON.stringify(v1Fixture));
      const loadStatus = await window.__mm.loadSave();
      const prof = window.__mm.profile();
      return {
        loadStatus,
        coinsPreserved: prof.coins === 350 && sanitized.coins === 350,
        starsPreserved: prof.stars['1'] === 3 && prof.stars['2'] === 2 && prof.stars['3'] === 3 && prof.stars['4'] === 1,
        weaponsPreserved: prof.owned.weapons.length === 2 && prof.owned.weapons.includes('w_iron_cleaver'),
        hasDaily: typeof prof.daily?.streak === 'number',
        hasFlags: typeof prof.flags === 'object'
      };
    })()`);

    if (saveResult.loadStatus !== 'loaded' || !saveResult.coinsPreserved || !saveResult.starsPreserved || !saveResult.weaponsPreserved || !saveResult.hasDaily || !saveResult.hasFlags) {
      const msg = `Save migration failed: status=${saveResult.loadStatus}, coinsPreserved=${saveResult.coinsPreserved}, starsPreserved=${saveResult.starsPreserved}`;
      console.error('  ERROR:', msg);
      failures.push(msg);
    } else {
      console.log('  ✓ v1 save migration passed: 350 coins preserved, 1-4 stars preserved, all modern fields normalized.\n');
    }
  } catch (err) {
    console.error('  Save migration threw exception:', err);
    failures.push(`Save migration exception: ${err.message}`);
  }

  // =========================================================================
  // 3. ASSERT CAMPAIGN LEVELS 1-12 (Solver, Balance Bands, 0 One-Shot Wins)
  // =========================================================================
  console.log('--- 3. ASSERTING LEVELS 1-12 PLAYTHROUGH & BALANCE BANDS ---');
  const defaultLoadout = ['w_militia_blade', 'w_iron_cleaver', 'w_ashwood_staff', 'w_hunters_pike', 'w_scrapheap_scattergun'];
  const l12Loadout = ['w_iron_cleaver', 'w_horned_scepter', 'w_hunters_pike', 'w_ashwood_staff', 'w_blast_tube'];

  for (let lvl = 1; lvl <= 12; lvl++) {
    const band = balanceBands[String(lvl)] || balanceBands[lvl];
    if (!band) {
      failures.push(`Level ${lvl}: missing entry in balance_bands.json`);
      continue;
    }
    const loadout = lvl === 12 ? l12Loadout : defaultLoadout;

    try {
      // 3a. Sweep check: assert 0 one-shot wins
      const sweepRes = await evalCode(`(() => {
        return window.__mm.sweep(${lvl}, ${JSON.stringify(loadout)});
      })()`);

      if (sweepRes.oneShotWins !== 0) {
        const msg = `Level ${lvl}: has ${sweepRes.oneShotWins} one-shot win(s), expected 0!`;
        console.error(`  FAIL ${msg}`);
        failures.push(msg);
      }

      // 3b. Greedy solver check: assert win and shots within band
      let solveRes = null;
      let attempts = 0;
      while ((!solveRes || !solveRes.done) && attempts < 8) {
        attempts++;
        solveRes = await evalCode(`(() => {
          const r = window.__mm.solveStep(${lvl}, ${JSON.stringify(loadout)}, 15000);
          return {
            done: r.done,
            shotsCount: r.shots?.length || 0,
            won: r.view?.won || false,
            lost: r.view?.lost || false,
            monstersLeft: r.view?.monsters,
            score: r.view?.score || 0
          };
        })()`);
      }

      const shots = solveRes.shotsCount;
      const won = solveRes.won;
      const inBand = shots >= band.min && shots <= band.max;

      if (!won) {
        const msg = `Level ${lvl}: greedy solver failed to win (monsters left=${solveRes.monstersLeft})`;
        console.error(`  FAIL ${msg}`);
        failures.push(msg);
      } else if (!inBand) {
        const msg = `Level ${lvl}: shots ${shots} outside allowed band [${band.min}, ${band.max}]`;
        console.error(`  FAIL ${msg}`);
        failures.push(msg);
      } else {
        console.log(`  ✓ Level ${String(lvl).padStart(2, ' ')}: won in ${shots} shots (band [${band.min}, ${band.max}]), 0 one-shot wins, score=${solveRes.score}`);
      }
    } catch (err) {
      console.error(`  Level ${lvl} execution error:`, err);
      failures.push(`Level ${lvl} error: ${err.message}`);
    }
  }

  // =========================================================================
  // 4. ASSERT CONSOLE ERRORS & UNCAUGHT EXCEPTIONS
  // =========================================================================
  console.log('\n--- 4. ASSERTING CONSOLE LOG & EXCEPTION INTEGRITY ---');
  if (consoleErrors.length > 0) {
    consoleErrors.forEach((e) => {
      console.error('  Browser console error:', e);
      failures.push(`Console error: ${e}`);
    });
  }
  if (uncaughtExceptions.length > 0) {
    uncaughtExceptions.forEach((e) => {
      console.error('  Uncaught exception:', e);
      failures.push(`Uncaught exception: ${e}`);
    });
  }
  if (consoleErrors.length === 0 && uncaughtExceptions.length === 0) {
    console.log('  ✓ 0 console errors and 0 uncaught exceptions recorded across all tests.\n');
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  ws.close();
  cleanup();

  console.log('======================================================');
  if (failures.length > 0) {
    console.error(`REGRESSION SUITE FAILED WITH ${failures.length} FAILURE(S):`);
    failures.forEach((f) => console.error(`  - ${f}`));
    console.log('======================================================\n');
    process.exit(1);
  } else {
    console.log('ALL REGRESSION CHECKS PASSED CLEANLY (EXIT 0)');
    console.log('======================================================\n');
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('Regression suite fatal crash:', err);
  process.exit(1);
});
