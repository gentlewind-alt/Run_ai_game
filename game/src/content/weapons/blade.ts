import { sfx } from '../../audio/sfx';
import { C } from '../../art/palette';
import { weaponTexture } from '../../art/textures';
import type { WeaponImpl } from './types';

export const blade: WeaponImpl = {
  texture: weaponTexture('w_militia_blade'),
  // Whirlwind roll: the blade keeps its gravity, drops to the ground and rolls along it as a buzzsaw, carving through
  // wood and monsters in its path for 1.4 s.
  onAbility(ctx, p) {
    p.t = p.def.params.sawSteps;
    p.data.rollDir = p.body.velocity.x >= 0 ? 1 : -1;
    ctx.M.Body.setAngularVelocity(p.body, p.def.params.sawSpin);
    sfx.saw();
  },
  onUpdate(ctx, p) {
    if (p.t <= 0) return;
    const P = p.def.params;
    p.t--;
    const b = p.body;
    ctx.M.Body.setVelocity(b, { x: p.data.rollDir * P.sawSpeed, y: b.velocity.y });
    if (p.t % P.tickSteps === 0) ctx.damageAround(b.position.x, b.position.y, P.tickRadius, P.tickMult, p.wid);
    if (p.t % 3 === 0) ctx.fx.sparks(b.position.x, b.position.y + 4, ['4', '3'], 1);
  },
  drawFx(_ctx, p, g) {
    if (p.t <= 0) return;
    const b = p.body.position;
    g.lineStyle(1, C('c'), 1).strokeCircle(b.x, b.y, 10);
    g.lineStyle(1, C('4'), 1).strokeCircle(b.x, b.y, 7);
  },
};
