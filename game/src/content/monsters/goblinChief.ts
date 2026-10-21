import type { MonsterBehavior } from './types';

/** Goblin Chief: Mini-boss with armor 8 who stomps every 4 seconds causing a ground shake. */
export const goblinChief: MonsterBehavior = {
  onSpawn(_ctx, m) {
    m.params.stompTimer = 0;
  },

  onUpdate(ctx, m) {
    const stompEvery = Number(m.params.stompEvery ?? 240); // 4 seconds at 60 Hz
    const timer = Number(m.params.stompTimer ?? 0) + 1;

    if (timer >= stompEvery) {
      m.params.stompTimer = 0;
      ctx.fx.word(m.body.position.x, m.body.position.y - 18, 'STOMP!');
      ctx.fx.shake(0.008);
    } else {
      m.params.stompTimer = timer;
    }
  },

  onDamaged(_ctx, m, amount) {
    const armour = Number(m.params.armour ?? m.params.armor ?? 8);
    return Math.max(1, amount - armour);
  },

  onDeath(ctx, m) {
    ctx.fx.shake(0.015);
    ctx.fx.word(m.body.position.x, m.body.position.y - 20, 'DEFEATED!');
  },
};
