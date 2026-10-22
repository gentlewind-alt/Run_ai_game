import type { MonsterBehavior } from './types';

/**
 * Frost Giant (boss), also used by the Forge Tyrant (`params.lava = 1` switches the words and colours): armoured, stomps and
 * drops a volley on a timer, and every so often its weak point glows: hits on it do double damage. Numbers come from `params`.
 */
export const frostGiant: MonsterBehavior = {
  onSpawn(_ctx, m) {
    m.params.timer = 0;
    m.params.chestOpen = 0;
  },

  onUpdate(ctx, m) {
    const lava = m.params.lava === 1;
    const timer = Number(m.params.timer ?? 0) + 1;
    m.params.timer = timer;

    const open = timer % Number(m.params.weakEvery) < Number(m.params.weakDuration);
    const wasOpen = m.params.chestOpen === 1;
    m.params.chestOpen = open ? 1 : 0;
    if (open && !wasOpen) ctx.fx.word(m.body.position.x, m.body.position.y - 26, lava ? 'ANVIL OPEN!' : 'CHEST OPEN!');

    if (timer % Number(m.params.stompEvery) === 0) {
      const x0 = m.body.position.x;
      ctx.fx.word(x0, m.body.position.y - 20, lava ? 'LAVA SURGE!' : 'ICICLES!');
      ctx.fx.shake(0.012);
      // a volley of falling drops across a band in front of the boss (visual)
      for (let k = 0; k < 4; k++) {
        const x = x0 - 60 + k * 40 + (ctx.rng.next() - 0.5) * 12;
        const dot = ctx.fx.dot(x, -10, 2, lava ? 0xff8a3c : 0xdff8ff, lava ? 0xffcd75 : 0x41a6f6);
        let y = -10;
        ctx.addActor({
          update() {
            y += 4;
            dot.setY(y);
            if (y >= ctx.groundAt(x)) {
              ctx.fx.sparks(x, y, lava ? ['3', '4'] : ['b', 'c'], 3);
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
    ctx.fx.word(m.body.position.x, m.body.position.y - 20, m.params.lava === 1 ? 'MELTED DOWN!' : 'FROZEN FALL!');
  },
};
