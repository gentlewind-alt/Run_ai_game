#!/usr/bin/env bash
# For boss levels: tries candidate seeds from fort_gen until one passes tools/gate_level.mjs. usage: bash tools/seed_search.sh 12 20 24
for N in "$@"; do
  P=$(printf %02d $N); F=game/public/data/levels/level_$P.json
  for S in 2 3 4 5 6 7 8 9 10 11 12; do
    (cd game && python scripts/build_levels.py --candidates --satellites --seed $S > /dev/null 2>&1)
    cp game/scripts/generated/level_${P}_candidate.json $F
    R=$(node tools/gate_level.mjs $N 2>&1 | tail -1)
    git checkout -- $F
    echo "L$N seed $S $R"
    echo "$R" | grep -q '"standStill":{"moved":0,"dead":0}' && echo "$R" | grep -qE '"pct":(4[0-9]|[5-9][0-9]|100)' && echo "$R" | grep -q '"won":true' && { bash -c "! node tools/gate_level.mjs $N >/dev/null 2>&1" ; echo "PASS? L$N seed $S"; break; }
  done
done
