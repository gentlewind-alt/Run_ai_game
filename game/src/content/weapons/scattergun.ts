import { sfx } from '../../audio/sfx';
import { C } from '../../art/palette';
import { weaponTexture } from '../../art/textures';
import type { BattleCtx, Proj } from '../../battle/BattleCtx';
import type { WeaponImpl } from './types';
import { aimFrom } from './util';

const KINDS = ['burn', 'slow', 'knock'];

// Cluster: fires its pellets in a cone at the nearest monster (on the tap, or when it crashes into anything);
// each pellet rolls burn, slow or knockback and pops in a small blast where it lands.
function fire(ctx: BattleCtx, p: Proj): void {
    if (p.data.fired) return;
    p.data.fired = true;
    const P = p.def.params;
    const b = p.body;
    const v = b.velocity;
    const sp = Math.max(P.minSpeed, Math.hypot(v.x, v.y));
    const aim = aimFrom(ctx, b.position.x, b.position.y, v.x, v.y);
    const base = Math.atan2(aim.dy, aim.dx);
    for (let i = 0; i < P.pellets; i++) {
      const a = base + (i - (P.pellets - 1) / 2) * P.coneStep;
      ctx.spawnPellet({
        x: b.position.x, y: b.position.y, vx: Math.cos(a) * sp * P.pelletSpeedMult, vy: Math.sin(a) * sp * P.pelletSpeedMult,
        radius: P.pelletRadius, density: P.pelletDensity, mul: P.pelletMult, wid: p.wid, color: 'c', status: KINDS[ctx.rng.int(0, KINDS.length - 1)],
        onEnd: (x, y) => {
          ctx.blast(x, y, P.popRadius, P.popMult, p.wid);
          ctx.fx.sparks(x, y, ['4', '3'], 3);
        },
      });
    }
    ctx.fx.ring(b.position.x, b.position.y, 14, C('4'));
    ctx.fx.sparks(b.position.x, b.position.y, ['4', '3', 'c'], 10);
    sfx.crunch();
    ctx.endProj(p);
}

export const scattergun: WeaponImpl = {
  texture: weaponTexture('w_scrapheap_scattergun'),
  onAbility: fire,
  onImpact: fire,
};
