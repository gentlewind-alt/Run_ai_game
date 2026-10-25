#!/usr/bin/env python3
"""Seeded level generator for MONSTER MASH siege levels, built from the thesis archetypes (docs/monster_mash/12_level_archetypes.md).

usage (from game/):
  python scripts/level_gen.py --realm frost --archetype balanced_beam --seed 3 --difficulty 2 --out scripts/generated_levels/x.json

A generated level is a normal level file (id 99, the sandbox slot) so tools/gate_file.mjs can test it: stand still at spawn,
collapse when hit, solver band. Nothing here writes into public/data/levels. Archetypes:
  tower          a stable multi-tier frame fort (fort_gen.py) plus an optional satellite spire
  balanced_beam  a long beam on one post, ranged monsters on its ends, heavies under it
  hanging_weight a slab and a heavy block balanced on one post over a cluster
  bomber_relay   Goblin Bombers in two satellites and on the ground (the chain runs between close ones)
"""
import argparse
import json
import os
import sys
from random import Random

sys.path.insert(0, os.path.dirname(__file__))
from fort_gen import _overlap, _rect, blk, check_stable, frame, generate_fort  # noqa: E402

GROUND = 320
SIZES = {
    'goblin_grunt': (12, 14), 'goblin_bomber': (12, 14), 'dark_elf_archer': (12, 14), 'dark_elf_hexer': (12, 14),
    'imp': (10, 10), 'orc_brute': (22, 28), 'troll': (24, 28), 'ice_golem': (28, 30), 'frost_wolf': (22, 14),
    'lava_imp': (12, 12), 'forge_ogre': (30, 34), 'cloud_harpy': (14, 12), 'storm_mage': (12, 14),
    'goblin_chief': (18, 21), 'dark_elf_matron': (17, 20), 'iron_warlord': (26, 30), 'frost_giant': (36, 46), 'forge_tyrant': (36, 46),
    'storm_sovereign': (36, 46),
}
REALMS = {
    'hills': dict(id='goblin_hills', heavy=['goblin_grunt'], ranged='goblin_grunt', support='goblin_grunt', flyers=[],
                  mats=[('stone', 'wood'), ('wood', 'wood'), ('wood', 'wood')], screen='stone'),
    'wood': dict(id='dark_elf_wood', heavy=['dark_elf_hexer'], ranged='dark_elf_archer', support='dark_elf_hexer', flyers=['imp'],
                 mats=[('stone', 'wood'), ('wood', 'wood'), ('wood', 'wood')], screen='stone'),
    'keep': dict(id='iron_keep', heavy=['orc_brute', 'troll'], ranged='dark_elf_archer', support='dark_elf_hexer', flyers=['imp'],
                 mats=[('iron', 'stone'), ('stone', 'stone'), ('stone', 'stone')], screen='iron'),
    'frost': dict(id='frost_peaks', heavy=['ice_golem'], ranged='dark_elf_archer', support='dark_elf_hexer', flyers=[],
                  mats=[('stone', 'stone'), ('crystal', 'crystal'), ('crystal', 'crystal')], screen='crystal'),
    'ember': dict(id='ember_forge', heavy=['forge_ogre'], ranged='dark_elf_archer', support='dark_elf_hexer', flyers=['lava_imp'],
                  mats=[('stone', 'stone'), ('stone', 'stone'), ('wood', 'wood')], screen='iron'),  # iron feet made the frame too hard to topple
    'sky': dict(id='sky_citadel', heavy=['forge_ogre'], ranged='dark_elf_archer', support='storm_mage', flyers=['cloud_harpy'],
                mats=[('iron', 'stone'), ('stone', 'stone'), ('crystal', 'crystal')], screen='crystal'),
}
BIG = {'forge_ogre'}  # 330 hp: never two of them in one cluster
LOADOUT = ['w_iron_cleaver', 'w_ashwood_staff', 'w_hunters_pike', 'w_blast_tube', 'w_scrapheap_scattergun', 'w_hunters_boomerang']
NAMES = {
    'tower': ['Spire Yard', 'Twin Keep', 'The Long Fort', 'High Frame'],
    'balanced_beam': ['The One-Post Choir', 'Seesaw Hall', 'The Balanced Beam'],
    'hanging_weight': ['The Hanging Weight', 'Loaded Slab', 'The Drop Post'],
    'bomber_relay': ['The Fuse Line', 'Bomber Relay', 'The Short Fuse'],
}
HINTS = {
    'tower': 'Topple the frame. Hit the supports.',
    'balanced_beam': 'Cut the post, not the beam.',
    'hanging_weight': 'A heavy weight hangs on one post.',
    'bomber_relay': 'Light one bomber. Watch the chain.',
}


