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


def chst(id, x, y, reward, hp=40):
    return {'id': id, 'x': round(x, 1), 'y': round(y, 1), 'hp': hp, 'reward': reward}


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


def write(n, name, realm, kind, worldW, hints, terrain, blocks, monsters, target, chests=None, **extra):
    shots = extra.pop('shots', 4 if n <= 3 else (5 if n <= 7 else 6))
    d = {
        'id': n, 'name': name, 'realm': realm, 'kind': kind, 'worldW': worldW, 'shots': shots, 'hints': hints,
        'scoreTarget': target,
    }
    d.update(extra)
    d['terrain'] = terrain
    d['blocks'] = blocks
    d['monsters'] = monsters
    if chests:
        d['chests'] = chests
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, 'level_%02d.json' % n)
    with open(path, 'w', newline='\n') as f:
        json.dump(d, f, indent=2)
    print('wrote', os.path.normpath(path), '-', len(blocks), 'blocks', len(monsters), 'monsters', len(chests or []), 'chests')


# ---------------------------------------------------------------- Goblin Hills

# 1 First fort: a low hill, a stone-footed wooden fort at mid range.
write(1, 'First fort', 'goblin_hills', 'siege', 432, ['Drag back from the sling, then let go.'],
      [[0, 320], [110, 320], [140, 308], [190, 308], [216, 320], [432, 320]],
      [blk('stone', 232, 306, 10, 28), blk('stone', 268, 306, 10, 28), blk('wood', 250, 289, 56, 6), blk('wood', 236, 276, 6, 20),
       blk('wood', 264, 276, 6, 20), blk('wood', 250, 263, 48, 6), blk('stone', 238, 254, 12, 12), blk('wood', 290, 313, 14, 14),
       blk('stone', 315, 306, 10, 28), blk('wood', 315, 289, 28, 6)],
      [mon('goblin_grunt', 250, 313), mon('goblin_grunt', 260, 253), mon('goblin_grunt', 308, 313), mon('goblin_grunt', 315, stand(286))], 720)

# 2 Bomb squad: a hump hides the base. Bombers chain when one goes.
write(2, 'Bomb squad', 'goblin_hills', 'siege', 432, ['Press the ability button mid-flight.'],
      [[0, 320], [120, 320], [150, 302], [195, 302], [225, 320], [432, 320]],
      [blk('stone', 240, 300, 12, 40), blk('stone', 240, 274, 12, 12), blk('wood', 252, 306, 8, 28), blk('wood', 298, 306, 8, 28),
       blk('wood', 276, 289, 60, 6), blk('wood', 264, 276, 6, 20), blk('wood', 290, 276, 6, 20), blk('wood', 277, 263, 44, 6),
       blk('stone', 277, 280, 12, 12), blk('wood', 318, 306, 8, 28), blk('wood', 344, 306, 8, 28), blk('wood', 331, 289, 30, 6)],
      [mon('goblin_bomber', 264, 313), mon('goblin_bomber', 284, 313), mon('goblin_grunt', 330, 313), mon('goblin_grunt', 284, 253)], 1600)

# 3 Run, skeleton, run: a fort close in, runners that sprint uphill to a door on the far side.
b3, top3 = tower(213, GROUND, 44, 1, 'stone', 28)
b3 += [blk('wood', 204, top3 - 10, 6, 20), blk('wood', 222, top3 - 10, 6, 20), blk('wood', 213, top3 - 23, 32, 6)]
c3 = [chst('c_l3', 350, 292, 'w_steersong_arrow', 40)]
write(3, 'Run, skeleton, run', 'goblin_hills', 'runner', 540, ['Stop the runners before the door.'],
      [[0, 320], [100, 320], [126, 308], [152, 308], [178, 320], [300, 320], [336, 298], [430, 298], [466, 320], [540, 320]],
      b3,
      [mon('goblin_grunt', 213, stand(GROUND)), mon('goblin_grunt', 213, stand(top3 - 26)), mon('goblin_grunt', 225, stand(top3 - 10)),
       mon('skeleton_runner', 252, stand(GROUND), dir=1, speed=1.0, delay=0.5), mon('skeleton_runner', 268, stand(GROUND), dir=1, speed=0.85, delay=0.8),
       mon('skeleton_runner', 284, stand(GROUND), dir=1, speed=0.7, delay=1.1)],
      1700, chests=c3, escapeLimit=1, exit={'x': 520, 'y': GROUND - 13})

