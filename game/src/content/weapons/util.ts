import type { BattleCtx } from '../../battle/BattleCtx';

/** Unit direction from (x, y) to the nearest living monster (then nearest block); along (vx, vy) when there is none. */
export function aimFrom(ctx: BattleCtx, x: number, y: number, vx: number, vy: number): { dx: number; dy: number } {
  const blocks = ctx.blocks().filter((e) => !e.dead).sort((a, c) => Math.hypot(a.body.position.x - x, a.body.position.y - y) - Math.hypot(c.body.position.x - x, c.body.position.y - y));
  const t = ctx.nearestMonsters(x, y, 1)[0] ?? blocks[0];
  const ax = t ? t.body.position.x - x : vx;
  const ay = t ? t.body.position.y - y : vy;
  const d = Math.hypot(ax, ay) || 1;
  return { dx: ax / d, dy: ay / d };
}

/** Where something falling at x stops: the ground, or the top of the first block or monster under it. */
export function landingY(ctx: BattleCtx, x: number): number {
  let y = ctx.groundAt(x);
  for (const e of [...ctx.monsters(), ...ctx.blocks()]) {
    if (e.dead) continue;
    if (Math.abs(e.body.position.x - x) <= e.w / 2 + 6) y = Math.min(y, e.body.position.y - e.h / 2);
  }
  return y;
}
