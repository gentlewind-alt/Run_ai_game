import { C } from '../../art/palette';
import { weaponTexture } from '../../art/textures';
import type { WeaponImpl } from './types';

export const boomerang: WeaponImpl = {
  texture: weaponTexture('w_hunters_boomerang'),
  // Rebound: flies out, then curves back on its own; the return pass deals extra damage and slices everything along its path.
  onAbility(_ctx, p) {
    p.data.returning = true;
  },
  onUpdate(ctx, p) {
    const P = p.def.params;
    if (p.steps > P.returnAfter) p.data.returning = true;
    if (!p.data.returning) return;
    p.body.proj.mul = P.returnMult;
    if (p.steps % P.sliceEvery === 0) {
      ctx.damageAround(p.body.position.x, p.body.position.y, P.sliceRadius, P.sliceMult, p.wid);
      ctx.fx.sparks(p.body.position.x, p.body.position.y, ['4', 'c'], 1);
    }
    ctx.setGravity(p.body, 0);
    const b = p.body;
    const dx = ctx.sling.x - b.position.x;
    const dy = ctx.sling.y - b.position.y;
    const d = Math.hypot(dx, dy);
    if (d < P.catchRadius) {
      ctx.endProj(p);
      return;
    }
    ctx.M.Body.setVelocity(b, {
      x: b.velocity.x + ((dx / d) * P.returnSpeed - b.velocity.x) * P.returnTurn,
      y: b.velocity.y + ((dy / d) * P.returnSpeed - b.velocity.y) * P.returnTurn,
    });
  },
  drawFx(_ctx, p, g) {
    if (!p.data.returning) return;
    const b = p.body.position;
    g.lineStyle(1, C('4'), 1).strokeCircle(b.x, b.y, 9);
  },
};
