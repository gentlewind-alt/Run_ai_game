#!/usr/bin/env bash
# Realm backdrops in the style of docs/concepts/realm_*.png: scenery only (no forts, monsters, slingshot or ground strip),
# drawn behind the game's own parallax ridges. 120 credits each. Raw output: docs/concepts/backdrops/<style>.png
# (processed into game/public/sprites/bg/ by the X8 brief). usage: bash tools/gen_backdrops.sh
R="$LOCALAPPDATA/Programs/Rundot/rundot.exe"
OUT=docs/concepts/backdrops
mkdir -p "$OUT"
STYLE="16-bit SNES pixel art background plate for a side-view game, wide panoramic scenery only, NO buildings in the foreground, NO forts, NO towers, NO monsters, NO characters, NO slingshot, NO text, NO UI, empty flat horizon band across the bottom fifth, crisp pixels, limited palette, layered depth"
gen() { # style key, realm concept file, theme
  local f="$OUT/$1.png"
  [ -f "$f" ] && { echo "skip $1"; return; }
  for i in 1 2 3 4 5 6; do
    if out=$("$R" generate image --prompt "$STYLE. $3" --aspect-ratio 16:9 --reference-image "docs/concepts/$2" --out "$f" --max-credits 150 2>&1); then
      echo "ok $1: $(echo "$out" | grep -ai credits | tail -1)"; return
    fi
    echo "retry $1 ($i): $(echo "$out" | tail -1)"; sleep 30
  done
  echo "FAILED $1"
}
gen hills realm_1_goblin_hills.png "Goblin Hills: bright blue daytime sky with soft clouds, distant green rolling hills and a far blue mountain line"
gen wood realm_2_dark_elf_wood.png "Dark Elf Wood: purple night sky with stars, layered silhouettes of a dark pine forest, glowing fireflies"
gen keep realm_3_iron_keep.png "Iron Keep: orange dusk sky, distant grey castle walls and towers far on the horizon, torch glow"
gen frost realm_4_frost_peaks.png "Frost Peaks: cold blue dusk sky, snowy mountain ridges, falling snow"
gen ember realm_5_ember_forge.png "Ember Forge: inside a volcanic cave, red and plum glow from lava below, dark rock walls and stalactites framing the top"
gen sky realm_6_sky_citadel.png "Sky Citadel: high above the clouds, slate and cyan sky, distant floating rock islands, gold lightning far away"
echo DONE
