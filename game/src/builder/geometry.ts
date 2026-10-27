import type { LevelBlock, LevelMonster } from '../data/types';

export interface Point { x: number; y: number }
export interface Bounds { l: number; r: number; t: number; b: number }
export type BlockPart = { kind: 'circle'; x: number; y: number; r: number } | { kind: 'polygon'; vertices: Point[] };

const EPSILON = 1e-6;
const TAU = Math.PI * 2;
const dot = (a: Point, b: Point): number => a.x * b.x + a.y * b.y;
const cross = (a: Point, b: Point): number => a.x * b.y - a.y * b.x;
const subtract = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const along = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const rectangle = (l: number, t: number, r: number, b: number): BlockPart => ({ kind: 'polygon', vertices: [{ x: l, y: t }, { x: r, y: t }, { x: r, y: b }, { x: l, y: b }] });

/** Convex local parts share the artwork's bounding-box centre, including asymmetric compounds. */
export function blockParts(block: LevelBlock): BlockPart[] {
  const { w, h, variant } = block;
  if (block.shape === 'circle') {
    if (variant === 'wheel_plank' || variant === 'wheel_wedge') {
      const hub = { x: -w / 2 + h / 2, y: 0 };
      const wheel: BlockPart = { kind: 'circle', ...hub, r: h / 2 };
      return [wheel, variant === 'wheel_plank'
        ? rectangle(hub.x, -h / 8, w / 2, h / 8)
        : { kind: 'polygon', vertices: [hub, { x: w / 2, y: -h / 2 }, { x: w / 2, y: h / 2 }] }];
    }
    return [{ kind: 'circle', x: 0, y: 0, r: w / 2 }];
  }
  if (block.shape === 'triangle') {
    const vertices = [{ x: 0, y: -h / 2 }, { x: w / 2, y: h / 2 }, { x: -w / 2, y: h / 2 }];
    if (variant !== 'hollow') return [{ kind: 'polygon', vertices }];
    const inner = vertices.map((p) => ({ x: p.x / 2, y: h / 6 + (p.y - h / 6) / 2 }));
    return vertices.map((p, i) => ({ kind: 'polygon', vertices: [p, vertices[(i + 1) % 3], inner[(i + 1) % 3], inner[i]] }));
  }
  if (variant === 'hollow') {
    const wall = Math.min(w, h) / 8;
    return [rectangle(-w / 2, -h / 2, w / 2, -h / 2 + wall), rectangle(-w / 2, h / 2 - wall, w / 2, h / 2),
      rectangle(-w / 2, -h / 2 + wall, -w / 2 + wall, h / 2 - wall), rectangle(w / 2 - wall, -h / 2 + wall, w / 2, h / 2 - wall)];
  }
  return [rectangle(-w / 2, -h / 2, w / 2, h / 2)];
}

export function localToWorld(block: LevelBlock, point: Point): Point {
  const angle = (block.angle ?? 0) * Math.PI / 180;
  return { x: block.x + point.x * Math.cos(angle) - point.y * Math.sin(angle), y: block.y + point.x * Math.sin(angle) + point.y * Math.cos(angle) };
}

export function worldToLocal(block: LevelBlock, point: Point): Point {
  const angle = (block.angle ?? 0) * Math.PI / 180;
  const x = point.x - block.x, y = point.y - block.y;
  return { x: x * Math.cos(angle) + y * Math.sin(angle), y: -x * Math.sin(angle) + y * Math.cos(angle) };
}

const worldParts = (block: LevelBlock): BlockPart[] => blockParts(block).map((part) => part.kind === 'circle'
  ? { ...part, ...localToWorld(block, part) }
  : { kind: 'polygon', vertices: part.vertices.map((p) => localToWorld(block, p)) });

const boundsOf = (parts: BlockPart[]): Bounds => {
  const bounds: Bounds = { l: Infinity, r: -Infinity, t: Infinity, b: -Infinity };
  for (const part of parts) {
    const points = part.kind === 'circle' ? [{ x: part.x - part.r, y: part.y - part.r }, { x: part.x + part.r, y: part.y + part.r }] : part.vertices;
    for (const p of points) {
      bounds.l = Math.min(bounds.l, p.x); bounds.r = Math.max(bounds.r, p.x);
      bounds.t = Math.min(bounds.t, p.y); bounds.b = Math.max(bounds.b, p.y);
    }
  }
  return bounds;
};

export function blockBounds(block: LevelBlock): Bounds { return boundsOf(worldParts(block)); }

