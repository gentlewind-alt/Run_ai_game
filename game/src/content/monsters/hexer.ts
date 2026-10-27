import { C } from '../../art/palette';
import type { MonsterBehavior } from './types';

/** Shields its neighbours (they absorb `shield` damage); hurting the hexer drops every shield it raised. */
export const hexer: MonsterBehavior = {
  onSpawn(ctx, hx) {
    for (const n of ctx.monsters()) {
      if (n.status.shieldBreak > 0) continue;
      if (n === hx) continue;
      if (Math.hypot(n.body.position.x - hx.body.position.x, n.body.position.y - hx.body.position.y) > hx.params.radius) continue;
      n.shield = hx.params.shield;
      n.shieldedBy = hx;
      n.shieldSprite = ctx.fx.image(n.body.position.x, n.body.position.y, 'ring').setTint(C('b')).setAlpha(0.7).setDepth(4).setScale((n.size / 64) * 1.5);
    }
  },
  onDamaged(ctx, hx) {
    for (const e of ctx.monsters()) {
      if (e.shieldedBy === hx) {
        e.shield = 0;
        e.shieldSprite?.destroy();
        e.shieldSprite = undefined;
      }
    }
  },
};
