#!/usr/bin/env node
// Gate and screenshot one level JSON file in the real game through the sandbox slot (level 99); the slot is restored afterwards.
// usage: node tools/gate_file.mjs <level.json> <screenshot.png> [minShots=2] [maxShots=5]   (dev server on :5212)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [file, shot, minS = '2', maxS = '5'] = process.argv.slice(2);
const slot = path.join(root, 'game/public/data/levels/level_99.json');
const backup = fs.readFileSync(slot);
const probe = path.join(root, 'tools/probe.mjs');
const level = JSON.parse(fs.readFileSync(file, 'utf8'));
const loadout = JSON.stringify(level.loadout ?? ['w_iron_cleaver', 'w_ashwood_staff', 'w_hunters_pike', 'w_blast_tube', 'w_scrapheap_scattergun', 'w_hunters_boomerang']);
const expr = `(async()=>{
  const n=99, mm=window.__mm; const loadout=${loadout};
  mm.load(n,loadout);
  const start=mm.battle(), b0=start.ents.filter(e=>e.kind==='block').map(e=>({x:e.body.position.x,y:e.body.position.y}));
  mm.run(300);
  const still=start.ents.filter(e=>e.kind==='block');
  const moved=b0.filter((p,i)=>!still[i]||Math.hypot(still[i].body.position.x-p.x,still[i].body.position.y-p.y)>2).length;
  const dead=start.ents.filter(e=>e.kind==='monster'&&e.dead).map(e=>e.type);
  const sweep=mm.sweep(n,loadout), best=sweep.best; mm.play(n,loadout,[best]);
  const fin=mm.battle().ents.filter(e=>e.kind==='block');
  const col=b0.filter((p,i)=>{const e=fin[i];return !e||e.dead||Math.hypot(e.body.position.x-p.x,e.body.position.y-p.y)>8;}).length;
  let solved; for(let i=0;i<12;i++){ solved=mm.solveStep(n,loadout,15000); if(solved.done)break; }
  const boss=solved?.view?.ents?.find(e=>e.kind==='monster'&&e.type.match(/sovereign|giant|tyrant|warlord|chief|matron/));
  return JSON.stringify({moved,dead,collapse:b0.length?Math.round(col*1000/b0.length)/10:0,shots:solved?.shots?.length??0,won:!!solved?.view?.won,bossHpLeft:boss?Math.round(boss.hp):null,blocks:b0.length});
})()`;
let code = 0;
try {
  fs.copyFileSync(file, slot);
  const g = spawnSync(process.execPath, [probe, expr], { cwd: root, encoding: 'utf8', timeout: 300000 });
  const r = JSON.parse(g.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1));
  spawnSync(process.execPath, [probe, `(async()=>{window.__mm.load(99,['w_militia_blade']);return 1})()`], { cwd: root, encoding: 'utf8', env: { ...process.env, SHOT: path.resolve(shot) } });
  console.log(JSON.stringify(r));
  const pass = r.moved === 0 && r.dead.length === 0 && r.collapse >= 40 && r.won && r.shots >= Number(minS) && r.shots <= Number(maxS);
  console.log(pass ? 'PASS' : 'FAIL');
  code = pass ? 0 : 1;
} finally {
  fs.writeFileSync(slot, backup);
}
process.exit(code);
