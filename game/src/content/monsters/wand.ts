import type { BattleCtx, Ent } from '../../battle/BattleCtx';

/** The grip keeps its spawn aim as the shooter's body turns. */
export function initEnemyWand(ctx: BattleCtx, m: Ent): void {
  const W = m.def!.wand!;
  const body = m.body;
  m.aimBodyAngle = body.angle;
  m.handFacing = ctx.sling.x < body.position.x ? -1 : 1;
  const c = Math.cos(body.angle);
  const s = Math.sin(body.angle);
  const handX = body.position.x + W.handX * m.handFacing * c - W.handY * s;
  const handY = body.position.y + W.handX * m.handFacing * s + W.handY * c;
  const dx = ctx.sling.x - handX;
  const dy = ctx.sling.y - handY;
  const distance = Math.hypot(dx, dy) || 1;
  m.aim = { x: dx / distance, y: dy / distance };
}

/** Shared by shots and drawing; only body state and the fixed grip determine the pose. */
export function enemyWandPose(m: Ent): { hand: { x: number; y: number }; tip: { x: number; y: number }; aim: { x: number; y: number }; angle: number } {
  const W = m.def!.wand!;
  const body = m.body;
  const c = Math.cos(body.angle);
  const s = Math.sin(body.angle);
  const hand = {
    x: body.position.x + W.handX * m.handFacing! * c - W.handY * s,
    y: body.position.y + W.handX * m.handFacing! * s + W.handY * c,
  };
  const angle = Math.atan2(m.aim!.y, m.aim!.x) + body.angle - m.aimBodyAngle!;
  const aim = { x: Math.cos(angle), y: Math.sin(angle) };
  return { hand, tip: { x: hand.x + aim.x * W.length, y: hand.y + aim.y * W.length }, aim, angle };
}
