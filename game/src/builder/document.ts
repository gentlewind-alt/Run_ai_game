import type { BuilderConfig, Level, LevelBlock, LevelConnection, LevelMonster } from '../data/types';

export interface BuilderDocument {
  schema: 'monster-mash-builder';
  version: 1;
  name: string;
  blocks: LevelBlock[];
  monsters: LevelMonster[];
  connections: LevelConnection[];
}

export function newDraft(): BuilderDocument {
  return { schema: 'monster-mash-builder', version: 1, name: 'My level', blocks: [], monsters: [], connections: [] };
}

export function cloneDraft(doc: BuilderDocument): BuilderDocument {
  return JSON.parse(JSON.stringify(doc)) as BuilderDocument;
}

type RecordValue = Record<string, unknown>;
const object = (value: unknown, label: string): RecordValue => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as RecordValue;
};
const finite = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} must be a finite number`);
  return value;
};
const identifier = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(value)) throw new Error(`${label} needs a valid ID`);
  return value;
};
const bounded = (value: number, low: number, high: number, label: string): number => {
  if (value < low - 1e-7 || value > high + 1e-7) throw new Error(`${label} is outside the build area`);
  return value;
};
const point = (value: unknown, label: string): { x: number; y: number } => {
  const p = object(value, label);
  return { x: finite(p.x, `${label}.x`), y: finite(p.y, `${label}.y`) };
};

/** Reconstruct trusted fields rather than copying imported runtime settings. */
export function validateDraft(value: unknown, config: BuilderConfig): BuilderDocument {
  const raw = object(value, 'Level');
  if (raw.schema !== 'monster-mash-builder' || raw.version !== 1) throw new Error('Unsupported builder file version');
  if (typeof raw.name !== 'string' || raw.name.trim().length < 1 || raw.name.trim().length > 40) throw new Error('Level name must contain 1 to 40 characters');
  const arrays = [['blocks', config.maxBlocks], ['monsters', config.maxMonsters], ['connections', config.maxConnections]] as const;
  for (const [key, cap] of arrays) {
    if (!Array.isArray(raw[key])) throw new Error(`${key} must be a list`);
    if ((raw[key] as unknown[]).length > cap) throw new Error(`Too many ${key}; maximum ${cap}`);
  }
  const ids = new Set<string>();
  const blocks = (raw.blocks as unknown[]).map((value, index): LevelBlock => {
    const label = `Block ${index + 1}`;
    const b = object(value, label);
    const id = identifier(b.id, label);
    if (ids.has(id)) throw new Error(`Duplicate block ID: ${id}`);
    ids.add(id);
    if (typeof b.m !== 'string' || !config.materials.includes(b.m)) throw new Error(`${label} has an unknown material`);
    const shape = b.shape ?? 'rectangle';
    if (shape !== 'rectangle' && shape !== 'circle' && shape !== 'triangle') throw new Error(`${label} has an unknown shape`);
    const w = finite(b.w, `${label} width`);
    const h = finite(b.h, `${label} height`);
    if (w < 4 || w > 128 || h < 4 || h > 128) throw new Error(`${label} dimensions must be 4 to 128`);
    if (shape === 'circle' && w !== h) throw new Error(`${label}: a ball needs equal width and height`);
    const angle = b.angle === undefined ? 0 : finite(b.angle, `${label} angle`);
    if (angle < -360 || angle > 360) throw new Error(`${label} angle must be -360 to 360`);
    if (b.static !== undefined && typeof b.static !== 'boolean') throw new Error(`${label} anchor must be true or false`);
    const radians = angle * Math.PI / 180;
    const c = Math.abs(Math.cos(radians));
    const s = Math.abs(Math.sin(radians));
    const halfX = shape === 'circle' ? w / 2 : c * w / 2 + s * h / 2;
    const halfY = shape === 'circle' ? h / 2 : s * w / 2 + c * h / 2;
    const x = bounded(finite(b.x, `${label}.x`), config.minX + halfX, config.worldW - halfX, label);
    const y = bounded(finite(b.y, `${label}.y`), config.minY + halfY, config.groundY - halfY, label);
    return { id, m: b.m, x, y, w, h, shape, angle, static: b.static === true };
  });
  const monsters = (raw.monsters as unknown[]).map((value, index): LevelMonster => {
    const label = `Target ${index + 1}`;
    const m = object(value, label);
    if (typeof m.t !== 'string' || !config.targets.includes(m.t)) throw new Error(`${label} is an unknown target`);
    return {
      t: m.t,
      x: bounded(finite(m.x, `${label}.x`), config.minX, config.worldW - 16, label),
      y: bounded(finite(m.y, `${label}.y`), config.minY, config.groundY - 7, label),
    };
  });
  const byId = new Map(blocks.map((b) => [b.id!, b]));
  const connectionIds = new Set<string>();
  const connections = (raw.connections as unknown[]).map((value, index): LevelConnection => {
    const label = `Connection ${index + 1}`;
    const c = object(value, label);
    const id = identifier(c.id, label);
    if (connectionIds.has(id)) throw new Error(`Duplicate connection ID: ${id}`);
    connectionIds.add(id);
    if (c.type !== 'lock' && c.type !== 'rope') throw new Error(`${label} has an unknown type`);
    const a = c.a === null ? null : identifier(c.a, `${label} source`);
    const b = identifier(c.b, `${label} destination`);
    const blockA = a === null ? undefined : byId.get(a);
    const blockB = byId.get(b);
    if (!blockB || (a !== null && !blockA)) throw new Error(`${label} references a missing block`);
    if (a === b) throw new Error(`${label} must join two different blocks`);
    if (c.type === 'lock' && a === null) throw new Error('A lock needs two blocks');
    const pointA = point(c.pointA, `${label} source point`);
    const pointB = point(c.pointB, `${label} destination point`);
    const local = (p: { x: number; y: number }, block: LevelBlock): void => {
      if (Math.abs(p.x) > block.w / 2 || Math.abs(p.y) > block.h / 2) throw new Error(`${label} point is outside its block`);
    };
    if (blockA) local(pointA, blockA);
    else {
      bounded(pointA.x, config.minX, config.worldW, label);
      bounded(pointA.y, config.minY, config.groundY, label);
    }
    local(pointB, blockB);
    const result: LevelConnection = { id, type: c.type, a, b, pointA, pointB };
    if (c.type === 'rope') {
      const worldPoint = (block: LevelBlock | undefined, p: { x: number; y: number }): { x: number; y: number } => {
        if (!block) return p;
        const angle = (block.angle ?? 0) * Math.PI / 180;
        return { x: block.x + p.x * Math.cos(angle) - p.y * Math.sin(angle), y: block.y + p.x * Math.sin(angle) + p.y * Math.cos(angle) };
      };
      const pa = worldPoint(blockA, pointA);
      const pb = worldPoint(blockB, pointB);
      const length = c.length === undefined ? Math.hypot(pb.x - pa.x, pb.y - pa.y) : finite(c.length, `${label} length`);
      if (length <= 0 || length > Math.hypot(config.worldW, config.groundY)) throw new Error(`${label} needs a positive rope length`);
      result.length = length;
    } else if (c.length !== undefined) {
      const length = finite(c.length, `${label} length`);
      if (length <= 0) throw new Error(`${label} length must be positive`);
    }
    return result;
  });
  return { schema: 'monster-mash-builder', version: 1, name: raw.name.trim(), blocks, monsters, connections };
}

interface Box { l: number; r: number; t: number; b: number }
const boxOf = (b: LevelBlock): Box => {
  const rad = (b.angle ?? 0) * Math.PI / 180;
  const c = Math.abs(Math.cos(rad)), s = Math.abs(Math.sin(rad));
  const hx = b.shape === 'circle' ? b.w / 2 : c * b.w / 2 + s * b.h / 2;
  const hy = b.shape === 'circle' ? b.h / 2 : s * b.w / 2 + c * b.h / 2;
  return { l: b.x - hx, r: b.x + hx, t: b.y - hy, b: b.y + hy };
};

/**
 * Strict gravity for the start of play: every free block that is not anchored, locked or roped drops straight down until it rests on
 * the ground or on a block below, lowest first, so no gaps are left under pieces. Targets drop the same way. Pure: returns a copy.
 */
export function settle(doc: BuilderDocument, config: BuilderConfig, sizeOf: (type: string) => { w: number; h: number } = () => ({ w: 12, h: 14 })): BuilderDocument {
  const out = cloneDraft(doc);
  const tied = new Set<string>();
  for (const c of out.connections) { if (c.a) tied.add(c.a); tied.add(c.b); }
  const overlapsX = (a: Box, b: Box): boolean => Math.min(a.r, b.r) - Math.max(a.l, b.l) > 0.01;
  const placed: Box[] = out.blocks.filter((b) => b.static || tied.has(b.id!)).map(boxOf);
  const free = out.blocks.filter((b) => !b.static && !tied.has(b.id!)).sort((a, b) => boxOf(b).b - boxOf(a).b);
  for (const block of free) {
    const box = boxOf(block);
    let drop = config.groundY - box.b;
    for (const other of placed) if (other.t >= box.b - 0.5 && overlapsX(box, other)) drop = Math.min(drop, other.t - box.b);
    if (drop > 0) block.y += drop;
    placed.push(boxOf(block));
  }
  const monsters = out.monsters.map((m, i) => ({ m, i, size: sizeOf(m.t) })).sort((a, b) => (b.m.y + b.size.h / 2) - (a.m.y + a.size.h / 2));
  for (const { m, size } of monsters) {
    const box: Box = { l: m.x - size.w / 2, r: m.x + size.w / 2, t: m.y - size.h / 2, b: m.y + size.h / 2 };
    let drop = config.groundY - box.b;
    for (const other of placed) if (other.t >= box.b - 0.5 && overlapsX(box, other)) drop = Math.min(drop, other.t - box.b);
    if (drop > 0) m.y += drop;
    placed.push({ ...box, t: box.t + Math.max(0, drop), b: box.b + Math.max(0, drop) });
  }
  return out;
}

export function toLevel(doc: BuilderDocument, config: BuilderConfig, sizeOf?: (type: string) => { w: number; h: number }): Level {
  const safe = settle(validateDraft(doc, config), config, sizeOf);
  return {
    id: 1000, name: safe.name, realm: 'goblin_hills', kind: 'siege', worldW: config.worldW,
    terrain: [[0, config.groundY], [config.worldW, config.groundY]], sling: { x: 56, y: config.groundY - 58 },
    shots: config.loadout.length, loadout: config.loadout.slice(), blocks: safe.blocks, monsters: safe.monsters,
    connections: safe.connections,
    overrides: { features: { tutorial: false, consumables: false, artifacts: false }, camera: { introPan: false } },
  };
}
