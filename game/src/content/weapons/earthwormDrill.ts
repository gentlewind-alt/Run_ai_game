import { sfx } from '../../audio/sfx';
import { C } from '../../art/palette';
import { weaponTexture } from '../../art/textures';
import type { BattleCtx, Proj } from '../../battle/BattleCtx';
import type { WeaponImpl } from './types';

/** The eruption: a blast under the fort with an upward shove and a spray of dirt. */
function erupt(ctx: BattleCtx, p: Proj): void {
  const P = p.def.params;
  const b = p.body.position;
  ctx.blast(b.x, b.y, P.eruptRadius, P.eruptMult, p.wid);
  ctx.push(b.x, b.y, P.eruptRadius * 1.3, P.eruptPush);
  ctx.fx.ring(b.x, b.y, P.eruptRadius, C('4'));
  ctx.fx.sparks(b.x, b.y, ['h', 'g', '4', '3'], 14);
  ctx.fx.shake(0.02);
  sfx.quake();
  ctx.endProj(p);
}

/**
 * Earthworm Drill (rare): the tap points the worm steeply down; it drills in with a trail of dirt, and wherever it stops
 * (the first contact) it erupts in a blast with an upward shove, pushing the fort off its foundations.
 */
export const earthwormDrill: WeaponImpl = {
  texture: weaponTexture('w_earthworm_drill'),
  onAbility(ctx, p) {
    const P = p.def.params;
    const v = p.body.velocity;
    ctx.M.Body.setVelocity(p.body, { x: v.x * P.diveForward, y: P.diveSpeed });
    ctx.M.Body.setAngularVelocity(p.body, P.drillSpin);
    p.data.drilling = true;
    sfx.saw();
  },
  onUpdate(ctx, p) {
    if (!p.data.drilling) return;
    const b = p.body.position;
    if (p.steps % 3 === 0) ctx.fx.sparks(b.x, b.y - 4, ['h', 'g'], 1);
  },
  onImpact(ctx, p) {
    if (p.data.drilling) erupt(ctx, p);
  },
  onPostImpact(ctx, p) {
    erupt(ctx, p);
  },
};
