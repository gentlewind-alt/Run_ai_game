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
    ctx.fx.pingStar?.(p.body.position.x, p.body.position.y);
    ctx.fx.sparks(p.body.position.x, p.body.position.y, ['c', '4', 'b'], 12);

    // The last bounce rings out as a shield blast, once
    if (p.data.bounces === maxBounces) {
      const b = p.body.position;
      ctx.blast(b.x, b.y, P.finalRadius, P.finalMult, p.wid);
      ctx.fx.ring(b.x, b.y, P.finalRadius, C('4'));
      ctx.fx.shake(0.012);
    }
  },
  onUpdate(_ctx, p) {
    // Record trail positions for dithered ghost copies
    const trail = p.data.trail as { x: number; y: number }[];
    if (trail) {
      trail.unshift({ x: p.body.position.x, y: p.body.position.y });
      if (trail.length > 8) trail.pop();
    }
  },
  drawFx(_ctx, p, g) {
    // 1. Dithered ghost trail behind disc
    const trail = p.data.trail as { x: number; y: number }[] | undefined;
    if (trail && trail.length > 1) {
      trail.slice(1, 5).forEach((pt, idx) => {
        const alpha = 0.7 - idx * 0.14;
        g.lineStyle(2, C('b'), alpha).strokeCircle(pt.x, pt.y, 11 - idx * 2);
        g.lineStyle(1, C('c'), alpha * 0.9).strokeCircle(pt.x, pt.y, 7 - idx);
      });
    }

    // 2. Bounce counter pips floating above disc
    const bCount = (p.data.bounces as number) ?? 0;
    if (bCount > 0) {
      const bx = p.body.position.x;
      const by = p.body.position.y - 15;
      const totalPips = Math.min(bCount, 6);
      const startX = bx - ((totalPips - 1) * 5) / 2;
      for (let i = 0; i < totalPips; i++) {
        const px = startX + i * 5;
        g.fillStyle(C('0'), 1).fillRect(px - 1, by - 1, 4, 4);
        g.fillStyle(C('4'), 1).fillRect(px, by, 2, 2);
      }
    }
  },
};
