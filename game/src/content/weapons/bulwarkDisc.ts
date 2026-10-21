import { sfx } from '../../audio/sfx';
import { C } from '../../art/palette';
import { weaponTexture } from '../../art/textures';
import type { WeaponImpl } from './types';

export const bulwarkDisc: WeaponImpl = {
  texture: weaponTexture('w_bulwark_disc'),
  onLaunch(_ctx, p) {
    p.data.bounces = 0;
    p.data.trail = [];
  },
  onAbility(ctx, p) {
    // Tap: redirects once toward the nearest monster
    const P = p.def.params;
    const nearest = ctx.nearestMonsters(p.body.position.x, p.body.position.y, 1)[0];
    if (!nearest) return;
    const dx = nearest.body.position.x - p.body.position.x;
    const dy = nearest.body.position.y - p.body.position.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.1) return;
    const sp = P.redirectSpeed ?? 9;
    ctx.M.Body.setVelocity(p.body, { x: (dx / d) * sp, y: (dy / d) * sp });
    ctx.fx.ring(p.body.position.x, p.body.position.y, 16, C('b'));
    sfx.saw();
  },
  onImpact(ctx, p) {
    const P = p.def.params;
    const maxBounces = P.maxBounces ?? 6;
    p.data.bounces = (p.data.bounces ?? 0) + 1;
    const bCount = Math.min(p.data.bounces, maxBounces);

    // Each bounce damages what it touches at +10% per bounce, with a spark and a ping
    const bonus = P.bounceDamageBonus ?? 0.10;
    p.body.proj.mul = 1 + bCount * bonus;

    sfx.ping();
    ctx.fx.sparks(p.body.position.x, p.body.position.y, ['c', '4', 'b'], 8);
  },
  onUpdate(_ctx, p) {
    // Record trail positions for dithered ghost copies
    const trail = p.data.trail as { x: number; y: number }[];
    if (trail) {
      trail.unshift({ x: p.body.position.x, y: p.body.position.y });
      if (trail.length > 5) trail.pop();
    }
  },
  drawFx(_ctx, p, g) {
    const trail = p.data.trail as { x: number; y: number }[] | undefined;
    if (trail && trail.length > 1) {
      trail.slice(1, 4).forEach((pt, idx) => {
        const alpha = 0.6 - idx * 0.18;
        g.lineStyle(1, C('a'), alpha).strokeCircle(pt.x, pt.y, 8 - idx);
      });
    }
  },
};
