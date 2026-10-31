import { sfx } from '../../audio/sfx';
import { C } from '../../art/palette';
import { weaponTexture } from '../../art/textures';
import type { WeaponImpl } from './types';
import { landingY } from './util';

export const scepter: WeaponImpl = {
  texture: weaponTexture('w_horned_scepter'),
  // Hellbrand: curse burst, and the brand falls to the ground as a fire pool that burns whatever stands in it.
  onAbility(ctx, p) {
    const b = p.body.position;
    ctx.fx.ring(b.x, b.y, p.def.params.radius, C('r'));
    ctx.fx.sparks(b.x, b.y, ['r', '1', 'u'], 14);
    for (const e of ctx.within(b.x, b.y, p.def.params.radius)) ctx.addStatus(e, 'curse', p.def.params.curseSteps);
    sfx.saw();
    const P = p.def.params;
    const px = b.x;
    const py = landingY(ctx, px);
    let t = 0;
    ctx.addActor({
      pos: () => ({ x: px, y: py }),
      update() {
        t++;
        if (t % 6 === 0) ctx.fx.sparks(px + (ctx.rng.next() - 0.5) * P.poolRadius * 1.6, py - 2, ['3', '4', '2'], 1);
        if (t % P.poolTick === 0) {
          ctx.fx.ring(px, py, P.poolRadius * 0.6, C('3'));
          for (const e of ctx.within(px, py - 6, P.poolRadius)) ctx.addStatus(e, 'burn', P.poolBurnSteps);
          for (const e of ctx.blocks()) {
            if (Math.hypot(e.body.position.x - px, e.body.position.y - (py - 6)) <= P.poolRadius + Math.max(e.w, e.h) / 2) ctx.fx.burn(e);
          }
        }
        return t >= P.poolSteps;
      },
      destroy() {},
    });
  },
  onUpdate(ctx, p) {
    if (p.steps % 3 === 0) ctx.fx.sparks(p.body.position.x, p.body.position.y, ['3', '4', '2'], 1);
  },
};
