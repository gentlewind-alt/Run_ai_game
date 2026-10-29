import type { MonsterBehavior } from './types';
import { data } from '../../data/load';
import { enemyWandPose, initEnemyWand } from './wand';

interface Theme { open: string; stomp: string; death: string; dropStroke: number; sparks: string[] }

// Words and colours per theme; chosen by the monster's params: `lava = 1` (Forge Tyrant), `storm = 1` (Storm Sovereign), else ice.
const ICE: Theme = { open: 'CHEST OPEN!', stomp: 'ICICLES!', death: 'FROZEN FALL!', dropStroke: 0x41a6f6, sparks: ['b', 'c'] };
const LAVA: Theme = { open: 'ANVIL OPEN!', stomp: 'LAVA SURGE!', death: 'MELTED DOWN!', dropStroke: 0xffcd75, sparks: ['3', '4'] };
const STORM: Theme = { open: 'EYE OPEN!', stomp: 'LIGHTNING!', death: 'STORM FALLS!', dropStroke: 0x41a6f6, sparks: ['4', 'b'] };
const themeOf = (params: Record<string, number>): Theme => (params.lava === 1 ? LAVA : params.storm === 1 ? STORM : ICE);

/**
 * Frost Giant (boss), also the Forge Tyrant and the Storm Sovereign through a theme flag: armoured, stomps and fires a
 * volley on a timer, and every so often its weak point glows: hits on it do double damage. Numbers come from `params`.
 */
export const frostGiant: MonsterBehavior = {
  onSpawn(ctx, m) {
    m.params.timer = 0;
    m.params.chestOpen = 0;
    initEnemyWand(ctx, m);
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
      const R = data.forge.enemyAttack;
      const { tip, aim } = enemyWandPose(m);
      const color = parseInt(m.def!.wand!.tipColor.slice(1), 16);
      for (let k = 0; k < R.volleyCount; k++) {
        if (ctx.spawnEnemyAttack({ x: tip.x, y: tip.y, color, boss: true, aim, shooter: m.body })) continue;
        const dot = ctx.fx.dot(tip.x, tip.y, R.radius, color, theme.dropStroke);
        let x = tip.x;
        let y = tip.y;
        let steps = 0;
        ctx.addActor({
          update() {
            steps++;
            x += aim.x * R.bossSpeed;
            y += aim.y * R.bossSpeed;
            dot.setPosition(x, y);
            if (steps >= R.lifetimeSteps || x < 0 || x > ctx.worldW || y < 0) return true;
            if (y >= ctx.groundAt(x)) {
              ctx.fx.sparks(x, y, theme.sparks, 3);
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
