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
  console.log('Launching Chrome...');
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${TMP_PROFILE}`
  ]);

  let killed = false;
  const cleanup = () => {
    if (!killed) {
      killed = true;
      try { chrome.kill(); } catch (e) {}
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
      await new Promise(r => setTimeout(r, 200));
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
  let loadFired = false;

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Page.loadEventFired') {
      loadFired = true;
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = (msg.params.args || []).map(a => a.value ?? a.description ?? '').join(' ');
      console.log(`[Browser Console ${msg.params.type}]`, text);
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
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      return { error: res.exceptionDetails };
    }
    return { value: res.result?.value };
  };

  const takeScreenshot = async (name) => {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const outPath = path.join(SHOTS_DIR, `${name}.png`);
    fs.writeFileSync(outPath, buffer);
    console.log(`Saved screenshot: ${outPath} (${buffer.length} bytes)`);
  };

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 432,
    height: 768,
    deviceScaleFactor: 1,
    mobile: true
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
    if (res?.value === true) break;
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

  // 3. Loadout Scene
  console.log('Capturing Loadout...');
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

  console.log('All screenshots captured successfully!');
  ws.close();
  cleanup();
}

run().catch((err) => {
  console.error('Audit run error:', err);
  process.exit(1);
});