const pointInPart = (part: BlockPart, p: Point, strict = false): boolean => {
  if (part.kind === 'circle') return Math.hypot(p.x - part.x, p.y - part.y) <= part.r + (strict ? -EPSILON : EPSILON);
  let sign = 0;
  for (let i = 0; i < part.vertices.length; i++) {
    const a = part.vertices[i], b = part.vertices[(i + 1) % part.vertices.length];
    const side = cross(subtract(b, a), subtract(p, a)) / Math.hypot(b.x - a.x, b.y - a.y);
    if (Math.abs(side) <= EPSILON) { if (strict) return false; continue; }
    if (sign && Math.sign(side) !== sign) return false;
    sign = Math.sign(side);
  }
  return true;
};

export function pointInBlock(block: LevelBlock, worldPoint: Point): boolean {
  const local = worldToLocal(block, worldPoint);
  return blockParts(block).some((part) => pointInPart(part, local));
}

const boundsOverlap = (a: Bounds, b: Bounds, epsilon: number): boolean => Math.min(a.r, b.r) - Math.max(a.l, b.l) > epsilon && Math.min(a.b, b.b) - Math.max(a.t, b.t) > epsilon;
const axesOf = (part: BlockPart): Point[] => part.kind === 'circle' ? [] : part.vertices.map((a, i) => {
  const b = part.vertices[(i + 1) % part.vertices.length], length = Math.hypot(b.x - a.x, b.y - a.y);
  return { x: -(b.y - a.y) / length, y: (b.x - a.x) / length };
});
const project = (part: BlockPart, axis: Point): [number, number] => {
  if (part.kind === 'circle') { const centre = dot(part, axis); return [centre - part.r, centre + part.r]; }
  const values = part.vertices.map((p) => dot(p, axis));
  return [Math.min(...values), Math.max(...values)];
};
const partsOverlap = (a: BlockPart, b: BlockPart, epsilon: number): boolean => {
  if (!boundsOverlap(boundsOf([a]), boundsOf([b]), epsilon)) return false;
  if (a.kind === 'circle' && b.kind === 'circle') return Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r - epsilon;
  const axes = [...axesOf(a), ...axesOf(b)];
  const circle = a.kind === 'circle' ? a : b.kind === 'circle' ? b : undefined;
  const polygon = a.kind === 'polygon' ? a : b.kind === 'polygon' ? b : undefined;
  if (circle && polygon) {
    let nearest = polygon.vertices[0], distance = Infinity;
    for (const p of polygon.vertices) {
      const d = Math.hypot(p.x - circle.x, p.y - circle.y);
      if (d < distance) { distance = d; nearest = p; }
    }
    if (distance > EPSILON) axes.push({ x: (nearest.x - circle.x) / distance, y: (nearest.y - circle.y) / distance });
  }
  return axes.every((axis) => {
    const pa = project(a, axis), pb = project(b, axis);
    return Math.min(pa[1], pb[1]) - Math.max(pa[0], pb[0]) > epsilon;
  });
};

/** Only positive interior intersection counts; touching sides, corners and hole edges remain legal. */
export function blocksOverlap(a: LevelBlock, b: LevelBlock, epsilon = EPSILON): boolean {
  const partsA = worldParts(a), partsB = worldParts(b);
  return boundsOverlap(boundsOf(partsA), boundsOf(partsB), epsilon) && partsA.some((partA) => partsB.some((partB) => partsOverlap(partA, partB, epsilon)));
}

export function snapBlock(block: LevelBlock, x: number, y: number, grid: number): Point {
  const bounds = blockBounds({ ...block, x: 0, y: 0 });
  return { x: Math.round((x + bounds.l) / grid) * grid - bounds.l, y: Math.round((y + bounds.t) / grid) * grid - bounds.t };
}

