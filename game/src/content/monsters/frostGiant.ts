import type { MonsterBehavior } from './types';

/**
 * Frost Giant (boss): armoured, stomps and drops icicles on a timer, and every so often the crystal in its chest glows:
 * hits on the open chest do double damage. All numbers come from the data row (`params`).
 */
export const frostGiant: MonsterBehavior = {
  onSpawn(_ctx, m) {
    m.params.timer = 0;
    m.params.chestOpen = 0;
  },

  onUpdate(ctx, m) {
    const timer = Number(m.params.timer ?? 0) + 1;
    m.params.timer = timer;

    const open = timer % Number(m.params.weakEvery) < Number(m.params.weakDuration);
    const wasOpen = m.params.chestOpen === 1;
    m.params.chestOpen = open ? 1 : 0;
    if (open && !wasOpen) ctx.fx.word(m.body.position.x, m.body.position.y - 26, 'CHEST OPEN!');

    if (timer % Number(m.params.stompEvery) === 0) {
      const x0 = m.body.position.x;
      ctx.fx.word(x0, m.body.position.y - 20, 'ICICLES!');
      ctx.fx.shake(0.012);
      // a volley of falling icicles across a band in front of the giant (visual)
      for (let k = 0; k < 4; k++) {
        const x = x0 - 60 + k * 40 + (ctx.rng.next() - 0.5) * 12;
        const dot = ctx.fx.dot(x, -10, 2, 0xdff8ff, 0x41a6f6);
        let y = -10;
        ctx.addActor({
          update() {
            y += 4;
            dot.setY(y);
            if (y >= ctx.groundAt(x)) {
              ctx.fx.sparks(x, y, ['b', 'c'], 3);
              dot.destroy();
              return true;
            }
            return false;
          },
          destroy() {
            dot.destroy();
          },
        });
      }
    }
  },

  onDamaged(ctx, m, amount) {
    if (m.params.chestOpen === 1) {
      ctx.fx.word(m.body.position.x, m.body.position.y - 26, 'WEAK POINT! 2x');
      return amount * Number(m.params.weakMult);
    }
    return Math.max(1, amount - Number(m.params.armour ?? 0));
  },

  onDeath(ctx, m) {
    ctx.fx.shake(0.02);
    ctx.fx.word(m.body.position.x, m.body.position.y - 20, 'FROZEN FALL!');
  },
};
