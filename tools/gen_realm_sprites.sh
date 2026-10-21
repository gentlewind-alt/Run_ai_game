#!/bin/bash
# Generates realm 4 monster sprites and the next two relic weapon icons with the RUN CLI (90 credits each), spaced and retried for the rate limit.
# usage (repo root): bash tools/gen_realm_sprites.sh
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
ICE="#12131f,#eceef6,#a9b1c6,#41a6f6,#8af0f8,#6d768e,#3e445d,#ffffff"
gen frost_wolf "$ICE" "snarling white and pale blue frost wolf in side view, running pose, icy fur with cyan highlights, glowing blue eyes, dark outline, game monster sprite"
gen ice_golem "$ICE" "hulking ice golem made of stacked glacier blocks with a glowing cyan core in its chest, frosty cracks, front view, dark outline, game monster sprite"
gen frost_giant "$ICE" "huge frost giant boss with a horned helmet of ice, white blue beard, fur cloak and a glowing blue crystal in its chest, front view, dark outline, game boss sprite"
gen w_brahmastra_arrow "#12131f,#ffd27a,#fff0b0,#ffffff,#c8864f,#f08a52,#a9b1c6,#3e445d" "ornate golden arrow with a radiant white-gold glowing tip and a faint ring of glowing glyphs around it, long feather fletching, pointing diagonally up right, dark outline, game weapon icon"
gen w_omnitrix_dial "#12131f,#1d5a22,#52b04f,#86d874,#eceef6,#3e445d,#6d768e,#a7f070" "round green and black hourglass shaped alien watch dial with a glowing green core and a dark metal ring, game weapon icon"
echo DONE
