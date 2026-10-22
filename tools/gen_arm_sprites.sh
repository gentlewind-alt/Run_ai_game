#!/bin/bash
# Generates the five Omnitrix Dial forearm sprites with the RUN CLI (90 credits each), spaced and retried for the rate limit.
# usage (repo root): bash tools/gen_arm_sprites.sh
R="$LOCALAPPDATA/Programs/Rundot/rundot.exe"
OUT=docs/handoff/shots/gen
mkdir -p "$OUT"
gen() {
  local name="$1" cols="$2" prompt="$3"
  [ -f "$OUT/$name.png" ] && { echo "skip $name (exists)"; return; }
  for try in 1 2 3 4 5 6; do
    msg=$("$R" generate sprite --prompt "$prompt" --pixel --bg transparent --style "16-bit SNES" --colors "$cols" --out "$OUT/$name.png" 2>&1 | sed 's/\x1b\[[0-9;]*m//g')
    if [ -f "$OUT/$name.png" ]; then echo "ok $name: $(echo "$msg" | grep -E 'Used' | head -1)"; sleep 35; return; fi
    echo "retry $name ($try): $(echo "$msg" | tail -1)"
    sleep 40
  done
  echo "FAILED $name"
}
gen omni_arm_fire "#12131f,#b13e53,#ef7d57,#ffcd75,#fff0b0,#5d275d,#3e445d,#6d768e" "giant red alien forearm and clawed fist pointing straight down, muscular, glowing orange cracks, vertical full arm from elbow to fist, dark outline, game sprite"
gen omni_arm_brute "#12131f,#1f6f3f,#38b764,#a7f070,#5ee0a0,#eceef6,#3e445d,#2e5d34" "giant green alien muscular forearm and huge clenched fist pointing straight down, vertical full arm from elbow to fist, dark outline, game sprite"
gen omni_arm_crystal "#12131f,#257179,#41a6f6,#73eff7,#eceef6,#29366f,#3e445d,#a9b1c6" "giant cyan crystal alien forearm and spiky crystal fist pointing straight down, faceted shards, vertical full arm from elbow to fist, dark outline, game sprite"
gen omni_arm_stone "#12131f,#566c86,#94b0c2,#f4f4f4,#333c57,#6d768e,#a9b4be,#7a8a99" "giant grey stone alien forearm and boulder fist pointing straight down, cracked rock, vertical full arm from elbow to fist, dark outline, game sprite"
gen omni_arm_lightning "#12131f,#ef7d57,#ffcd75,#ffe9a8,#ffffff,#3e445d,#5d275d,#41a6f6" "giant yellow alien forearm crackling with lightning and a sparking fist pointing straight down, vertical full arm from elbow to fist, dark outline, game sprite"
echo DONE
