// Focused real-browser acceptance for the modular Forge. Start Vite on 5212 first.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const dir = mkdtempSync(join(tmpdir(), 'mm-forge-'));
const chrome = spawn(process.env.CHROME_BIN ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', '--remote-debugging-port=9367', '--disable-gpu', '--no-first-run', '--window-size=960,540', `--user-data-dir=${dir}`, 'about:blank',
], { stdio: 'ignore' });
let ws;
let sequence = 0;
const pending = new Map();
const errors = [];
try {
  for (let i = 0; i < 60; i++) {
    try {
      const tabs = await (await fetch('http://127.0.0.1:9367/json')).json();
      const page = tabs.find((tab) => tab.type === 'page');
      if (page) { ws = new WebSocket(page.webSocketDebuggerUrl); break; }
    } catch { /* browser starting */ }
    await delay(150);
  }
  if (!ws) throw Error('Browser did not start');
  await new Promise((r) => { ws.onopen = r; });
  ws.onmessage = ({ data }) => {
    const m = JSON.parse(data);
    if (m.id) { pending.get(m.id)?.(m); pending.delete(m.id); }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.args[0]?.value === 'FORGE_PASS') console.log('PASS', m.params.args[1]?.value);
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
  };
  const send = (method, params = {}) => new Promise((r) => { const id = ++sequence; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
  const evaluate = async (expression) => {
    const m = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (m.error || m.result.exceptionDetails) throw Error(JSON.stringify(m.error ?? m.result.exceptionDetails));
    return m.result.result.value;
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:5212/?mock=1&debug=1' });
  let ready = false;
  for (let i = 0; i < 60; i++) {
    ready = await evaluate('!!(window.__mm && window.__game?.scene.isActive("title"))');
    if (ready) break;
    await delay(150);
  }
  if (!ready) throw Error('Game did not boot: ' + errors.join(' | ') + ' ' + await evaluate('JSON.stringify({url:location.href,title:document.title,body:document.body.innerText.slice(0,1000),scenes:window.__game?.scene.getScenes(true).map(s=>s.scene.key)})'));  
  await evaluate("window.__mm.profile().owned.weapons = ['w_militia_blade']; window.__game.scene.stop('title'); window.__game.scene.start('forge'); true");
  await delay(700);
  const click = async (x, y) => {
    const rect = await evaluate('(()=>{const r=document.querySelector("canvas").getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})()');
    const p = { x: rect.x + x / 480 * rect.w, y: rect.y + y / 270 * rect.h, button: 'left', clickCount: 1 };
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...p });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...p });
    await delay(100);

  };
  await click(158, 190); // spear
  await click(98, 43); await click(211, 84); await click(158, 119); // curse / venom
  await click(159, 43); await click(158, 108); // rain
  await click(220, 43); await click(58, 182); // green
  await click(396, 252);
  await delay(150);
  const ui = await evaluate(`(async()=>{
    const f=await import('/src/core/forge.ts');
    await f.loadForge();
    if(!window.__mm.profile().owned.weapons.includes('w_forge_spear'))throw Error('Save did not grant ownership');
    const r=f.forgeRecipe('w_forge_spear');
    if(r.abilityId!=='rain'||r.traitId!=='poison'||r.radianceId!=='green')throw Error('Real pointer choices did not save: '+JSON.stringify(r));
    await f.loadForge();
    if(JSON.stringify(f.forgeRecipe(r.weaponId))!==JSON.stringify(r))throw Error('Recipe reload mismatch');
    return r;
  })()`);
  console.log('PASS real pointer selection, save and store reload', JSON.stringify(ui));
  const shotDir = resolve('docs/handoff/shots'); mkdirSync(shotDir, { recursive: true });
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(shotDir, 'forge_saved.png'), Buffer.from(screenshot.result.data, 'base64'));

  const result = await evaluate(`(${browserChecks.toString()})()`);
  await evaluate(`(async()=>{
    const {data}=await import('/src/data/load.ts');
    (await import('/src/core/profile.ts')).profile.flags.tut_off=true; // the how-to cards would cover the buttons
    data.levels[98]={...data.levels[5],id:98,shots:6};delete data.levels[98].loadout;
    window.__game.scene.start('loadout',{level:98});return true;
  })()`);
  await delay(700);
  await evaluate(`(()=>{
    const s=window.__game.scene.getScene('loadout');
    s.slots=['w_militia_blade','w_forge_spear','w_militia_blade','w_forge_spear','w_militia_blade','w_forge_spear'];
    s.equipped=['r_gale_eye'];s.refresh();return true;
  })()`);
  await click(132,13);await delay(700);
  if(!await evaluate("window.__game.scene.isActive('forge')"))throw Error('Loadout Forge entry failed');
  await click(59,252);await delay(700);
  const preserved=await evaluate(`(()=>{
    const s=window.__game.scene.getScene('loadout');
    return window.__game.scene.isActive('loadout')&&s.slots[1]==='w_forge_spear'&&s.slots[3]==='w_forge_spear'&&s.equipped.includes('r_gale_eye');
  })()`);
  if(!preserved)throw Error('Forge round trip lost loadout choices');
  console.log('PASS real pointer Loadout / Forge / Back preserves weapon order and artifacts');
  await evaluate(`(async()=>{
    const{data}=await import('/src/data/load.ts');delete data.levels[98];
    window.__game.scene.stop('loadout');window.__game.scene.start('forge');return true;
  })()`);
  await delay(700);
  await send('Emulation.setDeviceMetricsOverride',{width:812,height:375,deviceScaleFactor:1,mobile:true});
  await delay(200);
  await evaluate(`(()=>{const s=window.__game.scene.getScene('forge');s.tab='Ability';s.recipe={weaponId:'w_forge_spear',traitId:'poison',abilityId:'rain',radianceId:'green'};s.render();return true})()`);
  await delay(200);
  const narrow=await send('Page.captureScreenshot',{format:'png'});
  writeFileSync(join(shotDir,'forge_phone.png'),Buffer.from(narrow.result.data,'base64'));
  if(!await evaluate("document.getElementById('rotate-overlay').classList.contains('hidden')"))throw Error('Landscape phone view is obscured');
  console.log('PASS narrow landscape editor renders with usable controls');
  console.log(`Completed ${result.length + 3} Forge acceptance groups`);
  if (errors.length) throw Error(errors.join('\n'));
  console.log('PASS zero browser exceptions or console errors');
} finally {
  ws?.close();
  if (chrome.pid) await new Promise((r) => {
    if (process.platform === 'win32') spawn('taskkill', ['/F', '/T', '/PID', String(chrome.pid)], { stdio: 'ignore' }).once('exit', r);
    else { chrome.kill(); r(); }
  });
  await delay(200);
  if (dirname(resolve(dir)) !== resolve(tmpdir()) || !basename(dir).startsWith('mm-forge-')) throw Error('Unexpected browser profile path');
  rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
}

