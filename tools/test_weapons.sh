#!/usr/bin/env bash
# Headless smoke test: every expansion weapon is fired with its ability on level 5 and must deal damage (score > 0)
# and leave the battle in a sane state. Needs the dev server on :5212. usage: bash tools/test_weapons.sh
fail=0
for w in brahmastra_arrow omnitrix_dial pinata_mirv hailstorm_cauldron rolling_millstone earthworm_drill chain_rod black_hole_marble horned_scepter hunters_pike; do
  out=$(node tools/probe.mjs "(async()=>{const mm=window.__mm;mm.load(5,Array(6).fill('w_$w'));mm.fire({angleDeg:42,power:0.85,abilityAfterSteps:34});let v;for(let i=0;i<30;i++)v=mm.settle(20);v=mm.state();return JSON.stringify({s:v.state,sc:v.score,m:v.monsters})})()" 2>&1 | grep "^{")
  sc=$(echo "$out" | sed -E 's/.*"sc":([0-9]+).*/\1/')
  if [ -z "$sc" ] || [ "$sc" -le 0 ]; then echo "FAIL w_$w $out"; fail=1; else echo "ok   w_$w $out"; fi
done
exit $fail
