"""Seeded, frame-only fort generation and a conservative static stability check."""
from math import ceil
from random import Random


MATERIAL_MASS = {'wood': 1.0, 'crystal': 0.75, 'stone': 2.0, 'iron': 3.0}
PILLAR_WIDTHS = (8, 10, 12)
FLOOR_HEIGHT = 6


def blk(material, x, y, w, h):
    return {'m': material, 'x': round(x, 1), 'y': round(y, 1), 'w': w, 'h': h}


def frame(base, xs, pillar_h, pillar_material, floor_material, pillar_w=10, pillars=None):
    """Make one row of posts and its thin floor; return blocks and the floor top."""
    blocks = [
        blk(pillars[i] if pillars else pillar_material, x, base - pillar_h / 2, pillar_w, pillar_h)
        for i, x in enumerate(xs)
    ]
    left = min(xs) - pillar_w / 2 - 3
    right = max(xs) + pillar_w / 2 + 3
    blocks.append(blk(floor_material, (left + right) / 2, base - pillar_h - FLOOR_HEIGHT / 2,
                      right - left, FLOOR_HEIGHT))
    return blocks, base - pillar_h - FLOOR_HEIGHT


def crenellations(top_y, xs, mat='stone', w=8, h=8):
    """Place castle battlements directly centered over support pillar x-coordinates so they never drift."""
    return [blk(mat, round(x, 1), round(top_y - h / 2, 1), w, h) for x in xs]


def _rect(block):
    return (block['x'] - block['w'] / 2, block['y'] - block['h'] / 2,
            block['x'] + block['w'] / 2, block['y'] + block['h'] / 2)


def _overlap(a, b):
    ax0, ay0, ax1, ay1 = _rect(a)
    bx0, by0, bx1, by1 = _rect(b)
    return min(ax1, bx1) - max(ax0, bx0) > 1e-6 and min(ay1, by1) - max(ay0, by0) > 1e-6


def _mass(block):
    return block['w'] * block['h'] * MATERIAL_MASS.get(block['m'], 1.0)


def _ground_supports(block, ground_fn):
    left, _, right, bottom = _rect(block)
    inset = min(4.0, block['w'] / 4)
    for x in (left + inset, (left + right) / 2, right - inset):
        try:
            if abs(float(ground_fn(x)) - bottom) > 0.1:
                return False
        except (TypeError, ValueError):
            return False
    return True


def check_stable(blocks, ground_fn):
    """Check contacts, overlaps and the centre of mass above every frame floor."""
    for i, block in enumerate(blocks):
        for other in blocks[i + 1:]:
            if _overlap(block, other):
                return False

    for block in blocks:
        left, _, right, bottom = _rect(block)
        inset = min(4.0, block['w'] / 4)
        left_end, right_end = left + inset, right - inset
        supports = []
        for other in blocks:
            if other is block:
                continue
            other_left, other_top, other_right, _ = _rect(other)
            if abs(other_top - bottom) <= 0.1 and min(right, other_right) - max(left, other_left) > 1e-6:
                supports.append((other_left, other_right, other))

        both_ends = (any(x0 <= left_end <= x1 for x0, x1, _ in supports)
                     and any(x0 <= right_end <= x1 for x0, x1, _ in supports))
        centre = (left + right) / 2
        centre_pillar = any(x0 <= centre <= x1 and other['w'] <= 14
                            for x0, x1, other in supports)
        if not (both_ends or centre_pillar or _ground_supports(block, ground_fn)):
            return False

    for floor in blocks:
        if floor['h'] > FLOOR_HEIGHT or floor['w'] <= 14:
            continue
        left, top, right, bottom = _rect(floor)
        pillars = []
        for block in blocks:
            if block is floor or block['w'] > 14:
                continue
            block_left, block_top, block_right, _ = _rect(block)
            if abs(block_top - bottom) <= 0.1 and min(right, block_right) - max(left, block_left) > 1e-6:
                pillars.append((block_left, block_right))
        if len(pillars) < 2:
            return False
        span_left = min(x0 for x0, _ in pillars)
        span_right = max(x1 for _, x1 in pillars)
        above = [block for block in blocks if block is not floor and _rect(block)[3] <= top + 0.1]
        total_mass = sum(_mass(block) for block in above)
        if total_mass:
            centre_x = sum(block['x'] * _mass(block) for block in above) / total_mass
            if not span_left - 0.1 <= centre_x <= span_right + 0.1:
                return False
    return True


def _materials(materials_by_tier):
    result = []
    for row in materials_by_tier:
        if isinstance(row, dict):
            result.append((row['pillar'], row['floor']))
        else:
            result.append(tuple(row))
    if not result or any(len(row) != 2 for row in result):
        raise ValueError('materials_by_tier must contain (pillar, floor) pairs')
    return result


def _intersects_clear(block, clear):
    x0, y0, x1, y1 = _rect(block)
    return (min(x1, clear['x'] + clear['w'] / 2) > max(x0, clear['x'] - clear['w'] / 2)
            and min(y1, clear['y'] + clear['h'] / 2) > max(y0, clear['y'] - clear['h'] / 2))