const edgesOf = (part: BlockPart): [Point, Point][] => part.kind === 'circle' ? [] : part.vertices.map((p, i) => [p, part.vertices[(i + 1) % part.vertices.length]]);
const segmentCircle = (a: Point, b: Point, circle: Extract<BlockPart, { kind: 'circle' }>): number[] => {
  const d = subtract(b, a), f = subtract(a, circle), aa = dot(d, d), bb = 2 * dot(f, d), cc = dot(f, f) - circle.r ** 2;
  const discriminant = bb * bb - 4 * aa * cc;
  if (discriminant < -EPSILON) return [];
  const root = Math.sqrt(Math.max(0, discriminant));
  return [(-bb - root) / (2 * aa), (-bb + root) / (2 * aa)].filter((t) => t >= -EPSILON && t <= 1 + EPSILON).map((t) => Math.max(0, Math.min(1, t)));
};
const segmentCuts = (a: Point, b: Point, part: BlockPart): number[] => {
  if (part.kind === 'circle') return segmentCircle(a, b, part);
  const result: number[] = [], direction = subtract(b, a);
  for (const [c, d] of edgesOf(part)) {
    const edge = subtract(d, c), offset = subtract(c, a), denominator = cross(direction, edge);
    if (Math.abs(denominator) <= EPSILON) {
      if (Math.abs(cross(offset, direction)) <= EPSILON) for (const p of [c, d]) {
        const t = dot(subtract(p, a), direction) / dot(direction, direction);
        if (t >= 0 && t <= 1) result.push(t);
      }
      continue;
    }
    const t = cross(offset, edge) / denominator, u = cross(offset, direction) / denominator;
    if (t >= -EPSILON && t <= 1 + EPSILON && u >= -EPSILON && u <= 1 + EPSILON) result.push(Math.max(0, Math.min(1, t)));
  }
  return result;
};
const angleOf = (p: Point, circle: Extract<BlockPart, { kind: 'circle' }>): number => (Math.atan2(p.y - circle.y, p.x - circle.x) + TAU) % TAU;
const circleCuts = (circle: Extract<BlockPart, { kind: 'circle' }>, part: BlockPart): number[] => {
  if (part.kind === 'polygon') return edgesOf(part).flatMap(([a, b]) => segmentCircle(a, b, circle).map((t) => angleOf(along(a, b, t), circle)));
  const dx = part.x - circle.x, dy = part.y - circle.y, distance = Math.hypot(dx, dy);
  if (distance <= EPSILON || distance > circle.r + part.r + EPSILON || distance < Math.abs(circle.r - part.r) - EPSILON) return [];
  const offset = (circle.r ** 2 - part.r ** 2 + distance ** 2) / (2 * distance);
  const height = Math.sqrt(Math.max(0, circle.r ** 2 - offset ** 2));
  const centre = { x: circle.x + offset * dx / distance, y: circle.y + offset * dy / distance };
  return [-1, 1].map((sign) => angleOf({ x: centre.x - sign * height * dy / distance, y: centre.y + sign * height * dx / distance }, circle));
};
const sortedCuts = (cuts: number[]): number[] => cuts.sort((a, b) => a - b).filter((value, i, values) => i === 0 || value - values[i - 1] > EPSILON);

/** Nearest exposed boundary of the union, returned in block-local coordinates for attachments. */
export function closestBlockPoint(block: LevelBlock, worldPoint: Point): Point {
  const point = worldToLocal(block, worldPoint), parts = blockParts(block);
  let nearest: Point = { x: 0, y: -block.h / 2 }, distance = Infinity;
  const consider = (candidate: Point): void => {
    const d = Math.hypot(candidate.x - point.x, candidate.y - point.y);
    if (d < distance - EPSILON) { distance = d; nearest = candidate; }
  };
  parts.forEach((part, index) => {
    const others = parts.filter((_part, i) => i !== index);
    const exposed = (p: Point, normal: Point): boolean => {
      const inside = (sign: number): boolean => parts.some((other) => pointInPart(other, { x: p.x + normal.x * EPSILON * 8 * sign, y: p.y + normal.y * EPSILON * 8 * sign }, true));
      return !(inside(-1) && inside(1));
    };
    if (part.kind === 'polygon') {
      for (const [a, b] of edgesOf(part)) {
        const cuts = sortedCuts([0, 1, ...others.flatMap((other) => segmentCuts(a, b, other))]);
        const direction = subtract(b, a), length = Math.hypot(direction.x, direction.y);
        const normal = { x: -direction.y / length, y: direction.x / length };
        for (let i = 1; i < cuts.length; i++) {
          const start = cuts[i - 1], end = cuts[i];
          if (!exposed(along(a, b, (start + end) / 2), normal)) continue;
          const t = dot(subtract(point, a), direction) / dot(direction, direction);
          consider(along(a, b, Math.max(start, Math.min(end, t))));
        }
      }
    } else {
      const at = (angle: number): Point => ({ x: part.x + part.r * Math.cos(angle), y: part.y + part.r * Math.sin(angle) });
      const cuts = sortedCuts([0, TAU, ...others.flatMap((other) => circleCuts(part, other))]);
      const preferred = Math.hypot(point.x - part.x, point.y - part.y) <= EPSILON ? Math.PI * 1.5 : angleOf(point, part);
      for (let i = 1; i < cuts.length; i++) {
        const start = cuts[i - 1], end = cuts[i];
        const middle = (start + end) / 2;
        if (!exposed(at(middle), { x: Math.cos(middle), y: Math.sin(middle) })) continue;
        if (preferred >= start && preferred <= end) consider(at(preferred));
        consider(at(start)); consider(at(end));
      }
    }
  });
  return nearest;
}

