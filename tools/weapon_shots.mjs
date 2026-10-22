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
const TMP_PROFILE = path.join(os.tmpdir(), 'mm_chrome_profile_weapons');
const WEAPONS_DIR = path.resolve(repoRoot, 'docs/handoff/shots/weapons');
const ART_DIR = path.resolve(repoRoot, 'docs/handoff/shots/art');

for (const d of [WEAPONS_DIR, ART_DIR]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
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
  console.log('=== STARTING RELIC WEAPONS, ART & SLINGSHOTS SCREENSHOT CAPTURE ===\n');

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

  await send('Emulation.setDeviceMetricsOverride', {
    width: 480,
    height: 270,
    deviceScaleFactor: 2,
    mobile: false,
  });
  await sleep(400);

  const takeScreenshot = async (dir, name) => {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const outPath = path.join(dir, `${name}.png`);
    fs.writeFileSync(outPath, buffer);
    console.log(`  ✓ Saved screenshot: ${name}.png (${buffer.length} bytes) in ${path.basename(dir)}`);
    return res.data;
  };

  const actionCaptures = {};

  // 1. Loadout with Relics & Slingshot Row
  console.log('1. Capturing Loadout with Relics & Slingshot Row...');
  await evalCode(`(() => {
    const mm = window.__mm;
    const prof = mm.profile();
    prof.owned.weapons = [
      'w_militia_blade', 'w_skyforge_maul', 'w_comet_fists',
      'w_bulwark_disc', 'w_steersong_arrow', 'w_silkline_shooters', 'w_kinetic_palms'
    ];
    prof.equipped.loadout = ['w_skyforge_maul', 'w_steersong_arrow', 'w_silkline_shooters', 'w_kinetic_palms'];
    prof.owned.slingSkins = ['classic', 'quicksilver', 'gemini'];
    prof.equipped.slingSkin = 'quicksilver';
    const g = window.__game;
    for (const s of g.scene.getScenes(true)) if (s.scene.key !== 'boot') g.scene.stop(s.scene.key);
    g.scene.start('loadout', { level: 4 });
  })()`);
  await sleep(600);
  await takeScreenshot(WEAPONS_DIR, '01_loadout_relic_weapons');
  await takeScreenshot(ART_DIR, '01_loadout');

  // 2. Shop Slingshots Tab
  console.log('2. Capturing Shop Slingshots Tab...');
  await evalCode(`(() => {
    const mm = window.__mm;
    const prof = mm.profile();
    prof.coins = 2500;
    prof.owned.slingSkins = ['classic'];
    const g = window.__game;
    for (const s of g.scene.getScenes(true)) if (s.scene.key !== 'boot') g.scene.stop(s.scene.key);
    g.scene.start('shop');
  })()`);
  await sleep(400);
  await evalCode(`(() => {
    const shop = window.__game.scene.getScene('shop');
    shop.tab = 'slingshots';
    shop.selected = 's_quicksilver';
    shop.render();
  })()`);
  await sleep(400);
  await takeScreenshot(WEAPONS_DIR, '02_shop_slingshots');
  await takeScreenshot(ART_DIR, '07_shop_slingshots');

  // Shop all tabs for ART_DIR
  const tabs = [
    { id: 'weapons', sel: 'w_scrapheap_scattergun', name: '02_shop_weapons' },
    { id: 'relics', sel: 'w_skyforge_maul', name: '03_shop_relics' },
    { id: 'artifacts', sel: 'a_horn_plenty', name: '04_shop_artifacts' },
    { id: 'items', sel: 'c_prime_serum', name: '05_shop_items' },
    { id: 'forge', sel: null, name: '06_shop_forge' },
  ];
  for (const t of tabs) {
    console.log(`Capturing Shop ${t.id} tab...`);
    await evalCode(`(() => {
      const shop = window.__game.scene.getScene('shop');
      shop.tab = '${t.id}';
      shop.selected = ${t.sel ? `'${t.sel}'` : 'null'};
      shop.render();
    })()`);
    await sleep(300);
    await takeScreenshot(ART_DIR, t.name);
  }

  // 3. Skyforge Maul (Lightning strike & Electric field at peak)
  console.log('3. Capturing Skyforge Maul Lightning strike...');
  await evalCode(`(() => {
    const mm = window.__mm;
    mm.load(1, ['w_skyforge_maul']);
    mm.fire({ angleDeg: 35, power: 0.8 });
    mm.run(15);
    mm.activateAbility();
    mm.run(4);
  })()`);
  await sleep(250);
  actionCaptures['maul'] = await takeScreenshot(WEAPONS_DIR, '03_skyforge_maul_lightning');

  // 4. Comet Fists (Dive-slam & Earthquake shockwave at peak)
  console.log('4. Capturing Comet Fists Earthquake shockwave...');
  await evalCode(`(() => {
    const mm = window.__mm;
    mm.load(1, ['w_comet_fists']);
    mm.fire({ angleDeg: 55, power: 0.95 });
    mm.run(28);
    mm.activateAbility();
    mm.run(26);
  })()`);
  await sleep(250);
  actionCaptures['fists'] = await takeScreenshot(WEAPONS_DIR, '04_comet_fists_earthquake');

  // 5. Bulwark Disc (Ricochet, Ping star & Ghost trail)
  console.log('5. Capturing Bulwark Disc Ricochet & Ping Star...');
  await evalCode(`(() => {
    const mm = window.__mm;
    mm.load(1, ['w_bulwark_disc']);
    mm.fire({ angleDeg: 25, power: 0.85 });
    mm.run(18);
  })()`);
  await sleep(250);
  actionCaptures['disc'] = await takeScreenshot(WEAPONS_DIR, '05_bulwark_disc_ricochet');

  // 6. Steersong Arrow (Split-tip 3-arrow fan clearly fanning out)
  console.log('6. Capturing Steersong Arrow Split Fan...');
  await evalCode(`(() => {
    const mm = window.__mm;
    mm.load(1, ['w_steersong_arrow']);
    mm.fire({ angleDeg: 35, power: 0.8 });
    mm.run(10);
    mm.activateAbility(); // Arm
    mm.run(2);
    mm.activateAbility(); // Split
    mm.run(8);
  })()`);
  await sleep(250);
  actionCaptures['arrow'] = await takeScreenshot(WEAPONS_DIR, '06_steersong_arrow_split');

  // 7. Silkline Shooters (Web strand & splat & slow)
  console.log('7. Capturing Silkline Shooters Web Line & Splat...');
  await evalCode(`(() => {
    const mm = window.__mm;
    mm.load(1, ['w_silkline_shooters']);
    mm.fire({ angleDeg: 30, power: 0.8 });
    mm.run(12);
    mm.activateAbility();
    mm.run(6);
  })()`);
  await sleep(250);
  actionCaptures['shooters'] = await takeScreenshot(WEAPONS_DIR, '07_silkline_shooters_web');

  // 8. Kinetic Palms (3-bolt repulsor volley & muzzle flash)
  console.log('8. Capturing Kinetic Palms Repulsor Volley...');
  await evalCode(`(() => {
    const mm = window.__mm;
    mm.load(1, ['w_kinetic_palms']);
    mm.fire({ angleDeg: 35, power: 0.8 });
    mm.run(14);
    mm.activateAbility();
    mm.run(10);
  })()`);
  await sleep(250);
  actionCaptures['palms'] = await takeScreenshot(WEAPONS_DIR, '08_kinetic_palms_repulsor');

  // 9. Quicksilver Slingshot (Speed lines & cyan band)
  console.log('9. Capturing Quicksilver Slingshot...');
  await evalCode(`(() => {
    const mm = window.__mm;
    const prof = mm.profile();
    prof.equipped.slingSkin = 's_quicksilver';
    mm.load(1, ['w_militia_blade']);
    mm.fire({ angleDeg: 35, power: 0.9 });
    mm.run(14);
  })()`);
  await sleep(250);
  actionCaptures['quicksilver'] = await takeScreenshot(WEAPONS_DIR, '09_quicksilver_sling_speed');

  // 10. Gemini Strand Slingshot (Twin launch in flight)
  console.log('10. Capturing Gemini Strand Twin Launch...');
  await evalCode(`(() => {
    const mm = window.__mm;
    const prof = mm.profile();
    prof.equipped.slingSkin = 's_gemini';
    mm.load(1, ['w_militia_blade', 'w_iron_cleaver']);
    mm.fire({ angleDeg: 40, power: 0.85 });
    mm.run(18);
  })()`);
  await sleep(250);
  actionCaptures['gemini'] = await takeScreenshot(WEAPONS_DIR, '10_gemini_strand_twin_launch');

  // Battle with each relic weapon mounted on sling in its natural pose
  const relicWeapons = [
    { id: 'w_skyforge_maul', name: '08_battle_w_skyforge_maul' },
    { id: 'w_comet_fists', name: '09_battle_w_comet_fists' },
    { id: 'w_bulwark_disc', name: '10_battle_w_bulwark_disc' },
    { id: 'w_steersong_arrow', name: '11_battle_w_steersong_arrow' },
    { id: 'w_silkline_shooters', name: '12_battle_w_silkline_shooters' },
    { id: 'w_kinetic_palms', name: '13_battle_w_kinetic_palms' },
  ];
  for (const rw of relicWeapons) {
    console.log(`Capturing battle with ${rw.id} mounted on sling...`);
    await evalCode(`(() => {
      const mm = window.__mm;
      const prof = mm.profile();
      prof.equipped.slingSkin = 'classic';
      mm.load(1, ['${rw.id}', 'w_militia_blade', 'w_iron_cleaver', 'w_ashwood_staff']);
    })()`);
    await sleep(400);
    await takeScreenshot(ART_DIR, rw.name);
  }

  // 11. Assemble Master Contact Sheet (sheet.png) from real action captures!
  console.log('11. Generating Master Contact Sheet (sheet.png) from real captures...');
  const captureDataJson = JSON.stringify(actionCaptures);
  const sheetBase64 = await evalCode(`(async () => {
    const g = window.__game;
    const tm = g.textures;
    const captures = ${captureDataJson};

    const canvas = document.createElement('canvas');
    canvas.width = 960;
    canvas.height = 540;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // Dark 16-bit background
    ctx.fillStyle = '#0f141f';
    ctx.fillRect(0, 0, 960, 540);

    // Title banner
    ctx.fillStyle = '#f0c040';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('MONSTER MASH: SLINGSHOT SIEGE - RELIC WEAPONS & SLINGSHOTS', 24, 34);

    ctx.fillStyle = '#8ba4b8';
    ctx.font = '12px monospace';
    ctx.fillText('Generated Sprites, 4x Hero Scales, Slingshot Frames, and REAL In-Game Combat FX Captures', 24, 52);

    // Section 1: Hero sprites at 4x scale
    const heroSprites = [
      { key: 'wpn_w_skyforge_maul', label: 'Skyforge Maul' },
      { key: 'wpn_w_comet_fists', label: 'Comet Fists' },
      { key: 'wpn_w_bulwark_disc', label: 'Bulwark Disc' },
      { key: 'wpn_w_steersong_arrow', label: 'Steersong Arrow' },
      { key: 'wpn_w_silkline_shooters', label: 'Silkline Shooters' },
      { key: 'wpn_w_kinetic_palms', label: 'Kinetic Palms' },
      { key: 'sling_quicksilver', label: 'Quicksilver' },
      { key: 'sling_gemini', label: 'Gemini Strand' },
    ];

    heroSprites.forEach((item, idx) => {
      const x = 24 + idx * 116;
      const y = 68;

      ctx.fillStyle = '#182436';
      ctx.fillRect(x, y, 108, 92);
      ctx.strokeStyle = '#2b3f5c';
      ctx.strokeRect(x, y, 108, 92);

      if (tm.exists(item.key)) {
        const img = tm.get(item.key).getSourceImage();
        const sw = img.width;
        const sh = img.height;
        // Scale to fit card
        const scale = sw <= 16 ? 4 : sw <= 24 ? 3 : 2;
        const dw = sw * scale;
        const dh = sh * scale;
        const ox = x + Math.floor((108 - dw) / 2);
        const oy = y + 8 + Math.floor((60 - Math.min(dh, 60)) / 2);
        ctx.drawImage(img, ox, oy, dw, Math.min(dh, 60));
      }

      ctx.fillStyle = '#9cb6db';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(item.label, x + 54, y + 82);
      ctx.textAlign = 'start';
    });

    // Section 2: In-Game Action Showcase (Real Captures)
    ctx.fillStyle = '#f0c040';
    ctx.font = 'bold 15px monospace';
    ctx.fillText('REAL IN-GAME ACTION CAPTURES (COMBAT MECHANICS & FX)', 24, 182);

    const actionPanels = [
      { key: 'maul', title: '1. SKYFORGE MAUL', desc: 'Lightning bolt strike & electric field' },
      { key: 'fists', title: '2. COMET FISTS', desc: 'Dive-slam & ground earthquake shock' },
      { key: 'disc', title: '3. BULWARK DISC', desc: 'Ricochet & ping star bounce' },
      { key: 'arrow', title: '4. STEERSONG ARROW', desc: 'Armed explosion & 3-arrow fan split' },
      { key: 'shooters', title: '5. SILKLINE SHOOTERS', desc: 'Web strand pull & 4s 50% slow' },
      { key: 'palms', title: '6. KINETIC PALMS', desc: '3-bolt repulsor volley & recoil' },
      { key: 'quicksilver', title: '7. QUICKSILVER SLING', desc: '+25% speed & speed-line trail' },
      { key: 'gemini', title: '8. GEMINI STRAND', desc: '12-step twin launch at 45% damage' },
    ];

    const loadImg = (b64) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = 'data:image/png;base64,' + b64;
    });

    for (let idx = 0; idx < actionPanels.length; idx++) {
      const p = actionPanels[idx];
      const col = idx % 4;
      const row = Math.floor(idx / 4);
      const px = 24 + col * 232;
      const py = 196 + row * 164;

      ctx.fillStyle = '#141d2c';
      ctx.fillRect(px, py, 222, 154);
      ctx.strokeStyle = '#2b3f5c';
      ctx.strokeRect(px, py, 222, 154);

      // Header strip
      ctx.fillStyle = '#1e2c44';
      ctx.fillRect(px, py, 222, 22);
      ctx.fillStyle = '#ffd15c';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(p.title, px + 8, py + 15);

      ctx.fillStyle = '#8ba4b8';
      ctx.font = '9px monospace';
      ctx.fillText(p.desc, px + 8, py + 34);

      // Simulation preview box with real capture
      ctx.fillStyle = '#0a0d14';
      ctx.fillRect(px + 8, py + 40, 206, 106);
      ctx.strokeStyle = '#1d273a';
      ctx.strokeRect(px + 8, py + 40, 206, 106);

      if (captures[p.key]) {
        const capturedImg = await loadImg(captures[p.key]);
        // Crop center combat region (capturedImg is 960x540)
        // Draw into 206x106 preview box
        ctx.drawImage(capturedImg, 0, 0, capturedImg.width, capturedImg.height, px + 8, py + 40, 206, 106);
      }
    }

    return canvas.toDataURL('image/png').replace(/^data:image\\/png;base64,/, '');
  })()`);

  const sheetBuffer = Buffer.from(sheetBase64, 'base64');
  fs.writeFileSync(path.join(WEAPONS_DIR, 'sheet.png'), sheetBuffer);
  console.log(`  ✓ Saved contact sheet from real captures: sheet.png (${sheetBuffer.length} bytes)`);

  console.log('\nAll screenshots and contact sheet captured successfully!');
  cleanup();
  process.exit(0);
}

run().catch((err) => {
  console.error('Fatal error during screenshot capture:', err);
  process.exit(1);
});
