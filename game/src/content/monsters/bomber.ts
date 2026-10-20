import type { MonsterBehavior } from './types';

/** Explodes on death, hurting neighbours and blocks. */
export const bomber: MonsterBehavior = {
  onDeath(ctx, m) {
    const b = m.body.position;
    ctx.explode(b.x, b.y, m.params.blastRadius, m.params.blastDamage, m, null);
  },
};
