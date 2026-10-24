#!/usr/bin/env node
// Gate one temporary candidate level on spawn stability, collapse and solver balance.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const levelNumber = Number(process.argv[2]);
if (!Number.isInteger(levelNumber) || levelNumber < 1) {
  console.error('usage: node tools/gate_level.mjs <level-number>');
  process.exit(2);
}

const bands = JSON.parse(fs.readFileSync(path.join(root, 'game/scripts/balance_bands.json'), 'utf8'));
const band = bands[String(levelNumber)];
if (!band) {
  console.error(`no solver band for level ${levelNumber}`);
  process.exit(2);
}

const expression = `(async()=>{
  const n=${levelNumber}, mm=window.__mm, loadout=['w_militia_blade','w_iron_cleaver','w_ashwood_staff','w_hunters_pike','w_scrapheap_scattergun','w_blast_tube'];
  mm.load(n,loadout);
  const start=mm.battle(), blocks0=start.ents.filter(e=>e.kind==='block').map(e=>({x:e.body.position.x,y:e.body.position.y}));
  mm.run(300);
  const still=start.ents.filter(e=>e.kind==='block');
  const moved=blocks0.filter((p,i)=>!still[i]||Math.hypot(still[i].body.position.x-p.x,still[i].body.position.y-p.y)>2).length;
  const dead=start.ents.filter(e=>e.kind==='monster'&&e.dead).length;
  const standStill={moved,dead};
  const sweep=mm.sweep(n,loadout), best=sweep.best;
  mm.play(n,loadout,[best]);
  const finalBlocks=mm.battle().ents.filter(e=>e.kind==='block');
  const collapsed=blocks0.filter((p,i)=>{
    const e=finalBlocks[i];
    return !e||e.dead||Math.hypot(e.body.position.x-p.x,e.body.position.y-p.y)>8;
  }).length;
  const pct=blocks0.length?Math.round(collapsed*1000/blocks0.length)/10:0;
  let solved;
  for(let i=0;i<12;i++){ solved=mm.solveStep(n,loadout,15000); if(solved.done)break; }
  return JSON.stringify({standStill,collapse:{pct},solver:{shots:solved?.shots?.length??0,won:!!solved?.view?.won}});
})()`;

const probe = path.join(root, 'tools/probe.mjs');
const run = spawnSync(process.execPath, [probe, expression], { cwd: root, encoding: 'utf8', timeout: 300000, maxBuffer: 8 * 1024 * 1024 });
if (run.error || run.status !== 0) {
  if (run.stderr?.trim()) process.stderr.write(run.stderr);
  if (run.error) console.error(run.error.message);
  process.exit(run.status ?? 1);
}

let result;
try {
  const output = run.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
  result = JSON.parse(output);
} catch (error) {
  console.error(`probe did not return gate JSON: ${error.message}`);
  if (run.stdout?.trim()) process.stderr.write(run.stdout);
  process.exit(1);
}

console.log(JSON.stringify(result));
const pass = result.standStill.moved === 0 && result.standStill.dead === 0
  && result.collapse.pct >= 40 && result.solver.won
  && result.solver.shots >= band.min && result.solver.shots <= band.max;
process.exit(pass ? 0 : 1);