def _one_fort(rng, base, x_min, x_max, tiers, bays, materials_by_tier, keep_clear, taper=False):
    if tiers < 1 or bays < 1 or x_max <= x_min:
        raise ValueError('tiers, bays and fort span must be positive')
    rows = _materials(materials_by_tier)
    if len(rows) < tiers:
        raise ValueError('materials_by_tier must define every tier')
    clear = list(keep_clear or [])
    width = x_max - x_min
    if width / bays < 18:
        raise ValueError('each bay must be at least 18 px wide')

    if not taper:
        # Exact repo path: preserves deterministic PRNG & geometry for ADOPTED campaign levels
        blocks, floor_tops = [], []
        tier_base = base
        for tier in range(tiers):
            pillar_material, floor_material = rows[tier]
            pillar_w = rng.choice(PILLAR_WIDTHS)
            bay = width / bays
            xs = [x_min + bay * i for i in range(bays + 1)]
            if tier:
                for i in range(1, bays):
                    xs[i] += rng.uniform(-min(8.0, bay / 6), min(8.0, bay / 6))
                xs.sort()

            pillar_h = rng.randint(20, 52)
            ground_clear = [r for r in clear
                            if r['x'] + r['w'] / 2 > x_min and r['x'] - r['w'] / 2 < x_max
                            and r['y'] + r['h'] / 2 >= base - 0.1]
            if tier == 0 and ground_clear:
                required = max(ceil(base - (r['y'] - r['h'] / 2) + 1) for r in ground_clear)
                if required > 52:
                    raise ValueError('keep_clear is taller than the 52 px pillar limit')
                pillar_h = max(pillar_h, required)
            posts = [blk(pillar_material, x, tier_base - pillar_h / 2, pillar_w, pillar_h)
                     for x in xs]
            posts = [post for post in posts if not any(_intersects_clear(post, r) for r in clear)]
            if len(posts) < 2:
                raise ValueError('keep_clear leaves fewer than two support posts')
            post_xs = [post['x'] for post in posts]
            row, next_base = frame(tier_base, post_xs, pillar_h, pillar_material, floor_material, pillar_w)
            if any(_intersects_clear(block, r) for block in row for r in clear):
                raise ValueError('generated frame intersects keep_clear')
            blocks.extend(row)
            floor_tops.append(round(next_base, 1))
            tier_base = next_base
        return blocks, floor_tops

    # Enhanced tapered path: upper pillars lock coaxially onto lower pillar xs for zero frame-1 drift
    blocks, floor_tops = [], []
    tier_base = base
    base_xs = [round(x_min + (width / bays) * i, 1) for i in range(bays + 1)]

    for tier in range(tiers):
        pillar_material, floor_material = rows[tier]
        pillar_w = rng.choice(PILLAR_WIDTHS) if tier < 2 else 8
        if tier >= 2 and len(base_xs) >= 3:
            # Symmetrically narrow or step onto existing lower pillar axes
            xs = [round((base_xs[0] + base_xs[1]) / 2, 1), round((base_xs[-2] + base_xs[-1]) / 2, 1)]
        else:
            xs = list(base_xs)

        pillar_h = rng.randint(26, 44) if tier == 0 else rng.randint(22, 30)
        tier_clear = [r for r in clear
                      if r['x'] + r['w'] / 2 > min(xs) and r['x'] - r['w'] / 2 < max(xs)
                      and abs((r['y'] + r['h'] / 2) - tier_base) <= 2.0]
        if tier_clear:
            required = max(ceil(tier_base - (r['y'] - r['h'] / 2) + 2) for r in tier_clear)
            if required > 52:
                raise ValueError('keep_clear is taller than the 52 px pillar limit')
            pillar_h = max(pillar_h, required)

        posts = [blk(pillar_material, x, tier_base - pillar_h / 2, pillar_w, pillar_h)
                 for x in xs]
        posts = [post for post in posts if not any(_intersects_clear(post, r) for r in clear)]
        if len(posts) < 2:
            raise ValueError('keep_clear leaves fewer than two support posts')
        post_xs = [post['x'] for post in posts]
        row, next_base = frame(tier_base, post_xs, pillar_h, pillar_material, floor_material, pillar_w)
        if any(_intersects_clear(block, r) for block in row for r in clear):
            raise ValueError('generated frame intersects keep_clear')
        blocks.extend(row)
        floor_tops.append(round(next_base, 1))
        tier_base = next_base
    return blocks, floor_tops


def generate_fort(seed, base, x_min, x_max, tiers, bays, materials_by_tier, keep_clear=None, *, ground_fn=None, taper=False):
    """Generate the first stable seeded frame, trying this seed and the next 49."""
    support = ground_fn or (lambda _x: base)
    materials_by_tier = _materials(materials_by_tier)
    last_error = None
    for attempt in range(50):
        rng = Random(int(seed) + attempt)
        try:
            blocks, floor_tops = _one_fort(rng, base, x_min, x_max, tiers, bays,
                                           materials_by_tier, keep_clear, taper=taper)
            if check_stable(blocks, support):
                return blocks, floor_tops
            last_error = 'stability check rejected frame'
        except ValueError as exc:
            last_error = str(exc)
    raise ValueError(f'no stable fort after 50 seeds: {last_error}')