async function browserChecks() {
  const f = await import('/src/core/forge.ts');
  const { data } = await import('/src/data/load.ts');
  const D = await import('/src/battle/damage.ts');
  const { forgeHit } = await import('/src/battle/forgeHits.ts');
  const { MatterLib: M } = await import('/src/battle/matter.ts');
  const { darkElfMatron } = await import('/src/content/monsters/darkElfMatron.ts');
  const { setProfile } = await import('/src/core/profile.ts');
  const mm = window.__mm;
  const game = window.__game;
  const assert = (test, why) => { if (!test) throw Error(why); };
  const passed = [];
  const pass = (value) => { passed.push(value); console.log('FORGE_PASS',value); };
  const oldLevel = data.levels[99];
  const oldProfile = JSON.parse(JSON.stringify(mm.profile()));
  const campaign = () => JSON.stringify({ version: mm.profile().version, stars: mm.profile().stars, best: mm.profile().best, upgrades: mm.profile().upgrades, daily: mm.profile().daily });
  const campaignBefore = campaign();
  mm.profile().equipped.artifacts = [];
  mm.profile().equipped.slingSkin = undefined;
  function arena(id) {
    data.levels[99] = { id: 99, name: 'Forge acceptance', realm: data.content.realms[0].id, kind: 'siege', worldW: 640, shots: 2,
      loadout: [id, id], blocks: [{ m: 'wood', x: 350, y: 300, w: 12, h: 40 }],
      monsters: [{ t: 'goblin_grunt', x: 320, y: 310 }, { t: 'goblin_grunt', x: 390, y: 310 }] };
    mm.load(99, [id, id]);
    const b = mm.battle(); b.custom = true;
    b.hitStop = 0;
    for (const e of b.ents) { e.hp = 1000; e.maxHp = 1000; e.shield = 0; }
    return b;
  }
  const recipe = (id, abilityId = 'dance', traitId = 'balanced') => ({ weaponId: id, abilityId, traitId, radianceId: 'blue' });
  const id = 'w_forge_sword';
  try {
    for (const w of data.forge.weapons) for (const a of data.forge.abilities) for (const t of data.forge.traits) for (const r of data.forge.radiances) {
      const def = f.compileForgeRecipe({ weaponId: w.id, abilityId: a.id, traitId: t.id, radianceId: r.id });
      assert(Number.isFinite(def.baseDamage) && def.forge.abilityId === a.id, 'Recipe compilation failed');
    }
    pass('4,860 valid weapon/ability/trait/aura combinations compile');
    let damaged = 0;
    for (const w of data.forge.weapons) for (const a of data.forge.abilities) {
      await f.saveForgeRecipe(recipe(w.id, a.id));
      const b = arena(w.id);
      const target = b.ents.find((e) => e.kind === 'monster');
      mm.fire({ angleDeg: 25, power: 0.7 });
      M.Body.setPosition(b.proj.body, { x: 280, y: 294 });
      mm.activateAbility();
      assert(b.actors.filter((x) => x.body?.label === 'proj').length <= data.forge.limits.maxCopies, 'Copy cap exceeded');
      for (const child of game.scene.getScene('game').children.list) {
        if (child.texture?.key?.startsWith('wpn_w_forge_')) assert(child.texture.key === 'wpn_' + w.id, 'Ability used wrong body artwork');
      }
      mm.run(330);
      if (target.hp < 1000 || b.ents.some((e) => e.hp < 1000)) damaged++;
      assert(b.actors.filter((x) => x.pos).length === 0 && !b.proj, `Ability did not finish: ${w.id}/${a.id}`);
      assert(b.ents.every((e) => Number.isFinite(e.hp)), 'Nonfinite damage');
    }
    assert(damaged === 54, `Only ${damaged}/54 body/ability pairs caused damage`);
    pass('54 real battles: correct weapon art, damage, bounded copies, no stuck abilities');

    for (const mode of ['direct', 'blast', 'collision']) {
      const losses = [];
      for (const trait of ['balanced', 'overcharge']) {
        await f.saveForgeRecipe(recipe(id, 'clone', trait));
        const b = arena(id);
        const e = b.ents.find((x) => x.kind === 'monster');
        if (mode === 'direct') D.directHit(b, e, id, 1, e.body.position.x, e.body.position.y, false);
        if (mode === 'blast') D.blast(b, e.body.position.x, e.body.position.y, 10, 1, id);
        if (mode === 'collision') {
          mm.fire({ angleDeg: 25, power: 0.7 }); b.proj.tapped = true; b.proj.data.forgeActivated = true;
          D.onCollide(b, { pairs: [{ bodyA: b.proj.body, bodyB: e.body, collision: { supports: [{ ...e.body.position }] } }] });
        }
        losses.push(1000 - e.hp);
      }
      assert(losses[0] > 0 && Math.abs(losses[1] / losses[0] - 2) < 0.001, `Overcharge mismatch on ${mode}: ${losses}`);
    }
    pass('Overcharge applies exactly once to direct hits, blasts and collisions');
    {
      await f.saveForgeRecipe(recipe(id,'burst'));
      const b=arena(id),e=b.ents.find(x=>x.kind==='monster');
      mm.fire({angleDeg:25,power:0.7});
      const body=b.proj.body;M.Body.setPosition(body,{...e.body.position});
      const pair={bodyA:body,bodyB:e.body,collision:{supports:[{...e.body.position}]}};
      D.onCollide(b,{pairs:[pair,pair]});
      const expected=b.forgeWeapons[id].baseDamage*b.rules.globalScale*1.15;
      assert(Math.abs((1000-e.hp)-expected)<0.001,'Ended main shot dealt duplicate collision damage');
    }
    pass('Ended main Forge shots ignore remaining contacts in the same physics step');

    await f.saveForgeRecipe(recipe(id, 'strike'));
    {
      const b = arena(id), e = b.ents.find((x) => x.kind === 'monster');
      mm.fire({ angleDeg: 25, power: 0.7 });
      D.onCollide(b, { pairs: [{ bodyA: b.proj.body, bodyB: e.body, collision: { supports: [{ ...e.body.position }] } }] });
      assert(e.hp < 1000, 'Automatic Strike discarded its impact');
      assert(!b.wdef.ability.charges, 'Forge incorrectly shares charges across shots');
    }
    pass('Strike delivers its automatic first impact; powers are available per shot');
    {
      await f.saveForgeRecipe(recipe(id, 'burst'));
      const b = arena(id);
      b.loadout = ['w_militia_blade', id]; b.mods.twinFraction = 0.45; b.mods.twinDelaySteps = 2;
      mm.fire({ angleDeg: 25, power: 0.7 });
      const main = b.proj;
      mm.run(2);
      const actor = b.actors.find((a) => a.body?.proj?.forgeProj);
      assert(actor, 'Gemini Forge twin not spawned');
      const e = b.ents.find((x) => x.kind === 'monster');
      M.Body.setPosition(actor.body, {...e.body.position});
      D.onCollide(b, {pairs:[{bodyA:actor.body,bodyB:e.body,collision:{supports:[{...e.body.position}]}}]});
      const expected = b.forgeWeapons[id].baseDamage * b.rules.globalScale * 1.15 * 0.45;
      assert(Math.abs((1000-e.hp)-expected)<0.001, 'Gemini burst did not retain reduced damage: '+(1000-e.hp)+'/'+expected);
      assert(b.proj===main && actor.body.proj.forgeProj.data.ended, 'Twin power ended the main projectile');
      mm.run(b.hitStop + 2);
      assert(!b.actors.includes(actor), 'Ended Gemini twin was not cleaned up');
      const velocities=[];
      for (const trait of ['balanced','reach']) {
        await f.saveForgeRecipe(recipe(id,'clone',trait));
        const b=arena(id); mm.fire({angleDeg:25,power:0.7}); mm.activateAbility();
        velocities.push(b.actors.find(a=>a.body?.label==='proj').body.velocity.x);
      }
      assert(Math.abs(velocities[1]/velocities[0]-1.3)<0.001,'Long Reach did not extend Clone flight');
    }
    pass('Gemini preserves reduced-power Forge abilities; Long Reach extends Clone');

    await f.saveForgeRecipe(recipe(id, 'burst', 'shieldbreak'));
    {
      const b = arena(id), e = b.ents.find((x) => x.kind === 'monster');
      e.behavior = darkElfMatron; e.params.shieldActive = 1; e.shield = 99999;
      D.directHit(b, e, id, 1, e.body.position.x, e.body.position.y, false);
      assert(e.hp < 1000 && e.shield === 0 && e.status.shieldBreak > 0, 'Unshield did not disable Matron magic');
    }
    pass('Unshield removes shields and bypasses Matron invulnerability');
    await f.saveForgeRecipe(recipe(id, 'clone', 'poison'));
    {
      const b = arena(id), e = b.ents.find((x) => x.kind === 'monster');
      e.hp = 2;
      forgeHit(b, e, id, 1, e.body.position.x, e.body.position.y, { strong: false, tag: 'norm' });
      mm.run(35);
      assert(e.dead && e.params.poisonWeaponId === id && b.coins > 0, 'Poison did not finish and credit its kill');
    }
    pass('Venom ticks, kills, and retains weapon attribution');
    await f.saveForgeRecipe(recipe(id, 'clone', 'fortune'));
    {
      const b = arena(id), e = b.ents.find((x) => x.kind === 'monster');
      const expected = Math.round((b.tune.coins[e.type] ?? b.tune.coins.monster) * 2);
      e.hp = 1;
      D.directHit(b, e, id, 1, e.body.position.x, e.body.position.y, false);
      assert(b.coins === expected, `Fortune coin mismatch ${b.coins}/${expected}`);
    }
    pass('Fortune doubles only attributed kill coins');
    await f.saveForgeRecipe(recipe(id, 'clone', 'zap'));
    {
      const b = arena(id), e = b.ents.find((x) => x.kind === 'monster');
      e.dead = true;
      const before = b.ents.map((x) => x.hp);
      forgeHit(b, e, id, 50, 320, 310, { strong: false, tag: 'norm' });
      assert(b.ents.every((x, i) => x.hp === before[i]), 'Dead target retriggered Conduct');
    }
    pass('Conduct cannot recurse through dead targets');

    {
      const b = arena(id);
      mm.fire({ angleDeg: 25, power: 0.7 });
      M.Body.setPosition(b.proj.body, { x: 270, y: 260 });
      M.Body.setVelocity(b.proj.body, { x: 0, y: 0 });
      assert(b.ctx.spawnEnemyAttack({ x: 284, y: 260, color: 0xffffff }), 'Enemy attack unavailable');
      const a = b.actors.find((x) => x.body?.label === 'enemyAttack');
      assert(a && !a.pos && a.body.mass > 0, 'Enemy attack lacks real mass or blocks turns');
      const monster = b.ents.find((e) => e.kind === 'monster');
      assert(!M.Detector.canCollide(a.body.collisionFilter, monster.body.collisionFilter), 'Enemy shot hits monsters');
      assert(M.Detector.canCollide(a.body.collisionFilter, b.proj.body.collisionFilter), 'Enemy shot misses weapons');
      mm.run(8);
      assert(Math.abs(b.proj?.body.velocity.x ?? 0) > 0.01, 'Enemy shot did not impart physical impulse');
    }
    pass('Enemy attacks have mass, push player weapons, ignore monsters and do not hold turns');
    {
      const b = arena(id);
      let detonated = 0;
      b.ctx.spawnPellet({ x: 300, y: 260, vx: 0, vy: 0, radius: 2, density: 0.001, wid: id, mul: 1, color: 'c', onEnd: () => { detonated++; } });
      game.scene.stop('game'); mm.run(1);
      assert(detonated === 0 && b.actors.length === 0, 'Battle cancellation triggered a live pellet callback');
    }
    pass('Retry/map cleanup cancels pellets without explosions or rewards');
    {
      const snapshot = f.forgeSnapshot();
      const before = JSON.stringify(snapshot[id]);
      await f.saveForgeRecipe(recipe(id, 'rain'));
      assert(JSON.stringify(snapshot[id]) === before, 'Saved edit mutated an existing battle snapshot');
      const previous = JSON.stringify(f.forgeRecipes());
      const storage = mm.platform().storage;
      const original = storage.set;
      storage.set = async () => { throw Error('Acceptance simulated storage failure'); };
      let failed = false;
      try { await f.saveForgeRecipe(recipe(id, 'burst')); } catch { failed = true; }
      storage.set = original;
      assert(failed && JSON.stringify(f.forgeRecipes()) === previous, 'Failed save changed recipe');
      await Promise.all([f.saveForgeRecipe(recipe(id, 'clone')), f.saveForgeRecipe(recipe('w_forge_spear', 'spirit'))]);
      await f.loadForge();
      assert(f.forgeRecipe(id).abilityId === 'clone' && f.forgeRecipe('w_forge_spear').abilityId === 'spirit', 'Concurrent saves lost a build');
    }
    pass('Battle snapshots, failed saves and concurrent saves preserve prior state');

    {
      data.levels[99].overrides={features:{weaponForge:false}};
      mm.load(99,[id,id]);
      const b=mm.battle(); b.custom=true;
      assert(b.loadout.every(w=>!f.isForgeWeapon(w))&&!b.wdef.forge,'Disabled Forge still executes crafted powers');
      const R=await import('/src/battle/rules.ts'); b.state='lost';
      assert(!R.grantShots(b,[id]),'Extra shots bypass disabled Forge');
      const storage=mm.platform().storage;const saved=await storage.get('monster-mash.forge.v1');
      await storage.set('monster-mash.forge.v1',JSON.stringify({version:1,recipes:[{weaponId:'unknown'},null]}));
      await f.loadForge();assert(f.forgeRecipes().length===0,'Invalid saved recipe survived validation');
      await storage.set('monster-mash.forge.v1',saved);await f.loadForge();
    }
    pass('Disabled Forge rejects crafted and extra shots; malformed builds load safely');
    assert(campaign() === campaignBefore, 'Forge acceptance changed campaign progress');
    {
      // forging costs coins: refused when poor, charged exactly once, half price to change a saved build
      await mm.platform().storage.set('monster-mash.forge.v1',JSON.stringify({version:1,recipes:[]}));await f.loadForge();
      const p=mm.profile(); const keep=p.coins; const rec={weaponId:'w_forge_dagger',traitId:'critical',abilityId:'strike',radianceId:'gold'};
      p.coins=100; let denied=''; try{await f.saveForgeRecipe(rec);}catch(e){denied=e.message;}
      assert(denied==='Not enough coins.'&&p.coins===100,'A poor player was not refused or was charged');
      const price=f.forgePrice(rec); assert(price===f.forgeCost(rec).total&&price>=300,'A new build is not full price');
      p.coins=price+25; await f.saveForgeRecipe(rec);
      assert(p.coins===25&&f.forgePrice(rec)===0,'Forging did not charge exactly the price');
      const change={...rec,abilityId:'phantom'};
      assert(f.forgePrice(change)===Math.round(f.forgeCost(change).total*0.5),'Changing a saved build is not half price');
      const prices=new Set(['w_forge_dagger','w_forge_sword','w_forge_cleaver','w_forge_double_sword'].map(w=>f.forgeCost({...rec,weaponId:w}).total));
      assert(prices.size===4,'Different weapons should cost different amounts');
      p.coins=keep;
    }
    pass('Forging costs coins: refused when poor, charged once, half price to change, prices differ per build');
    pass('Campaign save version, coins, upgrades, stars, daily data and scores unchanged');
    return passed;
  } finally {
    data.levels[99] = oldLevel;
    game.scene.stop('game');
    setProfile(oldProfile);
  }
}
