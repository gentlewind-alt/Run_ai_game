import { C } from '../../art/palette';
import type { MonsterBehavior } from './types';

/** Dark Elf Matron: Mini-boss with a periodic shield aura that blocks damage for 2 s every 6 s. */
export const darkElfMatron: MonsterBehavior = {
  onSpawn(_ctx, m) {
    m.params.shieldTimer = 0;
    m.params.shieldActive = 0;
  },

  onUpdate(ctx, m) {
    const shieldEvery = Number(m.params.shieldEvery ?? 360);
    const shieldDuration = Number(m.params.shieldDuration ?? 120);
    const radius = Number(m.params.shieldRadius ?? 48);
    const timer = (Number(m.params.shieldTimer ?? 0) + 1) % shieldEvery;
    m.params.shieldTimer = timer;

    const isActive = timer < shieldDuration;
    const wasActive = m.params.shieldActive === 1;

    if (isActive && !wasActive) {
      m.params.shieldActive = 1;
      ctx.fx.word(m.body.position.x, m.body.position.y - 20, 'SHIELD AURA!');
      // Apply shield to self and nearby monsters
      for (const n of ctx.monsters()) {
        if (n.status.shieldBreak > 0) continue;
        const d = Math.hypot(n.body.position.x - m.body.position.x, n.body.position.y - m.body.position.y);
        if (d <= radius || n === m) {
          n.shield = 99999;
          n.shieldedBy = m;
          if (!n.shieldSprite) {
            n.shieldSprite = ctx.fx.image(n.body.position.x, n.body.position.y, 'ring')
              .setTint(C('b')).setAlpha(0.7).setDepth(4).setScale((n.size / 64) * 1.5);
          }
        }
      }
    } else if (!isActive && wasActive) {
      m.params.shieldActive = 0;
      // Drop shields
      for (const n of ctx.monsters()) {
        if (n.shieldedBy === m) {
          n.shield = 0;
          n.shieldSprite?.destroy();
          n.shieldSprite = undefined;
          n.shieldedBy = undefined;
        }
      }
    }
  },

  onDamaged(_ctx, m, amount) {
    if (m.params.shieldActive === 1 && m.status.shieldBreak <= 0) {
      return 0;
    }
    return amount;
  },

  onDeath(ctx, m) {
    ctx.fx.shake(0.015);
    ctx.fx.word(m.body.position.x, m.body.position.y - 20, 'DEFEATED!');
    for (const n of ctx.monsters()) {
      if (n.shieldedBy === m) {
        n.shield = 0;
        n.shieldSprite?.destroy();
        n.shieldSprite = undefined;
        n.shieldedBy = undefined;
      }
    }
  },
};