# 4 Hill fort: a plateau fort with chief in the bay, grunts on top, runners waiting beyond the slope.
P4 = 288
b4 = [blk('stone', x, P4 - 14, 12, 28) for x in (192, 226, 260)]
b4 += [blk('stone', 274, P4 - 14, 12, 28)]
b4 += [blk('wood', 233, P4 - 31, 98, 6)]
b4 += [blk('wood', x, P4 - 44, 6, 20) for x in (204, 226, 248)]
b4 += [blk('wood', 226, P4 - 57, 52, 6), blk('stone', 208, P4 - 66, 12, 12), blk('stone', 244, P4 - 66, 12, 12)]
write(4, 'Hill fort', 'goblin_hills', 'boss', 600, ['Defeat the Goblin Chief!'],
      [[0, 320], [140, 320], [176, P4], [270, P4], [300, 320], [600, 320]],
      b4,
      [mon('goblin_chief', 209, stand(P4, 21)), mon('goblin_bomber', 243, stand(P4)), mon('goblin_grunt', 226, stand(P4 - 60)),
       mon('goblin_grunt', 242, stand(P4 - 60)), mon('goblin_grunt', 120, stand(GROUND)), mon('goblin_grunt', 256, stand(P4)),
       mon('skeleton_runner', 312, stand(GROUND), dir=1, speed=0.8, delay=0.8), mon('skeleton_runner', 330, stand(GROUND), dir=1, speed=0.7, delay=1.2)],
      1350, escapeLimit=1, exit={'x': 580, 'y': GROUND - 13}, shots=5,
      loadout=['w_militia_blade', 'w_iron_cleaver', 'w_ashwood_staff', 'w_scrapheap_scattergun', 'w_militia_blade'])

# ---------------------------------------------------------------- Dark Elf Wood (dusk): archers, hexers, imps
# Everything the player must kill sits inside the reach of a full pull. Distance and height are the difficulty.

# 5 Moonlit towers: two towers on plateaus either side of a pit. A hexer waits in the pit and shields its neighbours.
PA, PIT, PB = 296, 336, 296
tA, topA = tower(162, PA, 44, 2, 'stone', 28)
tB, topB = tower(298, PB, 48, 2, 'stone', 30)
c5 = [chst('c_l5', 328, 290, 'w_silkline_shooters', 40)]
write(5, 'Moonlit towers', 'dark_elf_wood', 'siege', 432, ['Archers hide high. Lob over the pit.'],
      [[0, 320], [110, 320], [128, PA], [196, PA], [214, PIT], [250, PIT], [268, PB], [336, PB], [356, 320], [432, 320]],
      tA + tB,
      [mon('dark_elf_archer', 162, stand(topA)), mon('dark_elf_hexer', 162, stand(PA - 34)), mon('goblin_grunt', 162, stand(PA)),
       mon('dark_elf_archer', 298, stand(topB)), mon('dark_elf_hexer', 298, stand(PB)), mon('imp', 230, 215),
       mon('dark_elf_archer', 298, stand(PB - 36))],
      1200, chests=c5, shots=5)

# 6 Imp swarm: a ridge hides the fort, so shots have to lob. Imps weave above the peak and the fort.
tC, topC = tower(300, GROUND, 44, 2, 'wood', 28)
b6 = tC + [blk('stone', 255, GROUND - 14, 10, 28), blk('wood', 300, topC - 10, 28, 6)]
write(6, 'Imp swarm', 'dark_elf_wood', 'siege', 432, ['A ridge blocks flat shots. Aim high.'],
      [[0, 320], [110, 320], [140, 296], [176, 250], [214, 250], [240, 286], [270, 320], [432, 320]],
      b6,
      [mon('imp', 205, 230), mon('imp', 230, 220), mon('imp', 255, 205), mon('imp', 280, 215), mon('dark_elf_archer', 300, stand(topC - 13)),
       mon('dark_elf_hexer', 300, stand(GROUND - 34)), mon('goblin_grunt', 300, stand(GROUND)),
       mon('dark_elf_archer', 195, stand(250))],
      1300, shots=5)

