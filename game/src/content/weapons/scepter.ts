import { sfx } from '../../audio/sfx';
import { C } from '../../art/palette';
import { weaponTexture } from '../../art/textures';
import type { WeaponImpl } from './types';

export const scepter: WeaponImpl = {
  texture: weaponTexture('w_horned_scepter'),
  // Curse burst: monsters in a small radius take extra damage from everything for a while.
  onAbility(ctx, p) {
    const b = p.body.position;
    ctx.fx.ring(b.x, b.y, p.def.params.radius, C('r'));
    ctx.fx.sparks(b.x, b.y, ['r', '1', 'u'], 14);
    for (const e of ctx.within(b.x, b.y, p.def.params.radius)) ctx.addStatus(e, 'curse', p.def.params.curseSteps);
    sfx.saw();
  },
  onUpdate(ctx, p) {
    if (p.steps % 3 === 0) ctx.fx.sparks(p.body.position.x, p.body.position.y, ['3', '4', '2'], 1);
  },
};
