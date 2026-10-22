import { sfx } from '../../audio/sfx';
import { C } from '../../art/palette';
import { weaponTexture } from '../../art/textures';
import type { BattleCtx, Proj } from '../../battle/BattleCtx';
import type { WeaponImpl } from './types';

// Nuke lob: detonate in the air (or on the first hit) for a huge blast that falls off with distance, with a white flash,
// a fireball, three shock rings and a heavy shake.
function detonate(ctx: BattleCtx, p: Proj): void {
  const b = p.body.position;
  const r: number = p.def.params.radius;
  ctx.flash?.(0xffffff, 120);
  ctx.hitStop?.(4);
  ctx.blast(b.x, b.y, r, p.def.params.mult, p.wid);
  ctx.fx.flameBlast?.(b.x, b.y, r, 40);
  ctx.fx.ring(b.x, b.y, r * 0.55, C('c'));
  ctx.fx.ring(b.x, b.y, r * 0.8, C('4'));
  ctx.fx.ring(b.x, b.y, r, C('3'));
  ctx.fx.sparks(b.x, b.y, ['4', '3', 'c'], 14);
  ctx.fx.shake(0.03);
  sfx.quake();
  ctx.endProj(p);
}

export const blastTube: WeaponImpl = {
  texture: weaponTexture('w_blast_tube'),
  onAbility: detonate,
  onImpact: detonate,
};
