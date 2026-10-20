import { sfx } from '../../audio/sfx';
import { C } from '../../art/palette';
import { weaponTexture } from '../../art/textures';
import type { Actor, BattleCtx, Ent, Proj } from '../../battle/BattleCtx';
import type { WeaponImpl } from './types';

let boltsFired = 0; // "every 5th bolt you ever fire splits in two"

export const staff: WeaponImpl = {
  texture: weaponTexture('w_ashwood_staff'),
  // Homing bolt at the nearest monster; every 5th bolt you ever fire splits in two.
  onAbility(ctx, p) {
    boltsFired++;
    const targets = ctx.nearestMonsters(p.body.position.x, p.body.position.y, boltsFired % p.def.params.splitEvery === 0 ? 2 : 1);
    if (targets.length === 0) return;
    for (const t of targets) ctx.addActor(makeBolt(ctx, p, t));
    sfx.launch();
  },
};

function makeBolt(ctx: BattleCtx, p: Proj, target: Ent): Actor {
  const P = p.def.params;
  const start = p.body.position;
  const sprite = ctx.fx.dot(start.x, start.y, 2, C('b'), C('c'));
  let x = start.x;
  let y = start.y;
  let vx = 0;
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
        ctx.directHit(tgt, p.wid, P.boltMult, x, y);
        ctx.fx.ring(x, y, 12, C('b'));
        return true;
      }
      vx += ((tx - x) / d * P.boltSpeed - vx) * P.boltTurn;
      vy += ((ty - y) / d * P.boltSpeed - vy) * P.boltTurn;
      x += vx;
      y += vy;
      sprite.setPosition(x, y);
      if (steps % 2 === 0) ctx.fx.sparks(x, y, ['b', 'c'], 1);
      return false;
    },
    destroy() {
      sprite.destroy();
    },
  };
}
