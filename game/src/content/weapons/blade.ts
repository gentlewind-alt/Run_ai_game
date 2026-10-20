import { sfx } from '../../audio/sfx';
import { C } from '../../art/palette';
import { weaponTexture } from '../../art/textures';
import type { WeaponImpl } from './types';

export const blade: WeaponImpl = {
  texture: weaponTexture('w_militia_blade'),
  // Spin-saw: floats and hits everything it touches for 0.6 s.
  onAbility(ctx, p) {
    p.t = p.def.params.sawSteps;
    ctx.setGravity(p.body, 0);
    ctx.M.Body.setAngularVelocity(p.body, p.def.params.sawSpin);
    sfx.saw();
  },
  onUpdate(ctx, p) {
    if (p.t <= 0) return;
    const P = p.def.params;
    p.t--;
    const b = p.body;
    const sp = Math.hypot(b.velocity.x, b.velocity.y);
    if (sp < P.sawSpeed && sp > 0.01) ctx.M.Body.setVelocity(b, { x: (b.velocity.x / sp) * P.sawSpeed, y: (b.velocity.y / sp) * P.sawSpeed });
    if (p.t % P.tickSteps === 0) ctx.damageAround(b.position.x, b.position.y, P.tickRadius, P.tickMult, p.wid);
    if (p.t === 0) ctx.setGravity(b, p.def.physics.gravity ?? 1);
  },
  drawFx(_ctx, p, g) {
    if (p.t <= 0) return;
    const b = p.body.position;
    g.lineStyle(1, C('c'), 1).strokeCircle(b.x, b.y, 10);
    g.lineStyle(1, C('4'), 1).strokeCircle(b.x, b.y, 7);
  },
};
