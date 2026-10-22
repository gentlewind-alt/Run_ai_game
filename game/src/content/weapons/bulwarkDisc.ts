import Phaser from 'phaser';
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
  onImpact(ctx, p, hit) {
    const P = p.def.params;
    const maxBounces = P.maxBounces ?? 6;
    // Only a real knock counts as a bounce: resting or rolling contact on the ground does not.
    if (hit && hit.rel < (P.minBounceSpeed ?? 1.5)) return;
    if (ctx.step - (p.data.lastBounce ?? -9999) < (P.bounceGapSteps ?? 8)) return;
    p.data.lastBounce = ctx.step;
    p.data.bounces = (p.data.bounces ?? 0) + 1;
    const bCount = Math.min(p.data.bounces, maxBounces);

    // Each bounce damages what it touches at +10% per bounce, with a spark and a ping
    const bonus = P.bounceDamageBonus ?? 0.10;
    p.body.proj.mul = 1 + bCount * bonus;

    sfx.ping();
    ctx.fx.pingStar?.(p.body.position.x, p.body.position.y);
    ctx.fx.sparks(p.body.position.x, p.body.position.y, ['c', '4', 'b'], 12);

    // Ricochet: after knocking a monster or a block, fly on to the next monster (not the one just hit) within range.
    if (hit?.target && p.data.bounces < maxBounces && (p.data.jumps ?? 0) < (P.ricochetJumps ?? 2)) {
      const b = p.body.position;
      const range = P.ricochetRange ?? 150;
      const next = ctx.nearestMonsters(b.x, b.y, 3).find((m) => m !== hit.target && Math.hypot(m.body.position.x - b.x, m.body.position.y - b.y) <= range);
      if (next) {
        // A lob, not a straight line: the thing just hit is usually between the disc and the next monster. The new velocity
        // is applied in onUpdate, after the physics solver has finished with this contact, or the solver would cancel it.
        const g = P.ricochetGravity ?? 0.25;
        const dx = next.body.position.x - b.x;
        const dy = next.body.position.y - b.y;
        const lift = Math.max(P.ricochetLift ?? 4.5, dy < 0 ? Math.sqrt(-2 * g * dy) + 0.5 : 0);
        const t = (lift + Math.sqrt(lift * lift + 2 * g * dy)) / g; // steps to arrive
        const maxSp = P.ricochetSpeed ?? 7;
        p.data.jumps = (p.data.jumps ?? 0) + 1;
        p.data.ricochet = { x: Phaser.Math.Clamp(dx / t, -maxSp, maxSp), y: -lift };
        ctx.fx.ring(b.x, b.y, 12, C('b'));
      }
    }

    // The last bounce rings out as a shield blast, once
    if (p.data.bounces === maxBounces) {
      const b = p.body.position;
      ctx.blast(b.x, b.y, P.finalRadius, P.finalMult, p.wid);
      ctx.fx.ring(b.x, b.y, P.finalRadius, C('4'));
      ctx.fx.shake(0.012);
    }
  },
  onUpdate(ctx, p) {
    const r = p.data.ricochet as { x: number; y: number } | undefined;
    if (r) {
      ctx.M.Body.setVelocity(p.body, r);
      p.data.ricochet = undefined;
    }
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