def stand(top, h):
    return top - h / 2


def mon(t, x, top, **kw):
    """A monster of type t standing on a surface at `top`."""
    h = SIZES[t][1]
    d = {'t': t, 'x': round(x, 1), 'y': round(stand(top, h), 1)}
    d.update(kw)
    return d


def fly(t, x, y):
    return {'t': t, 'x': round(x, 1), 'y': round(y, 1)}


def box(m):
    w, h = SIZES[m['t']]
    return {'x': m['x'], 'y': m['y'], 'w': w, 'h': h}


def terrain_for(P):
    return [[0, GROUND], [130, GROUND], [160, P], [310, P], [340, GROUND], [540, GROUND]]


def ground_fn(P):
    def f(x):
        if x < 130 or x > 340:
            return GROUND
        if x < 160:
            return GROUND + (P - GROUND) * (x - 130) / 30
        if x <= 310:
            return P
        return P + (GROUND - P) * (x - 310) / 30
    return f


def basic_ok(blocks, gf):
    """Overlap and contact check for single-post archetypes (a balanced beam is deliberately not 'frame stable')."""
    for i, b in enumerate(blocks):
        if any(_overlap(b, o) for o in blocks[i + 1:]):
            return False
        left, _, right, bottom = _rect(b)
        on_ground = abs(gf((left + right) / 2) - bottom) < 0.6
        on_block = any(o is not b and abs(_rect(o)[1] - bottom) < 0.1 and min(right, _rect(o)[2]) - max(left, _rect(o)[0]) > 1 for o in blocks)
        if not (on_ground or on_block):
            return False
    return True


