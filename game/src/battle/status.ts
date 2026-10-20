// Status effects on monsters: burn (damage over time), slow, curse (takes extra damage).
import { burst } from './fx';
import { damage } from './damage';
import { MatterLib } from './matter';
import type { Ent, StatusId } from './BattleCtx';
import type { BattleState } from './state';

export function inflict(_b: BattleState, e: Ent, kind: StatusId, steps: number): void {
  if (e.dead) return;
  e.status[kind] = steps;
  if (kind === 'stun') MatterLib.Body.setVelocity(e.body, { x: 0, y: 0 });
  if (kind === 'chain') MatterLib.Body.setStatic(e.body, true);
}

/** Ticks one monster's timers (burn can kill it). */
export function tick(b: BattleState, e: Ent): void {
  const body = e.body;
  const S = b.tune.status;
  if (e.status.burn > 0) {
    e.status.burn--;
    if (e.status.burn % S.burnTickSteps === 0) damage(b, e, S.burnDamage, body.position.x, body.position.y, { strong: false, tag: 'norm', quiet: true });
    if (e.status.burn % 6 === 0) burst(b, body.position.x, body.position.y - e.h / 2, ['3', '4'], 1);
  }
  if (e.status.slow > 0) e.status.slow--;
  if (e.status.curse > 0) e.status.curse--;
  if (e.status.stun > 0) e.status.stun--;
  if (e.status.chain > 0 && --e.status.chain === 0) MatterLib.Body.setStatic(body, false);
}
