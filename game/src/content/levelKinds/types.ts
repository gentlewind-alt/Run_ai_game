import type { BattleCtx } from '../../battle/BattleCtx';
import type { Level } from '../../data/types';

export interface LevelKind {
  id: string;
  name: string;
  /** Called once after battle entities and level are created. */
  onStart?(ctx: BattleCtx, level: Level): void;
  /** Called every 60 Hz physics step. */
  onStep?(ctx: BattleCtx, level: Level): void;
  /** Called when the level is won before results are launched. */
  onWin?(ctx: BattleCtx, level: Level): void;
}
