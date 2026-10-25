#!/usr/bin/env python3
"""Concept level: Citadel Ridge (Ember Forge), the grand version of Ridge and Valley.

Five things happening at once, as in the Angry Birds reference screenshots: a three-tier fort with a balanced beam on its roof
(low, near), a floating platform on two tall posts over a crate stack in the pit (middle, high), a narrow three-tier tower on the high
shelf with a heavy block on top (far, highest), and a stepped cliff behind. Flyers above. Writes citadel_ridge.json (level id 99).
"""
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from fort_gen import blk, frame
from level_gen import mon, fly, LOADOUT

PA, PV, PB = 300, 334, 262
terrain = [[0, 320], [130, 320], [150, PA], [212, PA], [224, PV], [258, PV], [286, PB], [348, PB], [368, 320], [540, 320]]

# A: three-tier fort on the plateau with a balanced beam on the roof
fa = []
base = PA
tops = []
for ph, pm, fm in [(28, 'stone', 'wood'), (26, 'wood', 'wood'), (24, 'wood', 'wood')]:
    f, nb = frame(base, [158, 184], ph, pm, fm, pillar_w=8)
    fa += f
    tops.append(nb)
    base = nb
roof_a = tops[-1]
fa += [blk('wood', 171, roof_a - 12, 8, 24), blk('wood', 171, roof_a - 24 - 3, 58, 6)]
beam_a = roof_a - 24 - 6

# B: the floating platform in the pit, two tall posts over a crate stack
fb = [
    blk('wood', 230, PV - 32, 8, 64), blk('wood', 252, PV - 32, 8, 64), blk('wood', 241, PV - 64 - 3, 36, 6),
    blk('wood', 241, PV - 6, 12, 12), blk('wood', 241, PV - 18, 12, 12),
]
plat_top = PV - 64 - 6

# C: the narrow tower on the high shelf with a heavy block on top
fc, tc = [], PB
base = PB
for ph, pm, fm in [(30, 'stone', 'stone'), (26, 'wood', 'wood')]:
    f, nb = frame(base, [298, 312], ph, pm, fm, pillar_w=10)
    fc += f
    base = nb
roof_c = base
fc += [blk('stone', 313, roof_c - 7, 14, 14)]

blocks = fa + fb + fc
monsters = [
    mon('dark_elf_archer', 171, PA), mon('dark_elf_hexer', 171, tops[0]), mon('dark_elf_archer', 171, tops[1]),
    mon('orc_brute', 201, PA),
    mon('dark_elf_archer', 149, beam_a), mon('dark_elf_hexer', 193, beam_a),
    mon('dark_elf_archer', 234, plat_top), mon('dark_elf_hexer', 249, plat_top),
    mon('dark_elf_archer', 300, roof_c),
    fly('lava_imp', 226, 140), fly('lava_imp', 262, 112), fly('lava_imp', 312, 130),
]
level = {
    'id': 99, 'name': 'Citadel Ridge', 'realm': 'ember_forge', 'kind': 'siege', 'worldW': 540, 'shots': 6,
    'hints': ['Three heights: topple the near fort first.'], 'scoreTarget': 3000,
    'terrain': terrain, 'blocks': blocks, 'monsters': monsters, 'loadout': LOADOUT,
}
out = os.path.join(os.path.dirname(__file__), 'citadel_ridge.json')
with open(out, 'w', newline='\n') as f:
    json.dump(level, f, indent=2)
print('wrote', out, len(blocks), 'blocks', len(monsters), 'monsters')
