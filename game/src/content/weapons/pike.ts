import { sfx } from '../../audio/sfx';
import { weaponTexture } from '../../art/textures';
import type { WeaponImpl } from './types';

export const pike: WeaponImpl = {
  texture: weaponTexture('w_hunters_pike'),
  // Speeds up and pierces up to `pierce` wood blocks or monsters.
  onAbility(ctx, p) {
    const v = p.body.velocity;
    ctx.M.Body.setVelocity(p.body, { x: v.x * p.def.params.boost, y: v.y * p.def.params.boost });
    p.body.isSensor = true;
    p.body.proj.pierce = p.def.params.pierce;
    p.body.proj.hit = new Set<number>();
    sfx.saw();
    ctx.fx.sparks(p.body.position.x, p.body.position.y, ['c', 'd'], 8);
  },
};
