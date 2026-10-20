import type Phaser from 'phaser';
import type { BattleCtx, Proj } from '../../battle/BattleCtx';

/**
 * Behaviour for one weapon id. Stats and numbers come from the data row (`physics`, `ability`, `params`), read through `p.def`.
 * Ability modes: 'button' (on-screen button in flight), 'impact' (automatically on the first hit, ground included, once),
 * 'both' (button, or the first hit if the player never pressed it).
 */
export interface WeaponImpl {
  texture: string;
  onLaunch?(ctx: BattleCtx, p: Proj): void;
  onAbility?(ctx: BattleCtx, p: Proj): void;
  onImpact?(ctx: BattleCtx, p: Proj): void;
  /** Called once on the first contact after the ability fired (for example the cleaver's shockwave). */
  onPostImpact?(ctx: BattleCtx, p: Proj): void;
  onUpdate?(ctx: BattleCtx, p: Proj): void;
  drawFx?(ctx: BattleCtx, p: Proj, g: Phaser.GameObjects.Graphics): void;
}
