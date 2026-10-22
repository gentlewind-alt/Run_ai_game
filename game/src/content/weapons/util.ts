import type { BattleCtx } from '../../battle/BattleCtx';

/** Where something falling at x stops: the ground, or the top of the first block or monster under it. */
export function landingY(ctx: BattleCtx, x: number): number {
  let y = ctx.groundAt(x);
  for (const e of [...ctx.monsters(), ...ctx.blocks()]) {
    if (e.dead) continue;
    if (Math.abs(e.body.position.x - x) <= e.w / 2 + 6) y = Math.min(y, e.body.position.y - e.h / 2);
  }
  return y;
}
