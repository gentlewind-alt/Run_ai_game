#!/usr/bin/env python3
"""Generates game/public/data/levels/level_NN.json for Goblin Hills (1-4) and Dark Elf Wood (5-8).

Why a script: every structure has to rest exactly on a flat shelf of the terrain, and distances from the sling (x=56)
decide what a level asks of the player. Writing the numbers by hand drifts; computing them keeps blocks flush.

Run from game/:  python scripts/build_levels.py
World units are the 216x384 viewport space, y grows downward, the flat ground is y=320, the sling stands at x=56.
Reach: a full pull lands about x=336 at ground level, about x=320 on a plateau at y=296, and about x=300 for a target
at y=230 (measured with the sweep in src/debug/testHook.ts). Anything the player must kill has to sit inside that.
"""
import argparse
import json
import os
from fort_gen import generate_fort

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'data', 'levels')
GENERATED = os.path.join(os.path.dirname(__file__), 'generated')
GROUND = 320
BOSS_LEVELS = {4, 8, 12, 16, 20, 24}
# Boss levels whose fort comes from fort_gen.py (seed, with a satellite spire). They passed tools/gate_level.mjs: stand-still,
# collapse >= 40%, solver band. 12, 20 and 24 stay hand-built (no generated seed passed the gate).
ADOPTED = {4: 1, 8: 1, 16: 1}


def _options():
    parser = argparse.ArgumentParser(description='Build campaign levels or boss fort candidates.')
    parser.add_argument('--candidates', action='store_true', help='write only boss candidates under scripts/generated')
    parser.add_argument('--seed', type=int, default=1, help='candidate seed (default: 1)')
    parser.add_argument('--satellites', action='store_true', help='add one separate satellite frame per boss candidate')
    parser.add_argument('--no-adopt', action='store_true', help='build the hand-written forts for every level (ignore ADOPTED)')
    args = parser.parse_args()
    if args.seed != 1 and not args.candidates:
        parser.error('--seed requires --candidates')
    if args.satellites and not args.candidates:
        parser.error('--satellites requires --candidates')
    return args


OPTIONS = _options()


def _ground_fn(terrain):
    def height_at(x):
        if x <= terrain[0][0]:
            return terrain[0][1]
        for (x0, y0), (x1, y1) in zip(terrain, terrain[1:]):
            if x <= x1:
                if x1 == x0:
                    return y1
                return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
        return terrain[-1][1]
    return height_at


def _flat_segments(terrain, worldW):
    return [(x0, x1, y0) for (x0, y0), (x1, y1) in zip(terrain, terrain[1:])
            if y0 == y1 and x1 - x0 >= 30 and x0 < worldW]


def _entity_box(entity):
    sizes = {
        'goblin_grunt': (12, 14), 'goblin_bomber': (12, 14), 'dark_elf_archer': (12, 14),
        'dark_elf_hexer': (12, 14), 'skeleton_runner': (9, 14), 'imp': (10, 10),
        'goblin_chief': (18, 21), 'dark_elf_matron': (17, 20), 'iron_warlord': (26, 30),
        'frost_giant': (36, 46), 'forge_tyrant': (36, 46), 'storm_sovereign': (36, 46),
        'lava_imp': (12, 12), 'cloud_harpy': (14, 12), 'storm_mage': (12, 14),
        'forge_ogre': (30, 34),
    }
    w, h = sizes.get(entity['t'], (12, 14))
    return {'x': entity['x'], 'y': entity['y'], 'w': w, 'h': h}


def _boxes_intersect(a, b):
    return (abs(a['x'] - b['x']) * 2 < a['w'] + b['w']
            and abs(a['y'] - b['y']) * 2 < a['h'] + b['h'])