# 7 Hexer court: a stone screen in front of a shielded stage. Two hexers cover a guard and an archer.
P7 = 300
tD, topD = tower(285, P7, 44, 2, 'stone', 28)
c7 = [chst('c_l7', 325, 294, 'w_kinetic_palms', 40)]
b7 = tD + [
    blk('stone', 175, P7 - 12, 14, 24),
    blk('stone', 220, P7 - 14, 8, 28), blk('stone', 250, P7 - 14, 8, 28), blk('wood', 235, P7 - 31, 38, 6)
]
write(7, 'Hexer court', 'dark_elf_wood', 'siege', 432, ['Hurt the hexer to drop its shields.'],
      [[0, 320], [110, 320], [150, P7], [336, P7], [356, 320], [432, 320]],
      b7,
      [mon('dark_elf_archer', 195, stand(P7)),
       mon('dark_elf_hexer', 235, stand(P7)), mon('goblin_grunt', 235, stand(P7 - 34)),
       mon('dark_elf_hexer', 285, stand(P7)), mon('dark_elf_archer', 285, stand(topD - 14)),
       mon('goblin_grunt', 325, stand(P7)), mon('imp', 260, 205), mon('imp', 210, 195)],
      1350, chests=c7, shots=5)

# 8 Elf bastion: a stepped cliff, a two-tier keep on the upper step, a lower outpost. Everything at once.
P8a, P8b = 300, 268
tE, topE = tower(275, P8b, 56, 2, 'stone', 28)
b8 = tE + [
    blk('stone', 160, P8a - 20, 12, 40), blk('stone', 174, P8a - 20, 12, 40), blk('stone', 167, P8a - 46, 26, 12),
    blk('wood', 324, P8b - 14, 8, 28), blk('wood', 324, P8b - 31, 24, 6), blk('stone', 275, topE - 10, 12, 20)
]
write(8, 'Elf bastion', 'dark_elf_wood', 'boss', 432, ['Defeat the Dark Elf Matron.'],
      [[0, 320], [110, 320], [126, P8a], [196, P8a], [220, P8b], [336, P8b], [356, 320], [432, 320]],
      b8,
      [mon('dark_elf_matron', 275, stand(P8b, 20)), mon('dark_elf_archer', 275, stand(topE - 20)), mon('goblin_grunt', 275, stand(P8b - 34)),
       mon('dark_elf_hexer', 324, stand(P8b)), mon('dark_elf_archer', 190, stand(P8a)), mon('imp', 235, 195),
       mon('goblin_grunt', 167, stand(P8a - 52))],
      1400, shots=6)

# ---------------------------------------------------------------- Iron Keep (fire glow): brutes, trolls, iron blocks, runners
# 648-wide worlds. Heavy blocks and high HP monsters require abilities, status combos, and precision.

# 9 Molten gate: an iron-reinforced gatehouse with an orc brute and a troll. Runners sprint past to a distant exit.
P9 = 304
b9 = [
    blk('iron', 188, P9 - 16, 12, 32), blk('iron', 232, P9 - 16, 12, 32), blk('stone', 210, P9 - 35, 60, 6),
    blk('stone', 195, P9 - 48, 8, 20), blk('stone', 225, P9 - 48, 8, 20), blk('wood', 210, P9 - 61, 44, 6),
    blk('wood', 150, P9 - 10, 8, 20), blk('stone', 260, GROUND - 14, 10, 28),
    blk('iron', 210, P9 - 73, 36, 12), blk('stone', 166, P9 - 14, 10, 28), blk('stone', 210, P9 - 48, 8, 20)
]
write(9, 'Molten gate', 'iron_keep', 'runner', 648, ['Iron blocks resist light hits.', 'Stop the runners before the exit.'],
      [[0, 320], [110, 320], [140, P9], [250, P9], [280, 320], [648, 320]],
      b9,
      [mon('goblin_bomber', 150, stand(P9)), mon('orc_brute', 210, stand(P9, 28)), mon('troll', 210, stand(P9 - 38, 28)),
       mon('goblin_grunt', 166, stand(P9)),
       mon('skeleton_runner', 285, stand(GROUND), dir=1, speed=0.7, delay=1.0),
       mon('skeleton_runner', 315, stand(GROUND), dir=1, speed=0.55, delay=1.4)],
      1600, escapeLimit=1, exit={'x': 620, 'y': GROUND - 13}, shots=6)

