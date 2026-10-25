#!/usr/bin/env python3
"""Seeded level generator for MONSTER MASH siege levels, built from the thesis archetypes (docs/monster_mash/12_level_archetypes.md).

A generated level is a normal level file (id 99, the sandbox slot) so tools/gate_file.mjs can test it: stand still at spawn,
collapse when hit, solver band. Nothing here writes into public/data/levels. Archetypes:
  tower          multi-tier frame fort (fort_gen.py, tapered) with battlements and a front watchtower
  balanced_beam  a long beam on one post, ranged monsters on its ends, heavies under it
  hanging_weight a slab and two heavy blocks balanced on one post over a cluster
  bomber_relay   Goblin Bombers in three stepped towers (the chain runs between close ones)
  boss_citadel   difficulty 4: vanguard tower plus a 4-tier coaxial keep with the realm's boss (gate pass rate about 2/3, keep realm weakest)

usage (from game/):
  python scripts/level_gen.py --realm frost --archetype balanced_beam --seed 3 --difficulty 2 --out scripts/generated_levels/x.json
"""
import argparse
import json
import os
import sys
from random import Random

sys.path.insert(0, os.path.dirname(__file__))
from fort_gen import _overlap, _rect, blk, check_stable, crenellations, frame, generate_fort  # noqa: E402

GROUND = 320
SIZES = {
    'goblin_grunt': (12, 14), 'goblin_bomber': (12, 14), 'dark_elf_archer': (12, 14), 'dark_elf_hexer': (12, 14),
    'imp': (10, 10), 'orc_brute': (22, 28), 'troll': (24, 28), 'ice_golem': (28, 30), 'frost_wolf': (22, 14),
    'lava_imp': (12, 12), 'forge_ogre': (30, 34), 'cloud_harpy': (14, 12), 'storm_mage': (12, 14),
    'goblin_chief': (18, 21), 'dark_elf_matron': (17, 20), 'iron_warlord': (26, 30), 'frost_giant': (36, 46), 'forge_tyrant': (36, 46),
    'storm_sovereign': (36, 46),
}
REALMS = {
    'hills': dict(id='goblin_hills', boss='goblin_chief', heavy=['goblin_grunt'], ranged='goblin_grunt', support='goblin_grunt', flyers=[],
                  mats=[('stone', 'wood'), ('wood', 'wood'), ('wood', 'wood'), ('wood', 'wood')], screen='stone'),
    'wood': dict(id='dark_elf_wood', boss='dark_elf_matron', heavy=['dark_elf_hexer'], ranged='dark_elf_archer', support='dark_elf_hexer', flyers=['imp'],
                 mats=[('stone', 'wood'), ('wood', 'wood'), ('wood', 'wood'), ('wood', 'wood')], screen='stone'),
    'keep': dict(id='iron_keep', boss='iron_warlord', heavy=['orc_brute', 'troll'], ranged='dark_elf_archer', support='dark_elf_hexer', flyers=['imp'],
                 mats=[('iron', 'stone'), ('stone', 'wood'), ('wood', 'wood'), ('wood', 'wood')], screen='iron'),
    'frost': dict(id='frost_peaks', boss='frost_giant', heavy=['ice_golem'], ranged='dark_elf_archer', support='dark_elf_hexer', flyers=[],
                  mats=[('stone', 'stone'), ('crystal', 'stone'), ('crystal', 'crystal'), ('crystal', 'crystal')], screen='crystal'),
    'ember': dict(id='ember_forge', boss='forge_tyrant', heavy=['forge_ogre'], ranged='dark_elf_archer', support='dark_elf_hexer', flyers=['lava_imp'],
                  mats=[('stone', 'stone'), ('stone', 'wood'), ('wood', 'wood'), ('wood', 'wood')], screen='stone'),
    'sky': dict(id='sky_citadel', boss='storm_sovereign', heavy=['forge_ogre'], ranged='dark_elf_archer', support='storm_mage', flyers=['cloud_harpy'],
                mats=[('stone', 'stone'), ('crystal', 'stone'), ('crystal', 'crystal'), ('crystal', 'crystal')], screen='crystal'),
}
BIG = {'forge_ogre'}
LOADOUT = ['w_iron_cleaver', 'w_ashwood_staff', 'w_hunters_pike', 'w_blast_tube', 'w_scrapheap_scattergun', 'w_hunters_boomerang']
NAMES = {
    'tower': ['Grand Spire', 'Twin Bastion', 'The High Citadel', 'Crown Keep'],
    'balanced_beam': ['The One-Post Choir', 'Cantilever Hall', 'The Grand Seesaw'],
    'hanging_weight': ['The Hanging Deadfall', 'Pendulum Gate', 'The Drop Bastion'],
    'bomber_relay': ['Powder Magazine', 'The Fuse Bastion', 'Chain Reaction Keep'],
    'boss_citadel': ['The Obsidian Citadel', 'Overlord Sanctum', 'Grand Bastion'],
}
HINTS = {
    'tower': 'Shatter the lower load-bearing posts to bring the keep down.',
    'balanced_beam': 'Cut the central fulcrum post to tip the upper gallery.',
    'hanging_weight': 'Snap the support post and let the deadfall crush the garrison.',
    'bomber_relay': 'Ignite one bomber to detonate the entire powder chain.',
    'boss_citadel': 'Breach the outer watchtower, then collapse the grand colonnade.',
}


