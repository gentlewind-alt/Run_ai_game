import { sfx } from '../../audio/sfx';
import { C } from '../../art/palette';
import { weaponTexture } from '../../art/textures';
import type { WeaponImpl } from './types';

export const steersongArrow: WeaponImpl = {
  texture: weaponTexture('w_steersong_arrow'),
  onLaunch(_ctx, p) {
    sfx.twang();
    p.data.mode = 'unarmed';
    p.data.taps = 0;
  },
  onAbility(ctx, p) {
    const P = p.def.params;
    p.data.taps = (p.data.taps ?? 0) + 1;

    if (p.data.taps === 1) {
      // Tap 1: arms the explosion (the default)
      p.data.mode = 'armed';
      p.sprite.setTexture('wpn_w_steersong_arrow_armed');
      p.data.allowSecondTap = true;
      p.data.secondTapLabel = 'Split';
      sfx.click();
      ctx.fx.sparks(p.body.position.x, p.body.position.y, ['4', '3', 't'], 6);
    } else if (p.data.taps >= 2) {
      // Tap 2: swaps to split-tip: three arrows fan out at +-8 degrees
      p.data.mode = 'split';
      p.data.allowSecondTap = false;
      sfx.twang();
      p.sprite.setTexture('wpn_w_steersong_arrow_split');

      const v = p.body.velocity;
      const baseAng = Math.atan2(v.y, v.x);
      const sp = Math.hypot(v.x, v.y);
      const dang = (P.splitAngleDeg ?? 8) * Math.PI / 180;
      const splitMult = P.splitMult ?? 0.7;

      [-dang, dang].forEach((offset) => {
        const a = baseAng + offset;
        ctx.spawnPellet({
          x: p.body.position.x,
          y: p.body.position.y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          radius: 3,
          density: p.def.physics.density,
          mul: splitMult,
          wid: p.wid,
          color: '2',
          gravity: p.def.physics.gravity,
        });
      });
      p.body.proj.mul = splitMult;
    }
  },
  onImpact(ctx, p) {
    if (p.data.mode === 'armed') {
      const P = p.def.params;
      const r = P.blastRadius ?? 38;
      const mult = P.blastMult ?? 1.2;
      ctx.blast(p.body.position.x, p.body.position.y, r, mult, p.wid);
      ctx.fx.sparks(p.body.position.x, p.body.position.y, ['3', '4', '2', 'f'], 16);
      ctx.fx.ring(p.body.position.x, p.body.position.y, r, C('3'));
      sfx.crunch();
      ctx.endProj(p);
    }
  },
  drawFx(_ctx, p, g) {
    if (p.data.mode === 'armed') {
      const b = p.body.position;
      g.lineStyle(1, C('4'), 0.8).strokeCircle(b.x, b.y, 6);
    }
  },
};