# 10 Iron foundry: a sunken furnace pit with a covered troll, guarded by an orc brute and a shielded hexer high above.
P10a, PIT10, P10b = 300, 336, 276
b10 = [
    blk('stone', 150, P10a - 14, 10, 28),
    blk('stone', 210, PIT10 - 16, 8, 32), blk('stone', 246, PIT10 - 16, 8, 32), blk('wood', 228, PIT10 - 35, 48, 6),
    blk('stone', 295, P10b - 15, 8, 30), blk('stone', 330, P10b - 15, 8, 30), blk('wood', 312.5, P10b - 33, 46, 6),
    blk('iron', 228, PIT10 - 44, 36, 12), blk('stone', 312.5, P10b - 48, 8, 24)
]
write(10, 'Iron foundry', 'iron_keep', 'siege', 648, ['Void weakens iron and brutes.', 'Hellfire burns trolls to stop regen.'],
      [[0, 320], [105, 320], [125, P10a], [175, P10a], [195, PIT10], [255, PIT10], [275, P10b], [340, P10b], [365, 320], [648, 320]],
      b10,
      [mon('orc_brute', 150, stand(P10a, 28)), mon('troll', 228, stand(PIT10, 28)), mon('goblin_grunt', 228, stand(PIT10 - 38)),
       mon('dark_elf_hexer', 312.5, stand(P10b)), mon('dark_elf_archer', 312.5, stand(P10b - 36)),
       mon('goblin_grunt', 312.5, stand(P10b - 60))],
      1200,
      shots=6)

# 11 Furnace bastion: multi-tier fortress with heavy iron footings, shielded defenders, and sprinting runners.
P11a, P11b = 300, 268
b11 = [
    blk('stone', 150, P11a - 14, 8, 28), blk('stone', 165, P11a - 14, 8, 28), blk('stone', 150, P11a - 42, 8, 28),
    blk('wood', 215, P11b - 12, 6, 24), blk('iron', 255, P11b - 12, 6, 24), blk('stone', 235, P11b - 27, 46, 6),
    blk('wood', 225, P11b - 38, 6, 16), blk('wood', 245, P11b - 38, 6, 16), blk('iron', 235, P11b - 50, 34, 16),
    blk('stone', 235, P11b - 64, 24, 12)
]
write(11, 'Furnace bastion', 'iron_keep', 'runner', 648, ['Curse with the Scepter.', 'Pierce the iron shield or stun runners.'],
      [[0, 320], [110, 320], [130, P11a], [190, P11a], [215, P11b], [325, P11b], [355, 320], [648, 320]],
      b11,
      [mon('dark_elf_hexer', 165, stand(P11a)), mon('goblin_bomber', 235, stand(P11b - 30)),
       mon('orc_brute', 225, stand(P11b, 28)), mon('goblin_grunt', 235, stand(P11b - 70)),
       mon('skeleton_runner', 275, stand(P11b), dir=1, speed=0.45, delay=1.2),
       mon('skeleton_runner', 300, stand(P11b), dir=1, speed=0.4, delay=1.8)],
      1300, escapeLimit=1, exit={'x': 620, 'y': GROUND - 13}, shots=6)

# 12 Iron Throne: boss arena for the Iron Warlord.
P12 = 280
b12 = [
    blk('stone', 150, P12 - 14, 10, 28),
    blk('iron', 205, P12 - 16, 12, 32), blk('iron', 265, P12 - 16, 12, 32),
    blk('stone', 235, P12 - 35, 72, 6),
    blk('stone', 215, P12 - 46, 8, 16), blk('stone', 255, P12 - 46, 8, 16),
    blk('stone', 235, P12 - 57, 48, 6),
    blk('stone', 305, P12 - 14, 10, 28), blk('stone', 330, P12 - 14, 10, 28),
    blk('stone', 317.5, P12 - 35, 40, 6), blk('stone', 317.5, P12 - 48, 12, 20)
]
write(12, 'Iron Throne', 'iron_keep', 'boss', 648,
      ['Wait for the visor to open for 2x.', 'Boulders shake the ground. Stay steady.'],
      [[0, 320], [110, 320], [135, P12], [330, P12], [360, 320], [648, 320]],
      b12,
      [mon('iron_warlord', 235, stand(P12, 30)),
       mon('dark_elf_hexer', 150, stand(P12)),
       mon('goblin_grunt', 235, stand(P12 - 60))],
      1400,
      shots=6,
      loadout=['w_iron_cleaver', 'w_horned_scepter', 'w_hunters_pike', 'w_ashwood_staff', 'w_blast_tube', 'w_scrapheap_scattergun'])

# ---------------------------------------------------------------- Frost Peaks

