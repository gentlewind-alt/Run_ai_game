#!/usr/bin/env node
// Generate levels with game/scripts/level_gen.py, gate each in the real game (stand-still, collapse, solver band) and screenshot it.
// usage: node tools/level_review.mjs <round-name> [realms=frost,ember,sky] [archetypes=all] [seeds=1] [difficulty=2]
// Output: docs/handoff/shots/levelgen/<round>/*.png, a contact sheet and results.json. Dev server must run on :5212.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [round = 'r1', realmsArg = 'frost,ember,sky', archArg = 'all', seedsArg = '1', diff = '2'] = process.argv.slice(2);
const realms = realmsArg.split(',');
const archs = archArg === 'all' ? ['tower', 'balanced_beam', 'hanging_weight', 'bomber_relay'] : archArg.split(',');
const seeds = seedsArg.split(',').map(Number);
const out = path.join(root, 'docs/handoff/shots/levelgen', round);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
// make sure the dev server is up (it has died between runs before)
const up = async () => { try { return (await fetch('http://localhost:5212/')).ok; } catch { return false; } };
if (!(await up())) {
  const { spawn } = await import('node:child_process');
  spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--port', '5212', '--strictPort'], { cwd: path.join(root, 'game'), detached: true, stdio: 'ignore', shell: true }).unref();
  for (let i = 0; i < 40 && !(await up()); i++) await new Promise((r) => setTimeout(r, 500));
  if (!(await up())) { console.error('dev server did not start'); process.exit(1); }
}
const slot = path.join(root, 'game/public/data/levels/level_99.json');
const backup = fs.readFileSync(slot);
const probe = path.join(root, 'tools/probe.mjs');
const BAND = [2, 5];
const diffFor = (arch) => { const m = Object.fromEntries(diff.split(',').filter((x) => x.includes(':')).map((x) => x.split(':'))); return m[arch] ?? (diff.includes(':') ? '2' : diff); };

const gateExpr = `(async()=>{
  const n=99, mm=window.__mm; const loadout=['w_iron_cleaver','w_ashwood_staff','w_hunters_pike','w_blast_tube','w_scrapheap_scattergun','w_hunters_boomerang'];
  mm.load(n,loadout);
  const start=mm.battle(), blocks0=start.ents.filter(e=>e.kind==='block').map(e=>({x:e.body.position.x,y:e.body.position.y}));
  mm.run(300);
  const still=start.ents.filter(e=>e.kind==='block');
  const moved=blocks0.filter((p,i)=>!still[i]||Math.hypot(still[i].body.position.x-p.x,still[i].body.position.y-p.y)>2).length;
  const dead=start.ents.filter(e=>e.kind==='monster'&&e.dead).length;
  const sweep=mm.sweep(n,loadout), best=sweep.best;
  mm.play(n,loadout,[best]);
  const fin=mm.battle().ents.filter(e=>e.kind==='block');
  const col=blocks0.filter((p,i)=>{const e=fin[i];return !e||e.dead||Math.hypot(e.body.position.x-p.x,e.body.position.y-p.y)>8;}).length;
  let solved; for(let i=0;i<12;i++){ solved=mm.solveStep(n,loadout,15000); if(solved.done)break; }
  return JSON.stringify({moved,dead,collapse:blocks0.length?Math.round(col*1000/blocks0.length)/10:0,shots:solved?.shots?.length??0,won:!!solved?.view?.won,score:solved?.view?.score??0,blocks:blocks0.length});
})()`;
const shotExpr = `(async()=>{window.__mm.load(99,['w_militia_blade']);return 1})()`;

const run = (args, env = {}) => spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', timeout: 300000, env: { ...process.env, ...env } });
const results = [];
try {
  for (const realm of realms) for (const arch of archs) for (const seed of seeds) {
    const name = `${realm}_${arch}_s${seed}`;
    const file = path.join(root, 'game/scripts/generated_levels', `${name}.json`);
    const gen = spawnSync('python', ['scripts/level_gen.py', '--realm', realm, '--archetype', arch, '--seed', String(seed), '--difficulty', diffFor(arch), '--out', file], { cwd: path.join(root, 'game'), encoding: 'utf8' });
    if (gen.status !== 0) { results.push({ name, error: (gen.stderr || '').trim().split('\n').pop() }); console.log(name, 'GEN FAIL', results.at(-1).error); continue; }
    fs.copyFileSync(file, slot);
    const g = run([probe, gateExpr]);
    let r; try { r = JSON.parse(g.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1)); } catch { r = { error: 'probe failed' }; }
    run([probe, shotExpr], { SHOT: path.join(out, `${name}.png`) });
    if (!r.error) r.pass = r.moved === 0 && r.dead === 0 && r.collapse >= 40 && r.won && r.shots >= BAND[0] && r.shots <= BAND[1];
    results.push({ name, ...r });
    console.log(name, JSON.stringify(r));
  }
} finally {
  fs.writeFileSync(slot, backup);
}
fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
const sheet = spawnSync('powershell', ['-NoProfile', '-File', 'tools/concept_sheet.ps1', out, path.join(out, '_sheet.png'), '4'], { cwd: root, encoding: 'utf8' });
console.log(sheet.stdout.trim());
console.log(`pass ${results.filter((x) => x.pass).length}/${results.length}`);