/** The nearest pair of boundary points between two blocks (world and block-local), found by bouncing between the two shapes. */
export function closestPair(a: LevelBlock, b: LevelBlock): { a: Point; b: Point; la: Point; lb: Point; gap: number } {
  let la = closestBlockPoint(a, { x: b.x, y: b.y });
  let lb = closestBlockPoint(b, localToWorld(a, la));
  for (let i = 0; i < 6; i++) {
    la = closestBlockPoint(a, localToWorld(b, lb));
    lb = closestBlockPoint(b, localToWorld(a, la));
  }
  const wa = localToWorld(a, la), wb = localToWorld(b, lb);
  return { a: wa, b: wb, la, lb, gap: Math.hypot(wa.x - wb.x, wa.y - wb.y) };
}

/**
 * How far to slide `mover` so it just touches `anchor`, keeping both angles. A gap is closed along the shortest line, an overlap is
 * pushed apart along the line between the centres. Null when they are too far apart or there is no clear way.
 */
export function touchOffset(mover: LevelBlock, anchor: LevelBlock, maxGap = 40): Point | null {
  const shift = (d: Point): LevelBlock => ({ ...mover, x: mover.x + d.x, y: mover.y + d.y });
  if (blocksOverlap(mover, anchor)) {
    let dx = mover.x - anchor.x, dy = mover.y - anchor.y;
    const len = Math.hypot(dx, dy);
    if (len < EPSILON) { dx = 0; dy = -1; } else { dx /= len; dy /= len; }
    let hi = 1;
    while (blocksOverlap(shift({ x: dx * hi, y: dy * hi }), anchor)) { hi *= 2; if (hi > 400) return null; }
    let lo = 0;
    for (let i = 0; i < 16; i++) {
      const mid = (lo + hi) / 2;
      if (blocksOverlap(shift({ x: dx * mid, y: dy * mid }), anchor)) lo = mid; else hi = mid;
    }
    return { x: dx * hi, y: dy * hi };
  }
  const pair = closestPair(mover, anchor);
  if (pair.gap > maxGap) return null;
  const d = { x: pair.b.x - pair.a.x, y: pair.b.y - pair.a.y };
  if (!blocksOverlap(shift(d), anchor)) return d;
  let lo = 0, hi = 1;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    if (blocksOverlap(shift({ x: d.x * mid, y: d.y * mid }), anchor)) hi = mid; else lo = mid;
  }
  return { x: d.x * lo, y: d.y * lo };
}

export function findDraftOverlaps(doc: { blocks: LevelBlock[]; monsters: LevelMonster[] }, sizeOf: (type: string) => { w: number; h: number } = () => ({ w: 12, h: 14 })): { a: string; b: string }[] {
  const pieces = doc.blocks.map((block, i) => ({ id: block.id ?? `block_${i + 1}`, block }));
  doc.monsters.forEach((monster, i) => {
    const size = sizeOf(monster.t), id = (monster as LevelMonster & { id?: string }).id ?? `target_${i + 1}`;
    pieces.push({ id, block: { m: '', x: monster.x, y: monster.y, ...size, shape: 'rectangle' } });
  });
  const overlaps: { a: string; b: string }[] = [];
  for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) {
    if (blocksOverlap(pieces[i].block, pieces[j].block)) overlaps.push({ a: pieces[i].id, b: pieces[j].id });
  }
  return overlaps;
}

/** Sweep downward in half-pixel steps, then refine the first contact without filling compound holes. */
export function dropDistance(block: LevelBlock, placed: LevelBlock[], maxDrop: number): number {
  if (maxDrop <= 0) return 0;
  const bounds = blockBounds(block);
  const candidates = placed.filter((other) => {
    const b = blockBounds(other);
    return Math.min(bounds.r, b.r) - Math.max(bounds.l, b.l) > EPSILON && b.b > bounds.t && b.t < bounds.b + maxDrop;
  });
  const collides = (drop: number): boolean => candidates.some((other) => blocksOverlap({ ...block, y: block.y + drop }, other));
  if (collides(0)) return 0;
  let clear = 0;
  while (clear < maxDrop) {
    const next = Math.min(maxDrop, clear + 0.5);
    if (collides(next)) {
      let hit = next;
      for (let i = 0; i < 10; i++) {
        const middle = (clear + hit) / 2;
        if (collides(middle)) hit = middle;
        else clear = middle;
      }
      return clear;
    }
    clear = next;
  }
  return maxDrop;
}
