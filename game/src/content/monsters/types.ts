import type { BattleCtx, Ent } from '../../battle/BattleCtx';

/** Behaviour for one monster `behavior` key (defaults to the monster id, then 'basic'). Numbers come from the data row's `params`. */
export interface MonsterBehavior {
  /** Called once for every monster after the whole level is built (so neighbours exist). */
  onSpawn?(ctx: BattleCtx, m: Ent): void;
  onUpdate?(ctx: BattleCtx, m: Ent): void;
  /** Runs after shields absorb, before HP drops. Return a new amount to change the damage. */
  onDamaged?(ctx: BattleCtx, m: Ent, amount: number): number | void;
  onDeath?(ctx: BattleCtx, m: Ent): void;
}
