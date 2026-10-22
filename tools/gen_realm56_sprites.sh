#!/bin/bash
# Generates realm 5 and 6 monster sprites and six new relic weapon icons with the RUN CLI (90 credits each, 12 total),
# spaced and retried for the API rate limit. usage (repo root): bash tools/gen_realm56_sprites.sh
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
FIRE="#12131f,#5d275d,#b13e53,#ef7d57,#ffcd75,#fff0b0,#3e445d,#6d768e"
SKY="#12131f,#eceef6,#a9b1c6,#41a6f6,#8af0f8,#ffd27a,#6d768e,#3e445d"
gen lava_imp "$FIRE" "small flying lava imp with glowing orange cracks in dark red skin, tiny bat wings and a fire tail, dark outline, game monster sprite"
gen forge_ogre "$FIRE" "heavy forge ogre in a blacksmith apron and an iron mask, molten glowing forearms, holding a hammer, front view, dark outline, game monster sprite"
gen forge_tyrant "$FIRE" "huge forge tyrant boss in blackened iron armour with glowing lava veins and a crown of flames, anvil shaped shoulder plates, front view, dark outline, game boss sprite"
gen cloud_harpy "$SKY" "winged cloud harpy with pale blue feathers and sharp talons, white wing tips, mid flight, dark outline, game monster sprite"
gen storm_mage "$SKY" "storm mage in a pale blue hooded robe holding a staff with a crackling lightning orb, floating slightly above the ground, front view, dark outline, game monster sprite"
gen storm_sovereign "$SKY" "storm sovereign boss, a towering robed sky king with a crown of clouds and a beard of lightning bolts, glowing white eyes, front view, dark outline, game boss sprite"
gen w_hailstorm_cauldron "#12131f,#3e445d,#6d768e,#38b764,#a7f070,#eceef6,#ffcd75,#1d5a22" "small black iron cauldron tipped on its side spilling glowing green stew with floating bubbles, dark outline, game weapon icon"
gen w_rolling_millstone "#12131f,#3e445d,#6d768e,#a9b1c6,#eceef6,#8a5232,#c8864f,#333c57" "round grey millstone with a square hole in the middle and chipped edges, a bit of rope, dark outline, game weapon icon"
gen w_pinata_mirv "#12131f,#b13e53,#ef7d57,#ffcd75,#38b764,#41a6f6,#eceef6,#5d275d" "colourful star shaped pinata bomb with a lit fuse and candy spilling out, dark outline, game weapon icon"
gen w_earthworm_drill "#12131f,#c28b4f,#8b5a2b,#f2a65a,#a9b4be,#566c86,#eceef6,#b13e53" "cartoon armoured earthworm with a spiral drill for a head and a tiny helmet, dark outline, game weapon icon"
gen w_black_hole_marble "#12131f,#5d275d,#7a3b8c,#41a6f6,#8af0f8,#eceef6,#333c57,#ffffff" "glass marble containing a swirling black hole with a purple glowing ring, dark outline, game weapon icon"
gen w_chain_rod "#12131f,#3e445d,#6d768e,#a9b1c6,#41a6f6,#8af0f8,#eceef6,#ffffff" "metal rod with a crackling blue lightning ball on top and chain links hanging from it, dark outline, game weapon icon"
echo DONE
