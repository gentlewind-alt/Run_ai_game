// Builds the level: background, ground, sling, blocks and monsters.
import { buildBackground } from '../art/backgrounds';
import { MONSTER_ART, blockKey, makeBattleTextures } from '../art/textures';
import { behaviorFor } from '../content/monsters';
import { materialDef, monsterDef } from '../data/lookup';
import type { LevelMonster, Params } from '../data/types';
import type Phaser from 'phaser';
import type { Ent, Kind } from './BattleCtx';
import type { BattleState } from './state';

// Body defaults when a material or monster row doesn't say (see architecture/DATA.md).
const DEFAULT_DENSITY = 0.001;
const BLOCK_FRICTION = 0.7;

export function buildWorld(b: BattleState): void {
  const s = b.scene;
  makeBattleTextures(s, b.level.blocks);
  buildBackground(s, b.worldW, b.groundY);
  s.matter.add.rectangle(b.worldW / 2, b.groundY + 40, b.worldW + 400, 80, { isStatic: true, friction: 1, label: 'ground' });
  s.matter.add.rectangle(b.worldW + 10, 200, 20, 600, { isStatic: true, label: 'wall' });
}

/** Sling, blocks, monsters and the exit door. Call after the view is set up. */
export function populate(b: BattleState): void {
  const s = b.scene;
  s.add.image(b.slingX, b.slingY + 28, 'sling').setDepth(2);
  for (const blk of b.level.blocks) addBlock(b, blk.m, blk.x, blk.y, blk.w, blk.h);
  for (const m of b.level.monsters) addMonster(b, m);
  for (const e of b.ents) if (e.kind === 'monster') e.behavior?.onSpawn?.(b.ctx, e);
  if (b.level.exit) s.add.image(b.level.exit.x, b.groundY - 13, 'door').setDepth(1);
}

function addBlock(b: BattleState, mat: string, x: number, y: number, w: number, h: number): void {
  const def = materialDef(mat)!;
  const body: any = b.scene.matter.add.rectangle(x, y, w, h, {
    density: def.density ?? DEFAULT_DENSITY,
    friction: def.friction ?? BLOCK_FRICTION, frictionStatic: 1, restitution: 0.05, label: 'block',
  });
  const sprite = b.scene.add.image(x, y, blockKey(mat, w, h, false)).setDepth(2);
  b.ents.push(makeEnt(b, 'block', mat, body, sprite, def.hp, def.weak ?? null, null, w, h, 16, {}));
}

function addMonster(b: BattleState, m: LevelMonster): void {
  const def = monsterDef(m.t);
  const art = MONSTER_ART[m.t];
  if (!def || !art) return;
  const body: any = b.scene.matter.add.rectangle(m.x, m.y, art.w, art.h, {
    density: def.density ?? DEFAULT_DENSITY, friction: 0.6, frictionStatic: 1, restitution: 0.05, label: 'monster',
  });
  const sprite = b.scene.add.image(m.x, m.y, m.t).setDepth(3);
  const e = makeEnt(b, 'monster', m.t, body, sprite, def.hp, def.weak, def.resist, art.w, art.h, art.size, def.params ?? {});
  e.dir = m.dir ?? 1;
  e.speed = m.speed ?? def.params?.speed ?? 0;
  e.def = def;
  e.behavior = behaviorFor(def);
  b.ents.push(e);
}

function makeEnt(
  b: BattleState, kind: Kind, type: string, body: any, sprite: Phaser.GameObjects.Image, hp: number,
  weak: string | null, resist: string | null, w: number, h: number, size: number, params: Params,
): Ent {
  const e: Ent = {
    kind, type, body, sprite, hp, maxHp: hp, weak, resist, w, h, size, cool: 0, hurt: 0, flash: 0, dead: false,
    phase: b.rng.next() * 6, shield: 0, status: { burn: 0, slow: 0, curse: 0 }, ox: body.position.x, oy: body.position.y,
    dir: 1, speed: 0, fireT: 0, params,
  };
  body.ent = e;
  return e;
}
