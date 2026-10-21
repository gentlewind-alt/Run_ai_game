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

const repoRoot = fs.existsSync(path.resolve('game')) ? path.resolve('.') : path.resolve('..');
const gameDir = path.join(repoRoot, 'game');
const TMP_PROFILE = path.join(os.tmpdir(), 'mm_chrome_profile_land');
const SHOTS_DIR = path.resolve(repoRoot, 'docs/handoff/shots/land');

if (!fs.existsSync(SHOTS_DIR)) {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: '568x320', width: 568, height: 320, mobile: true },
  { name: '667x375', width: 667, height: 375, mobile: true },
  { name: '812x375', width: 812, height: 375, mobile: true },
  { name: '915x412', width: 915, height: 412, mobile: true },
  { name: '1024x768', width: 1024, height: 768, mobile: false },
  { name: '1180x820', width: 1180, height: 820, mobile: false },
  { name: '1920x1080', width: 1920, height: 1080, mobile: false },
  { name: '2560x1080', width: 2560, height: 1080, mobile: false },
  { name: 'portrait_375x812', width: 375, height: 812, mobile: true, isPortrait: true },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function checkServer() {
  try {
    const res = await fetch('http://127.0.0.1:5173/?debug=1');
    if (res.ok) return 'http://127.0.0.1:5173/?debug=1';
  } catch (e) {}
  try {
    const res = await fetch('http://localhost:5173/?debug=1');
    if (res.ok) return 'http://localhost:5173/?debug=1';
  } catch (e) {}
  return null;
}