def _candidate_forts(level, terrain, monsters, worldW, seed, satellites=None):
    satellites = OPTIONS.satellites if satellites is None else satellites
    ground_fn = _ground_fn(terrain)
    boss = next((entity for entity in monsters if entity['t'] in {
        'goblin_chief', 'dark_elf_matron', 'iron_warlord', 'frost_giant', 'forge_tyrant', 'storm_sovereign'
    }), None)
    if boss is None:
        raise ValueError(f'level {level} has no registered boss')
    base = ground_fn(boss['x'])
    segment = next(((x0, x1, y) for x0, x1, y in _flat_segments(terrain, worldW)
                    if x0 <= boss['x'] <= x1 and abs(y - base) < 0.1), None)
    if segment is None:
        raise ValueError(f'level {level} boss is not on a flat terrain span')
    x0, x1, _ = segment
    x_min, x_max = {
        4: (193, 260), 8: (235, 326), 12: (183, 320),
        16: (190, 330), 20: (190, 330), 24: (190, 330),
    }[level]
    if x_min < x0 or x_max > x1:
        raise ValueError(f'level {level} candidate span is outside the boss shelf')

    tier_count = {4: 3, 8: 3, 12: 3, 16: 3, 20: 4, 24: 4}[level]
    materials = {
        4:  [('stone', 'wood'), ('stone', 'wood'), ('wood', 'wood')],
        8:  [('stone', 'stone'), ('wood', 'wood'), ('wood', 'wood')],
        12: [('iron', 'stone'), ('stone', 'stone'), ('crystal', 'crystal')],
        16: [('stone', 'stone'), ('stone', 'crystal'), ('crystal', 'crystal')],
        20: [('iron', 'stone'), ('stone', 'stone'), ('wood', 'wood'), ('crystal', 'crystal')],
        24: [('iron', 'stone'), ('stone', 'stone'), ('crystal', 'crystal'), ('crystal', 'crystal')],
    }[level]
    blocks, _ = generate_fort(seed + level, base, x_min, x_max, tier_count, 2, materials,
                              [_entity_box(entity) for entity in monsters], ground_fn=ground_fn)

    if satellites:
        entity_boxes = [_entity_box(entity) for entity in monsters]
        spans = []
        for sx0, sx1, sy in _flat_segments(terrain, worldW):
            for center in range(int(sx0 + 17), int(sx1 - 16), 8):
                sat_min, sat_max = center - 24, center + 24
                if sat_min < 70 or sat_min < x_max + 2 and sat_max > x_min - 2:
                    continue
                base_y = ground_fn(center)
                if any(abs(ground_fn(x) - base_y) > 0.1 for x in (sat_min, center, sat_max)):
                    continue
                if any(abs(box['x'] - center) < box['w'] / 2 + 22
                       and box['y'] + box['h'] / 2 > base_y - 120
                       and box['y'] - box['h'] / 2 < base_y + 2 for box in entity_boxes):
                    continue
                spans.append((abs(center - boss['x']), center, base_y))
        if not spans:
            raise ValueError(f'level {level} has no clear flat satellite span')
        sat_tiers = 1 + (seed + level) % 2
        sat_materials = [('stone', 'stone'), ('crystal', 'crystal')][:sat_tiers]
        satellite = None
        for _, center, sat_base in sorted(spans):
            candidate, _ = generate_fort(seed + level + 1, sat_base, center - 15, center + 15,
                                          sat_tiers, 1, sat_materials, ground_fn=ground_fn)
            if (not any(_boxes_intersect(block, box) for block in candidate for box in entity_boxes)
                    and not any(_boxes_intersect(main, block) for main in blocks for block in candidate)):
                satellite = candidate
                break
        if satellite is None:
            raise ValueError(f'level {level} has no spawn-clear satellite fort')
        blocks.extend(satellite)
    return blocks


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


def frame(base, xs, ph, pillar, floor, pw=10, pillars=None):
    """One tier of a collapsible fort: pillars standing on `base`, one thin floor across them.
    xs = pillar centres; pillars = optional per-pillar materials. Returns (blocks, top of the floor = the next base)."""
    blocks = []
    for i, x in enumerate(xs):
        m = pillars[i] if pillars else pillar
        blocks.append(blk(m, x, base - ph / 2, pw, ph))
    x0, x1 = min(xs) - pw / 2 - 3, max(xs) + pw / 2 + 3
    blocks.append(blk(floor, (x0 + x1) / 2, base - ph - 3, x1 - x0, 6))
    return blocks, base - ph - 6


