import { weaponTexture } from '../../art/textures';
import type { BattleCtx, Proj } from '../../battle/BattleCtx';
import type { WeaponImpl } from './types';

// Detonate in the air for a wide blast that falls off with distance; also goes off on the first hit.
function detonate(ctx: BattleCtx, p: Proj): void {
  const b = p.body.position;
  ctx.blast(b.x, b.y, p.def.params.radius, p.def.params.mult, p.wid);
  ctx.endProj(p);
}

export const blastTube: WeaponImpl = {
  texture: weaponTexture('w_blast_tube'),
  onAbility: detonate,
  onImpact: detonate,
};
