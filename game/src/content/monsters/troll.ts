import type { MonsterBehavior } from './types';

/** Regenerates HP unless burning. */
export const troll: MonsterBehavior = {
  onUpdate(_ctx, m) {
    if (m.hp < m.maxHp && m.status.burn <= 0) m.hp = Math.min(m.maxHp, m.hp + m.params.regenPerSec / 60);
  },
};
