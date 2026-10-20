#!/usr/bin/env python3
"""Generates game/public/data/levels/level_NN.json for Goblin Hills (1-4) and Dark Elf Wood (5-8).

Why a script: every structure has to rest exactly on a flat shelf of the terrain, and distances from the sling (x=56)
decide what a level asks of the player. Writing the numbers by hand drifts; computing them keeps blocks flush.

Run from game/:  python scripts/build_levels.py
World units are the 216x384 viewport space, y grows downward, the flat ground is y=320, the sling stands at x=56.
Reach: a full pull lands about x=336 at ground level, about x=320 on a plateau at y=296, and about x=300 for a target
at y=230 (measured with the sweep in src/debug/testHook.ts). Anything the player must kill has to sit inside that.
"""
import json
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'data', 'levels')
GROUND = 320


def blk(m, x, y, w, h):
    return {'m': m, 'x': round(x, 1), 'y': round(y, 1), 'w': w, 'h': h}


def mon(t, x, y, **kw):
    d = {'t': t, 'x': round(x, 1), 'y': round(y, 1)}
    d.update(kw)
    return d


def stand(top, h=14):
    """Centre y of a monster of body height h standing on a surface at `top`."""
    return top - h / 2


def tower(cx, base, w=44, tiers=1, pillar='stone', ph=30, floor='wood'):
    """Pillars and a floor per tier. Returns (blocks, top surface y)."""
    blocks = []
    y = base
    for _ in range(tiers):
        blocks.append(blk(pillar, cx - w / 2 + 5, y - ph / 2, 10, ph))
        blocks.append(blk(pillar, cx + w / 2 - 5, y - ph / 2, 10, ph))
        y -= ph
        blocks.append(blk(floor, cx, y - 3, w, 6))
        y -= 6
    return blocks, y


def write(n, name, realm, kind, worldW, hints, terrain, blocks, monsters, target, **extra):
    d = {
        'id': n, 'name': name, 'realm': realm, 'kind': kind, 'worldW': worldW, 'shots': 4, 'hints': hints,
        'scoreTarget': target,
    }
    d.update(extra)
    d['terrain'] = terrain
    d['blocks'] = blocks
    d['monsters'] = monsters
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, 'level_%02d.json' % n)
    with open(path, 'w', newline='\n') as f:
        json.dump(d, f, indent=2)
    print('wrote', os.path.normpath(path), '-', len(blocks), 'blocks', len(monsters), 'monsters')


# ---------------------------------------------------------------- Goblin Hills

# 1 First fort: a low hill, a stone-footed wooden fort at mid range.
write(1, 'First fort', 'goblin_hills', 'siege', 432, ['Drag back from the sling, then let go.'],
      [[0, 320], [110, 320], [140, 308], [190, 308], [216, 320], [432, 320]],
      [blk('stone', 232, 306, 10, 28), blk('stone', 268, 306, 10, 28), blk('wood', 250, 289, 56, 6), blk('wood', 236, 276, 6, 20),
       blk('wood', 264, 276, 6, 20), blk('wood', 250, 263, 48, 6), blk('stone', 238, 254, 12, 12), blk('wood', 290, 313, 14, 14)],
      [mon('goblin_grunt', 250, 313), mon('goblin_grunt', 260, 253), mon('goblin_grunt', 308, 313)], 1200)

# 2 Bomb squad: a hump hides the base. Bombers chain when one goes.
write(2, 'Bomb squad', 'goblin_hills', 'siege', 432, ['Press the ability button mid-flight.'],
      [[0, 320], [120, 320], [150, 302], [195, 302], [225, 320], [432, 320]],
      [blk('stone', 240, 300, 12, 40), blk('stone', 240, 274, 12, 12), blk('wood', 252, 306, 8, 28), blk('wood', 298, 306, 8, 28),
       blk('wood', 276, 289, 60, 6), blk('wood', 264, 276, 6, 20), blk('wood', 290, 276, 6, 20), blk('wood', 277, 263, 44, 6),
       blk('stone', 277, 280, 12, 12), blk('wood', 318, 306, 8, 28), blk('wood', 344, 306, 8, 28), blk('wood', 331, 289, 30, 6)],
      [mon('goblin_bomber', 264, 313), mon('goblin_bomber', 284, 313), mon('goblin_grunt', 330, 313), mon('goblin_grunt', 284, 253)], 1800)

# 3 Run, skeleton, run: a fort close in, runners that sprint uphill to a door on the far side.
b3, top3 = tower(213, GROUND, 44, 1, 'stone', 28)
b3 += [blk('wood', 204, top3 - 10, 6, 20), blk('wood', 222, top3 - 10, 6, 20), blk('wood', 213, top3 - 23, 32, 6)]
write(3, 'Run, skeleton, run', 'goblin_hills', 'runner', 540, ['Stop the runners before the door.'],
      [[0, 320], [100, 320], [126, 308], [152, 308], [178, 320], [300, 320], [336, 298], [430, 298], [466, 320], [540, 320]],
      b3,
      [mon('goblin_grunt', 213, stand(GROUND)), mon('goblin_grunt', 213, stand(top3 - 26)), mon('goblin_grunt', 250, stand(GROUND)),
       mon('skeleton_runner', 262, stand(GROUND), dir=1, speed=1.05, delay=0.4), mon('skeleton_runner', 278, stand(GROUND), dir=1, speed=0.9, delay=0.7),
       mon('skeleton_runner', 292, stand(GROUND), dir=1, speed=0.75, delay=1.0)],
      2000, escapeLimit=1, exit={'x': 520, 'y': GROUND - 13})

