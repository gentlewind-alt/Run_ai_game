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
const TMP_PROFILE = path.join(os.tmpdir(), 'mm_chrome_profile_resp');
const SHOTS_DIR = path.resolve(repoRoot, 'docs/handoff/shots/resp');

if (!fs.existsSync(SHOTS_DIR)) {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: '320x568', width: 320, height: 568, mobile: true },
  { name: '375x812', width: 375, height: 812, mobile: true },
  { name: '412x915', width: 412, height: 915, mobile: true },
  { name: '768x1024', width: 768, height: 1024, mobile: true },
  { name: '1024x768', width: 1024, height: 768, mobile: false },
  { name: '1920x1080', width: 1920, height: 1080, mobile: false },
  { name: '2560x1080', width: 2560, height: 1080, mobile: false },
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
  console.log('=== STARTING RESPONSIVE SCREENSHOT CAPTURE ===\n');

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

    devProc.stdout?.on('data', (d) => {
      const s = d.toString();
      if (s.includes('Local:')) console.log('  Vite:', s.trim());
    });
    devProc.stderr?.on('data', (d) => {
      console.error('  Vite err:', d.toString().trim());
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
        targetWs = list[0].webSocketDebuggerUrl;
        break;
      }
    } catch (e) {
      try {
        const res = await fetch('http://localhost:9222/json');
        const list = await res.json();
        if (list && list.length > 0) {
          targetWs = list[0].webSocketDebuggerUrl;
          break;
        }
      } catch (e2) {}
    }
    await sleep(200);
  }

  let killed = false;
  const cleanup = () => {
    if (!killed) {
      killed = true;
      try { chrome.kill(); } catch (e) {}
      if (devProc) {
        try {
          if (process.platform === 'win32') {
            spawn('taskkill', ['/F', '/T', '/PID', String(devProc.pid)]);
          } else {
            devProc.kill('SIGTERM');
          }
        } catch (e) {}
      }
    }
  };
  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);

  if (!targetWs) {
    console.error('Could not connect to Chrome debugging port.');
    cleanup();
    process.exit(1);
  }

  console.log('Connecting to WebSocket:', targetWs);
  const ws = new WebSocket(targetWs);

  let idCounter = 1;
  const pending = new Map();
  let loadFired = false;

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Page.loadEventFired') {
      loadFired = true;
    }
    if (msg.id && pending.has(msg.id)) {
      console.log(`  [recv] id=${msg.id} err=${Boolean(msg.error)}`);
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
    console.log(`  [send] id=${id} method=${method}`);
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
    await sleep(500);
  };

  // Ensure unlocked profile
  await evalCode(`(() => {
    if (window.__mm) window.__mm.give({ unlockAll: true });
  })()`);

  for (const vp of VIEWPORTS) {
    console.log(`\n--- Capturing viewport ${vp.name} (${vp.width}x${vp.height}) ---`);
    await send('Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 1,
      mobile: vp.mobile,
    });
    await sleep(400);

    // 1. Title
    await goToScene('title');
    await sleep(400);
    await takeScreenshot(`${vp.name}_title`);

    // 2. Map
    await goToScene('map');
    await sleep(400);
    await takeScreenshot(`${vp.name}_map`);

    // 3. Loadout
    await goToScene('loadout', { level: 1 });
    await sleep(400);
    await takeScreenshot(`${vp.name}_loadout`);

    // 4. Battle
    await evalCode(`(() => {
      window.__mm.load(1, ['w_militia_blade', 'w_iron_cleaver', 'w_ashwood_staff', 'w_hunters_pike']);
    })()`);
    await sleep(500);
    await takeScreenshot(`${vp.name}_battle`);

    // 5. Results
    await evalCode(`(() => {
      const g = window.__game;
      for (const s of g.scene.getScenes(true)) if (s.scene.key !== 'boot') g.scene.stop(s.scene.key);
      g.scene.start('results', {
        levelId: 1,
        won: true,
        why: 'shots',
        stars: 3,
        score: 2150,
        target: 1200,
        loadout: ['w_militia_blade', 'w_iron_cleaver']
      });
    })()`);
    await sleep(500);
    await takeScreenshot(`${vp.name}_results`);
  }

  console.log('\n=== ALL RESPONSIVE SCREENSHOTS CAPTURED ===\n');
  ws.close();
  cleanup();
  process.exit(0);
}

run().catch((err) => {
  console.error('Fatal error capturing responsive screenshots:', err);
  process.exit(1);
});
