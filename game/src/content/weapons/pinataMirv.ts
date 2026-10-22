import { sfx } from '../../audio/sfx';
import { C } from '../../art/palette';
import { weaponTexture } from '../../art/textures';
import type { WeaponImpl } from './types';

const CANDY = ['3', '4', '5', 'a', 'b'];

/**
 * Pinata MIRV (rare): the tap bursts the pinata into five candy bombs that fan out, arc down and each explode on the first
 * thing they touch (ground, block or monster). The pinata itself is gone at the tap. Numbers are in the data row.
 */
export const pinataMirv: WeaponImpl = {
  texture: weaponTexture('w_pinata_mirv'),
  onAbility(ctx, p) {
    const P = p.def.params;
    const b = p.body;
    const speed = Math.max(P.minSpeed, Math.hypot(b.velocity.x, b.velocity.y));
    const base = Math.atan2(b.velocity.y, b.velocity.x);
    const x0 = b.position.x;
    const y0 = b.position.y;
    ctx.fx.ring(x0, y0, 16, C('4'));
    ctx.fx.sparks(x0, y0, ['3', '4', '5', 'a'], 10);
    sfx.crunch();
    for (let i = 0; i < P.bombs; i++) {
      const color = CANDY[i % CANDY.length];
      const a = base + (i - (P.bombs - 1) / 2) * P.spread;
      let vx = Math.cos(a) * speed * P.speedMult;
      let vy = Math.sin(a) * speed * P.speedMult;
      let x = x0;
      let y = y0;
      const dot = ctx.fx.dot(x, y, 2.2, C(color), C('0'));
      ctx.addActor({
        update() {
          vy += P.gravity;
          x += vx;
          y += vy;
          dot.setPosition(x, y);
          const hit = y >= ctx.groundAt(x) || [...ctx.monsters(), ...ctx.blocks()].some(
            (e) => !e.dead && Math.abs(e.body.position.x - x) <= e.w / 2 + 2 && Math.abs(e.body.position.y - y) <= e.h / 2 + 2,
          );
          if (!hit && y < 400) return false;
          ctx.explode(x, y, P.bombRadius, p.def.baseDamage * P.bombMult, null, p.wid);
          ctx.fx.ring(x, y, P.bombRadius, C(color));
          ctx.fx.sparks(x, y, [color, '4'], 4);
          dot.destroy();
          return true;
        },
        destroy() {
          dot.destroy();
        },
      });
    }
    ctx.endProj(p);
  },
};