# 4 Hill fort: a plateau fort with bombers in the bays, grunts on top, runners waiting beyond the slope.
P4 = 288
b4 = [blk('stone', x, P4 - 14, 12, 28) for x in (192, 226, 260)]
b4 += [blk('wood', 226, P4 - 31, 84, 6)]
b4 += [blk('wood', x, P4 - 44, 6, 20) for x in (204, 226, 248)]
b4 += [blk('wood', 226, P4 - 57, 52, 6), blk('stone', 208, P4 - 66, 12, 12)]
write(4, 'Hill fort', 'goblin_hills', 'siege', 600, ['Kill 3 in 2 seconds for a MASH combo.'],
      [[0, 320], [140, 320], [176, P4], [270, P4], [300, 320], [600, 320]],
      b4,
      [mon('goblin_bomber', 209, stand(P4)), mon('goblin_bomber', 243, stand(P4)), mon('goblin_grunt', 226, stand(P4 - 60)),
       mon('goblin_grunt', 242, stand(P4 - 60)), mon('goblin_grunt', 120, stand(GROUND)),
       mon('skeleton_runner', 312, stand(GROUND), dir=1, speed=0.8, delay=0.8), mon('skeleton_runner', 330, stand(GROUND), dir=1, speed=0.7, delay=1.2)],
      3000, escapeLimit=1, exit={'x': 580, 'y': GROUND - 13})

# ---------------------------------------------------------------- Dark Elf Wood (dusk): archers, hexers, imps
# Everything the player must kill sits inside the reach of a full pull. Distance and height are the difficulty.

# 5 Moonlit towers: two towers on plateaus either side of a pit. A hexer waits in the pit and shields its neighbours.
PA, PIT, PB = 296, 336, 296
tA, topA = tower(162, PA, 44, 2, 'stone', 28)
tB, topB = tower(298, PB, 48, 1, 'stone', 30)
write(5, 'Moonlit towers', 'dark_elf_wood', 'siege', 432, ['Archers hide high. Lob over the pit.'],
      [[0, 320], [110, 320], [128, PA], [196, PA], [214, PIT], [250, PIT], [268, PB], [336, PB], [356, 320], [432, 320]],
      tA + tB,
      [mon('dark_elf_archer', 162, stand(topA)), mon('dark_elf_hexer', 162, stand(PA - 34)), mon('goblin_grunt', 162, stand(PA)),
       mon('dark_elf_archer', 298, stand(topB)), mon('dark_elf_hexer', 298, stand(PB))],
      3400)

# 6 Imp swarm: a ridge hides the fort, so shots have to lob. Imps weave above the peak and the fort.
tC, topC = tower(310, GROUND, 44, 2, 'wood', 28)
write(6, 'Imp swarm', 'dark_elf_wood', 'siege', 432, ['A ridge blocks flat shots. Aim high.'],
      [[0, 320], [110, 320], [140, 296], [176, 250], [214, 250], [240, 286], [270, 320], [432, 320]],
      tC,
      [mon('imp', 250, 215), mon('imp', 290, 170), mon('imp', 332, 205), mon('dark_elf_archer', 310, stand(topC)),
       mon('dark_elf_hexer', 310, stand(GROUND - 34)), mon('goblin_grunt', 310, stand(GROUND)),
       mon('dark_elf_archer', 195, stand(250))],
      3600)

# 7 Hexer court: a stone screen in front of a shielded stage. Two hexers cover a guard and an archer.
P7 = 300
tD, topD = tower(260, P7, 64, 2, 'stone', 28)
write(7, 'Hexer court', 'dark_elf_wood', 'siege', 432, ['Hurt the hexer to drop its shields.'],
      [[0, 320], [110, 320], [150, P7], [336, P7], [356, 320], [432, 320]],
      tD + [blk('stone', 176, P7 - 30, 12, 60), blk('stone', 176, P7 - 66, 12, 12)],
      [mon('dark_elf_hexer', 246, stand(P7)), mon('goblin_grunt', 274, stand(P7)), mon('dark_elf_hexer', 260, stand(P7 - 34)),
       mon('dark_elf_archer', 260, stand(topD)), mon('dark_elf_archer', 326, stand(P7)),
       mon('imp', 290, 200)],
      3800)

# 8 Elf bastion: a stepped cliff, a two-tier keep on the upper step, a lower outpost. Everything at once.
P8a, P8b = 300, 268
tE, topE = tower(280, P8b, 60, 2, 'stone', 26)
write(8, 'Elf bastion', 'dark_elf_wood', 'siege', 432, ['Break the cliff keep. Mind the shields.'],
      [[0, 320], [110, 320], [126, P8a], [196, P8a], [220, P8b], [336, P8b], [356, 320], [432, 320]],
      tE + [blk('stone', 160, P8a - 18, 12, 36), blk('wood', 160, P8a - 40, 12, 8), blk('wood', 330, P8b - 14, 8, 28), blk('wood', 330, P8b - 31, 22, 6)],
      [mon('dark_elf_archer', 280, stand(topE)), mon('dark_elf_hexer', 280, stand(P8b - 32)), mon('goblin_grunt', 280, stand(P8b)),
       mon('dark_elf_hexer', 250, stand(P8b)), mon('dark_elf_archer', 190, stand(P8a)), mon('imp', 235, 200)],
      4200)
