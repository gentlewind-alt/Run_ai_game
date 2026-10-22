import { sfx } from '../../audio/sfx';
import { weaponTexture } from '../../art/textures';
import { C } from '../../art/palette';
import type { WeaponImpl } from './types';

export const pike: WeaponImpl = {
  texture: weaponTexture('w_hunters_pike'),
  // Driller: speeds up and pierces up to `pierce` wood blocks or monsters; the first solid it meets after that is blasted.
  onAbility(ctx, p) {
    const v = p.body.velocity;
    ctx.M.Body.setVelocity(p.body, { x: v.x * p.def.params.boost, y: v.y * p.def.params.boost });
    p.body.isSensor = true;
    p.body.proj.pierce = p.def.params.pierce;
    p.body.proj.hit = new Set<number>();
    sfx.saw();
    ctx.fx.sparks(p.body.position.x, p.body.position.y, ['c', 'd'], 8);
  },
  onPostImpact(ctx, p) {
    const P = p.def.params;
    const b = p.body.position;
    ctx.blast(b.x, b.y, P.drillRadius, P.drillMult, p.wid);
    ctx.fx.ring(b.x, b.y, P.drillRadius, C('c'));
    ctx.fx.sparks(b.x, b.y, ['c', 'd', '4'], 8);
    sfx.saw();
  },
};