def stand(top, h):
    return top - h / 2


def mon(t, x, top, **kw):
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
    return [[0, GROUND], [125, GROUND], [155, P], [320, P], [350, GROUND], [540, GROUND]]


def ground_fn(P):
    def f(x):
        if x < 125 or x > 350:
            return GROUND
        if x < 155:
            return GROUND + (P - GROUND) * (x - 125) / 30
        if x <= 320:
            return P
        return P + (GROUND - P) * (x - 320) / 30
    return f


def basic_ok(blocks, gf):
    """Overlap and contact check for single-post cantilevers."""
    for i, b in enumerate(blocks):
        if any(_overlap(b, o) for o in blocks[i + 1:]):
            return False
        left, _, right, bottom = _rect(b)
        on_ground = abs(gf((left + right) / 2) - bottom) < 0.6
        on_block = any(
            o is not b and abs(_rect(o)[1] - bottom) < 0.15 and min(right, _rect(o)[2]) - max(left, _rect(o)[0]) > 1
            for o in blocks
        )
        if not (on_ground or on_block):
            return False
    return True


def clusters(blocks):
    """Group touching blocks so separate towers are stability-checked independently."""
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


def flyers(rng, R, count, avoid):
    out = []
    if not R['flyers'] or count <= 0:
        return out
    for _ in range(count):
        for _ in range(40):
            x, y = rng.randint(185, 305), rng.randint(105, 165)
            if (all(abs(x - o['x']) > 52 for o in out)
                    and not any(abs(x - bx) < bw / 2 + 34 and y > by - bh / 2 - 42 for bx, by, bw, bh in avoid)):
                out.append(fly(pick(rng, R['flyers']), x, y))
                break
    return out


def tower(rng, R, P, d):
    """Grand multi-tier keep with tapered upper spire, battlements, and flanking watchtower."""
    gf = ground_fn(P)
    tiers = 3 if d >= 2 else 2
    x_min = 210 + rng.randint(0, 4)
    heavy_t = pick(rng, R['heavy'])
    width = max(rng.choice([76, 84, 88]), 2 * (SIZES[heavy_t][0] + 16))
    x_max = x_min + width
    bay = width / 2

    ground_mons = [
        mon(heavy_t, x_min + bay * 0.5, P),
        mon(R['support'] if heavy_t in BIG else heavy_t, x_min + bay * 1.5, P),
    ]
    if d >= 2:
        ground_mons.append(mon('goblin_bomber', x_min + bay, P))

    blocks, tops = generate_fort(
        rng.randrange(10 ** 6), P, x_min, x_max, tiers, 2, R['mats'],
        [box(m) for m in ground_mons], ground_fn=gf, taper=True
    )
    mons = list(ground_mons)
    mons.append(mon(R['ranged'], x_min + bay * 0.5, tops[0]))
    mons.append(mon(R['support'], x_min + bay * 1.5, tops[0]))
    if len(tops) >= 2:
        mons.append(mon(R['ranged'], (x_min + x_max) / 2, tops[-1]))

    # Add battlements directly over the top tier's support pillars
    top_pillars = sorted(b['x'] for b in blocks if abs((b['y'] - b['h'] / 2) - (tops[-1] + 6)) < 0.2 and b['w'] <= 12)
    if len(top_pillars) >= 2:
        blocks.extend(crenellations(tops[-1], [top_pillars[0], top_pillars[-1]], R['screen']))

    # Vanguard watchtower in front
    sat_x0, sat_x1 = 168, 192
    sat_tiers = 2 if d >= 2 else 1
    sat_mats = [('stone', 'wood'), ('wood', 'wood')][:sat_tiers]
    sat, st = generate_fort(rng.randrange(10 ** 6), P, sat_x0, sat_x1, sat_tiers, 1, sat_mats, ground_fn=gf)
    blocks.extend(sat)
    mons.append(mon(R['ranged'], (sat_x0 + sat_x1) / 2, st[-1]))
    if sat_tiers >= 2:
        mons.append(mon('goblin_bomber', (sat_x0 + sat_x1) / 2, st[0]))

    avoid = [(b['x'], b['y'], b['w'], b['h']) for b in blocks]
    return blocks, mons + flyers(rng, R, max(0, d - 1), avoid)