# 13 Frozen pass: an ice tower on a snowy shelf. Ice (crystal) shatters at a touch, the stone floors do not.
P13 = 300
b13, top13 = tower(225, P13, w=56, tiers=2, pillar='stone', ph=28, floor='stone')
b13 += [blk('stone', 168, P13 - 12, 10, 24)]
write(13, 'Frozen pass', 'frost_peaks', 'siege', 540, ['Ice shatters easily. Stone does not.'],
      [[0, 320], [130, 320], [160, P13], [310, P13], [340, 320], [540, 320]],
      b13,
      [mon('ice_golem', 225, stand(P13, 30)),
       mon('dark_elf_archer', 205, stand(top13)), mon('dark_elf_archer', 245, stand(top13)),
       mon('dark_elf_hexer', 168, stand(P13 - 24)), mon('ice_golem', 282, stand(P13, 30))],
      1300, shots=6,
      loadout=['w_iron_cleaver', 'w_ashwood_staff', 'w_hunters_pike', 'w_blast_tube', 'w_scrapheap_scattergun', 'w_hunters_boomerang'])

# 14 Glacier steps: two shelves, wolves racing for the exit, a golem on the high shelf.
LOW14, HIGH14 = 300, 276
b14 = [
    blk('stone', 185, LOW14 - 15, 10, 30), blk('stone', 225, LOW14 - 15, 10, 30), blk('wood', 205, LOW14 - 33, 50, 6),
    blk('crystal', 270, HIGH14 - 14, 8, 28), blk('crystal', 312, HIGH14 - 14, 8, 28), blk('stone', 291, HIGH14 - 31, 52, 6),
]
write(14, 'Glacier steps', 'frost_peaks', 'runner', 648, ['Frost wolves are fast. Stop them early.', 'Fire melts ice golems.'],
      [[0, 320], [120, 320], [150, LOW14], [240, LOW14], [255, HIGH14], [335, HIGH14], [365, 320], [648, 320]],
      b14,
      [mon('ice_golem', 291, stand(HIGH14, 30)), mon('dark_elf_hexer', 205, stand(LOW14)),
       mon('dark_elf_archer', 291, stand(HIGH14 - 37)),
       mon('frost_wolf', 395, stand(GROUND), dir=1, speed=0.9, delay=0.8),
       mon('frost_wolf', 430, stand(GROUND), dir=1, speed=1.0, delay=1.4)],
      900, escapeLimit=1, exit={'x': 620, 'y': GROUND - 13}, shots=6)

# 15 Ice cathedral: a tall crystal-and-stone spire with golems at the base and on the second floor.
P15 = 296
b15, top15 = tower(230, P15, w=60, tiers=3, pillar='stone', ph=26, floor='stone')
b15 += [blk('stone', 165, P15 - 18, 12, 36), blk('stone', 295, P15 - 18, 12, 36), blk('iron', 230, P15 - 6, 36, 12)]
write(15, 'Ice cathedral', 'frost_peaks', 'siege', 540, ['Shatter the pillars, drop the spire.'],
      [[0, 320], [120, 320], [150, P15], [320, P15], [350, 320], [540, 320]],
      b15,
      [mon('ice_golem', 230, stand(P15 - 12, 30)), mon('ice_golem', 230, stand(P15 - 12 - 32, 30)),
       mon('dark_elf_archer', 210, stand(top15)), mon('dark_elf_archer', 250, stand(top15)),
       mon('dark_elf_hexer', 165, stand(P15 - 36)), mon('ice_golem', 275, stand(P15, 30))],
      1550, shots=6,
      loadout=['w_iron_cleaver', 'w_ashwood_staff', 'w_hunters_pike', 'w_blast_tube', 'w_scrapheap_scattergun', 'w_hunters_boomerang'])

# 16 Frost throne: the Frost Giant on a shelf, ringed by ice and stone. Hit the glowing chest crystal for 2x.
P16 = 296
b16 = [
    blk('stone', 168, P16 - 22, 12, 44), blk('stone', 302, P16 - 22, 12, 44),
    blk('crystal', 188, P16 - 19, 8, 38), blk('crystal', 282, P16 - 19, 8, 38),
    blk('stone', 235, P16 - 44 - 3, 144, 6), blk('crystal', 205, P16 - 53, 8, 20), blk('crystal', 265, P16 - 53, 8, 20),
]
write(16, 'Frost throne', 'frost_peaks', 'boss', 648,
      ['Hit the glowing chest crystal for 2x.', 'Icicles fall in a band. Stay steady.'],
      [[0, 320], [110, 320], [135, P16], [340, P16], [370, 320], [648, 320]],
      b16,
      [mon('frost_giant', 235, stand(P16, 46)), mon('dark_elf_archer', 205, stand(P16 - 50)),
       mon('dark_elf_archer', 265, stand(P16 - 50))],
      1100, shots=6,
      loadout=['w_iron_cleaver', 'w_horned_scepter', 'w_hunters_pike', 'w_ashwood_staff', 'w_blast_tube', 'w_scrapheap_scattergun'])
