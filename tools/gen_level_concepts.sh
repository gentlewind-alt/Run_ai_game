#!/usr/bin/env bash
# Concept art for each realm: one 16:9 image with four side-view panels, levels left to right, each fort bigger,
# taller and more layered than the last. 120 credits per image. Output: docs/concepts/realm_<n>_<id>.png
# usage: bash tools/gen_level_concepts.sh
R="$LOCALAPPDATA/Programs/Rundot/rundot.exe"
OUT=docs/concepts
mkdir -p "$OUT"
REF=docs/handoff/shots/gen/omni_arm_in_game.png
STYLE="16-bit SNES pixel art, side view, slingshot siege game level concept sheet, four panels in a row labelled 1 2 3 4, a wooden slingshot on the far left of every panel, monsters standing in and on top of a block fort on the right, forts made of wood planks, stone pillars and iron plates, each panel's fort larger, taller and more layered than the one before: panel 1 a small single tower, panel 2 two towers with a gap, panel 3 a multi-tier fortress with hidden chest, panel 4 a boss throne fortress, crisp pixels, limited palette, no text other than the panel numbers"
gen() { # name, theme
  local f="$OUT/$1.png"
  [ -f "$f" ] && { echo "skip $1"; return; }
  for i in 1 2 3 4 5 6; do
    if out=$("$R" generate image --prompt "$STYLE. Realm theme: $2" --aspect-ratio 16:9 --reference-image "$REF" --out "$f" --max-credits 150 2>&1); then
      echo "ok $1: $(echo "$out" | grep -ai credits | tail -1)"; return
    fi
    echo "retry $1 ($i): $(echo "$out" | tail -1)"; sleep 25
  done
  echo "FAILED $1"
}
gen realm_1_goblin_hills "Goblin Hills: green rolling hills, warm brown dirt, blue daytime sky, green goblins, bombers and skeleton runners, a goblin chief boss with a crown on the final throne"
gen realm_2_dark_elf_wood "Dark Elf Wood: purple night forest, glowing fireflies, dark elf archers on high perches, hexers casting shields, a dark elf matron boss"
gen realm_3_iron_keep "Iron Keep: grey stone castle walls at dusk, orange torchlight, orc brutes and trolls, heavy iron-plated towers, an armoured iron warlord boss with a visor"
gen realm_4_frost_peaks "Frost Peaks: snowy mountain ridges at blue dusk, falling snow, ice crystal blocks, frost wolves and ice golems, a giant frost giant boss with a glowing chest crystal"
gen realm_5_ember_forge "Ember Forge: volcanic furnace cave, red and plum sky glowing from lava below, basalt ground, lava imps flying, forge ogres, molten bridge over a pit, a forge tyrant boss with an anvil on its back"
gen realm_6_sky_citadel "Sky Citadel: floating stone citadel above the clouds, slate and cyan sky with gold lightning, cloud harpies flying, storm mages shielding, a storm sovereign boss with a glowing eye in its chest"
echo DONE
