#!/usr/bin/env python3
"""Concept level: Bastion Ridge (Ember Forge): the big, thick, tough-looking version, set well back from the sling.

A pit in front of the slingshot (the Angry Birds "gap") and a long plateau beyond it. A four-tier stone-and-iron bastion with
battlements and iron lintels (near the back of the plateau), and a thick iron post carrying a stone platform to its right.
Thick 12 px posts, brutes behind them, shooters on every floor, imps overhead. Writes bastion_ridge.json (level id 99).
"""
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from fort_gen import blk, frame
from level_gen import mon, fly, LOADOUT

PA = 300
terrain = [[0, 320], [96, 320], [110, 338], [168, 338], [184, PA], [346, PA], [366, 320], [540, 320]]

# the bastion: two bays 38 px apart, so a brute or a troll fits between the posts
xs = [204, 246, 288]
tiers = [(34, 'stone', 'stone'), (30, 'stone', 'wood'), (28, 'stone', 'wood'), (26, 'wood', 'stone')]
a, tops, base = [], [], PA
for ph, pm, fm in tiers:
    f, base = frame(base, xs, ph, pm, fm, pillar_w=12)
    a += f
    tops.append(base)
roof = tops[-1]
a += [blk('stone', 204, roof - 7, 10, 14), blk('stone', 246, roof - 7, 10, 14), blk('stone', 288, roof - 7, 10, 14)]    # battlements
a += [blk('iron', 225, roof - 5, 26, 10), blk('iron', 267, roof - 5, 26, 10)]                                      # iron lintels over the bays

# a thick iron post with a stone platform on top, to the right of the bastion
post_h = 46
b = [blk('iron', 322, PA - post_h / 2, 14, post_h), blk('stone', 322, PA - post_h - 3, 40, 6)]
plat = PA - post_h - 6

blocks = a + b
monsters = [
    mon('orc_brute', 225, PA), mon('dark_elf_hexer', 267, PA),
    mon('dark_elf_archer', 225, tops[0]), mon('dark_elf_hexer', 267, tops[0]),
    mon('dark_elf_archer', 225, tops[1]), mon('dark_elf_archer', 267, tops[1]),
    mon('dark_elf_archer', 225, roof), mon('dark_elf_archer', 267, roof),
    mon('dark_elf_archer', 312, plat), mon('dark_elf_hexer', 332, plat),
    fly('lava_imp', 250, 90), fly('lava_imp', 330, 150), fly('lava_imp', 206, 70),
]
level = {
    'id': 99, 'name': 'Bastion Ridge', 'realm': 'ember_forge', 'kind': 'siege', 'worldW': 540, 'shots': 6,
    'hints': ['Thick walls. Find the load posts.'], 'scoreTarget': 4200,
    'terrain': terrain, 'blocks': blocks, 'monsters': monsters, 'loadout': LOADOUT,
}
out = os.path.join(os.path.dirname(__file__), 'bastion_ridge.json')
with open(out, 'w', newline='\n') as f:
    json.dump(level, f, indent=2)
print('wrote', out, len(blocks), 'blocks', len(monsters), 'monsters')
