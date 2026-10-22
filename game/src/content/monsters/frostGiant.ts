import type { MonsterBehavior } from './types';

interface Theme { open: string; stomp: string; death: string; drop: number; dropStroke: number; sparks: string[] }

// Words and colours per theme; chosen by the monster's params: `lava = 1` (Forge Tyrant), `storm = 1` (Storm Sovereign), else ice.
const ICE: Theme = { open: 'CHEST OPEN!', stomp: 'ICICLES!', death: 'FROZEN FALL!', drop: 0xdff8ff, dropStroke: 0x41a6f6, sparks: ['b', 'c'] };
const LAVA: Theme = { open: 'ANVIL OPEN!', stomp: 'LAVA SURGE!', death: 'MELTED DOWN!', drop: 0xff8a3c, dropStroke: 0xffcd75, sparks: ['3', '4'] };
const STORM: Theme = { open: 'EYE OPEN!', stomp: 'LIGHTNING!', death: 'STORM FALLS!', drop: 0xffffaa, dropStroke: 0x41a6f6, sparks: ['4', 'b'] };
const themeOf = (params: Record<string, number>): Theme => (params.lava === 1 ? LAVA : params.storm === 1 ? STORM : ICE);

/**
 * Frost Giant (boss), also the Forge Tyrant and the Storm Sovereign through a theme flag: armoured, stomps and drops a
 * volley on a timer, and every so often its weak point glows: hits on it do double damage. Numbers come from `params`.
 */
export const frostGiant: MonsterBehavior = {
  onSpawn(_ctx, m) {
    m.params.timer = 0;
    m.params.chestOpen = 0;
  },

  onUpdate(ctx, m) {
    const theme = themeOf(m.params);
    const timer = Number(m.params.timer ?? 0) + 1;
    m.params.timer = timer;

    const open = timer % Number(m.params.weakEvery) < Number(m.params.weakDuration);
    const wasOpen = m.params.chestOpen === 1;
    m.params.chestOpen = open ? 1 : 0;
    if (open && !wasOpen) ctx.fx.word(m.body.position.x, m.body.position.y - 26, theme.open);

    if (timer % Number(m.params.stompEvery) === 0) {
      const x0 = m.body.position.x;
      ctx.fx.word(x0, m.body.position.y - 20, theme.stomp);
      ctx.fx.shake(0.012);
      // a volley of falling drops across a band in front of the boss (visual)
      for (let k = 0; k < 4; k++) {
        const x = x0 - 60 + k * 40 + (ctx.rng.next() - 0.5) * 12;
        const dot = ctx.fx.dot(x, -10, 2, theme.drop, theme.dropStroke);
        let y = -10;
        ctx.addActor({
          update() {
            y += 4;
            dot.setY(y);
            if (y >= ctx.groundAt(x)) {
              ctx.fx.sparks(x, y, theme.sparks, 3);
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
    ctx.fx.word(m.body.position.x, m.body.position.y - 20, themeOf(m.params).death);
  },
};