async function run() {
  console.log('=== STARTING LANDSCAPE RESPONSIVE SCREENSHOT CAPTURE ===\n');

  // 1. Ensure Vite dev server is running on port 5173
  let devProc = null;
  let serverUrl = await checkServer();

  if (!serverUrl) {
    console.log('Launching Vite dev server on port 5173...');
    const isWin = process.platform === 'win32';
    const cmd = isWin ? 'cmd.exe' : 'npx';
    const args = isWin ? ['/c', 'npx', 'vite', '--port', '5173', '--host', '127.0.0.1'] : ['vite', '--port', '5173'];
    devProc = spawn(cmd, args, {
      cwd: gameDir,
      stdio: 'pipe',
    });

    for (let i = 0; i < 60; i++) {
      serverUrl = await checkServer();
      if (serverUrl) break;
      await sleep(250);
    }

    if (!serverUrl) {
      console.error('Failed to start Vite dev server on port 5173.');
      process.exit(1);
    }
  }

  console.log(`Vite server ready at ${serverUrl}`);

  // 2. Launch headless Chrome
  console.log('Launching Chrome (headless)...');
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${TMP_PROFILE}`,
  ]);

  let targetWs = null;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9222/json');
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
    console.error('Failed to connect to Chrome on CDP 9222.');
    try { chrome.kill(); } catch (e) {}
    process.exit(1);
  }

  const ws = new WebSocket(targetWs);
  let idCounter = 1;
  const pending = new Map();
  let loadFired = false;

  const cleanup = () => {
    try { spawn('taskkill', ['/F', '/T', '/PID', String(chrome.pid)]); } catch (e) {}
    try { spawn('taskkill', ['/F', '/IM', 'chrome.exe']); } catch (e) {}
  };
  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Page.loadEventFired') {
      loadFired = true;
    }
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

  console.log(`Navigating to ${serverUrl} ...`);
  await send('Page.navigate', { url: serverUrl });

  for (let i = 0; i < 50; i++) {
    if (loadFired) break;
    await sleep(100);
  }

  console.log('Waiting for window.__game ready...');
  for (let i = 0; i < 60; i++) {
    const res = await evalCode(`Boolean(window.__game && window.__game.scene && window.__game.scene.scenes.length > 0)`);
    if (res === true) break;
    await sleep(250);
  }

  const takeScreenshot = async (name) => {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const outPath = path.join(SHOTS_DIR, `${name}.png`);
    fs.writeFileSync(outPath, buffer);
    console.log(`  Saved screenshot: ${name}.png (${buffer.length} bytes)`);
  };

  const goToScene = async (key, data = {}) => {
    await evalCode(`(() => {
      const g = window.__game;
      if (!g) return;
      for (const s of g.scene.getScenes(true)) {
        if (s.scene.key !== 'boot') g.scene.stop(s.scene.key);
      }
      g.scene.start('${key}', ${JSON.stringify(data)});
    })()`);
    await sleep(400);
  };

  // Ensure unlocked profile
  await evalCode(`(() => {
    if (window.__mm) window.__mm.give({ unlockAll: true });
  })()`);

  // Detailed captures on 812x375 (representative landscape phone)
  console.log('\n--- Capturing detailed scene suite at 812x375 landscape ---');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 812,
    height: 375,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await sleep(400);

  // 1. Title
  await goToScene('title');
  await sleep(400);
  await takeScreenshot('01_title');

  // 2. Map
  await goToScene('map');
  await sleep(400);
  await takeScreenshot('02_map');

  // 3. Loadout
  await goToScene('loadout', { level: 1 });
  await sleep(400);
  await takeScreenshot('03_loadout');

  // 4. Shop tabs
  for (const tab of ['weapons', 'relics', 'artifacts', 'items', 'forge', 'skins']) {
    await goToScene('shop');
    await evalCode(`(() => {
      const s = window.__game.scene.getScene('shop');
      if (s) { s.tab = '${tab}'; s.render(); }
    })()`);
    await sleep(350);
    await takeScreenshot(`04_shop_${tab}`);
  }

  // 5. Battle: Level 1 (Hills)
  await evalCode(`(() => {
    window.__mm.load(1, ['w_militia_blade', 'w_iron_cleaver', 'w_ashwood_staff', 'w_hunters_pike']);
  })()`);
  await sleep(500);
  await takeScreenshot('05_battle_l1_hills');

  // 6. Battle: Level 5 (Wood)
  await evalCode(`(() => {
    window.__mm.load(5, ['w_militia_blade', 'w_scrapheap_scattergun', 'w_hunters_pike', 'w_blast_tube']);
  })()`);
  await sleep(500);
  await takeScreenshot('06_battle_l5_wood');

  // 7. Battle: Level 12 Boss (Iron Keep)
  await evalCode(`(() => {
    window.__mm.load(12, ['w_militia_blade', 'w_iron_cleaver', 'w_ashwood_staff', 'w_hunters_pike']);
  })()`);
  await sleep(500);
  await takeScreenshot('07_battle_l12_boss');

  // 8. Battle: Daily
  await evalCode(`(() => {
    window.__mm.load(0);
  })()`);
  await sleep(500);
  await takeScreenshot('08_battle_daily');

  // 9. Pause Overlay
  await evalCode(`(() => {
    const s = window.__game.scene.getScene('game');
    if (s) s.setPaused(true);
  })()`);
  await sleep(400);
  await takeScreenshot('09_pause_overlay');

  // 10. Results Win
  await evalCode(`(() => {
    const g = window.__game;
    for (const s of g.scene.getScenes(true)) if (s.scene.key !== 'boot') g.scene.stop(s.scene.key);
    g.scene.start('results', {
      levelId: 1, won: true, why: 'shots', stars: 3, score: 2450, target: 1200, loadout: ['w_militia_blade', 'w_iron_cleaver']
    });
  })()`);
  await sleep(500);
  await takeScreenshot('10_results_win');

  // 11. Results Lose
  await evalCode(`(() => {
    const g = window.__game;
    for (const s of g.scene.getScenes(true)) if (s.scene.key !== 'boot') g.scene.stop(s.scene.key);
    g.scene.start('results', {
      levelId: 1, won: false, why: 'shots', stars: 0, score: 620, target: 1200, loadout: ['w_militia_blade', 'w_iron_cleaver']
    });
  })()`);
  await sleep(500);
  await takeScreenshot('11_results_lose');

  // 12. Credits
  await goToScene('credits');
  await sleep(400);
  await takeScreenshot('12_credits');

  // Matrix captures for all responsive viewports
  console.log('\n--- Capturing viewport matrix across phone, tablet, desktop, and portrait ---');
  for (const vp of VIEWPORTS) {
    console.log(`\nViewport: ${vp.name} (${vp.width}x${vp.height})`);
    await send('Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 1,
      mobile: vp.mobile,
    });
    await sleep(350);

    if (vp.isPortrait) {
      // Assert and capture portrait rotate overlay
      await takeScreenshot(`vp_${vp.name}_rotate_overlay`);
    } else {
      await goToScene('title');
      await sleep(300);
      await takeScreenshot(`vp_${vp.name}_title`);

      await evalCode(`(() => {
        window.__mm.load(1, ['w_militia_blade', 'w_iron_cleaver', 'w_ashwood_staff', 'w_hunters_pike']);
      })()`);
      await sleep(400);
      await takeScreenshot(`vp_${vp.name}_battle`);
    }
  }

  console.log('\n=== ALL SCREENSHOTS CAPTURED INTO docs/handoff/shots/land/ ===\n');
  ws.close();
  cleanup();
  process.exit(0);
}

run().catch((err) => {
  console.error('Fatal error capturing screenshots:', err);
  process.exit(1);
});
