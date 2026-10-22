import { sfx } from '../../audio/sfx';
import { C } from '../../art/palette';
import { weaponTexture } from '../../art/textures';
import type { WeaponImpl } from './types';

export const cleaver: WeaponImpl = {
  texture: weaponTexture('w_iron_cleaver'),
  // Crater slam: dive straight down; where it lands it digs a visible crater and sends out a crumbling shock ring.
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
    ctx.fx.ring(b.x, b.y, P.shockRingRadius * 0.6, C('4'));
    ctx.damageAround(b.x, b.y, P.shockRadius, P.shockMult, p.wid);
    ctx.push(b.x, b.y, P.shockPushRadius, P.shockPush);
    ctx.fx.quakeRings?.(b.x, b.y, P.shockRingRadius * 2);
    ctx.fx.sparks(b.x, b.y, ['k', 'l', 'c', 'h'], 14);
    ctx.fx.shake(0.018);
    ctx.flash?.(0xffffff, 40);
    // the crater: a dark ellipse in the ground that fades after a couple of seconds
    const crater = ctx.fx.dot(b.x, b.y + 2, P.shockRadius * 0.6, C('j'), C('0'));
    crater.setScale(1, 0.3).setDepth(2);
    crater.scene.tweens.add({ targets: crater, alpha: 0, delay: 1800, duration: 700, onComplete: () => crater.destroy() });
    sfx.crunch();
    sfx.quake();
  },
  onUpdate(ctx, p) {
    if (p.data.slam) {
      const P = p.def.params;
      const v = p.body.velocity;
      if (v.y < P.slamHold && !p.data.landed) ctx.M.Body.setVelocity(p.body, { x: v.x * P.slamDrag, y: P.slamSpeed });
    }
  },
};
