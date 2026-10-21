#!/bin/bash
# Generates relic weapon sprites with the RUN CLI, spaced out and retried because the API rate-limits (about 24 s between calls).
# usage: tools/gen_relic_sprites.sh   (run from the repo root; skips sprites that already exist; each success costs 90 credits)
R="$LOCALAPPDATA/Programs/Rundot/rundot.exe"
OUT=docs/handoff/shots/gen
mkdir -p "$OUT"
gen() {
  local name="$1" cols="$2" prompt="$3"
  [ -f "$OUT/$name.png" ] && { echo "skip $name (exists)"; return; }
  for try in 1 2 3 4 5 6; do
    msg=$("$R" generate sprite --prompt "$prompt" --pixel --width 32 --height 32 --bg transparent --style "16-bit SNES" --colors "$cols" --out "$OUT/$name.png" 2>&1 | sed 's/\x1b\[[0-9;]*m//g')
    if [ -f "$OUT/$name.png" ]; then echo "ok $name: $(echo "$msg" | grep -E 'Used' | head -1)"; sleep 35; return; fi
    echo "retry $name ($try): $(echo "$msg" | tail -1)"
    sleep 40
  done
  echo "FAILED $name"
}
gen disc "#12131f,#eceef6,#2f4fc2,#41a6f6,#c2415b,#ffd27a,#6b2a5e,#3e445d" "round steel shield disc with concentric rings in blue white and red, small gold crown emblem on a plain gold centre boss, glossy highlight on the upper left rim, dark outline, no star, game weapon icon"
gen arrow "#12131f,#c2415b,#6b2a5e,#c8864f,#8a5232,#a9b1c6,#f08a52,#ffd27a" "red-fletched arrow pointing diagonally up right, three red feathers, wooden shaft, grey steel arrowhead, glowing orange explosive bulb at the tip, dark outline, game weapon icon"
gen shooters "#12131f,#eceef6,#a9b1c6,#6d768e,#3e445d,#c2415b,#6b2a5e,#41a6f6" "armoured wrist bracer web-shooter gauntlet with two red straps and a metal nozzle, white spider web radiating from the nozzle, dark outline, game weapon icon"
gen palms "#12131f,#16224f,#41a6f6,#8af0f8,#ffffff,#6d768e,#a9b1c6,#3e445d" "armoured palm gauntlet open hand facing forward with a glowing cyan circular reactor core in the palm, navy ring with three cyan segments and a white triangle in the middle, dark outline, game weapon icon"
echo DONE
