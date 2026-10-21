// Builds the level: background, ground, sling, blocks and monsters.
import { buildBackground } from '../art/backgrounds';
import { MONSTER_ART, blockKey, makeBattleTextures } from '../art/textures';
import { behaviorFor } from '../content/monsters';
import { buildTerrain, groundAt } from './terrain';
import { profile } from '../core/profile';
import { data } from '../data/load';
import { materialDef, monsterDef } from '../data/lookup';
import type { LevelMonster } from '../data/types';
import type Phaser from 'phaser';
import type { Ent, Kind } from './BattleCtx';
import type { BattleState } from './state';

// Body defaults when a material or monster row doesn't say (see architecture/DATA.md).
const DEFAULT_DENSITY = 0.001;
const BLOCK_FRICTION = 0.7;

export function buildWorld(b: BattleState): void {
  const s = b.scene;
  makeBattleTextures(s, b.level.blocks);
  const realm = data.content.realms.find((r) => r.id === b.level.realm)?.background ?? 'hills';
  buildBackground(s, b.worldW, b.groundY, realm, false);
  buildTerrain(b);
}

/** Sling, blocks, monsters and the exit door. Call after the view is set up. */
export function populate(b: BattleState): void {
  const s = b.scene;
  const slingSkin = profile.equipped.slingSkin;
  const skinKey = slingSkin === 's_quicksilver' ? 'sling_quicksilver' :
                  slingSkin === 's_gemini' ? 'sling_gemini' : slingSkin;
  const slingTex = skinKey && s.textures.exists(skinKey) ? skinKey : 'sling';
  s.add.image(b.slingX, b.slingY + 28, slingTex).setDepth(2);
  for (const blk of b.level.blocks) addBlock(b, blk.m, blk.x, blk.y, blk.w, blk.h);
  for (const c of b.level.chests ?? []) addChest(b, c);
  for (const m of b.level.monsters) addMonster(b, m);
  for (const e of b.ents) if (e.kind === 'monster') e.behavior?.onSpawn?.(b.ctx, e);
  if (b.level.exit) s.add.image(b.level.exit.x, b.level.exit.y ?? groundAt(b, b.level.exit.x) - 13, 'door').setDepth(1);
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

function addChest(b: BattleState, chest: { id: string; x: number; y: number; hp?: number; reward: string }): void {
  const w = 14;
  const h = 12;
  const body: any = b.scene.matter.add.rectangle(chest.x, chest.y, w, h, {
    density: DEFAULT_DENSITY * 1.5, friction: 0.8, frictionStatic: 1, restitution: 0.05, label: 'chest',
  });
  const sprite = b.scene.add.image(chest.x, chest.y, 'chest').setDepth(2);
  const hp = chest.hp ?? b.tune.chestHp ?? 40;
  const e = makeEnt(b, 'chest', chest.id, body, sprite, hp, 'physical', null, w, h, 16, { reward: chest.reward });
  e.reward = chest.reward;
  b.ents.push(e);
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
  e.delay = m.delay ?? 0;
  e.speed = m.speed ?? def.params?.speed ?? 0;
  e.def = def;
  e.behavior = behaviorFor(def);
  b.ents.push(e);
}

function makeEnt(
  b: BattleState, kind: Kind, type: string, body: any, sprite: Phaser.GameObjects.Image, hp: number,
  weak: string | null, resist: string | null, w: number, h: number, size: number, params: Record<string, any>,
): Ent {
  const e: Ent = {
    kind, type, body, sprite, hp, maxHp: hp, weak, resist, w, h, size, cool: 0, hurt: 0, flash: 0, dead: false,
    phase: b.rng.next() * 6, shield: 0, status: { burn: 0, slow: 0, curse: 0, stun: 0, chain: 0 }, ox: body.position.x, oy: body.position.y,
    dir: 1, speed: 0, fireT: 0, delay: 0, params,
  };
  body.ent = e;
  return e;
}
