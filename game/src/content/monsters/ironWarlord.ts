import type { MonsterBehavior } from './types';

export const ironWarlord: MonsterBehavior = {
  onSpawn(_ctx, m) {
    m.params.timer = 0;
    m.params.visorOpen = 0;
    m.params.boulderTimer = 0;
  },

  onUpdate(ctx, m) {
    const openEvery = Number(m.params.visorOpenEvery ?? 180);
    const openDur = Number(m.params.visorOpenDuration ?? 60);
    const boulderEvery = Number(m.params.boulderEvery ?? 240);

    const timer = Number(m.params.timer ?? 0) + 1;
    m.params.timer = timer;

    const cycle = timer % openEvery;
    const isOpen = cycle >= (openEvery - openDur);
    const wasOpen = m.params.visorOpen === 1;
    m.params.visorOpen = isOpen ? 1 : 0;

    if (isOpen && !wasOpen) {
      ctx.fx.word(m.body.position.x, m.body.position.y - 20, 'VISOR OPEN!');
    }

    const bTimer = Number(m.params.boulderTimer ?? 0) + 1;
    if (bTimer >= boulderEvery) {
      m.params.boulderTimer = 0;
      ctx.fx.word(m.body.position.x, m.body.position.y - 18, 'BOULDER!');
      ctx.fx.shake(0.012);
    } else {
      m.params.boulderTimer = bTimer;
    }
  },

  onDamaged(ctx, m, amount) {
    if (m.params.visorOpen === 1) {
      const mult = Number(m.params.visorMult ?? 2);
      ctx.fx.word(m.body.position.x, m.body.position.y - 24, 'WEAK POINT! 2x');
      return amount * mult;
    }
    return amount;
  },

  onDeath(ctx, m) {
    ctx.fx.shake(0.02);
    ctx.fx.word(m.body.position.x, m.body.position.y - 20, 'FALLEN!');
  },
};
