import { sfx } from '../../audio/sfx';
import { C } from '../../art/palette';
import { weaponTexture } from '../../art/textures';
import type { Ent } from '../../battle/BattleCtx';
import type { WeaponImpl } from './types';

/**
 * Chain Rod (rare): the tap releases lightning that jumps from the rod to the nearest monster, then on to the nearest one
 * from there, up to `jumps` monsters, losing a little strength with every jump. Numbers are in the data row.
 */
export const chainRod: WeaponImpl = {
  texture: weaponTexture('w_chain_rod'),
  onAbility(ctx, p) {
    const P = p.def.params;
    let x = p.body.position.x;
    let y = p.body.position.y;
    const hit = new Set<Ent>();
    let mult = P.jumpMult;
    sfx.thunder();
    ctx.flash?.(0x8af0f8, 50);
    for (let j = 0; j < P.jumps; j++) {
      const next = ctx.nearestMonsters(x, y, P.jumps + 1).find((m) => !hit.has(m) && Math.hypot(m.body.position.x - x, m.body.position.y - y) <= P.jumpRange);
      if (!next) break;
      hit.add(next);
      const nx = next.body.position.x;
      const ny = next.body.position.y;
      // the arc: sparks strung along the segment, a ring where it lands
      for (let s = 1; s <= 8; s++) {
        const t = s / 8;
        ctx.fx.sparks(x + (nx - x) * t + (ctx.rng.next() - 0.5) * 6, y + (ny - y) * t + (ctx.rng.next() - 0.5) * 6, ['b', 'c'], 1);
      }
      ctx.fx.ring(nx, ny, 12, C('b'));
      ctx.directHit(next, p.wid, mult, nx, ny, true);
      ctx.addStatus(next, 'chain', 40);
      mult *= P.jumpFalloff;
      x = nx;
      y = ny;
    }
    ctx.fx.shake(0.012);
    ctx.endProj(p);
  },
};
