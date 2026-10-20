// The interface content code (weapons, monsters, later artifacts) uses to act on the battle. Never import a scene.
import type Phaser from 'phaser';
import type { EventBus } from '../core/events';
import type { Rng } from '../core/rng';
import type { DamageRules, Level, MonsterDef, Params, Tuning, WeaponDef } from '../data/types';
import type { MonsterBehavior } from '../content/monsters/types';

export type Kind = 'block' | 'monster';
export type StatusId = 'burn' | 'slow' | 'curse' | 'stun' | 'chain';
export type BattlePhase = 'intro' | 'loading' | 'ready' | 'aiming' | 'flying' | 'settling' | 'won' | 'lost';
export type DamageTag = 'weak' | 'resist' | 'norm';

export interface DamageOpts {
  strong: boolean; // hit-stop on this hit
  tag: DamageTag;
  fall?: boolean;
  quiet?: boolean; // no numbers or words (burn ticks)
}

/** A block or a monster. */
export interface Ent {
  kind: Kind;
  type: string; // monster id, or material id
  body: any;
  sprite: Phaser.GameObjects.Image;
  hp: number;
  maxHp: number;
  weak: string | null;
  resist: string | null;
  w: number;
  h: number;
  size: number; // sprite size (16 or 32) for monsters
  cool: number;
  hurt: number;
  flash: number;
  dead: boolean;
  phase: number;
  shield: number;
  shieldSprite?: Phaser.GameObjects.Image;
  shieldedBy?: Ent;
  icon?: Phaser.GameObjects.Image;
  revealed?: boolean; // show HP and element from the start (Analyst Lens)
  status: Record<StatusId, number>;
  ox: number;
  oy: number;
  dir: number;
  speed: number;
  fireT: number;
  delay: number; // seconds a runner waits before it starts (level data)
  runFrom?: number; // step a runner starts running, set once the battle is live
  params: Params; // from the monster's data row
  behavior?: MonsterBehavior;
  def?: MonsterDef;
}

/** Scratch fields the collision code reads from a projectile body. */
export interface ProjInfo {
  wid: string;
  mul: number;
  owner: 'main' | 'extra';
  status?: string;
  pierce?: number;
  hit?: Set<number>;
}

/** The shot in the air. `data` is scratch space for the weapon's own state. */
export interface Proj {
  body: any;
  sprite: Phaser.GameObjects.Image;
  wid: string;
  def: WeaponDef;
  steps: number;
  slow: number;
  tapped: boolean;
  t: number;
  data: Record<string, any>;
}

/** Anything that lives for a while and updates each physics step (bolts, arrows, pellets). */
export interface Actor {
  pos?: () => { x: number; y: number };
  update(): boolean; // return true when finished
  destroy(): void;
}

export interface PelletOpts {
  x: number; y: number; vx: number; vy: number; radius: number; density: number; mul: number; wid: string;
  color: string; status?: string; gravity?: number;
}

/** Numbers artifacts and consumables adjust during a battle. */
export interface Mods {
  damageMult: number; // set at each launch (Prime Serum)
  serumShots: number; // shots left that get serumMult
  serumMult: number;
  coinMult: number; // Gambler's Charm
  previewMult: number; // Analyst Lens
}

export interface BattleCtx {
  readonly step: number; // fixed steps since the level started
  readonly stepHz: number; // fixed steps per second
  readonly rng: Rng;
  readonly tune: Tuning;
  readonly rules: DamageRules;
  readonly events: EventBus;
  readonly sling: { x: number; y: number };
  readonly groundY: number;
  groundAt(x: number): number; // ground height at world x (see battle/terrain.ts)
  readonly worldW: number;
  readonly level: Level;
  readonly phase: BattlePhase;
  readonly mods: Mods;
  readonly M: any; // Matter.js namespace

  // queries
  monsters(): Ent[];
  blocks(): Ent[];
  within(x: number, y: number, r: number): Ent[]; // living monsters in a radius
  nearestMonsters(x: number, y: number, n: number): Ent[];
  shotPos(): { x: number; y: number } | null; // the main shot in the air, if any

  // actions
  damage(target: Ent, amount: number, x: number, y: number, opts: DamageOpts): void;
  directHit(target: Ent, weaponId: string, mult: number, x: number, y: number, strong?: boolean): void;
  damageAround(x: number, y: number, r: number, mult: number, weaponId: string): void;
  blast(x: number, y: number, r: number, mult: number, weaponId: string): void;
  explode(x: number, y: number, r: number, base: number, exclude: Ent | null, weaponId: string | null): void;
  addStatus(target: Ent, status: StatusId, steps: number): void;
  push(x: number, y: number, r: number, strength: number): void;
  setGravity(body: any, factor: number): void;
  addActor(a: Actor): void;
  spawnPellet(o: PelletOpts): void;
  endProj(p: Proj): void;
  escape(runner: Ent): void;
  addCoins(n: number): void; // goes through the coin multiplier
  reveal(e: Ent): void; // show HP and element for this monster

  // presentation
  fx: {
    ring(x: number, y: number, r: number, color: number): void;
    sparks(x: number, y: number, colors: string[], n: number): void;
    shake(intensity: number): void;
    dot(x: number, y: number, r: number, fill: number, stroke: number): Phaser.GameObjects.Arc;
    image(x: number, y: number, key: string): Phaser.GameObjects.Image;
    word(x: number, y: number, word: string): void;
    bolt(x: number, y: number): void; // a lightning strike from above
  };
}
