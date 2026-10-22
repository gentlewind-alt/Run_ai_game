import { sfx } from '../../audio/sfx';
import { C } from '../../art/palette';
import { weaponTexture } from '../../art/textures';
import type { Actor } from '../../battle/BattleCtx';
import type { WeaponImpl } from './types';
import { landingY } from './util';

/**
 * Hailstorm Cauldron (rare): the tap tips the cauldron over the nearest monster and the sky opens: a rain of stew drops falls
 * across a band, one every few steps, each exploding where it lands. Numbers are in the data row.
 */
export const hailstormCauldron: WeaponImpl = {
  texture: weaponTexture('w_hailstorm_cauldron'),
  onAbility(ctx, p) {
    const P = p.def.params;
    const b = p.body;
    const target = ctx.nearestMonsters(b.position.x, b.position.y, 1)[0];
    const cx = target ? target.body.position.x : b.position.x + 60;
    ctx.M.Body.setVelocity(b, { x: 0, y: 0 });
    ctx.M.Body.setAngularVelocity(b, 0);
    ctx.setGravity(b, 0);
    p.sprite.setAlpha(0.5);
    ctx.flash?.(0xa7f070, 70);
    ctx.fx.ring(b.position.x, b.position.y, 18, C('6'));
    sfx.thwip();

    let launched = 0;
    let landed = 0;
    let t = 0;
    ctx.addActor({
      update() {
        t++;
        if (launched < P.drops && t % P.dropEvery === 0) {
          launched++;
          const x = cx + (ctx.rng.next() - 0.5) * P.bandWidth;
          const landY = landingY(ctx, x);
          const dot = ctx.fx.dot(x, -10, 2.2, C('5'), C('6'));
          let y = -10;
          ctx.addActor({
            update() {
              y += P.dropSpeed;
              dot.setY(y);
              if (y < landY) return false;
              ctx.damageAround(x, landY, P.dropRadius, P.dropMult, p.wid);
              ctx.fx.ring(x, landY, P.dropRadius, C('5'));
              ctx.fx.sparks(x, landY, ['5', '6', 'a'], 4);
              dot.destroy();
              landed++;
              if (landed === P.drops) ctx.endProj(p);
              return true;
            },
            destroy() {
              dot.destroy();
            },
          } as Actor);
        }
        return launched >= P.drops;
      },
      destroy() {},
    });
  },
};
