// The mutable state of one battle. Battle modules are functions over this object; content code only sees BattleCtx.
import type Phaser from 'phaser';
import type { Settings } from '../config/settings';
import type { EventBus } from '../core/events';
import type { Rng } from '../core/rng';
import type { Content, DamageRules, Level, Tuning, WeaponDef } from '../data/types';
import type { WeaponImpl } from '../content/weapons/types';
import type { Actor, BattleCtx, BattlePhase, Ent, Mods, Proj } from './BattleCtx';
import type { ArtifactImpl } from '../content/artifacts/types';
import type { ConsumableImpl } from '../content/consumables';
import type { Params } from '../data/types';

export interface Particle { s: Phaser.GameObjects.Image; vx: number; vy: number; life: number }

/** What the battle needs from the HUD (implemented in ui/hud.ts). Keeps battle/ free of ui/ imports. */
export interface BattleUi {
  setAbilityLabel(label: string): void;
  showAbility(inAir: boolean, ready: boolean, scale: number): void;
  setEscaped(escaped: number, limit: number): void;
  setTargeting(on: boolean, label?: string): void;
  consumableUsed(i: number): void;
}

export interface InstalledArtifact { id: string; impl: ArtifactImpl; params: Params; off: () => void }
export interface ConsumableSlot { id: string; name: string; impl: ConsumableImpl; params: Params; used: boolean }

export interface View {
  z: number; // zoom
  cx: number; // world x at the screen centre
  free: boolean; // player moved the view: stop following the shot
  pinchPrev: number;
  panLast: number | null;
}

export interface BattleState {
  scene: Phaser.Scene;
  ctx: BattleCtx;
  ui: BattleUi;
  events: EventBus;
  rng: Rng;
  content: Content;
  level: Level;
  levelId: number;
  loadout: string[];
  settings: Settings;
  tune: Tuning;
  rules: DamageRules;
  stepMs: number;
  groundY: number;
  slingX: number;
  slingY: number;
  worldW: number;
  maxSpeed: number; // launch speed at full pull
  terrain: [number, number][]; // ground profile, see battle/terrain.ts
  mods: Mods;
  artifacts: InstalledArtifact[];
  consumables: ConsumableSlot[];
  targeting: number | null; // index of an armed targeted consumable
  paused: boolean;

  ents: Ent[];
  actors: Actor[];
  proj: Proj | null;
  state: BattlePhase;
  wpn: WeaponImpl;
  wdef: WeaponDef;
  shotIdx: number;
  coins: number;
  score: number;
  chain: number;
  chainT: number;
  escaped: number;
  steps: number;
  acc: number;
  hitStop: number;
  settleSteps: number;
  endTimer: number;
  lastPop: number;
  lastStretch: number;

  pouch: Phaser.Math.Vector2;
  readySprite: Phaser.GameObjects.Image;
  queue: Phaser.GameObjects.Image[];
  gfx: Phaser.GameObjects.Graphics;
  parts: Particle[];

  view: View;
  uiCam: Phaser.Cameras.Scene2D.Camera;
  uiMode: boolean; // objects created while true are drawn by the fixed UI camera only
  /** Run `fn` with newly created objects routed to the UI camera. */
  inUi<T>(fn: () => T): T;
}
