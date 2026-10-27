import { sfx } from '../../audio/sfx';
import { weaponTexture } from '../../art/textures';
import type { WeaponImpl } from './types';

/** On sand (Ember Forge): bursts on its first hit and heaps a mound of sand there. On fixed ground it just hits like a sack. */
export const sandbag: WeaponImpl = {
  texture: weaponTexture('w_sandbag'),
  onImpact(ctx, p, hit) {
    if (p.data.piled) return;
    p.data.piled = true;
    const P = p.def.params;
    const x = hit?.x ?? p.body.position.x;
    const y = hit?.y ?? p.body.position.y;
    if (!ctx.pileSand(x, P.half, P.height)) return;
    ctx.fx.sparks(x, y, ['i', 'p', 't'], 8);
    sfx.crunch();
    ctx.endProj(p);
  },
};