def write(n, name, realm, kind, worldW, hints, terrain, blocks, monsters, target, chests=None, **extra):
    if OPTIONS.candidates and n not in BOSS_LEVELS:
        return
    shots = extra.pop('shots', 4 if n <= 3 else (5 if n <= 7 else 6))
    d = {
        'id': n, 'name': name, 'realm': realm, 'kind': kind, 'worldW': worldW, 'shots': shots, 'hints': hints,
        'scoreTarget': target,
    }
    d.update(extra)
    d['terrain'] = terrain
    if OPTIONS.candidates:
        d['blocks'] = _candidate_forts(n, terrain, monsters, worldW, OPTIONS.seed)
    elif n in ADOPTED and not OPTIONS.no_adopt:
        d['blocks'] = _candidate_forts(n, terrain, monsters, worldW, ADOPTED[n], satellites=True)
    else:
        d['blocks'] = blocks
    d['monsters'] = monsters
    if chests:
        d['chests'] = chests
    output = GENERATED if OPTIONS.candidates else OUT
    os.makedirs(output, exist_ok=True)
    suffix = '_candidate' if OPTIONS.candidates else ''
    path = os.path.join(output, 'level_%02d%s.json' % (n, suffix))
    with open(path, 'w', newline='\n') as f:
        json.dump(d, f, indent=2)
    if OPTIONS.candidates:
        print('wrote', os.path.normpath(path), 'seed', OPTIONS.seed, '-', len(d['blocks']), 'blocks')
    else:
        print('wrote', os.path.normpath(path), '-', len(blocks), 'blocks', len(monsters), 'monsters', len(chests or []), 'chests')


# ---------------------------------------------------------------- Goblin Hills

# 1 First fort: a low hill, a stone-footed wooden fort at mid range.
write(1, 'First fort', 'goblin_hills', 'siege', 432, ['Drag back from the sling, then let go.'],
      [[0, 320], [110, 320], [140, 308], [190, 308], [216, 320], [432, 320]],
      [blk('stone', 232, 306, 10, 28), blk('stone', 268, 306, 10, 28), blk('wood', 250, 289, 56, 6), blk('wood', 236, 276, 6, 20),
       blk('wood', 264, 276, 6, 20), blk('wood', 250, 263, 48, 6), blk('stone', 238, 254, 12, 12), blk('wood', 290, 313, 14, 14),
       blk('stone', 315, 306, 10, 28), blk('wood', 315, 289, 28, 6)],
      [mon('goblin_grunt', 250, 313), mon('goblin_grunt', 260, 253), mon('goblin_grunt', 308, 313), mon('goblin_grunt', 325, 281)], 720)

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