def balanced_beam(rng, R, P, d):
    """A high T-beam gallery flanked by a stone-footed guard tower so it takes 2-4 shots instead of 1."""
    heavy_t = pick(rng, R['heavy'])
    hw, hh = SIZES[heavy_t]
    post_h = max(rng.randint(38, 44), hh + 10)
    post_x = 250 + rng.randint(-4, 4)
    beam_w = rng.choice([104, 112, 118])
    beam_y = P - post_h - 3

    # Central fulcrum post + main beam + upper belfry arch on the beam center
    blocks = [
        blk('wood', post_x, P - post_h / 2, 8, post_h),
        blk('wood', post_x, beam_y, beam_w, 6),
        blk('stone', post_x - 16, beam_y - 3 - 10, 6, 20),
        blk('stone', post_x + 16, beam_y - 3 - 10, 6, 20),
        blk('wood', post_x, beam_y - 3 - 20 - 3, 40, 6),
    ]
    # Decoupled stone-footed vanguard watchtower at x=166..186 prevents a 1-shot wipe in frost
    f_left1, t_left1 = frame(P, [166, 184], 28, 'stone', 'stone', pillar_w=8)
    blocks.extend(f_left1)

    mons = [
        mon(R['ranged'], post_x - beam_w / 2 + 12, beam_y - 3),
        mon(R['ranged'], post_x + beam_w / 2 - 12, beam_y - 3),
        mon(heavy_t, post_x + 6 + hw / 2 + 6, P),
        mon(R['support'], post_x - 26, P),
        mon(R['ranged'], 175, t_left1),
    ]
    if d >= 2:
        mons.append(mon(heavy_t if heavy_t not in BIG else R['ranged'], min(310, post_x + beam_w / 2 - 6), P))
    if d >= 3:
        mons.append(mon(R['ranged'], post_x, beam_y - 26))
    avoid = [(b['x'], b['y'], b['w'], b['h']) for b in blocks]
    return blocks, mons + flyers(rng, R, max(0, d - 1), avoid)


def hanging_weight(rng, R, P, d):
    """Cantilevered deadfall poised over a heavy bunker, shielded by a two-tier vanguard gatehouse."""
    heavy_t = pick(rng, R['heavy'])
    hw, hh = SIZES[heavy_t]
    post_h = max(44, hh + 10)
    post_x = 252 + rng.randint(-6, 6)
    slab_w = 104
    slab_y = P - post_h - 3

    blocks = [
        blk('wood', post_x, P - post_h / 2, 8, post_h),
        blk('stone', post_x, slab_y, slab_w, 6),
        blk('stone', post_x + 26, slab_y - 3 - 7, 14, 14),
        blk('stone', post_x - 26, slab_y - 3 - 7, 14, 14),
    ]
    f1, t1 = frame(P, [168, 186], 34, R['screen'], 'stone', pillar_w=8)
    f2, t2 = frame(t1, [168, 186], 22, 'wood', 'wood', pillar_w=8)
    blocks.extend(f1 + f2)

    mons = [
        mon(heavy_t, post_x - 6 - hw / 2 - 8, P),
        mon(R['support'], post_x + 24, P),
        mon(R['ranged'], 177, t2),
        mon('goblin_bomber', post_x, slab_y - 3),
    ]
    if d >= 2 and heavy_t not in BIG:
        mons.append(mon(heavy_t, 306, P))
    avoid = [(b['x'], b['y'], b['w'], b['h']) for b in blocks]
    return blocks, mons + flyers(rng, R, d, avoid)


def bomber_relay(rng, R, P, d):
    """Three stepped towers linked by a chain of Goblin Bombers."""
    heavy_t = pick(rng, R['heavy'])
    f1a, t1a = frame(P, [168, 190], 26, 'stone', 'wood', pillar_w=8)
    f1b, t1b = frame(t1a, [168, 190], 22, 'wood', 'wood', pillar_w=8)
    f2, t2 = frame(P, [212, 234], 28, 'wood', 'stone', pillar_w=8)
    s3 = 256
    f3a, t3a = frame(P, [s3, s3 + 26, s3 + 52], 32, 'stone', 'stone', pillar_w=8)
    f3b, t3b = frame(t3a, [s3, s3 + 26, s3 + 52], 24, 'wood', 'wood', pillar_w=8)
    f3c, t3c = frame(t3b, [s3, s3 + 26], 20, 'wood', 'stone', pillar_w=8)

    blocks = f1a + f1b + f2 + f3a + f3b + f3c
    blocks.extend(crenellations(t3c, [s3, s3 + 26], 'stone'))

    mons = [
        mon('goblin_bomber', 179, t1a),
        mon(R['ranged'], 179, t1b),
        mon('goblin_bomber', 223, t2),
        mon('goblin_bomber', s3 + 13, t3a),
        mon(R['support'] if heavy_t in BIG else heavy_t, s3 + 39, P),
        mon(R['ranged'], s3 + 13, t3c),
    ]
    if d >= 2:
        mons.append(mon(R['support'], s3 + 13, P))
    avoid = [(b['x'], b['y'], b['w'], b['h']) for b in blocks]
    return blocks, mons + flyers(rng, R, max(0, d - 1), avoid)


