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
const TMP_PROFILE = path.join(os.tmpdir(), 'mm_chrome_profile_relics');
const SHOTS_DIR = path.resolve(repoRoot, 'docs/handoff/shots/relics');

if (!fs.existsSync(SHOTS_DIR)) {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
}

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
  console.log('=== STARTING RELIC SCREENSHOT CAPTURE ===\n');

  let devProc = null;
  let serverUrl = await checkServer();

  if (!serverUrl) {
    console.log('Launching Vite dev server on port 5173...');
    const isWin = process.platform === 'win32';
    const cmd = isWin ? 'cmd.exe' : 'npx';
    const args = isWin ? ['/c', 'npx', 'vite', '--port', '5173', '--host', '127.0.0.1'] : ['vite', '--port', '5173'];
    devProc = spawn(cmd, args, { cwd: gameDir, stdio: 'pipe' });
    for (let i = 0; i < 60; i++) {
      serverUrl = await checkServer();
      if (serverUrl) break;
      await sleep(250);
    }
  }

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
    console.error('Could not connect to Chrome debugging port 9222.');
    cleanup();
    process.exit(1);
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
    const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (res.exceptionDetails) throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`);
    return res.result?.value;
  };

  await send('Page.enable');
  await send('Runtime.enable');

  await send('Page.navigate', { url: serverUrl });
  for (let i = 0; i < 50; i++) {
    if (loadFired) break;
    await sleep(100);
  }

  for (let i = 0; i < 60; i++) {
    const res = await evalCode(`Boolean(window.__game && window.__mm)`);
    if (res === true) break;
    await sleep(250);
  }

  // Standard mobile portrait viewport
  await send('Emulation.setDeviceMetricsOverride', {
    width: 432,
    height: 768,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await sleep(400);

  const takeScreenshot = async (name) => {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const outPath = path.join(SHOTS_DIR, `${name}.png`);
    fs.writeFileSync(outPath, buffer);
    console.log(`  ✓ Saved screenshot: ${name}.png (${buffer.length} bytes)`);
  };

  // 1. Loadout with Rare + Legendary
  console.log('1. Capturing Loadout with Rare + Legendary...');
  await evalCode(`(() => {
    const mm = window.__mm;
    const prof = mm.profile();
    prof.owned.weapons = ['w_militia_blade', 'w_iron_cleaver', 'w_steersong_arrow', 'w_comet_fists'];
    prof.equipped.loadout = ['w_militia_blade', 'w_steersong_arrow', 'w_comet_fists'];
    const g = window.__game;
    for (const s of g.scene.getScenes(true)) if (s.scene.key !== 'boot') g.scene.stop(s.scene.key);
    g.scene.start('loadout', { level: 4 });
  })()`);
  await sleep(600);
  await takeScreenshot('01_loadout_rare_legendary');

  // 2. Shop Relic Market locked
  console.log('2. Capturing Shop Relic Market (locked)...');
  await evalCode(`(() => {
    const mm = window.__mm;
    const prof = mm.profile();
    prof.stats.bossLosses = { '4': 1, '8': 0, '12': 0 };
    prof.coins = 500;
    prof.owned.weapons = ['w_militia_blade'];
    const g = window.__game;
    for (const s of g.scene.getScenes(true)) if (s.scene.key !== 'boot') g.scene.stop(s.scene.key);
    g.scene.start('shop');
  })()`);
  await sleep(400);
  await evalCode(`(() => {
    const shop = window.__game.scene.getScene('shop');
    shop.tab = 'relics';
    shop.selected = null;
    shop.render();
  })()`);
  await sleep(400);
  await takeScreenshot('02_shop_relic_market_locked');

  // 3. Shop Relic Market unlocked
  console.log('3. Capturing Shop Relic Market (unlocked pity)...');
  await evalCode(`(() => {
    const mm = window.__mm;
    const prof = mm.profile();
    prof.stats.bossLosses = { '4': 3, '8': 1, '12': 0 };
    prof.coins = 2000;
    prof.owned.weapons = ['w_militia_blade'];
    const shop = window.__game.scene.getScene('shop');
    shop.tab = 'relics';
    shop.selected = null;
    shop.render();
  })()`);
  await sleep(400);
  await takeScreenshot('03_shop_relic_market_unlocked');

  // 4. L4 Goblin Chief boss HUD
  console.log('4. Capturing L4 Goblin Chief boss HUD...');
  await evalCode(`(() => {
    window.__mm.load(4, ['w_militia_blade', 'w_iron_cleaver']);
  })()`);
  await sleep(800);
  await takeScreenshot('04_l4_boss_hud');

  // 5. L8 Dark Elf Matron boss HUD
  console.log('5. Capturing L8 Dark Elf Matron boss HUD...');
  await evalCode(`(() => {
    window.__mm.load(8, ['w_militia_blade', 'w_iron_cleaver']);
  })()`);
  await sleep(800);
  await takeScreenshot('05_l8_boss_hud');

  // 6. Chest break in L3
  console.log('6. Capturing Chest break...');
  await evalCode(`(() => {
    window.__mm.load(3, ['w_militia_blade']);
    const b = window.__mm.battle();
    const chest = b.ents.find(e => e.kind === 'chest');
    if (chest) {
      b.ctx.damage(chest, 9999, chest.body.position.x, chest.body.position.y, { strong: true, tag: 'norm' });
    }
  })()`);
  await sleep(150);
  await takeScreenshot('06_chest_break');

  // 7. Results Scene Relic Found Toast
  console.log('7. Capturing Relic Found Toast...');
  await evalCode(`(() => {
    const g = window.__game;
    for (const s of g.scene.getScenes(true)) if (s.scene.key !== 'boot') g.scene.stop(s.scene.key);
    g.scene.start('results', {
      levelId: 4,
      won: true,
      why: 'all_monsters_killed',
      stars: 3,
      score: 2200,
      target: 1200,
      loadout: ['w_militia_blade', 'w_comet_fists'],
      relicUnlocked: 'w_comet_fists'
    });
  })()`);
  await sleep(600);
  await takeScreenshot('07_relic_found_toast');

  console.log('\nAll 7 relic screenshots captured successfully!');
  cleanup();
  process.exit(0);
}

run().catch((err) => {
  console.error('Fatal error during screenshot capture:', err);
  process.exit(1);
});
