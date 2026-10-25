#!/usr/bin/env python3
"""Concept boss level: The Eye of the Citadel (Sky Citadel capstone, an alternative to level 24).

Thesis patterns used (docs/research/thesis_pages p102 and p107): clearing a path (a wood grille shuts the boss pocket), a balanced beam on a
single post above it (non-fixed tap time), a shield-mage the player must silence first (the Storm Mage shields the Sovereign), and
a flyer lane overhead. Writes game/scripts/concepts/eye_of_the_citadel.json (level id 99 so tools/gate_file.mjs can test it).
"""
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from fort_gen import blk
from level_gen import mon, fly, terrain_for, LOADOUT

P = 296
top_roof = P - 52 - 6                      # 238: surface of the pocket roof
blocks = [
    blk('iron', 205, P - 26, 10, 52), blk('iron', 308, P - 26, 10, 52),        # iron uprights frame the pocket
    blk('stone', 256.5, P - 52 - 3, 114, 6),                                   # the pocket roof
    blk('wood', 222, P - 23, 6, 46), blk('wood', 236, P - 23, 6, 46),   # the wood grille (two slats)
    blk('wood', 262, top_roof - 15, 8, 30),                                   # post on the roof
    blk('wood', 262, top_roof - 30 - 3, 92, 6),                               # the balanced beam above the pocket
    blk('crystal', 168, P - 14, 8, 28), blk('crystal', 184, P - 14, 8, 28),   # a crystal perch on the left (two posts)
    blk('crystal', 176, P - 28 - 3, 24, 6),
]
beam_top = top_roof - 36
monsters = [
    mon('storm_sovereign', 272, P),                                           # the boss, in the pocket, behind the grille
    mon('storm_mage', 252, top_roof),                                         # on the roof: its shield covers the boss, kill it first
    mon('dark_elf_archer', 230, beam_top), mon('dark_elf_archer', 294, beam_top),
    mon('dark_elf_archer', 176, P - 34),                                      # on the crystal perch
    fly('cloud_harpy', 215, 120), fly('cloud_harpy', 285, 112),
]
level = {
    'id': 99, 'name': 'The Eye of the Citadel', 'realm': 'sky_citadel', 'kind': 'boss', 'worldW': 648, 'shots': 6,
    'hints': ['Silence the mage. Open the grille.', 'Cut the post to drop the beam.', 'Hit the glowing eye for 2x.'],
    'scoreTarget': 2600, 'terrain': [[0, 320], [110, 320], [135, P], [335, P], [365, 320], [648, 320]],
    'blocks': blocks, 'monsters': monsters, 'loadout': LOADOUT,
}
out = os.path.join(os.path.dirname(__file__), 'eye_of_the_citadel.json')
with open(out, 'w', newline='\n') as f:
    json.dump(level, f, indent=2)
print('wrote', out)
