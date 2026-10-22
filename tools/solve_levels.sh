#!/usr/bin/env bash
# Greedy-solver summary for the given levels with the level's own loadout (or the regress default): shots used, won, boss hp left.
# usage: bash tools/solve_levels.sh 4 8 12   (dev server on :5212)
for L in "$@"; do
  node tools/probe.mjs "(async()=>{const mm=window.__mm;const lo=['w_militia_blade','w_iron_cleaver','w_ashwood_staff','w_hunters_pike','w_scrapheap_scattergun','w_blast_tube'];let r;for(let i=0;i<12;i++){r=mm.solveStep($L,lo,15000);if(r.done)break}const boss=r.view.ents.find(e=>e.kind==='monster'&&(e.type.includes('warlord')||e.type.includes('giant')||e.type.includes('tyrant')||e.type.includes('sovereign')||e.type.includes('chief')||e.type.includes('matron')));return JSON.stringify({L:$L,shots:r.shots.length,won:r.view.won,left:r.view.monsters,boss:boss?Math.round(boss.hp):null})})()" 2>&1 | grep '^{'
done