# 4 Hill fort: a two-tier frame fort on the plateau (stone feet, wood above). Chief and bomber in the lower bays, grunts upstairs.
P4 = 288
f4a, t4a = frame(P4, [190, 226, 262], 28, 'stone', 'wood')
f4b, t4b = frame(t4a, [190, 226, 262], 24, 'wood', 'wood')
b4 = f4a + f4b + [blk('stone', 208, t4b - 6, 12, 12), blk('stone', 244, t4b - 6, 12, 12)]
write(4, 'Hill fort', 'goblin_hills', 'boss', 600, ['Runners bolt after your first shot!'],
      [[0, 320], [140, 320], [176, P4], [270, P4], [300, 320], [600, 320]],
      b4,
      [mon('goblin_chief', 208, stand(P4, 21)), mon('goblin_bomber', 244, stand(P4)), mon('goblin_grunt', 208, stand(t4a)),
       mon('goblin_grunt', 244, stand(t4a)), mon('goblin_grunt', 120, stand(GROUND)), mon('goblin_grunt', 181, stand(P4)),
       mon('skeleton_runner', 312, stand(GROUND), dir=1, speed=0.55, delay=0.8), mon('skeleton_runner', 330, stand(GROUND), dir=1, speed=0.5, delay=1.2)],
      1350, escapeLimit=1, exit={'x': 580, 'y': GROUND - 13}, shots=5, runnersStartOnShot=True,
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

# 8 Elf bastion: a stepped cliff, a three-tier frame keep on the upper step with a bridge floor, a lower outpost.
P8a, P8b = 300, 268
f8a, t8a = frame(P8b, [238, 272, 306], 28, 'wood', 'wood')
f8b, t8b = frame(t8a, [238, 272, 306], 26, 'wood', 'wood')
f8c, t8c = frame(t8b, [238, 272, 306], 22, 'wood', 'wood')
b8 = f8a + f8b + f8c + [
    blk('stone', 160, P8a - 20, 12, 40), blk('stone', 174, P8a - 20, 12, 40), blk('stone', 167, P8a - 46, 26, 12),
]
write(8, 'Elf bastion', 'dark_elf_wood', 'boss', 432, ['Defeat the Dark Elf Matron.'],
      [[0, 320], [110, 320], [126, P8a], [196, P8a], [220, P8b], [336, P8b], [356, 320], [432, 320]],
      b8,
      [mon('dark_elf_matron', 255, stand(P8b, 20)), mon('dark_elf_archer', 255, stand(t8b)), mon('goblin_grunt', 255, stand(t8a)),
       mon('dark_elf_hexer', 289, stand(P8b)), mon('dark_elf_archer', 190, stand(P8a)), mon('imp', 205, 150),
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

# 12 Iron Throne: a two-tier frame keep, iron feet, stone above; the Iron Warlord holds the ground bay.
P12 = 280
f12a, t12a = frame(P12, [196, 248, 300], 36, 'stone', 'stone', pillars=['stone', 'stone', 'iron'])
f12b, t12b = frame(t12a, [196, 248, 300], 28, 'stone', 'stone')
b12 = f12a + f12b + [blk('iron', 248, t12b - 6, 36, 12), blk('stone', 150, P12 - 14, 10, 28)]
write(12, 'Iron Throne', 'iron_keep', 'boss', 648,
      ['Wait for the visor to open for 2x.', 'Boulders shake the ground. Stay steady.'],
      [[0, 320], [110, 320], [135, P12], [330, P12], [360, 320], [648, 320]],
      b12,
      [mon('iron_warlord', 222, stand(P12, 30)),
       mon('dark_elf_hexer', 168, stand(P12)),
       mon('goblin_grunt', 222, stand(t12a))],
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

# 16 Frost throne: a three-tier frame fort, stone feet, crystal above. The Frost Giant holds the hall; hit the chest crystal for 2x.
P16 = 296
f16a, t16a = frame(P16, [180, 290], 52, 'stone', 'stone')
f16b, t16b = frame(t16a, [205, 265], 30, 'crystal', 'crystal', pw=8)
f16c, t16c = frame(t16b, [235], 24, 'crystal', 'crystal', pw=8)
b16 = f16a + f16b + f16c + [blk('crystal', 198, P16 - 19, 8, 38), blk('crystal', 272, P16 - 19, 8, 38)]
write(16, 'Frost throne', 'frost_peaks', 'boss', 648,
      ['Hit the glowing chest crystal for 2x.', 'Icicles fall in a band. Stay steady.'],
      [[0, 320], [110, 320], [135, P16], [340, P16], [370, 320], [648, 320]],
      b16,
      [mon('frost_giant', 235, stand(P16, 46)), mon('dark_elf_archer', 220, stand(t16a)),
       mon('dark_elf_archer', 250, stand(t16a))],
      1100, shots=6,
      loadout=['w_iron_cleaver', 'w_horned_scepter', 'w_hunters_pike', 'w_ashwood_staff', 'w_blast_tube', 'w_scrapheap_scattergun'])

# ---------------------------------------------------------------- Ember Forge
LOAD5 = ['w_iron_cleaver', 'w_ashwood_staff', 'w_hunters_pike', 'w_blast_tube', 'w_scrapheap_scattergun', 'w_hunters_boomerang']

# 17 Cinder gate: a wooden-floored tower, an ogre at its foot and lava imps wobbling above.
P17 = 300
b17, top17 = tower(225, P17, w=60, tiers=3, pillar='stone', ph=26, floor='stone')
b17 += [blk('stone', 168, P17 - 12, 10, 24), blk('iron', 225, P17 - 6, 36, 12)]
write(17, 'Cinder gate', 'ember_forge', 'siege', 540, ['Imps fly. Ogres stomp. Break the tower.'],
      [[0, 320], [130, 320], [160, P17], [310, P17], [340, 320], [540, 320]],
      b17,
      [mon('forge_ogre', 225, stand(P17 - 12, 34)), mon('lava_imp', 200, P17 - 150), mon('lava_imp', 255, P17 - 155),
       mon('lava_imp', 290, P17 - 70), mon('dark_elf_archer', 205, stand(top17)), mon('forge_ogre', 288, stand(P17, 34))],
      1400, shots=6, loadout=LOAD5)

# 18 Molten bridge: a pit in the middle, runners racing the far shelf, an ogre guarding it.
LO18, PIT18 = 300, 336
b18 = [
    blk('stone', 185, LO18 - 15, 10, 30), blk('stone', 225, LO18 - 15, 10, 30), blk('wood', 205, LO18 - 33, 50, 6),
    blk('stone', 372, LO18 - 15, 10, 30), blk('stone', 412, LO18 - 15, 10, 30), blk('stone', 392, LO18 - 33, 50, 6),
]
write(18, 'Molten bridge', 'ember_forge', 'runner', 648, ['Skeletons race across the bridge.', 'Stop them before the exit.'],
      [[0, 320], [120, 320], [150, LO18], [250, LO18], [270, PIT18], [340, PIT18], [360, LO18], [450, LO18], [480, 320], [648, 320]],
      b18,
      [mon('forge_ogre', 392, stand(LO18, 34)), mon('lava_imp', 205, LO18 - 70), mon('lava_imp', 372, LO18 - 80),
       mon('dark_elf_hexer', 205, stand(LO18 - 37)),
       mon('skeleton_runner', 300, stand(PIT18), dir=1, speed=0.8, delay=0.8), mon('skeleton_runner', 320, stand(PIT18), dir=1, speed=0.7, delay=1.3)],
      1600, escapeLimit=1, exit={'x': 620, 'y': GROUND - 13}, shots=6, loadout=LOAD5)

# 19 Anvil hall: a three-tier hall of stone and iron with two ogres, and a hidden chest holding the Omnitrix Dial.
P19 = 296
b19, top19 = tower(230, P19, w=60, tiers=3, pillar='stone', ph=26, floor='stone')
b19 += [blk('iron', 230, P19 - 6, 36, 12), blk('stone', 165, P19 - 18, 12, 36)]
c19 = [chst('c_l19', 318, P19 - 8, 'w_omnitrix_dial', 40)]
write(19, 'Anvil hall', 'ember_forge', 'siege', 540, ['A chest hides in the rubble.', 'Iron resists. Shatter the pillars.'],
      [[0, 320], [120, 320], [150, P19], [320, P19], [350, 320], [540, 320]],
      b19,
      [mon('forge_ogre', 230, stand(P19 - 12, 34)), mon('forge_ogre', 230, stand(P19 - 12 - 32, 34)),
       mon('lava_imp', 210, top19 - 40), mon('lava_imp', 255, top19 - 46), mon('dark_elf_hexer', 165, stand(P19 - 36))],
      1900, chests=c19, shots=6, loadout=LOAD5)

# 20 Forge throne: a three-tier frame keep, iron and stone. The Forge Tyrant holds the hall; the anvil on its back opens for 2x.
P20 = 296
f20a, t20a = frame(P20, [180, 290], 52, 'iron', 'stone')
f20b, t20b = frame(t20a, [205, 265], 30, 'stone', 'stone', pw=8)
f20c, t20c = frame(t20b, [235], 24, 'stone', 'stone', pw=8)
b20 = f20a + f20b + f20c + [blk('stone', 198, P20 - 19, 8, 38), blk('stone', 272, P20 - 19, 8, 38), blk('iron', 235, t20c - 6, 36, 12)]
write(20, 'Forge throne', 'ember_forge', 'boss', 648,
      ['Hit the glowing anvil for 2x.', 'Lava surges in a band. Stay steady.'],
      [[0, 320], [110, 320], [135, P20], [340, P20], [370, 320], [648, 320]],
      b20,
      [mon('forge_tyrant', 235, stand(P20, 46)), mon('lava_imp', 205, 140), mon('lava_imp', 265, 144),
       mon('forge_ogre', 148, stand(P20, 34))],
      2600, shots=6, loadout=LOAD5)

# ---------------------------------------------------------------- Sky Citadel
# 21 Cloud dock: harpies circle a stone tower, a storm mage shields its foot. A chest holds the Pinata MIRV.
P21 = 300
b21, top21 = tower(225, P21, w=60, tiers=3, pillar='stone', ph=26, floor='wood')
b21 += [blk('stone', 168, P21 - 12, 10, 24), blk('iron', 225, P21 - 6, 36, 12)]
c21 = [chst('c_l21', 318, P21 - 8, 'w_pinata_mirv', 40)]
write(21, 'Cloud dock', 'sky_citadel', 'siege', 540, ['Harpies swoop. A mage shields the rest.', 'Break the tower.'],
      [[0, 320], [130, 320], [160, P21], [310, P21], [340, 320], [540, 320]],
      b21,
      [mon('forge_ogre', 225, stand(P21 - 12, 34)), mon('forge_ogre', 288, stand(P21, 34)), mon('cloud_harpy', 200, P21 - 150), mon('cloud_harpy', 255, P21 - 155),
       mon('storm_mage', 255, stand(P21, 14)), mon('dark_elf_archer', 205, stand(top21))],
      1800, chests=c21, shots=6, loadout=LOAD5)

# 22 Gale bridge: a pit between two tower shelves, skeletons racing the far side, harpies above.
LO22, PIT22 = 300, 336
b22 = [
    blk('stone', 185, LO22 - 15, 10, 30), blk('stone', 225, LO22 - 15, 10, 30), blk('wood', 205, LO22 - 33, 50, 6),
    blk('stone', 372, LO22 - 15, 10, 30), blk('stone', 412, LO22 - 15, 10, 30), blk('stone', 392, LO22 - 33, 50, 6),
]
c22 = [chst('c_l22', 440, LO22 - 8, 'w_earthworm_drill', 40)]
write(22, 'Gale bridge', 'sky_citadel', 'runner', 648, ['Skeletons race the bridge.', 'Stop them before the exit.'],
      [[0, 320], [120, 320], [150, LO22], [250, LO22], [270, PIT22], [340, PIT22], [360, LO22], [450, LO22], [480, 320], [648, 320]],
      b22,
      [mon('forge_ogre', 392, stand(LO22, 34)), mon('cloud_harpy', 205, LO22 - 70), mon('cloud_harpy', 372, LO22 - 80),
       mon('storm_mage', 205, stand(LO22 - 37)),
       mon('skeleton_runner', 300, stand(PIT22), dir=1, speed=0.8, delay=0.8), mon('skeleton_runner', 320, stand(PIT22), dir=1, speed=0.7, delay=1.3)],
      1700, chests=c22, escapeLimit=1, exit={'x': 620, 'y': GROUND - 13}, shots=6, loadout=LOAD5)

# 23 Thunder hall: a tall stone-and-iron hall; mages shield two ogres. A chest holds the Chain Rod.
P23 = 296
b23, top23 = tower(230, P23, w=60, tiers=3, pillar='stone', ph=26, floor='stone')
b23 += [blk('iron', 230, P23 - 6, 36, 12), blk('stone', 165, P23 - 18, 12, 36), blk('iron', 292, P23 - 18, 10, 36)]
c23 = [chst('c_l23', 330, P23 - 8, 'w_chain_rod', 40)]
write(23, 'Thunder hall', 'sky_citadel', 'siege', 540, ['Mages shield the ogres.', 'A chest hides in the rubble.'],
      [[0, 320], [120, 320], [150, P23], [320, P23], [350, 320], [540, 320]],
      b23,
      [mon('forge_ogre', 230, stand(P23 - 12, 34)), mon('forge_ogre', 230, stand(P23 - 12 - 32, 34)),
       mon('cloud_harpy', 210, top23 - 40), mon('cloud_harpy', 255, top23 - 46), mon('storm_mage', 165, stand(P23 - 36)),
       mon('storm_mage', 300, stand(P23, 14))],
      2100, chests=c23, shots=6, loadout=LOAD5)

# 24 Storm throne: the citadel, a three-tier frame keep with iron feet, stone and crystal above. The eye on its chest opens for 2x.
P24 = 296
f24a, t24a = frame(P24, [165, 305], 52, 'iron', 'stone')
f24b, t24b = frame(t24a, [190, 280], 30, 'stone', 'stone', pw=8)
f24c, t24c = frame(t24b, [215, 255], 24, 'crystal', 'crystal', pw=8)
b24 = f24a + f24b + f24c + [blk('stone', 190, P24 - 19, 8, 38), blk('stone', 280, P24 - 19, 8, 38), blk('iron', 235, t24c - 6, 36, 12)]
write(24, 'Storm throne', 'sky_citadel', 'boss', 648,
      ['Hit the glowing eye for 2x.', 'Lightning falls in a band. Stay steady.'],
      [[0, 320], [110, 320], [135, P24], [340, P24], [370, 320], [648, 320]],
      b24,
      [mon('storm_sovereign', 235, stand(P24, 46)), mon('cloud_harpy', 205, 130), mon('cloud_harpy', 265, 134),
       mon('storm_mage', 148, stand(P24, 14))],
      3600, shots=6, loadout=LOAD5)
