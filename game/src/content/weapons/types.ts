import type Phaser from 'phaser';
import type { BattleCtx, Ent, Proj } from '../../battle/BattleCtx';

export interface ImpactInfo {
  target?: Ent; rel: number; x: number; y: number;
  /** Optional contact normal toward the projectile and identity of the touched body. */
  normal?: { x: number; y: number };
  bodyId?: number;
  label?: string;
}

/**
 * Behaviour for one weapon id. Stats and numbers come from the data row (`physics`, `ability`, `params`), read through `p.def`.
 * Ability modes: 'button' (on-screen button in flight), 'impact' (automatically on the first hit, ground included, once),
 * 'both' (button, or the first hit if the player never pressed it).
 */
export interface WeaponImpl {
  texture: string;
  onLaunch?(ctx: BattleCtx, p: Proj): void;
  onAbility?(ctx: BattleCtx, p: Proj): void;
  /** `hit` says what was touched (a monster or block; absent for ground and walls) and how fast the contact was. */
  onImpact?(ctx: BattleCtx, p: Proj, hit?: ImpactInfo): void;
  /** Called once on the first contact after the ability fired (for example the cleaver's shockwave). */
  onPostImpact?(ctx: BattleCtx, p: Proj): void;
  onUpdate?(ctx: BattleCtx, p: Proj): void;
  drawFx?(ctx: BattleCtx, p: Proj, g: Phaser.GameObjects.Graphics): void;
}
