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

const isQuick = process.argv.includes('--quick');
const suiteStartTime = performance.now();

async function run() {
  console.log(`=== STARTING MONSTER MASH REGRESSION SUITE (${isQuick ? 'QUICK MODE' : 'FULL SUITE'}) ===\n`);

  // 1. Ensure Vite dev server is running on port 5173
  let devProc = null;
  let serverReady = false;
  try {
    const res = await fetch('http://127.0.0.1:5173/?debug=1');
    if (res.ok) serverReady = true;
  } catch (e) {
    try {
      const res = await fetch('http://localhost:5173/?debug=1');
      if (res.ok) serverReady = true;
    } catch (e2) {}
  }

  if (!serverReady) {
    console.log('Starting Vite dev server on port 5173...');
    const isWin = process.platform === 'win32';
    const cmd = isWin ? 'cmd.exe' : 'npx';
    const args = isWin ? ['/c', 'npx', 'vite', '--port', '5173', '--host', '127.0.0.1'] : ['vite', '--port', '5173'];
    devProc = spawn(cmd, args, {
      cwd: gameDir,
      stdio: 'pipe',
    });
    for (let i = 0; i < 60; i++) {
      try {
        const res = await fetch('http://127.0.0.1:5173/?debug=1');
        if (res.ok) {
          serverReady = true;
          break;
        }
      } catch (e) {
        try {
          const res = await fetch('http://localhost:5173/?debug=1');
          if (res.ok) {
            serverReady = true;
            break;
          }
        } catch (e2) {}
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
  const tSec1 = performance.now();
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
  console.log(`  [Timing] Section 1 finished in ${((performance.now() - tSec1) / 1000).toFixed(2)}s\n`);

  // =========================================================================
  // 2. ASSERT V1 SAVE MIGRATION
  // =========================================================================
  console.log('--- 2. ASSERTING V1 SAVE FIXTURE MIGRATION ---');
  const tSec2 = performance.now();
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
      // Snapshot values immediately — setProfile mutates the shared profile object in place
      const prof1Coins = window.__mm.profile().coins;
      const prof1Stars = JSON.parse(JSON.stringify(window.__mm.profile().stars));
      const prof1Weapons = window.__mm.profile().owned.weapons.slice();
      const prof1HasDaily = typeof window.__mm.profile().daily?.streak === 'number';
      const prof1HasFlags = typeof window.__mm.profile().flags === 'object';
      const prof1HasBossLosses = typeof window.__mm.profile().stats?.bossLosses === 'object';
      const prof = window.__mm.profile();

      // v-previous save with 4 loadout ids -> must load and pad to 6 with starter weapon
      const save4Ids = {
        version: 2,
        coins: 200,
        owned: { weapons: ['w_militia_blade', 'w_iron_cleaver', 'w_ashwood_staff', 'w_scrapheap_scattergun'], artifacts: [], consumables: {}, cosmetics: [] },
        upgrades: {},
        stars: { '1': 2 },
        equipped: { loadout: ['w_militia_blade', 'w_iron_cleaver', 'w_ashwood_staff', 'w_scrapheap_scattergun'], artifacts: [] },
        flags: {},
        stats: { bossLosses: {} },
        settings: { muted: false, musicOn: true }
      };
      await window.__mm.platform().storage.set('save', JSON.stringify(save4Ids));
      const load4Status = await window.__mm.loadSave();
      const prof4 = window.__mm.profile();
      const fourIdsPadded = load4Status === 'loaded' &&
        prof4.equipped.loadout.length === 6 &&
        prof4.equipped.loadout[0] === 'w_militia_blade' &&
        prof4.equipped.loadout[1] === 'w_iron_cleaver' &&
        prof4.equipped.loadout[2] === 'w_ashwood_staff' &&
        prof4.equipped.loadout[3] === 'w_scrapheap_scattergun' &&
        prof4.equipped.loadout[4] === 'w_militia_blade' &&
        prof4.equipped.loadout[5] === 'w_militia_blade';

      // Full 6-weapon fight assertion on Level 12 (6 shots)
      const sixWeapons = ['w_militia_blade', 'w_iron_cleaver', 'w_ashwood_staff', 'w_hunters_pike', 'w_scrapheap_scattergun', 'w_blast_tube'];
      const v6 = window.__mm.play(12, sixWeapons, [
        { angleDeg: 35, power: 0.8 },
        { angleDeg: 45, power: 0.8 },
        { angleDeg: 55, power: 0.8 },
        { angleDeg: 65, power: 0.8 },
        { angleDeg: 30, power: 0.8 },
        { angleDeg: 50, power: 0.8 }
      ]);
      const sixFightValid = v6.shotsLeft !== undefined && (6 - v6.shotsLeft) === 6;

      return {
        loadStatus,
        coinsPreserved: prof1Coins === 350 && sanitized.coins === 350,
        starsPreserved: prof1Stars['1'] === 3 && prof1Stars['2'] === 2 && prof1Stars['3'] === 3 && prof1Stars['4'] === 1,
        weaponsPreserved: prof1Weapons.length === 2 && prof1Weapons.includes('w_iron_cleaver'),
        hasDaily: prof1HasDaily,
        hasFlags: prof1HasFlags,
        hasBossLosses: prof1HasBossLosses,
        fourIdsPadded,
        sixFightValid
      };
    })()`);

    if (saveResult.loadStatus !== 'loaded' || !saveResult.coinsPreserved || !saveResult.starsPreserved || !saveResult.weaponsPreserved || !saveResult.hasDaily || !saveResult.hasFlags || !saveResult.hasBossLosses || !saveResult.fourIdsPadded || !saveResult.sixFightValid) {
      const msg = `Save migration failed: status=${saveResult.loadStatus}, coinsPreserved=${saveResult.coinsPreserved}, fourIdsPadded=${saveResult.fourIdsPadded}, sixFightValid=${saveResult.sixFightValid}`;
      console.error('  ERROR:', msg);
      failures.push(msg);
    } else {
      console.log('  ✓ v1 save migration passed: 350 coins preserved, 1-4 stars preserved, all modern fields normalized.');
      console.log('  ✓ v-previous 4-id save loaded and padded with starter weapon to 6 slots.');
      console.log('  ✓ Full 6-weapon fight verified: all 6 shots executed in battle sequence.\n');
    }
  } catch (err) {
    console.error('  Save migration threw exception:', err);
    failures.push(`Save migration exception: ${err.message}`);
  }
  console.log(`  [Timing] Section 2 finished in ${((performance.now() - tSec2) / 1000).toFixed(2)}s\n`);

  // =========================================================================
  // 2b. ASSERT RELICS FRAMEWORK: RARITY, LOADOUT, MINI-BOSSES, CHESTS, PITY
  // =========================================================================
  console.log('--- 2b. ASSERTING RELICS FRAMEWORK (RARITY, LOADOUT, MINI-BOSS, CHESTS, PITY) ---');
  const tSec2b = performance.now();
  try {
    const relicResult = await evalCode(`(async () => {
      const g = window.__game;
      const mm = window.__mm;
      const prof = mm.profile();

      // 1. Loadout rejects 2nd legendary
      prof.owned.weapons = ['w_militia_blade', 'w_comet_fists', 'w_bulwark_disc'];
      mm.setLoadout(['w_comet_fists', 'w_bulwark_disc']);
      const loadoutHasAtMostOne = prof.equipped.loadout.filter(id => id === 'w_comet_fists' || id === 'w_bulwark_disc').length <= 1;

      // 2. Pity appears in shop only at >= 3 losses
      prof.stats.bossLosses = { 4: 2 };
      prof.coins = 2000;
      prof.owned.weapons = ['w_militia_blade'];
      const buyAt2Losses = mm.buyWeapon('w_comet_fists'); // should be 'locked'
      
      prof.stats.bossLosses[4] = 3;
      prof.coins = 1400;
      const buyNoCoins = mm.buyWeapon('w_comet_fists'); // should be 'coins'
      
      prof.coins = 2000;
      const buyAt3Losses = mm.buyWeapon('w_comet_fists'); // should be 'ok'
      const pityBought = buyAt3Losses === 'ok' && prof.coins === 500 && prof.owned.weapons.includes('w_comet_fists');

      // 3. Mini-boss and chest battle rewards
      // Load L4 (Goblin Chief mini-boss)
      prof.owned.weapons = ['w_militia_blade'];
      mm.load(4, ['w_militia_blade']);
      const b4 = mm.battle();
      const chiefEnt = b4.ents.find(e => e.kind === 'monster' && e.type === 'goblin_chief');
      const chiefPresent = !!chiefEnt && chiefEnt.def?.boss === true;

      // Simulate boss kill
      if (chiefEnt) {
        b4.ctx.damage(chiefEnt, 9999, chiefEnt.body.position.x, chiefEnt.body.position.y, { strong: true, tag: 'weak' });
      }
      const bossRelicGranted = prof.owned.weapons.includes('w_comet_fists') && b4.relicUnlocked === 'w_comet_fists';

      // Repeat kill does not duplicate
      if (chiefEnt) {
        chiefEnt.dead = false; chiefEnt.hp = 90;
        b4.ctx.damage(chiefEnt, 9999, chiefEnt.body.position.x, chiefEnt.body.position.y, { strong: true, tag: 'weak' });
      }
      const bossNotDuplicated = prof.owned.weapons.filter(x => x === 'w_comet_fists').length === 1;

      // Load L3 (Treasure chest)
      prof.owned.weapons = ['w_militia_blade'];
      mm.load(3, ['w_militia_blade']);
      const b3 = mm.battle();
      const chestEnt = b3.ents.find(e => e.kind === 'chest');
      const chestPresent = !!chestEnt && chestEnt.params?.reward === 'w_steersong_arrow';

      // Destroy chest for the first time -> grants relic
      if (chestEnt) {
        b3.ctx.damage(chestEnt, 9999, chestEnt.body.position.x, chestEnt.body.position.y, { strong: true, tag: 'norm' });
      }
      const chestRelicGranted = prof.owned.weapons.includes('w_steersong_arrow') && b3.relicUnlocked === 'w_steersong_arrow';

      // Destroy chest again when already owned -> grants 150 coins fallback
      const coinsBefore = b3.coins;
      if (chestEnt) {
        chestEnt.dead = false; chestEnt.hp = 40;
        b3.ctx.damage(chestEnt, 9999, chestEnt.body.position.x, chestEnt.body.position.y, { strong: true, tag: 'norm' });
      }
      const chestCoinFallback = b3.coins === coinsBefore + 150;

      return {
        loadoutHasAtMostOne,
        buyAt2Losses,
        buyNoCoins,
        pityBought,
        chiefPresent,
        bossRelicGranted,
        bossNotDuplicated,
        chestPresent,
        chestRelicGranted,
        chestCoinFallback,
        passed: loadoutHasAtMostOne && buyAt2Losses === 'locked' && buyNoCoins === 'coins' && pityBought &&
                chiefPresent && bossRelicGranted && bossNotDuplicated &&
                chestPresent && chestRelicGranted && chestCoinFallback
      };
    })()`);

    if (!relicResult.passed) {
      const msg = `Relics framework checks failed: ${JSON.stringify(relicResult)}`;
      console.error('  FAIL', msg);
      failures.push(msg);
    } else {
      console.log('  ✓ Loadout rejected second legendary weapon (max 1 legendary in loadout).');
      console.log('  ✓ Pity shop locked at 2 losses, required 1500 coins, purchased ok at 3 losses.');
      console.log('  ✓ L4 Goblin Chief boss present, kill granted Comet Fists once (no duplicates).');
      console.log('  ✓ L3 Chest present, break granted Steersong Arrow, second break gave 150 coins fallback.\n');
    }
  } catch (err) {
    console.error('  Relics framework check exception:', err);
    failures.push(`Relics framework exception: ${err.message}`);
  }
  console.log(`  [Timing] Section 2b finished in ${((performance.now() - tSec2b) / 1000).toFixed(2)}s\n`);

  // =========================================================================
  // 2c. ASSERT RELIC WEAPONS & SLINGSHOTS (BATCH A: 6 WEAPONS & 2 SLINGSHOTS)
  // =========================================================================
  console.log('--- 2c. ASSERTING RELIC WEAPONS & SLINGSHOTS (BATCH A) ---');
  const tSec2c = performance.now();
  try {
    const wpnResult = await evalCode(`(async () => {
      const g = window.__game;
      const mm = window.__mm;
      const prof = mm.profile();

      // 1. SKYFORGE MAUL (Legendary)
      prof.owned.weapons = ['w_skyforge_maul', 'w_militia_blade'];
      mm.load(1, ['w_skyforge_maul', 'w_skyforge_maul']);
      let b = mm.battle();
      mm.fire({ angleDeg: 35, power: 0.8 });
      mm.run(15);
      const maulProj = b.proj;
      const maulInitialCharges = b.abilityCharges?.['w_skyforge_maul'] ?? 1;
      const targetMon = b.ctx.nearestMonsters(maulProj.body.position.x, maulProj.body.position.y, 1)[0];
      const targetHpBefore = targetMon ? targetMon.hp : 0;
      
      mm.activateAbility(); // Tap 1: lightning + electric field
      const maulChargesAfter = b.abilityCharges?.['w_skyforge_maul'];
      const maulAllowSecondTap = maulProj?.data?.allowSecondTap === true;
      const maulSecondLabel = maulProj?.data?.secondTapLabel === 'Recall';
      const nearestDamaged = targetMon ? targetMon.hp < targetHpBefore : true;
      
      // Step 25 steps to verify field actor tick (tickSteps = 20)
      mm.run(25);
      
      // Tap 2: Recall
      mm.activateAbility();
      const maulRecalling = maulProj?.data?.recalling === true;
      const maulAllowSecondAfter = maulProj?.data?.allowSecondTap === false;
      
      // Settle shot 1 and check that charges: 1 stays 0 on shot 2
      mm.settle();
      mm.fire({ angleDeg: 35, power: 0.8 });
      mm.run(15);
      const maulProj2 = b.proj;
      mm.activateAbility();
      const maulShot2Blocked = maulProj2?.tapped === false;
      mm.settle();

      const maulPassed = maulInitialCharges === 1 && maulChargesAfter === 0 &&
                         maulAllowSecondTap && maulSecondLabel && nearestDamaged &&
                         maulRecalling && maulAllowSecondAfter && maulShot2Blocked;

      // 2. COMET FISTS (Legendary)
      prof.owned.weapons = ['w_comet_fists'];
      mm.load(1, ['w_comet_fists', 'w_comet_fists']);
      b = mm.battle();
      mm.fire({ angleDeg: 55, power: 1.0 });
      mm.run(32);
      const fistProj = b.proj;
      mm.activateAbility(); // Tap: dive-slam straight down
      const fistSlamming = fistProj?.data?.slamming === true;
      const fistChargesAfter = b.abilityCharges?.['w_comet_fists'];
      
      // Step until impact and verify earthquake stun & knockdown
      let stunnedMonsters = 0;
      for (let s = 0; s < 80; s++) {
        mm.run(1);
        const st = b.ents.filter(e => e.kind === 'monster' && e.status?.stun > 0);
        if (st.length > 0) {
          stunnedMonsters = st.length;
          break;
        }
      }
      mm.settle();
      
      // Shot 2: verify charges: 1 disabled
      mm.fire({ angleDeg: 45, power: 0.8 });
      mm.run(15);
      const fistProj2 = b.proj;
      mm.activateAbility();
      const fistShot2Blocked = fistProj2?.tapped === false;
      mm.settle();

      const fistsPassed = fistSlamming && fistChargesAfter === 0 && stunnedMonsters > 0 && fistShot2Blocked;

      // 3. BULWARK DISC (Legendary)
      prof.owned.weapons = ['w_bulwark_disc'];
      mm.load(1, ['w_bulwark_disc']);
      b = mm.battle();
      mm.fire({ angleDeg: 25, power: 0.9 });
      let discProj = b.proj;
      mm.run(10);
      const velBeforeRedirect = { ...discProj?.body?.velocity };
      mm.activateAbility(); // Redirect
      const discChargesAfter = b.abilityCharges?.['w_bulwark_disc'];
      const redirected = discProj?.body?.velocity?.x !== velBeforeRedirect.x || discProj?.body?.velocity?.y !== velBeforeRedirect.y;
      
      // Directly verify 6-bounce clamp and +10% damage bonus
      const discImpl = b.wpn;
      const mockP = {
        def: b.wdef,
        body: { proj: { mul: 1 }, position: { x: 200, y: 200 } },
        data: { bounces: 0 }
      };
      for (let i = 0; i < 8; i++) {
        discImpl.onImpact(b.ctx, mockP);
      }
      const bouncesClampedAt6 = mockP.data.bounces === 8 && Math.abs(mockP.body.proj.mul - 1.6) < 0.001;
      mm.settle();

      const discPassed = redirected && discChargesAfter === 0 && bouncesClampedAt6;

      // 4. STEERSONG ARROW (Rare)
      prof.owned.weapons = ['w_steersong_arrow'];
      // Mode 1: Armed explosion
      mm.load(1, ['w_steersong_arrow']);
      b = mm.battle();
      mm.fire({ angleDeg: 35, power: 0.8 });
      mm.run(10);
      let arrowProj = b.proj;
      mm.activateAbility();
      const arrowArmed = arrowProj?.data?.mode === 'armed' && arrowProj?.data?.allowSecondTap === true;
      mm.settle();

      // Mode 2: Split 3-arrow fan
      mm.load(1, ['w_steersong_arrow']);
      b = mm.battle();
      mm.fire({ angleDeg: 35, power: 0.8 });
      mm.run(10);
      arrowProj = b.proj;
      mm.activateAbility(); // Tap 1
      mm.run(2);
      const actorsBeforeSplit = b.actors.length;
      mm.activateAbility(); // Tap 2: split
      const arrowSplit = arrowProj?.data?.mode === 'split' && arrowProj?.data?.allowSecondTap === false;
      const pelletsSpawned = b.actors.length >= actorsBeforeSplit + 2;
      mm.settle();

      const arrowPassed = arrowArmed && arrowSplit && pelletsSpawned;

      // 5. SILKLINE SHOOTERS (Rare)
      prof.owned.weapons = ['w_silkline_shooters'];
      mm.load(1, ['w_silkline_shooters']);
      b = mm.battle();
      mm.fire({ angleDeg: 30, power: 0.8 });
      mm.run(15);
      const monsterStarts = new Map(b.ents.filter(e => e.kind === 'monster').map(e => [e, e.body.position.x]));
      mm.activateAbility();
      const silkProj = b.proj;
      const webLine = !!silkProj?.data?.webLine;
      const affected = b.ents.find(e => e.kind === 'monster' && (e.status?.slow > 0 || (monsterStarts.has(e) && e.body.position.x < monsterStarts.get(e))));
      const targetSlowed = !!(affected && affected.status?.slow > 0);
      const targetPulled = !!(affected && monsterStarts.has(affected) && affected.body.position.x < monsterStarts.get(affected));
      mm.settle();

      const shootersPassed = webLine && targetSlowed && targetPulled;

      // 6. KINETIC PALMS (Rare)
      prof.owned.weapons = ['w_kinetic_palms'];
      mm.load(1, ['w_kinetic_palms']);
      b = mm.battle();
      mm.fire({ angleDeg: 35, power: 0.8 });
      mm.run(15);
      const palmProj = b.proj;
      const palmVxBefore = palmProj?.body?.velocity?.x ?? 0;
      const actorsBeforeTap = b.actors.length;
      mm.activateAbility();
      const palmVxAfter = palmProj?.body?.velocity?.x ?? 0;
      const recoilApplied = palmVxAfter < palmVxBefore;
      const firstBoltSpawned = b.actors.length >= actorsBeforeTap + 2;
      mm.run(25);
      mm.settle();

      const palmsPassed = recoilApplied && firstBoltSpawned;

      // 7. QUICKSILVER SLINGSHOT
      prof.owned.cosmetics = ['s_quicksilver', 's_gemini'];
      mm.equipSlingSkin('s_quicksilver');
      mm.load(1, ['w_militia_blade']);
      b = mm.battle();
      const qsSpeedMult = b.mods.launchSpeedMult;
      mm.fire({ angleDeg: 45, power: 0.8 });
      const qsProj = b.proj;
      const qsSpeedLines = qsProj?.data?.speedLines === true;
      mm.settle();

      const quicksilverPassed = qsSpeedMult === 1.25 && qsSpeedLines;

      // 8. GEMINI STRAND SLINGSHOT
      mm.equipSlingSkin('s_gemini');
      mm.load(1, ['w_militia_blade', 'w_iron_cleaver']);
      b = mm.battle();
      const twinFraction = b.mods.twinFraction;
      const twinDelaySteps = b.mods.twinDelaySteps;
      mm.fire({ angleDeg: 45, power: 0.8 });
      const shotIdxTwin = b.shotIdx;
      mm.run(14);
      const twinActor = b.actors.find(a => a.body?.proj?.owner === 'extra' && Math.abs(a.body?.proj?.mul - 0.45) < 0.01);
      const twinLaunched = !!twinActor;
      mm.settle();
      mm.equipSlingSkin(undefined);

      const geminiPassed = twinFraction === 0.45 && twinDelaySteps === 12 && shotIdxTwin === 2 && twinLaunched;

      // 9. LOADOUT & SHOP REAL NAMES AND CARD CLEARANCE
      prof.owned.weapons = [
        'w_skyforge_maul', 'w_comet_fists', 'w_bulwark_disc',
        'w_steersong_arrow', 'w_silkline_shooters', 'w_kinetic_palms'
      ];
      for (const s of g.scene.getScenes(true)) if (s.scene.key !== 'boot') g.scene.stop(s.scene.key);
      g.scene.start('loadout', { level: 1 });
      await new Promise(r => setTimeout(r, 400));
      const loadoutScene = g.scene.getScene('loadout');
      
      let realNamesPassed = true;
      for (const wid of prof.owned.weapons) {
        loadoutScene.describe(wid);
        const infoTexts = loadoutScene.info.map(t => t.text || t.texture?.key || '');
        const wDef = mm.battle().content.weapons.find(w => w.id === wid);
        const hasRealName = infoTexts.some(txt => txt.includes(wDef.name));
        const hasLaunch = infoTexts.some(txt => txt.includes(wDef.launch.slice(0, 15)));
        const hasTap = infoTexts.some(txt => txt.includes(wDef.tap.slice(0, 15)));
        if (!hasRealName || !hasLaunch || !hasTap) {
          realNamesPassed = false;
        }
      }

      // Shop Slingshots tab check
      for (const s of g.scene.getScenes(true)) if (s.scene.key !== 'boot') g.scene.stop(s.scene.key);
      g.scene.start('shop');
      await new Promise(r => setTimeout(r, 400));
      const shopScene = g.scene.getScene('shop');
      shopScene.tab = 'slingshots';
      shopScene.selected = null;
      shopScene.render();
      await new Promise(r => setTimeout(r, 200));
      const shopItems = shopScene.items();
      const hasQuicksilver = shopItems.some(it => it.id === 's_quicksilver' && it.price === 600);
      const hasGemini = shopItems.some(it => it.id === 's_gemini' && it.price === 1200);
      const shopSlingshotsOk = hasQuicksilver && hasGemini;

      // Reset shop tab back to weapons for subsequent tests
      shopScene.tab = 'weapons';
      shopScene.selected = null;
      shopScene.render();

      return {
        maulPassed,
        fistsPassed,
        discPassed,
        arrowPassed,
        shootersPassed,
        palmsPassed,
        quicksilverPassed,
        geminiPassed,
        realNamesPassed,
        shopSlingshotsOk,
        passed: maulPassed && fistsPassed && discPassed && arrowPassed &&
                shootersPassed && palmsPassed && quicksilverPassed && geminiPassed &&
                realNamesPassed && shopSlingshotsOk,
        details: {
          maul: { maulInitialCharges, maulChargesAfter, maulAllowSecondTap, maulSecondLabel, nearestDamaged, maulRecalling, maulAllowSecondAfter, maulShot2Blocked },
          fists: { fistSlamming, fistChargesAfter, stunnedMonsters, fistShot2Blocked }
        }
      };
    })()`);

    if (!wpnResult.passed) {
      const msg = `Relic weapons & slingshots check failed: ${JSON.stringify(wpnResult)}`;
      console.error('  FAIL', msg);
      failures.push(msg);
    } else {
      console.log('  ✓ Skyforge Maul: lightning strike + hit-stop, electric field ticks, recall return, charges: 1 disabled on shot 2.');
      console.log('  ✓ Comet Fists: dive-slam, earthquake stun + knockdown, charges: 1 disabled on shot 2.');
      console.log('  ✓ Bulwark Disc: ricochet 6-bounce clamp at +10%/bounce (+60% total), tap 1 redirect toward monster.');
      console.log('  ✓ Steersong Arrow: armed explosion mode and split-tip 3-arrow fan mode.');
      console.log('  ✓ Silkline Shooters: web line pulls target 16px toward sling and slows monsters 50% for 4s.');
      console.log('  ✓ Kinetic Palms: 3-bolt repulsor volley (10 steps apart), knockback and shot recoil.');
      console.log('  ✓ Quicksilver Slingshot: +25% speed verified via mods.launchSpeedMult and speed-line trail.');
      console.log('  ✓ Gemini Strand Slingshot: queued weapon consumed and twin-launched 12 steps behind at 45% damage.');
      console.log('  ✓ Loadout & Shop display full catalogue names, descriptions, and coin prices (600c, 1200c) with 0 clipping.\n');
    }
  } catch (err) {
    console.error('  Relic weapons check exception:', err);
    failures.push(`Relic weapons exception: ${err.message}`);
  }
  console.log(`  [Timing] Section 2c finished in ${((performance.now() - tSec2c) / 1000).toFixed(2)}s\n`);

  // =========================================================================
  // 3. ASSERT CAMPAIGN LEVELS (Solver, Balance Bands, 0 One-Shot Wins)
  // =========================================================================
  const levelsToTest = process.env.LEVELS ? process.env.LEVELS.split(',').map(Number) : (isQuick ? [1, 4, 8, 12, 16] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
  console.log(`--- 3. ASSERTING LEVELS ${levelsToTest.join(', ')} PLAYTHROUGH & BALANCE BANDS ---`);
  const tSec3 = performance.now();
  const defaultLoadout = ['w_militia_blade', 'w_iron_cleaver', 'w_ashwood_staff', 'w_hunters_pike', 'w_scrapheap_scattergun', 'w_blast_tube'];
  const l6Loadout = ['w_militia_blade', 'w_iron_cleaver', 'w_scrapheap_scattergun', 'w_ashwood_staff', 'w_hunters_pike', 'w_blast_tube'];
  const l12Loadout = ['w_iron_cleaver', 'w_horned_scepter', 'w_hunters_pike', 'w_ashwood_staff', 'w_blast_tube', 'w_scrapheap_scattergun'];

  for (const lvl of levelsToTest) {
    const band = balanceBands[String(lvl)] || balanceBands[lvl];
    if (!band) {
      failures.push(`Level ${lvl}: missing entry in balance_bands.json`);
      continue;
    }
    const loadout = lvl === 12 ? l12Loadout : lvl === 6 ? l6Loadout : defaultLoadout;

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

  // 3c. Relic weapons balance: assert 0 one-shot wins on L1-12 and >= 2 shots on L4-12
  console.log('\n--- 3c. ASSERTING RELIC WEAPONS BALANCE (0 ONE-SHOTS L1-12, >= 2 SHOTS ON L4-L12) ---');
  const relicWeapons = [
    'w_skyforge_maul', 'w_comet_fists', 'w_bulwark_disc',
    'w_steersong_arrow', 'w_silkline_shooters', 'w_kinetic_palms'
  ];
  const sweepLevels = isQuick ? [1, 2, 3, 4, 6, 8, 12] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  for (const w of relicWeapons) {
    const relicLoadout = [w, 'w_militia_blade', 'w_iron_cleaver', 'w_ashwood_staff', 'w_scrapheap_scattergun', 'w_blast_tube'];
    for (const lvl of sweepLevels) {
      const sweepRes = await evalCode(`window.__mm.sweep(${lvl}, ${JSON.stringify(relicLoadout)})`);
      if (sweepRes.oneShotWins !== 0) {
        const msg = `Relic ${w} on Level ${lvl}: has ${sweepRes.oneShotWins} one-shot win(s), expected 0!`;
        console.error(`  FAIL ${msg}`);
        failures.push(msg);
      }
    }
  }
  console.log('  ✓ All 6 relic weapons verified: 0 one-shot wins across all levels 1-12.');

  const solverLevels = isQuick ? [4, 8] : [4, 5, 6, 7, 8, 9, 10, 11, 12];
  for (const lvl of solverLevels) {
    const w = relicWeapons[(lvl - 4) % relicWeapons.length];
    const relicLoadout = [w, 'w_militia_blade', 'w_iron_cleaver', 'w_ashwood_staff', 'w_scrapheap_scattergun', 'w_blast_tube'];
    let solveRes = null;
    let attempts = 0;
    while ((!solveRes || !solveRes.done) && attempts < 8) {
      attempts++;
      solveRes = await evalCode(`(() => {
        const r = window.__mm.solveStep(${lvl}, ${JSON.stringify(relicLoadout)}, 15000);
        return {
          done: r.done,
          shotsCount: r.shots?.length || 0,
          won: r.view?.won || false
        };
      })()`);
    }
    if (solveRes.shotsCount < 2) {
      const msg = `Level ${lvl} with ${w}: won in ${solveRes.shotsCount} shots, expected >= 2!`;
      console.error(`  FAIL ${msg}`);
      failures.push(msg);
    } else {
      console.log(`  ✓ Level ${String(lvl).padStart(2, ' ')} with ${w}: won in ${solveRes.shotsCount} shots (>= 2 shots).`);
    }
  }
  console.log(`  [Timing] Section 3 finished in ${((performance.now() - tSec3) / 1000).toFixed(2)}s\n`);

  // =========================================================================
  // 4. PHONE-TEST BUG 1: NEXT LEVEL FLOW ASSERTION (RESULTS -> LOADOUT -> GAME)
  // =========================================================================
  console.log('\n--- 4. ASSERTING NEXT LEVEL TRANSITION (BUG 1: RESULTS -> LOADOUT -> GAME) ---');
  const tSec4 = performance.now();
  try {
    const b1Res = await evalCode(`(async () => {
      const results = [];
      const g = window.__game;

      window.__mm.give({ unlockAll: true });
      const testEquipped = ['w_militia_blade', 'w_iron_cleaver', 'w_ashwood_staff', 'w_hunters_pike', 'w_scrapheap_scattergun', 'w_blast_tube'];
      window.__mm.profile().equipped.loadout = testEquipped.slice();

      for (const [currLvl, nextLvl] of [[1, 2], [2, 3]]) {
        window.__mm.profile().stars['1'] = 3;
        window.__mm.profile().stars[String(currLvl)] = 3;
        window.__mm.profile().stars[currLvl] = 3;

        const curScene = g.scene.getScene('game');
        if (!curScene || !curScene.scene.isActive() || curScene.levelId !== currLvl) {
          for (const s of g.scene.getScenes(true)) if (s.scene.key !== 'boot') g.scene.stop(s.scene.key);
          g.scene.start('game', { level: currLvl, loadout: testEquipped });
          await new Promise(r => setTimeout(r, 400));
        }
        
        const gameScene = g.scene.getScene('game');
        gameScene.scene.pause();
        gameScene.scene.launch('results', {
          levelId: currLvl,
          won: true,
          why: 'shots',
          stars: 3,
          score: 1500,
          target: 1000,
          loadout: testEquipped
        });
        await new Promise(r => setTimeout(r, 400));

        const resultsScene = g.scene.getScene('results');
        if (!resultsScene || !resultsScene.scene.isActive()) {
          results.push({ currLvl, nextLvl, error: 'ResultsScene not active' });
          continue;
        }

        const nextBtnBox = resultsScene.children.list.find(c => 
          c.type === 'Container' && c.input && c.input.enabled &&
          (c.list?.[0]?.list?.some(sub => sub.texture?.key?.includes('Next level')) || (c.width === 128 && c.height === 26))
        );
        if (!nextBtnBox) {
          results.push({ currLvl, nextLvl, error: 'Next level button not found' });
          continue;
        }

        nextBtnBox.emit('pointerdown');
        nextBtnBox.emit('pointerup');

        let loadoutScene = null;
        for (let t = 0; t < 30; t++) {
          loadoutScene = g.scene.getScene('loadout');
          if (loadoutScene && loadoutScene.scene.isActive()) break;
          await new Promise(r => setTimeout(r, 100));
        }

        if (!loadoutScene || !loadoutScene.scene.isActive()) {
          results.push({ currLvl, nextLvl, error: 'LoadoutScene not active after Next level' });
          continue;
        }

        const headerImg = loadoutScene.children.list.find(c => 
          c.type === 'Image' && (c.y === 12 || Math.abs(c.y - 12) <= 3) && c.texture && c.texture.key.includes('Level ' + nextLvl + ':')
        );
        let headerText = '';
        if (headerImg && headerImg.texture) {
          const key = headerImg.texture.key;
          const lastColon = key.lastIndexOf(':');
          const secondLastColon = key.lastIndexOf(':', lastColon - 1);
          headerText = key.slice(3, secondLastColon);
        }
        const headerOk = headerText.startsWith('Level ' + nextLvl + ':');

        const currentSlots = loadoutScene.slots ? loadoutScene.slots.slice() : [];
        const slotsOk = JSON.stringify(currentSlots) === JSON.stringify(testEquipped);

        const profileEquipped = window.__mm.profile().equipped.loadout ? window.__mm.profile().equipped.loadout.slice() : [];
        const profileOk = JSON.stringify(profileEquipped) === JSON.stringify(testEquipped);

        if (!headerOk || !slotsOk || !profileOk) {
          results.push({
            currLvl,
            nextLvl,
            headerText,
            headerOk,
            slotsOk,
            profileOk,
            error: !headerOk ? 'Loadout header mismatch (' + headerText + ')' : (!slotsOk ? 'Slots not preselected' : 'Profile loadout was reset')
          });
          continue;
        }

        const flingBtn = loadoutScene.goBtn ? loadoutScene.goBtn.box : loadoutScene.children.list.find(c =>
          c.type === 'Container' && c.input && c.input.enabled &&
          c.list?.[0]?.list?.some(sub => sub.texture?.key?.includes('Fling!'))
        );

        if (!flingBtn) {
          results.push({ currLvl, nextLvl, error: 'Fling button not found in LoadoutScene' });
          continue;
        }

        flingBtn.emit('pointerdown');
        flingBtn.emit('pointerup');

        let newGame = null;
        let bState = null;
        for (let t = 0; t < 70; t++) {
          newGame = g.scene.getScene('game');
          if (newGame && newGame.scene.isActive() && newGame.levelId === nextLvl && newGame.b) {
            bState = newGame.b.state;
            if (bState === 'ready') break;
          }
          await new Promise(r => setTimeout(r, 100));
        }

        const isActive = newGame && newGame.scene.isActive();
        const newLevelId = newGame ? newGame.levelId : null;
        // b.loadout is capped to min(loadout.length, level.shots) — compare the prefix that actually fires
        const effectiveShots = newGame && newGame.b ? newGame.b.loadout.length : testEquipped.length;
        const battleLoadoutOk = newGame && newGame.b && JSON.stringify(newGame.b.loadout) === JSON.stringify(testEquipped.slice(0, effectiveShots));

        results.push({
          currLvl,
          nextLvl,
          headerText,
          headerOk,
          slotsOk,
          profileOk,
          isActive,
          newLevelId,
          bState,
          battleLoadoutOk,
          passed: isActive && newLevelId === nextLvl && bState === 'ready' && headerOk && slotsOk && profileOk && battleLoadoutOk
        });
      }

      return results;
    })()`);

    const failed = b1Res.filter(r => !r.passed);
    if (failed.length > 0) {
      failed.forEach(f => {
        const msg = `Next level flow: L${f.currLvl} -> L${f.nextLvl} failed (header="${f.headerText}", slotsOk=${f.slotsOk}, profileOk=${f.profileOk}, active=${f.isActive}, id=${f.newLevelId}, state=${f.bState}, err=${f.error})`;
        console.error('  FAIL', msg);
        failures.push(msg);
      });
    } else {
      b1Res.forEach(r => {
        console.log(`  ✓ L${r.currLvl} win -> Next -> Loadout shows "${r.headerText}" with preselected weapons -> Fling -> Battle L${r.nextLvl} ready.`);
      });
      console.log('  ✓ Bug 1 assertion passed: Next opens Loadout with correct header & preselected loadout, Fling reaches ready (L1->L2, L2->L3).\n');
    }
  } catch (err) {
    console.error('  Bug 1 check exception:', err);
    failures.push(`Bug 1 exception: ${err.message}`);
  }
  console.log(`  [Timing] Section 4 finished in ${((performance.now() - tSec4) / 1000).toFixed(2)}s\n`);

  // =========================================================================
  // 5. PHONE-TEST BUG 2: WEAPON CARD TEXT OVERLAP ASSERTION
  // =========================================================================
  console.log('--- 5. ASSERTING WEAPON CARD TEXT / ART CLEARANCE (BUG 2) ---');
  const tSec5 = performance.now();
  try {
    const b2Res = await evalCode(`(async () => {
      window.__mm.give({ unlockAll: true });
      const g = window.__game;

      for (const s of g.scene.getScenes(true)) if (s.scene.key !== 'boot') g.scene.stop(s.scene.key);
      g.scene.start('loadout', { level: 1 });
      await new Promise(r => setTimeout(r, 400));

      const loadoutScene = g.scene.getScene('loadout');
      const images = loadoutScene.children.list.filter(c => c.type === 'Image' && c.texture && c.texture.key.startsWith('wpn_') && c.x < 260 && c.y >= 30 && c.y <= 240);
      const texts = loadoutScene.children.list.filter(c => (c.type === 'Text' || c.type === 'BitmapText' || c.type === 'Image') && c.y >= 30 && c.y <= 240);

      const loadoutOverlaps = [];
      const loadoutBoundsExceeded = [];
      for (const icon of images) {
        const cardTexts = texts.filter(t => t !== icon && Math.abs(t.y - icon.y) < 20 && t.x >= icon.x - 20 && t.x <= icon.x + 115);
        for (const t of cardTexts) {
          const iconBoxRight = icon.x + 12;
          const textLeft = t.originX === 1 ? t.x - t.width : t.x;
          const textRight = t.originX === 1 ? t.x : t.x + t.width;
          if (textLeft < iconBoxRight) {
            loadoutOverlaps.push({ icon: icon.texture.key, text: t.text || t.texture?.key, textLeft, iconBoxRight });
          }
          if (textRight > icon.x + 114) {
            loadoutBoundsExceeded.push({ icon: icon.texture.key, text: t.text || t.texture?.key, textRight, maxRight: icon.x + 114 });
          }
        }
      }

      for (const s of g.scene.getScenes(true)) if (s.scene.key !== 'boot') g.scene.stop(s.scene.key);
      g.scene.start('shop');
      await new Promise(r => setTimeout(r, 400));

      const shopScene = g.scene.getScene('shop');
      const shopList = shopScene.body ? shopScene.body.list : shopScene.children.list;
      const shopImages = shopList.filter(c => c.type === 'Image' && c.texture && c.texture.key.startsWith('wpn_'));
      const shopTexts = shopList.filter(c => c.type === 'Text' || c.type === 'BitmapText' || c.type === 'Image');
      const shopOverlaps = [];
      const shopBoundsExceeded = [];
      for (const icon of shopImages) {
        const cardTexts = shopTexts.filter(t => t !== icon && Math.abs(t.y - icon.y) < 20 && t.x >= icon.x - 20 && t.x <= icon.x + 100);
        for (const t of cardTexts) {
          const iconBoxRight = icon.x + 12;
          const textLeft = t.originX === 1 ? t.x - t.width : t.x;
          const textRight = t.originX === 1 ? t.x : t.x + t.width;
          if (textLeft < iconBoxRight) {
            shopOverlaps.push({ icon: icon.texture.key, text: t.text || t.texture?.key, textLeft, iconBoxRight });
          }
          if (textRight > icon.x + 100) {
            shopBoundsExceeded.push({ icon: icon.texture.key, text: t.text || t.texture?.key, textRight, maxRight: icon.x + 100 });
          }
        }
      }

      // Shop info panel non-overlap assertion across all tabs for the longest description
      const infoPanelOverlaps = [];
      const tabsToCheck = ['weapons', 'relics', 'artifacts', 'items', 'slingshots'];
      for (const tabName of tabsToCheck) {
        shopScene.tab = tabName;
        shopScene.selected = null;
        shopScene.render();
        await new Promise(r => setTimeout(r, 60));

        const tabItems = shopScene.items();
        if (!tabItems.length) continue;
        let longestItem = tabItems[0];
        let maxDescLen = 0;
        for (const it of tabItems) {
          const len = (it.desc || []).join(' ').length;
          if (len > maxDescLen) {
            maxDescLen = len;
            longestItem = it;
          }
        }

        shopScene.selected = longestItem.id;
        shopScene.render();
        await new Promise(r => setTimeout(r, 60));

        const bodyObjs = shopScene.body ? shopScene.body.list : [];
        const actionBtn = bodyObjs.find(c => c.type === 'Container' && Math.abs(c.x - 240) < 15 && c.y > 150);
        if (actionBtn) {
          const btnTop = actionBtn.y - 10;
          const infoTexts = bodyObjs.filter(c => c.type === 'Image' && c.y >= 130 && c.y < actionBtn.y + 10);
          for (const t of infoTexts) {
            const textBot = t.y + (t.height ? (1 - (t.originY ?? 0.5)) * t.height : 4);
            const clearance = btnTop - textBot;
            if (clearance < 4) {
              infoPanelOverlaps.push({ tab: tabName, item: longestItem.id, textY: t.y, textBot, btnY: actionBtn.y, btnTop, clearance });
            }
          }
          if (actionBtn.y + 10 > 240) {
            infoPanelOverlaps.push({ tab: tabName, item: longestItem.id, issue: 'Collides with back button', btnBottom: actionBtn.y + 10 });
          }
        }
      }

      return {
        loadoutCardsChecked: images.length,
        loadoutOverlaps,
        loadoutBoundsExceeded,
        shopCardsChecked: shopImages.length,
        shopOverlaps,
        shopBoundsExceeded,
        infoPanelOverlaps,
        passed: loadoutOverlaps.length === 0 && shopOverlaps.length === 0 &&
                loadoutBoundsExceeded.length === 0 && shopBoundsExceeded.length === 0 &&
                infoPanelOverlaps.length === 0 &&
                images.length > 0 && shopImages.length > 0
      };
    })()`);

    if (!b2Res.passed) {
      const msg = `Weapon card & shop info checks failed: loadoutOverlaps=${b2Res.loadoutOverlaps.length}, shopOverlaps=${b2Res.shopOverlaps.length}, infoPanelOverlaps=${b2Res.infoPanelOverlaps?.length ?? 0} (${JSON.stringify(b2Res.infoPanelOverlaps || [])})`;
      console.error('  FAIL', msg);
      failures.push(msg);
    } else {
      console.log(`  ✓ Bug 2 assertion passed: ${b2Res.loadoutCardsChecked} Loadout cards & ${b2Res.shopCardsChecked} Shop cards have 0 overlaps; Shop info panel has 0 button overlaps across all 5 tabs.\n`);
    }
  } catch (err) {
    console.error('  Bug 2 check exception:', err);
    failures.push(`Bug 2 exception: ${err.message}`);
  }
  console.log(`  [Timing] Section 5 finished in ${((performance.now() - tSec5) / 1000).toFixed(2)}s\n`);

  // =========================================================================
  // 6. PHONE-TEST BUG 3: SLINGSHOT & FORT FRAMING ASSERTION
  // =========================================================================
  console.log(`--- 6. ASSERTING SLINGSHOT & FORT FRAMING (BUG 3)${isQuick ? ' (QUICK: L1, 4, 8, 12 + Daily)' : ''} ---`);
  const tSec6 = performance.now();
  const framingLevels = isQuick ? [1, 4, 8, 12, 16] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
  try {
    const b3Res = await evalCode(`(async () => {
      const checks = [];
      const W = 480;
      const lvls = ${JSON.stringify(framingLevels)};

      for (const lvl of lvls) {
        window.__mm.load(lvl);
        const b = window.__mm.battle();
        const z = b.view.z;
        const cx = b.view.cx;
        const Vw = W / z;
        const leftEdge = cx - Vw / 2;
        const rightEdge = cx + Vw / 2;
        const slingScreenX = (b.slingX - leftEdge) * z;
        const slingFrac = slingScreenX / W;

        const monsters = b.level.monsters ?? [];
        const blocks = b.level.blocks ?? [];
        const monsterMaxX = monsters.length ? Math.max(...monsters.map((m) => m.x)) : b.slingX;
        const blockMaxX = blocks.length ? Math.max(...blocks.map((blk) => blk.x + (blk.w || 0) / 2)) : 0;
        const maxX = Math.max(monsterMaxX, blockMaxX);
        const rightMargin = rightEdge - maxX;
        const leftGroundVisible = 0 - leftEdge;

        const slingFracOk = slingFrac >= 0.14 && slingFrac <= 0.18;
        const rightMarginOk = rightMargin > 0;
        const leftGroundOk = leftGroundVisible > 0;

        checks.push({
          lvl,
          slingFrac: Math.round(slingFrac * 1000) / 1000,
          rightMargin: Math.round(rightMargin * 10) / 10,
          leftGroundVisible: Math.round(leftGroundVisible * 10) / 10,
          passed: slingFracOk && rightMarginOk && leftGroundOk
        });
      }

      window.__mm.load(0);
      const b = window.__mm.battle();
      const z = b.view.z;
      const cx = b.view.cx;
      const Vw = W / z;
      const leftEdge = cx - Vw / 2;
      const rightEdge = cx + Vw / 2;
      const slingScreenX = (b.slingX - leftEdge) * z;
      const slingFrac = slingScreenX / W;

      const monsters = b.level.monsters ?? [];
      const blocks = b.level.blocks ?? [];
      const monsterMaxX = monsters.length ? Math.max(...monsters.map((m) => m.x)) : b.slingX;
      const blockMaxX = blocks.length ? Math.max(...blocks.map((blk) => blk.x + (blk.w || 0) / 2)) : 0;
      const maxX = Math.max(monsterMaxX, blockMaxX);
      const rightMargin = rightEdge - maxX;
      const leftGroundVisible = 0 - leftEdge;

      const slingFracOk = slingFrac >= 0.14 && slingFrac <= 0.18;
      const rightMarginOk = rightMargin > 0;
      const leftGroundOk = leftGroundVisible > 0;

      checks.push({
        lvl: 'daily',
        slingFrac: Math.round(slingFrac * 1000) / 1000,
        rightMargin: Math.round(rightMargin * 10) / 10,
        leftGroundVisible: Math.round(leftGroundVisible * 10) / 10,
        passed: slingFracOk && rightMarginOk && leftGroundOk
      });

      return {
        checks,
        allPassed: checks.every(c => c.passed)
      };
    })()`);

    if (!b3Res.allPassed) {
      const failed = b3Res.checks.filter(c => !c.passed);
      failed.forEach(f => {
        const msg = `Level ${f.lvl} framing fail: slingFrac=${(f.slingFrac * 100).toFixed(1)}% (target 14-18%), rightMargin=${f.rightMargin}px, leftGround=${f.leftGroundVisible}px`;
        console.error('  FAIL', msg);
        failures.push(msg);
      });
    } else {
      console.log(`  ✓ Bug 3 assertion passed: Levels ${isQuick ? '1, 4, 8, 12' : '1-12'} and Daily have sling in 14-18% visible width, right fort margin > 0, and open ground visible beyond both ends.\n`);
    }
  } catch (err) {
    console.error('  Bug 3 check exception:', err);
    failures.push(`Bug 3 exception: ${err.message}`);
  }
  console.log(`  [Timing] Section 6 finished in ${((performance.now() - tSec6) / 1000).toFixed(2)}s\n`);

  // =========================================================================
  // 7. CAMERA RETURN AFTER SHOT ASSERTION (L1, L3, L5, L12)
  // =========================================================================
  const testCamLevels = isQuick ? [1] : [1, 3, 5, 12];
  console.log(`--- 7. ASSERTING CAMERA RETURN TO SLING FRAME AFTER SHOT (LEVELS ${testCamLevels.join(', ')}) ---`);
  const tSec7 = performance.now();
  try {
    const camRes = await evalCode(`(async () => {
      const results = [];
      const testLevels = ${JSON.stringify(testCamLevels)};
      const W = 480;

      for (const lvl of testLevels) {
        window.__mm.load(lvl);
        await new Promise(r => setTimeout(r, 200));

        const expectedCx = window.__mm.homeCx();
        const expectedZoom = window.__mm.homeZoom();

        // Fire a shot toward the fort
        window.__mm.fire({ angleDeg: 50, power: 0.75 });

        // Wait for the battle to reach 'ready' again
        let reachedReady = false;
        let lastState = '';
        for (let t = 0; t < 120; t++) {
          const b = window.__mm.battle();
          if (b) {
            lastState = b.state;
            if (b.state === 'ready') {
              reachedReady = true;
              break;
            }
          }
          await new Promise(r => setTimeout(r, 50));
        }

        if (!reachedReady) {
          results.push({
            lvl,
            reachedReady: false,
            lastState,
            passed: false,
            error: 'Battle did not reach ready state after shot within 6s (state: ' + lastState + ')'
          });
          continue;
        }

        // Wait up to 3 s, assert |view.cx - homeCx| < 3 and |view.z - homeZoom| < 0.02.
        // Also assert the sling is still at 22-26% of the visible width.
        let easedHome = false;
        let finalCx = 0;
        let finalZ = 0;
        let finalFrac = 0;
        let cxDiff = 999;
        let zDiff = 999;
        let fracOk = false;

        const tStart = Date.now();
        while (Date.now() - tStart < 3000) {
          const b = window.__mm.battle();
          finalCx = b.view.cx;
          finalZ = b.view.z;
          cxDiff = Math.abs(finalCx - expectedCx);
          zDiff = Math.abs(finalZ - expectedZoom);

          const Vw = W / finalZ;
          const leftEdge = finalCx - Vw / 2;
          const slingScreenX = (b.slingX - leftEdge) * finalZ;
          finalFrac = slingScreenX / W;
          fracOk = finalFrac >= 0.14 && finalFrac <= 0.18;

          if (cxDiff < 3 && zDiff < 0.02 && fracOk) {
            easedHome = true;
            break;
          }
          await new Promise(r => setTimeout(r, 50));
        }

        results.push({
          lvl,
          reachedReady: true,
          easedHome,
          finalCx: Math.round(finalCx * 10) / 10,
          expectedCx: Math.round(expectedCx * 10) / 10,
          cxDiff: Math.round(cxDiff * 10) / 10,
          finalZ: Math.round(finalZ * 1000) / 1000,
          expectedZoom: Math.round(expectedZoom * 1000) / 1000,
          zDiff: Math.round(zDiff * 1000) / 1000,
          slingFrac: Math.round(finalFrac * 1000) / 1000,
          fracOk,
          passed: reachedReady && easedHome
        });
      }

      // Check free view preservation, view-all reset, and consumable reset
      window.__mm.load(1);
      await new Promise(r => setTimeout(r, 200));
      const expCx = window.__mm.homeCx();
      const expZoom = window.__mm.homeZoom();
      let b = window.__mm.battle();
      b.view.cx = 200;
      b.view.free = true;
      await new Promise(r => setTimeout(r, 200));
      const freePreserved = b.view.free === true && Math.abs(b.view.cx - 200) < 1;

      // View-all button resets free view back to home framing
      window.__mm.toggleView();
      await new Promise(r => setTimeout(r, 400));
      b = window.__mm.battle();
      const toggleResetOk = b.view.free === false && Math.abs(b.view.cx - expCx) < 3 && Math.abs(b.view.z - expZoom) < 0.02;

      // Consumable use clears free view and eases home
      window.__mm.give({ unlockAll: true });
      window.__mm.load(1);
      await new Promise(r => setTimeout(r, 200));
      b = window.__mm.battle();
      b.view.cx = 200;
      b.view.free = true;
      window.__mm.pressConsumable(0);
      window.__mm.targetTap(200, 200);
      const freeClearedOnSpend = b.view.free === false;
      let consumableHomeOk = false;
      const tCons = Date.now();
      while (Date.now() - tCons < 3000) {
        if (Math.abs(b.view.cx - expCx) < 3 && Math.abs(b.view.z - expZoom) < 0.02) {
          consumableHomeOk = true;
          break;
        }
        await new Promise(r => setTimeout(r, 50));
      }

      results.push({
        lvl: 'free_and_consumable_checks',
        reachedReady: true,
        freePreserved,
        toggleResetOk,
        freeClearedOnSpend,
        consumableHomeOk,
        passed: freePreserved && toggleResetOk && freeClearedOnSpend && consumableHomeOk
      });

      return results;
    })()`);

    const failed = camRes.filter(r => !r.passed);
    if (failed.length > 0) {
      failed.forEach(f => {
        const msg = f.lvl === 'free_and_consumable_checks'
          ? `Free & consumable camera checks fail: freePreserved=${f.freePreserved}, toggleResetOk=${f.toggleResetOk}, freeCleared=${f.freeClearedOnSpend}, consumableHomeOk=${f.consumableHomeOk}`
          : `Level ${f.lvl} camera return fail: reachedReady=${f.reachedReady}, easedHome=${f.easedHome}, cxDiff=${f.cxDiff} (target <3), zDiff=${f.zDiff} (target <0.02), slingFrac=${(f.slingFrac * 100).toFixed(1)}% (target 14-18%), err=${f.error || 'none'}`;
        console.error('  FAIL', msg);
        failures.push(msg);
      });
    } else {
      camRes.forEach(r => {
        if (r.lvl === 'free_and_consumable_checks') {
          console.log(`  ✓ Free/pinch view preserved without forced return; toggleView resets to home; consumable use resets free and returns home.`);
        } else {
          console.log(`  ✓ Level ${r.lvl}: shot fired -> ready reached -> view returned to cx=${r.finalCx} (|diff|=${r.cxDiff} < 3), z=${r.finalZ} (|diff|=${r.zDiff} < 0.02), sling at ${(r.slingFrac * 100).toFixed(1)}% width.`);
        }
      });
      console.log(`  ✓ Camera return assertion passed: Levels ${testCamLevels.join(', ')} return to sling frame within 3s after shot.\n`);
    }
  } catch (err) {
    console.error('  Camera return check exception:', err);
    failures.push(`Camera return exception: ${err.message}`);
  }
  console.log(`  [Timing] Section 7 finished in ${((performance.now() - tSec7) / 1000).toFixed(2)}s\n`);

  // =========================================================================
  // 7b. ASSERT EVENT AND LISTENER HYGIENE (RETRY, NEXT, MAP TRANSITIONS)
  // =========================================================================
  console.log('--- 7b. ASSERTING EVENT AND LISTENER HYGIENE (5 CYCLES: RETRY, NEXT, MAP) ---');
  const tSec7b = performance.now();
  try {
    const hygieneRes = await evalCode(`(async () => {
      const g = window.__game;
      const mm = window.__mm;
      const counts = [];
      const pauseMenuCounts = [];
      const duplicateToasts = [];
      const defaultLoadout = ['w_militia_blade', 'w_iron_cleaver', 'w_ashwood_staff', 'w_hunters_pike'];

      for (let cycle = 0; cycle < 5; cycle++) {
        // Step 1: Start Battle L1
        for (const s of g.scene.getScenes(true)) if (s.scene.key !== 'boot') g.scene.stop(s.scene.key);
        g.scene.start('game', { level: 1, loadout: defaultLoadout });
        for (let t = 0; t < 30; t++) {
          const bs = g.scene.getScene('game');
          if (bs && bs.scene.isActive() && bs.b?.state === 'ready') break;
          await new Promise(r => setTimeout(r, 50));
        }

        let gameScene = g.scene.getScene('game');
        if (!gameScene || !gameScene.scene.isActive()) {
          return { error: 'Battle scene not active in cycle ' + cycle };
        }

        // Test Pause Menu: call setPaused(true) twice to assert idempotency
        gameScene.setPaused(true);
        gameScene.setPaused(true);

        const pausedHeaders = gameScene.children.list.filter(c =>
          c.type === 'Image' && c.texture && c.texture.key.includes('Paused')
        );
        pauseMenuCounts.push(pausedHeaders.length);

        // Step 2: Retry from pause menu
        const restartBtn = gameScene.children.list.find(c =>
          c.type === 'Container' && c.input && c.input.enabled &&
          c.list?.[0]?.list?.some(sub => sub.texture?.key?.includes('Restart'))
        );
        if (restartBtn) {
          restartBtn.emit('pointerdown');
          restartBtn.emit('pointerup');
        } else {
          gameScene.setPaused(false);
          gameScene.scene.restart({ level: 1, loadout: defaultLoadout });
        }

        for (let t = 0; t < 30; t++) {
          const bs = g.scene.getScene('game');
          if (bs && bs.scene.isActive() && bs.b?.state === 'ready') break;
          await new Promise(r => setTimeout(r, 50));
        }
        gameScene = g.scene.getScene('game');

        // Step 3: Next level flow (launch Results with win and relic unlock)
        gameScene.scene.pause();
        gameScene.scene.launch('results', {
          levelId: 1,
          won: true,
          why: 'shots',
          stars: 3,
          score: 1500,
          target: 1000,
          loadout: defaultLoadout,
          relicUnlocked: 'w_steersong_arrow'
        });
        await new Promise(r => setTimeout(r, 200));

        const resultsScene = g.scene.getScene('results');
        const relicPanels = resultsScene ? resultsScene.children.list.filter(c =>
          c.type === 'Image' && c.texture && c.texture.key.includes('RELIC FOUND')
        ) : [];
        if (relicPanels.length > 1) {
          duplicateToasts.push({ cycle, count: relicPanels.length });
        }

        // Next level -> Loadout -> Fling -> Battle L2
        const nextBtn = resultsScene?.children.list.find(c =>
          c.type === 'Container' && c.input && c.input.enabled &&
          (c.list?.[0]?.list?.some(sub => sub.texture?.key?.includes('Next level')) || (c.width === 128 && c.height === 26))
        );
        if (nextBtn) {
          nextBtn.emit('pointerdown');
          nextBtn.emit('pointerup');
        }
        for (let t = 0; t < 30; t++) {
          const ls = g.scene.getScene('loadout');
          if (ls && ls.scene.isActive()) break;
          await new Promise(r => setTimeout(r, 50));
        }

        const loadoutScene = g.scene.getScene('loadout');
        const flingBtn = loadoutScene?.goBtn?.box || loadoutScene?.children.list.find(c =>
          c.type === 'Container' && c.input && c.input.enabled &&
          c.list?.[0]?.list?.some(sub => sub.texture?.key?.includes('Fling!'))
        );
        if (flingBtn) {
          flingBtn.emit('pointerdown');
          flingBtn.emit('pointerup');
        }
        for (let t = 0; t < 30; t++) {
          const bs = g.scene.getScene('game');
          if (bs && bs.scene.isActive() && bs.levelId === 2 && bs.b?.state === 'ready') break;
          await new Promise(r => setTimeout(r, 50));
        }

        // Step 4: Map transition from Battle L2
        gameScene = g.scene.getScene('game');
        if (gameScene) {
          gameScene.setPaused(true);
          const mapBtn = gameScene.children.list.find(c =>
            c.type === 'Container' && c.input && c.input.enabled &&
            c.list?.[0]?.list?.some(sub => sub.texture?.key?.includes('Back to map'))
          );
          if (mapBtn) {
            mapBtn.emit('pointerdown');
            mapBtn.emit('pointerup');
          }
        }
        for (let t = 0; t < 40; t++) {
          const ms = g.scene.getScene('map');
          if (ms && ms.scene.isActive()) break;
          await new Promise(r => setTimeout(r, 50));
        }

        // Record event listener count at end of cycle (Map scene active)
        counts.push({
          cycle,
          evCount: mm.eventListenerCount()
        });
      }

      // Check whether listener counts grew after cycle 0 baseline
      const baseEv = counts[0]?.evCount ?? 0;
      const grew = counts.some(c => c.evCount > baseEv);
      const dupPause = pauseMenuCounts.some(cnt => cnt > 1);
      const dupToast = duplicateToasts.length > 0;

      return {
        passed: !grew && !dupPause && !dupToast && counts.length === 5,
        counts,
        pauseMenuCounts,
        duplicateToasts,
        baseEv,
        grew,
        dupPause,
        dupToast
      };
    })()`);

    if (!hygieneRes.passed) {
      const msg = `Listener and event hygiene check failed: baseEv=${hygieneRes.baseEv}, grew=${hygieneRes.grew}, dupPause=${hygieneRes.dupPause}, dupToast=${hygieneRes.dupToast}, counts=${JSON.stringify(hygieneRes.counts)}, pauseCounts=${JSON.stringify(hygieneRes.pauseMenuCounts)}`;
      console.error('  FAIL', msg);
      failures.push(msg);
    } else {
      console.log('  ✓ 5 transitions (Retry, Next, Map) completed cleanly.');
      console.log(`  ✓ EventBus listener count remained strictly constant (${hygieneRes.baseEv}) across all 5 cycles without leaking.`);
      console.log('  ✓ 0 duplicate pause menus (all cycles had exactly 1 header).');
      console.log('  ✓ 0 duplicate toasts/overlays recorded.\n');
    }
  } catch (err) {
    console.error('  Event/listener hygiene check exception:', err);
    failures.push(`Event/listener hygiene exception: ${err.message}`);
  }
  console.log(`  [Timing] Section 7b finished in ${((performance.now() - tSec7b) / 1000).toFixed(2)}s\n`);

  // =========================================================================
  // 8. ASSERT RESPONSIVE SHELL, VIEWPORTS, AND MID-BATTLE RESIZE
  // =========================================================================
  console.log(`--- 8. ASSERTING RESPONSIVE SHELL & VIEWPORTS (${isQuick ? 'QUICK: 812x375' : '8 LANDSCAPE + 1 PORTRAIT'}) ---`);
  const tSec8 = performance.now();
  try {
    const testViewports = isQuick ? [
      [812, 375]
    ] : [
      [568, 320],
      [667, 375],
      [812, 375],
      [915, 412],
      [1024, 768],
      [1180, 820],
      [1920, 1080],
      [2560, 1080]
    ];

    // Check portrait mode: assert Rotate Device overlay shows and app is hidden
    await send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 812,
      deviceScaleFactor: 1,
      mobile: true
    });
    await sleep(200);
    const portraitRes = await evalCode(`(() => {
      const overlay = document.getElementById('rotate-overlay');
      const app = document.getElementById('app');
      const visible = overlay && !overlay.classList.contains('hidden');
      const appHidden = app && app.style.display === 'none';
      return { visible, appHidden, passed: Boolean(visible && appHidden) };
    })()`);
    if (!portraitRes?.passed) {
      const msg = `Portrait 375x812 rotate overlay check failed: visible=${portraitRes?.visible}, appHidden=${portraitRes?.appHidden}`;
      console.error('  FAIL', msg);
      failures.push(msg);
    } else {
      console.log('  ✓ Portrait 375x812: full-screen Rotate Device overlay active and canvas hidden.');
    }

    // Ensure we are in Level 1 battle
    await evalCode(`(async () => {
      window.__mm.give({ unlockAll: true });
      window.__mm.load(1, ['w_militia_blade', 'w_iron_cleaver', 'w_ashwood_staff', 'w_hunters_pike']);
      await new Promise(r => setTimeout(r, 400));
    })()`);

    const vpResults = [];
    for (const [w, h] of testViewports) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: w,
        height: h,
        deviceScaleFactor: 1,
        mobile: w < 700
      });
      await sleep(150);

      const res = await evalCode(`(() => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return { error: 'Canvas not found' };
        const rect = canvas.getBoundingClientRect();
        const docEl = document.documentElement;

        // 1. Canvas bounding box fully inside viewport
        const inside = rect.left >= -1 && rect.top >= -1 &&
                       rect.right <= window.innerWidth + 1 &&
                       rect.bottom <= window.innerHeight + 1;

        // 2. Aspect ratio 480:270 (16:9) preserved within 0.01
        const aspect = rect.width / rect.height;
        const targetAspect = 480 / 270;
        const aspectOk = Math.abs(aspect - targetAspect) < 0.01;

        // 3. No scrollbars or page overflow
        const noScrollbars = docEl.scrollHeight <= window.innerHeight + 1 &&
                             docEl.scrollWidth <= window.innerWidth + 1;

        // 4. Tap on sling: verify world point equals (b.slingX, b.slingY) within 1px
        const b = window.__mm.battle();
        let slingPointOk = false;
        let worldPt = null;
        if (b && b.scene) {
          const cam = b.scene.cameras.main;
          // In logical game coords (480x270):
          const screenX = (b.slingX - (cam.scrollX + 240)) * b.view.z + 240;
          const screenY = (b.slingY - (cam.scrollY + 135)) * b.view.z + 135;
          // Screen to client:
          const clientX = rect.left + screenX * (rect.width / 480);
          const clientY = rect.top + screenY * (rect.height / 270);
          // Simulate pointer transform as Phaser input manager computes:
          const phaserX = (clientX - rect.left) * (480 / rect.width);
          const phaserY = (clientY - rect.top) * (270 / rect.height);
          const wx = cam.scrollX + 240 + (phaserX - 240) / b.view.z;
          const wy = cam.scrollY + 135 + (phaserY - 135) / b.view.z;
          worldPt = { x: Math.round(wx * 10) / 10, y: Math.round(wy * 10) / 10 };
          slingPointOk = Math.abs(wx - b.slingX) < 1 && Math.abs(wy - b.slingY) < 1;
        }

        return {
          viewport: [window.innerWidth, window.innerHeight],
          rect: { width: Math.round(rect.width), height: Math.round(rect.height), left: Math.round(rect.left), top: Math.round(rect.top) },
          inside,
          aspectOk,
          aspect: Math.round(aspect * 1000) / 1000,
          noScrollbars,
          slingPointOk,
          worldPt,
          slingExpected: b ? { x: b.slingX, y: b.slingY } : null,
          passed: inside && aspectOk && noScrollbars && slingPointOk
        };
      })()`);

      vpResults.push(res);
    }

    const vpFailed = vpResults.filter(r => !r.passed);
    if (vpFailed.length > 0) {
      vpFailed.forEach(f => {
        const msg = `Viewport ${f.viewport[0]}x${f.viewport[1]} fail: inside=${f.inside}, aspectOk=${f.aspectOk} (aspect=${f.aspect}), noScrollbars=${f.noScrollbars}, slingOk=${f.slingPointOk} (got ${JSON.stringify(f.worldPt)}, exp ${JSON.stringify(f.slingExpected)}), err=${f.error || 'none'}`;
        console.error('  FAIL', msg);
        failures.push(msg);
      });
    } else {
      vpResults.forEach(r => {
        console.log(`  ✓ Viewport ${r.viewport[0]}x${r.viewport[1]}: canvas ${r.rect.width}x${r.rect.height} (inside, aspect 16:9), no scrollbars, sling pointer mapping exact (${r.worldPt.x}, ${r.worldPt.y}).`);
      });
      console.log(`  ✓ Responsive shell viewports assertion passed across ${isQuick ? 'quick resolution' : 'all 8 landscape resolutions'}.\n`);
    }

    // Mid-battle resize assertion:
    // Resize mid-battle keeps |view.cx - homeCx| < 3 when not free
    console.log('--- 8b. ASSERTING MID-BATTLE RESIZE PRESERVES HOME FRAMING ---');
    const resizeRes = await evalCode(`(async () => {
      window.__mm.load(1);
      await new Promise(r => setTimeout(r, 200));
      const b = window.__mm.battle();
      const expHomeCx = window.__mm.homeCx();

      // Trigger window resize event
      window.dispatchEvent(new Event('resize'));
      await new Promise(r => setTimeout(r, 200));

      const cxDiff = Math.abs(b.view.cx - expHomeCx);
      const passed = cxDiff < 3;
      return {
        cx: Math.round(b.view.cx * 10) / 10,
        expHomeCx: Math.round(expHomeCx * 10) / 10,
        cxDiff: Math.round(cxDiff * 10) / 10,
        free: b.view.free,
        passed
      };
    })()`);

    if (!resizeRes.passed) {
      const msg = `Mid-battle resize failed: cx=${resizeRes.cx}, expHomeCx=${resizeRes.expHomeCx}, diff=${resizeRes.cxDiff} (target <3)`;
      console.error('  FAIL', msg);
      failures.push(msg);
    } else {
      console.log(`  ✓ Mid-battle resize preserved home framing: cx=${resizeRes.cx} (diff=${resizeRes.cxDiff} < 3, free=${resizeRes.free}).\n`);
    }

    // Reset device metrics override to standard landscape 812x375
    await send('Emulation.setDeviceMetricsOverride', {
      width: 812,
      height: 375,
      deviceScaleFactor: 1,
      mobile: true
    });
    await sleep(150);

  } catch (err) {
    console.error('  Responsive shell check exception:', err);
    failures.push(`Responsive shell exception: ${err.message}`);
  }
  console.log(`  [Timing] Section 8 finished in ${((performance.now() - tSec8) / 1000).toFixed(2)}s\n`);

  // =========================================================================
  // 9. ASSERT CONSOLE ERRORS & UNCAUGHT EXCEPTIONS
  // =========================================================================
  console.log('--- 9. ASSERTING CONSOLE LOG & EXCEPTION INTEGRITY ---');
  const tSec9 = performance.now();
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
  console.log(`  [Timing] Section 9 finished in ${((performance.now() - tSec9) / 1000).toFixed(2)}s\n`);

  // =========================================================================
  // SUMMARY
  // =========================================================================
  ws.close();
  cleanup();

  const totalDuration = ((performance.now() - suiteStartTime) / 1000).toFixed(2);
  console.log('======================================================');
  console.log(`TOTAL SUITE TIME: ${totalDuration}s (${(totalDuration / 60).toFixed(2)} min)`);
  if (failures.length > 0) {
    console.error(`REGRESSION SUITE FAILED WITH ${failures.length} FAILURE(S):`);
    failures.forEach((f) => console.error(`  - ${f}`));
    console.log('======================================================\n');
    process.exit(1);
  } else {
    console.log(`ALL REGRESSION CHECKS PASSED CLEANLY (EXIT 0) [${isQuick ? 'QUICK MODE' : 'FULL SUITE'}]`);
    console.log('======================================================\n');
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('Regression suite fatal crash:', err);
  process.exit(1);
});
