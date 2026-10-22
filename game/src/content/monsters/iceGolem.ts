import type { MonsterBehavior } from './types';

/** Ice Golem: when it is destroyed it shatters, and the ice shards hurt everything close by. */
export const iceGolem: MonsterBehavior = {
  onDeath(ctx, m) {
    const x = m.body.position.x;
    const y = m.body.position.y;
    ctx.explode(x, y, Number(m.params.shatterRadius), Number(m.params.shatterDamage), m, null);
    ctx.fx.ring(x, y, Number(m.params.shatterRadius), 0x8af0f8);
    ctx.fx.sparks(x, y, ['b', 'c', 'a'], 10);
    ctx.fx.shake(0.012);
    ctx.fx.word(x, y - 20, 'SHATTERED!');
  },
};
