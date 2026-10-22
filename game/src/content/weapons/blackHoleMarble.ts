import { sfx } from '../../audio/sfx';
import { C } from '../../art/palette';
import { weaponTexture } from '../../art/textures';
import type { WeaponImpl } from './types';

/**
 * Black Hole Marble (legendary): the tap leaves a singularity hanging in the air. For `holeSteps` it pulls everything within its
 * radius toward it with growing force, then it collapses in a shock wave. One charge per level. Numbers are in the data row.
 */
export const blackHoleMarble: WeaponImpl = {
  texture: weaponTexture('w_black_hole_marble'),
  onAbility(ctx, p) {
    const P = p.def.params;
    const b = p.body;
    ctx.M.Body.setVelocity(b, { x: 0, y: 0 });
    ctx.M.Body.setAngularVelocity(b, 0);
    ctx.setGravity(b, 0);
    p.sprite.setAlpha(0.35);
    const x = b.position.x;
    const y = b.position.y;
    const core = ctx.fx.dot(x, y, 4, C('0'), C('7'));
    core.setDepth(11);
    ctx.flash?.(0x7a3b8c, 80);
    sfx.omnitrix();
    let t = 0;
    ctx.addActor({
      pos: () => ({ x, y }),
      update() {
        t++;
        const grow = t / P.holeSteps;
        core.setRadius(4 + grow * 6);
        if (t % 6 === 0) {
          ctx.fx.ring(x, y, P.holeRadius * (1 - ((t / 6) % 5) / 5), C(t % 12 === 0 ? '7' : 'b'));
          const a = ctx.rng.next() * Math.PI * 2;
          ctx.fx.sparks(x + Math.cos(a) * P.holeRadius * 0.8, y + Math.sin(a) * P.holeRadius * 0.8, ['7', 'b'], 1);
        }
        // pull: a negative push draws things in, stronger as the hole grows
        ctx.push(x, y, P.holeRadius, -P.pullStrength * (0.4 + grow));
        if (t % P.tickSteps === 0) ctx.damageAround(x, y, P.holeRadius * 0.5, P.tickMult, p.wid);
        if (t < P.holeSteps) return false;
        // collapse
        ctx.blast(x, y, P.collapseRadius, P.collapseMult, p.wid);
        ctx.fx.ring(x, y, P.collapseRadius, C('c'));
        ctx.fx.sparks(x, y, ['7', 'b', 'c'], 14);
        ctx.fx.shake(0.03);
        ctx.flash?.(0xffffff, 100);
        sfx.quake();
        core.destroy();
        ctx.endProj(p);
        return true;
      },
      destroy() {
        core.destroy();
      },
    });
  },
};