def boss_citadel(rng, R, P, d):
    """Concept-art grand citadel with strictly coaxial pillar load paths (zero drift) and internal bomber relay."""
    boss_t = R['boss']
    bh = SIZES[boss_t][1]
    col_h = max(48, bh + 4)

    # 1. Left Vanguard Tower (2 tiers, x=168..190 — well inside flat shelf x=155..320)
    v1, tv1 = frame(P, [168, 190], 28, 'wood', 'wood', pillar_w=8)
    v2, tv2 = frame(tv1, [168, 190], 22, 'wood', 'stone', pillar_w=8)
    v_cren = crenellations(tv2, [168, 190], 'stone')

    # 2. Central Colonnade & Coaxial Stepped Keep (x=210..306)
    # Every upper pillar sits directly above a lower pillar so wood beams never flex/drift on spawn.
    # Left & center ground posts are wood so a front breach + bomber relay collapses the keep in 3-5 shots.
    xs_base = [210, 258, 306]
    c1, tc1 = frame(P, xs_base, col_h, 'stone', 'wood', pillar_w=10, pillars=['wood', 'wood', 'stone'])
    c2, tc2 = frame(tc1, xs_base, 26, 'wood', 'wood', pillar_w=8)
    c3, tc3 = frame(tc2, [210, 258], 22, 'wood', 'wood', pillar_w=8)
    c4, tc4 = frame(tc3, [210, 258], 18, R['screen'], 'stone', pillar_w=8)
    c_cren = crenellations(tc4, [210, 258], 'stone')

    blocks = v1 + v2 + v_cren + c1 + c2 + c3 + c4 + c_cren
    mons = [
        mon(boss_t, 282, P),
        mon('goblin_bomber', 234, P),
        mon('goblin_bomber', 179, tv1),
        mon(R['ranged'], 179, tv2),
        mon('goblin_bomber', 234, tc1),
        mon(R['support'], 282, tc1),
        mon(R['ranged'], 234, tc2),
        mon(R['support'], 282, tc2),
        mon(R['ranged'], 234, tc4),
    ]
    avoid = [(b['x'], b['y'], b['w'], b['h']) for b in blocks]
    return blocks, mons


ARCHETYPES = {
    'tower': tower,
    'balanced_beam': balanced_beam,
    'hanging_weight': hanging_weight,
    'bomber_relay': bomber_relay,
    'boss_citadel': boss_citadel,
}


def generate(seed, realm, archetype, difficulty=2):
    rng = Random(f'{realm}-{archetype}-{seed}')
    R = REALMS[realm]
    if difficulty >= 4:
        archetype = 'boss_citadel'
    for attempt in range(40):
        P = rng.choice([292, 296, 300])
        blocks, mons = ARCHETYPES[archetype](rng, R, P, difficulty)
        reach_ok = all(m['x'] <= 318 for m in mons)
        if archetype in ('tower', 'bomber_relay', 'boss_citadel'):
            stable = all(check_stable(c, ground_fn(P)) for c in clusters(blocks))
        else:
            stable = basic_ok(blocks, ground_fn(P))
        if reach_ok and stable:
            break
    else:
        raise ValueError('no stable, reachable layout in 40 attempts')
    return {
        'id': 99, 'name': pick(rng, NAMES[archetype]), 'realm': R['id'],
        'kind': 'boss' if archetype == 'boss_citadel' else 'siege',
        'worldW': 540, 'shots': 6,
        'hints': [HINTS[archetype]], 'scoreTarget': 2200 if archetype == 'boss_citadel' else 1600,
        'terrain': terrain_for(P), 'blocks': blocks, 'monsters': mons,
        'loadout': LOADOUT, 'gen': {'seed': seed, 'realm': realm, 'archetype': archetype, 'difficulty': difficulty},
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--realm', choices=list(REALMS), required=True)
    ap.add_argument('--archetype', choices=list(ARCHETYPES), required=True)
    ap.add_argument('--seed', type=int, default=1)
    ap.add_argument('--difficulty', type=int, default=2, choices=[1, 2, 3, 4])
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    level = generate(a.seed, a.realm, a.archetype, a.difficulty)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    with open(a.out, 'w', newline='\n') as f:
        json.dump(level, f, indent=2)
    print('wrote', a.out, len(level['blocks']), 'blocks', len(level['monsters']), 'monsters')


if __name__ == '__main__':
    main()