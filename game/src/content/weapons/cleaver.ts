import { sfx } from '../../audio/sfx';
import { C } from '../../art/palette';
import { weaponTexture } from '../../art/textures';
import type { WeaponImpl } from './types';

export const cleaver: WeaponImpl = {
  texture: weaponTexture('w_iron_cleaver'),
  // Dive-slam straight down; the first thing it hits sends out a shockwave.
  onAbility(ctx, p) {
    ctx.M.Body.setVelocity(p.body, { x: 0, y: p.def.params.slamSpeed });
    ctx.M.Body.setAngularVelocity(p.body, 0);
    ctx.M.Body.setAngle(p.body, Math.PI);
    p.data.slam = true;
    sfx.saw();
  },
  onPostImpact(ctx, p) {
    const P = p.def.params;
    const b = p.body.position;
    ctx.fx.ring(b.x, b.y, P.shockRingRadius, C('c'));
    ctx.damageAround(b.x, b.y, P.shockRadius, P.shockMult, p.wid);
    ctx.push(b.x, b.y, P.shockPushRadius, P.shockPush);
    ctx.fx.sparks(b.x, b.y, ['k', 'l', 'c'], 12);
    ctx.fx.shake(0.01);
    sfx.crunch();
  },
  onUpdate(ctx, p) {
    if (p.data.slam) {
      const P = p.def.params;
      const v = p.body.velocity;
      if (v.y < P.slamHold && !p.data.landed) ctx.M.Body.setVelocity(p.body, { x: v.x * P.slamDrag, y: P.slamSpeed });
    }
  },
};
