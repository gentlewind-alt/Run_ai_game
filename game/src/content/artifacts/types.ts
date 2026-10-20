import type { BattleCtx, Ent } from '../../battle/BattleCtx';
import type { Params } from '../../data/types';

/** A weapon hit in the damage pipeline, offered to artifacts that modify damage. */
export interface Hit {
  weaponId: string;
  target: Ent;
}

/** Equipped artifacts subscribe to events for the length of a level. Numbers come from the data row's `params`. */
export interface ArtifactImpl {
  /** Subscribe to events and set `ctx.mods`. Return an uninstall function (listeners are also cleared when the battle ends). */
  install(ctx: BattleCtx, params: Params): () => void;
  /** Optional multiplier applied to every weapon hit. */
  modifyDamage?(hit: Hit, params: Params): number;
}
