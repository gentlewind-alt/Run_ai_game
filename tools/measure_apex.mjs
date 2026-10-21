import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';

const CHROME_PATH = process.env.CHROME_BIN ||
  (process.platform === 'win32'
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : 'google-chrome');

const TMP_PROFILE = path.join(os.tmpdir(), 'mm_chrome_measure');

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
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

  const cleanup = () => {
    try { spawn('taskkill', ['/F', '/T', '/PID', String(chrome.pid)]); } catch (e) {}
    try { spawn('taskkill', ['/F', '/IM', 'chrome.exe']); } catch (e) {}
  };
  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);

  await sleep(1000);

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

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  };

  const send = (method, params = {}) => {
    const id = idCounter++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  await new Promise((r) => { ws.onopen = r; });
  await send('Page.enable');
  await send('Runtime.enable');

  await send('Page.navigate', { url: 'http://127.0.0.1:5173/?debug=1' });

  // wait for game and __mm
  let ready = false;
  for (let i = 0; i < 60; i++) {
    await sleep(250);
    const r = await send('Runtime.evaluate', {
      expression: `Boolean(window.__game && window.__mm && typeof window.__mm.load === 'function')`,
      returnByValue: true
    });
    if (r.result?.value) {
      ready = true;
      break;
    }
  }

  if (!ready) {
    console.error('__mm failed to become ready');
    cleanup();
    process.exit(1);
  }

  console.log('Game & __mm ready. Measuring apex heights for all weapons at angle 75, power 1...');

  const weapons = [
    'w_militia_blade',
    'w_iron_cleaver',
    'w_ashwood_staff',
    'w_scrapheap_scattergun',
    'w_hunters_pike',
    'w_hunters_boomerang',
    'w_blast_tube',
    'w_horned_scepter',
    'w_comet_fists',
    'w_bulwark_disc',
    'w_skyforge_maul',
    'w_steersong_arrow',
    'w_silkline_shooters',
    'w_kinetic_palms'
  ];

  const evalCode = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    return r.result?.value;
  };

  const results = [];
  for (const wid of weapons) {
    const res = await evalCode(`(async () => {
      window.__mm.give({ unlockAll: true });
      window.__mm.load(99, ['${wid}']); // sandbox level 99
      await new Promise(r => setTimeout(r, 100));
      const b = window.__mm.battle();
      const slingY = b.slingY;
      const slingX = b.slingX;
      
      // Fire at angle 75, power 1.0
      window.__mm.fire({ angleDeg: 75, power: 1.0 });
      
      let minY = slingY;
      let apexX = slingX;
      let apexStep = 0;
      
      for (let step = 0; step < 240; step++) {
        window.__mm.run(1);
        if (b.proj && b.proj.body) {
          const py = b.proj.body.position.y;
          const px = b.proj.body.position.x;
          if (py < minY) {
            minY = py;
            apexX = px;
            apexStep = step;
          }
          if (py > slingY && step > 20) break;
        } else {
          break;
        }
      }
      
      return {
        weapon: '${wid}',
        slingY,
        minY: Math.round(minY * 10) / 10,
        apexHeightAboveSling: Math.round((slingY - minY) * 10) / 10,
        apexX: Math.round(apexX * 10) / 10,
        apexStep
      };
    })()`);
    results.push(res);
  }

  console.table(results);

  // Now measure fort heights in L5, L6, L9, L12
  console.log('\nTallest fort/monster items in L5, L6, L9, L12:');
  for (const lvl of [5, 6, 9, 12]) {
    const fortRes = await evalCode(`(() => {
      window.__mm.load(${lvl});
      const b = window.__mm.battle();
      let minY = 999;
      let minDesc = '';
      for (const ent of b.ents) {
        if (ent.dead) continue;
        const topY = ent.kind === 'block' ? (ent.body.position.y - (ent.origH || 0) / 2) : ent.body.position.y;
        if (topY < minY) {
          minY = topY;
          minDesc = ent.kind + ':' + ent.type + '@' + Math.round(ent.body.position.x);
        }
      }
      return {
        level: ${lvl},
        minY: Math.round(minY * 10) / 10,
        heightAboveGround: Math.round((b.groundY - minY) * 10) / 10,
        heightAboveSling: Math.round((b.slingY - minY) * 10) / 10,
        desc: minDesc
      };
    })()`);
    console.log(fortRes);
  }

  cleanup();
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
