import { sfx } from '../../audio/sfx';
import { C } from '../../art/palette';
import { weaponTexture } from '../../art/textures';
import type { Actor, BattleCtx, Ent, Proj } from '../../battle/BattleCtx';
import type { WeaponImpl } from './types';

export const staff: WeaponImpl = {
  texture: weaponTexture('w_ashwood_staff'),
  // Ember volley: several homing bolts at the nearest monsters, and each bolt splits in two when it hits.
  onAbility(ctx, p) {
    const P = p.def.params;
    const targets = ctx.nearestMonsters(p.body.position.x, p.body.position.y, P.volley);
    if (targets.length === 0) return;
    targets.forEach((t, i) => ctx.addActor(makeBolt(ctx, p, t, 0, p.body.position.x, p.body.position.y, i)));
    sfx.launch();
  },
};

/** generation 0 is a volley bolt (splits on hit); generation 1 is an ember from a split (does not split again). */
function makeBolt(ctx: BattleCtx, p: Proj, target: Ent, generation: number, sx: number, sy: number, index: number): Actor {
  const P = p.def.params;
  const sprite = ctx.fx.dot(sx, sy, generation === 0 ? 2 : 1.5, C('3'), C('4'));
  let x = sx;
  let y = sy;
  let vx = (index - 1) * 1.2; // volley bolts fan out before they home in
  let vy = P.boltLaunchVy;
  let steps = 0;
  return {
    update() {
      steps++;
      let tgt = target;
      if (tgt.dead) tgt = ctx.nearestMonsters(x, y, 1)[0];
      if (!tgt || steps > P.boltSteps) return true;
      const tx = tgt.body.position.x;
      const ty = tgt.body.position.y;
      const d = Math.hypot(tx - x, ty - y);
      if (d < P.boltHitRadius) {
        ctx.directHit(tgt, p.wid, generation === 0 ? P.boltMult : P.boltMult * P.splitMult, x, y);
        ctx.fx.ring(x, y, generation === 0 ? 12 : 8, C('3'));
        ctx.fx.sparks(x, y, ['3', '4'], 4);
        if (generation === 0) {
          const others = ctx.nearestMonsters(x, y, P.splitCount + 1).filter((m) => m !== tgt).slice(0, P.splitCount);
          others.forEach((m, k) => ctx.addActor(makeBolt(ctx, p, m, 1, x, y, k * 2)));
        }
        return true;
      }
      vx += ((tx - x) / d * P.boltSpeed - vx) * P.boltTurn;
      vy += ((ty - y) / d * P.boltSpeed - vy) * P.boltTurn;
      x += vx;
      y += vy;
      sprite.setPosition(x, y);
      if (steps % 2 === 0) ctx.fx.sparks(x, y, ['3', '4'], 1);
      return false;
    },
    destroy() {
      sprite.destroy();
    },
  };
}
