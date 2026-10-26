import type { BuilderConfig, Level, LevelBlock, LevelConnection, LevelMonster } from '../data/types';
import { blockBounds, dropDistance, findDraftOverlaps, localToWorld, pointInBlock } from './geometry';

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
export function validateDraft(value: unknown, config: BuilderConfig, sizeOf: (type: string) => { w: number; h: number } = () => ({ w: 12, h: 14 })): BuilderDocument {
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
    const variant = b.variant;
    if (variant !== undefined && variant !== 'hollow' && variant !== 'wheel' && variant !== 'wheel_plank' && variant !== 'wheel_wedge') throw new Error(`${label} has an unknown variant`);
    if (variant === 'hollow' && shape === 'circle' || variant && variant !== 'hollow' && shape !== 'circle') throw new Error(`${label} variant does not match its shape`);
    const w = finite(b.w, `${label} width`);
    const h = finite(b.h, `${label} height`);
    if (w < 4 || w > 128 || h < 4 || h > 128) throw new Error(`${label} dimensions must be 4 to 128`);
    if (shape === 'circle' && w !== (variant === 'wheel_plank' || variant === 'wheel_wedge' ? h * 2 : h)) throw new Error(`${label}: invalid circle or wheel dimensions`);
    const angle = b.angle === undefined ? 0 : finite(b.angle, `${label} angle`);
    if (angle < -360 || angle > 360) throw new Error(`${label} angle must be -360 to 360`);
    if (b.static !== undefined && typeof b.static !== 'boolean') throw new Error(`${label} anchor must be true or false`);
    const block: LevelBlock = { id, m: b.m, x: finite(b.x, `${label}.x`), y: finite(b.y, `${label}.y`), w, h, shape, angle, static: b.static === true };
    if (variant) block.variant = variant;
    const bounds = blockBounds(block);
    bounded(bounds.l, config.minX, config.worldW, label);
    bounded(bounds.r, config.minX, config.worldW, label);
    bounded(bounds.t, config.minY, config.groundY, label);
    bounded(bounds.b, config.minY, config.groundY, label);
    return block;
  });
  const reserved = new Set((raw.monsters as RecordValue[]).map((m) => m?.id));
  const monsters = (raw.monsters as unknown[]).map((value, index): LevelMonster => {
    const label = `Target ${index + 1}`;
    const m = object(value, label);
    if (typeof m.t !== 'string' || !config.targets.includes(m.t)) throw new Error(`${label} is an unknown target`);
    let generated = `target_${index + 1}`;
    while (ids.has(generated) || reserved.has(generated)) generated += '_m';
    const id = m.id === undefined ? generated : identifier(m.id, label);
    if (ids.has(id)) throw new Error(`Duplicate target ID: ${id}`);
    ids.add(id);
    const size = sizeOf(m.t);
    const legacy = m.id === undefined;
    const oldX = legacy ? bounded(finite(m.x, `${label}.x`), config.minX, config.worldW - 16, label) : finite(m.x, `${label}.x`);
    const oldY = legacy ? bounded(finite(m.y, `${label}.y`), config.minY, config.groundY - 7, label) : finite(m.y, `${label}.y`);
    return {
      id,
      t: m.t,
      x: legacy ? Math.max(config.minX + size.w / 2, Math.min(config.worldW - size.w / 2, oldX)) : bounded(oldX, config.minX + size.w / 2, config.worldW - size.w / 2, label),
      y: legacy ? Math.max(config.minY + size.h / 2, Math.min(config.groundY - size.h / 2, oldY)) : bounded(oldY, config.minY + size.h / 2, config.groundY - size.h / 2, label),
    };
  });
  const byId = new Map(blocks.map((b) => [b.id!, b]));
  const entities = new Map([...byId, ...monsters.map((m): [string, LevelBlock] => [m.id!, { ...m, ...sizeOf(m.t), m: 'wood', shape: 'rectangle' }])]);
  const connectionIds = new Set<string>();
  const connections = (raw.connections as unknown[]).map((value, index): LevelConnection => {
    const label = `Connection ${index + 1}`;
    const c = object(value, label);
    const id = identifier(c.id, label);
    if (connectionIds.has(id)) throw new Error(`Duplicate connection ID: ${id}`);
    connectionIds.add(id);
    if (c.type !== 'lock' && c.type !== 'rope' && c.type !== 'pin') throw new Error(`${label} has an unknown type`);
    const a = c.a === null ? null : identifier(c.a, `${label} source`);
    const b = identifier(c.b, `${label} destination`);
    const blockA = a === null ? undefined : entities.get(a);
    const blockB = entities.get(b);
    if (!blockB || (a !== null && !blockA)) throw new Error(`${label} references a missing piece`);
    if (a === b) throw new Error(`${label} must join two different pieces`);
    if (c.type === 'lock' && (a === null || !byId.has(a) || !byId.has(b))) throw new Error('Glue needs two blocks');
    if (c.type === 'pin' && (!byId.has(b) || a !== null && !byId.has(a))) throw new Error('Pins attach to blocks');
    const pointA = point(c.pointA, `${label} source point`);
    const pointB = point(c.pointB, `${label} destination point`);
    const local = (p: { x: number; y: number }, block: LevelBlock): void => {
      if (!pointInBlock({ ...block, x: 0, y: 0, angle: 0 }, p)) throw new Error(`${label} point is outside its piece`);
    };
    if (blockA) local(pointA, blockA);
    else {
      bounded(pointA.x, config.minX, config.worldW, label);
      bounded(pointA.y, config.minY, config.groundY, label);
    }
    local(pointB, blockB);
    const result: LevelConnection = { id, type: c.type, a, b, pointA, pointB };
    if (c.type === 'rope') {
      const worldPoint = (block: LevelBlock | undefined, p: { x: number; y: number }): { x: number; y: number } => block ? localToWorld(block, p) : p;
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

/**
 * Drop free pieces onto real occupied geometry, lowest first. Connected targets keep their rope attachments.
 * An overlapping work in progress stays authored so Test can demonstrate its actual physics.
 */
export function settle(doc: BuilderDocument, config: BuilderConfig, sizeOf: (type: string) => { w: number; h: number } = () => ({ w: 12, h: 14 })): BuilderDocument {
  const out = cloneDraft(doc);
  if (findDraftOverlaps(out, sizeOf).length) return out;
  const tied = new Set<string>();
  for (const c of out.connections) { if (c.a) tied.add(c.a); tied.add(c.b); }
  const pieces = [
    ...out.blocks.map((block) => ({ block, entity: block, fixed: block.static || tied.has(block.id!) })),
    ...out.monsters.map((monster) => ({ block: { ...monster, ...sizeOf(monster.t), m: 'wood', shape: 'rectangle' as const }, entity: monster, fixed: tied.has(monster.id!) })),
  ];
  const placed = pieces.filter((p) => p.fixed).map((p) => p.block);
  const free = pieces.filter((p) => !p.fixed).sort((a, b) => blockBounds(b.block).b - blockBounds(a.block).b);
  for (const piece of free) {
    const drop = dropDistance(piece.block, placed, config.groundY - blockBounds(piece.block).b);
    piece.entity.y += drop;
    piece.block.y = piece.entity.y;
    placed.push(piece.block);
  }
  return out;
}

export function toLevel(doc: BuilderDocument, config: BuilderConfig, sizeOf?: (type: string) => { w: number; h: number }): Level {
  const safe = settle(validateDraft(doc, config, sizeOf), config, sizeOf);
  return {
    id: 1000, name: safe.name, realm: 'goblin_hills', kind: 'siege', worldW: config.worldW,
    terrain: [[0, config.groundY], [config.worldW, config.groundY]], sling: { x: 56, y: config.groundY - 58 },
    shots: config.loadout.length, loadout: config.loadout.slice(), blocks: safe.blocks, monsters: safe.monsters,
    connections: safe.connections,
    overrides: { features: { tutorial: false, consumables: false, artifacts: false }, camera: { introPan: false } },
  };
}
