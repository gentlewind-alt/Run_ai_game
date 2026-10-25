#!/usr/bin/env python3
"""Concept level: Ridge and Valley (Ember Forge), a layout study from two Angry Birds screenshots.

What the screenshots teach (see docs/monster_mash/15_layout_style_notes.md):
  terrain is part of the level (a pit, a steep ramp, a high shelf), structures sit at three different heights and distances,
  tall thin sticks carry a lone target, crates lie low on the pit floor, a balanced beam crowns the high shelf, and flyers hang above.
Writes game/scripts/concepts/ridge_and_valley.json (level id 99 so tools/gate_file.mjs can test it).
"""
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from fort_gen import blk, frame
from level_gen import mon, fly, LOADOUT

PA, PV, PB = 296, 332, 258          # plateau A, valley floor, high shelf B
terrain = [[0, 320], [130, 320], [150, PA], [225, PA], [238, PV], [268, PV], [290, PB], [345, PB], [365, 320], [540, 320]]
f1, t1 = frame(PA, [166, 188], 28, 'stone', 'wood')                       # tier 1 of the low fort on plateau A
f2, t2 = frame(t1, [166, 188], 24, 'wood', 'wood')                        # tier 2
blocks = f1 + f2 + [
    blk('wood', 250, PV - 28, 6, 56), blk('wood', 250, PV - 56 - 3, 26, 6),   # the tall thin stick with a floor on top
    blk('wood', 262, PV - 6, 12, 12),                                        # a crate on the pit floor
    blk('wood', 306, PB - 18, 8, 36), blk('wood', 306, PB - 36 - 3, 52, 6),   # post and beam on the high shelf
]
beam_top = PB - 36 - 6
stick_top = PV - 56 - 6
monsters = [
    mon('dark_elf_archer', 177, PA), mon('dark_elf_hexer', 177, t1), mon('dark_elf_archer', 177, t2),   # inside and on top of the low fort
    mon('orc_brute', 210, PA),                                                                     # a heavy beside it, on the plateau
    mon('dark_elf_archer', 250, stick_top),                                                        # alone on the tall stick
    mon('dark_elf_archer', 292, beam_top), mon('dark_elf_hexer', 320, beam_top),                    # on the beam ends
    fly('lava_imp', 235, 165), fly('lava_imp', 300, 150),
]
level = {
    'id': 99, 'name': 'Ridge and Valley', 'realm': 'ember_forge', 'kind': 'siege', 'worldW': 540, 'shots': 6,
    'hints': ['Three heights. Start low, or cut the stick.'], 'scoreTarget': 2200,
    'terrain': terrain, 'blocks': blocks, 'monsters': monsters, 'loadout': LOADOUT,
}
out = os.path.join(os.path.dirname(__file__), 'ridge_and_valley.json')
with open(out, 'w', newline='\n') as f:
    json.dump(level, f, indent=2)
print('wrote', out)