def clusters(blocks):
    """Group blocks that touch (rectangles within 1 px): separate structures are stability-checked on their own."""
    parent = list(range(len(blocks)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for i, a in enumerate(blocks):
        ax0, ay0, ax1, ay1 = _rect(a)
        for j in range(i + 1, len(blocks)):
            bx0, by0, bx1, by1 = _rect(blocks[j])
            if min(ax1, bx1) - max(ax0, bx0) > -1 and min(ay1, by1) - max(ay0, by0) > -1:
                parent[find(j)] = find(i)
    groups = {}
    for i, b in enumerate(blocks):
        groups.setdefault(find(i), []).append(b)
    return list(groups.values())


def pick(rng, items):
    return items[rng.randrange(len(items))]


def flyers(rng, R, d, avoid):
    """Flyers above the structures, away from every block and each other."""
    out = []
    if not R['flyers']:
        return out
    for i in range(d + 1):
        for _ in range(30):
            x, y = rng.randint(190, 300), rng.randint(110, 175)
            # flyers sway about 26 px sideways: keep them clear of every block, or well above it
            if all(abs(x - o['x']) > 56 for o in out) and not any(abs(x - bx) < bw / 2 + 36 and y > by - bh / 2 - 44 for bx, by, bw, bh in avoid):
                out.append(fly(pick(rng, R['flyers']), x, y))
                break
    return out


def tower(rng, R, P, d):
    gf = ground_fn(P)
    tiers = 2 + (1 if d >= 2 else 0)
    left_sat = d >= 3
    x_min = (212 if left_sat else 188) + rng.randint(0, 4)
    heavy_t = pick(rng, R['heavy'])
    width = max(rng.choice([62, 72, 82]), 2 * (SIZES[heavy_t][0] + 16))  # each bay must fit its monster between two posts
    x_max = x_min + width
    bay = width / 2
    ground_mons = [mon(heavy_t, x_min + bay / 2, P)]
    ground_mons.append(mon(heavy_t if d >= 3 and heavy_t not in BIG else R['support'], x_min + bay * 1.5, P))
    blocks, tops = generate_fort(rng.randrange(10 ** 6), P, x_min, x_max, tiers, 2, R['mats'], [box(m) for m in ground_mons], ground_fn=gf)
    roof = tops[-1]
    mons = ground_mons + [mon(R['ranged'], x_min + bay, roof)]
    if d >= 2:
        upstairs = pick(rng, R['heavy'])
        mons.append(mon(upstairs if SIZES[upstairs][1] <= 26 else R['ranged'], x_min + bay / 2, tops[0]))
    if left_sat:
        # posts at 174 and 192 stand well inside the plateau (x 160 and up: a post on the slope edge leans) and the floor clears the tower, clear of the tower
        sat, st = generate_fort(rng.randrange(10 ** 6), P, 174, 192, 1, 1, [(R['screen'], R['screen'])], ground_fn=gf)
        blocks += sat
        mons.append(mon(R['ranged'], 183, st[-1]))
    elif x_max < 262 and rng.random() < 0.8:
        cx = rng.randint(272, 292)
        sat, st = generate_fort(rng.randrange(10 ** 6), P, cx - 12, cx + 12, 1 + rng.randint(0, 1), 1, [(R['screen'], R['screen'])] * 2, ground_fn=gf)
        blocks += sat
        mons.append(mon(R['ranged'], cx, st[-1]))
    avoid = [(b['x'], b['y'], b['w'], b['h']) for b in blocks]
    return blocks, mons + flyers(rng, R, d - 1, avoid)


def balanced_beam(rng, R, P, d):
    heavy_t = pick(rng, R['heavy'])
    hw, hh = SIZES[heavy_t]
    post_h = max(rng.randint(34, 46), hh + 10)
    post_x = 236 + rng.randint(-8, 8)
    beam_w = rng.choice([100, 116, 128])
    beam_y = P - post_h - 3
    blocks = [blk('wood', post_x, P - post_h / 2, 8, post_h), blk('wood', post_x, beam_y, beam_w, 6)]
    screen_x = post_x - beam_w / 2 - 14
    if screen_x >= 172:  # a screen on the slope would slide
        blocks.append(blk(R['screen'], screen_x, P - 14, 8, 28))
    mons = [mon(R['ranged'], post_x - beam_w / 2 + 12, beam_y - 3), mon(R['ranged'], post_x + beam_w / 2 - 12, beam_y - 3),
            mon(heavy_t, post_x + 6 + hw / 2 + 4, P), mon(R['support'], post_x - 30, P)]
    if d >= 2:
        mons.append(mon(heavy_t, post_x + beam_w / 2 + hw / 2 - 20, P) if post_x + beam_w / 2 + hw / 2 - 20 < 318 else mon(R['ranged'], post_x - 14, P))
    if d >= 3:
        mons.append(mon(R['ranged'], post_x - 14, P))
    avoid = [(b['x'], b['y'], b['w'], b['h']) for b in blocks]
    return blocks, mons + flyers(rng, R, d - 1, avoid)


def hanging_weight(rng, R, P, d):
    heavy_t = pick(rng, R['heavy'])
    hw, hh = SIZES[heavy_t]
    post_h = max(44, hh + 10)
    post_x = 250 + rng.randint(-8, 8)
    slab_w = 100
    bx = post_x + 26
    slab_area, block_area = slab_w * 6, 14 * 14
    slab_c = (post_x * (slab_area + block_area) - block_area * bx) / slab_area
    slab_y = P - post_h - 3
    blocks = [blk('wood', post_x, P - post_h / 2, 8, post_h), blk('stone', round(slab_c, 1), slab_y, slab_w, 6),
              blk('stone', bx, slab_y - 3 - 7, 14, 14)]
    f, _ = frame(P, [170, 186], 40, R['screen'], R['screen'], pillar_w=8)
    if slab_c - slab_w / 2 > 200:
        blocks += f
    mons = [mon(heavy_t, post_x - 6 - hw / 2 - 6, P), mon(R['support'], post_x + 24, P)]
    if d >= 2 and heavy_t not in BIG:
        mons.append(mon(heavy_t, 308, P))
    avoid = [(b['x'], b['y'], b['w'], b['h']) for b in blocks]
    return blocks, mons + flyers(rng, R, d, avoid)


def bomber_relay(rng, R, P, d):
    heavy_t = pick(rng, R['heavy'])
    f1, t1 = frame(P, [180, 198], 24, 'wood', 'wood')
    s2 = 244 + rng.randint(0, 6)
    f2, t2 = frame(P, [s2, s2 + 16], 28, 'stone', 'stone')
    f3, t3 = frame(t2, [s2, s2 + 16], 22, 'wood', 'wood')
    gap = rng.choice([28, 34])
    mons = [mon('goblin_bomber', 189, t1), mon('goblin_bomber', 189 + gap, P), mon('goblin_bomber', s2 + 8, t3),
            mon(R['support'] if heavy_t in BIG else heavy_t, 290, P)]
    if d >= 2:
        mons.append(mon(R['ranged'], 223 + gap, P))
    blocks = f1 + f2 + f3
    avoid = [(b['x'], b['y'], b['w'], b['h']) for b in blocks]
    return blocks, mons + flyers(rng, R, d - 2, avoid)


ARCHETYPES = {'tower': tower, 'balanced_beam': balanced_beam, 'hanging_weight': hanging_weight, 'bomber_relay': bomber_relay}


def generate(seed, realm, archetype, difficulty=2):
    rng = Random(f'{realm}-{archetype}-{seed}')
    R = REALMS[realm]
    for attempt in range(40):
        P = rng.choice([288, 292, 296, 300])
        blocks, mons = ARCHETYPES[archetype](rng, R, P, difficulty)
        reach_ok = all(m['x'] <= 318 for m in mons)
        stable = all(check_stable(c, ground_fn(P)) for c in clusters(blocks)) if archetype == 'tower' else basic_ok(blocks, ground_fn(P))
        if reach_ok and stable:
            break
    else:
        raise ValueError('no stable, reachable layout in 40 attempts')
    return {
        'id': 99, 'name': pick(rng, NAMES[archetype]), 'realm': R['id'], 'kind': 'siege', 'worldW': 540, 'shots': 6,
        'hints': [HINTS[archetype]], 'scoreTarget': 1500, 'terrain': terrain_for(P), 'blocks': blocks, 'monsters': mons,
        'loadout': LOADOUT, 'gen': {'seed': seed, 'realm': realm, 'archetype': archetype, 'difficulty': difficulty},
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--realm', choices=list(REALMS), required=True)
    ap.add_argument('--archetype', choices=list(ARCHETYPES), required=True)
    ap.add_argument('--seed', type=int, default=1)
    ap.add_argument('--difficulty', type=int, default=2, choices=[1, 2, 3])
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    level = generate(a.seed, a.realm, a.archetype, a.difficulty)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    with open(a.out, 'w', newline='\n') as f:
        json.dump(level, f, indent=2)
    print('wrote', a.out, len(level['blocks']), 'blocks', len(level['monsters']), 'monsters')


if __name__ == '__main__':
    main()
