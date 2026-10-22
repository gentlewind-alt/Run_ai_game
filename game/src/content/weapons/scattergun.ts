import { sfx } from '../../audio/sfx';
import { C } from '../../art/palette';
import { weaponTexture } from '../../art/textures';
import type { WeaponImpl } from './types';

const KINDS = ['burn', 'slow', 'knock'];

export const scattergun: WeaponImpl = {
  texture: weaponTexture('w_scrapheap_scattergun'),
  // Cluster: bursts into pellets in a cone; each pellet rolls burn, slow or knockback and pops in a small blast where it lands.
  onAbility(ctx, p) {
    const P = p.def.params;
    const b = p.body;
    const v = b.velocity;
    const sp = Math.max(P.minSpeed, Math.hypot(v.x, v.y));
    const base = Math.atan2(v.y, v.x);
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
  },
};
