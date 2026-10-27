import { C } from '../../art/palette';
import type { BattleCtx } from '../../battle/BattleCtx';
import type { MonsterBehavior } from './types';

/** Visual only: an arrow flies at the launcher pad and fizzles. */
function fireArrow(ctx: BattleCtx, x: number, y: number, steps: number): void {
  if (ctx.spawnEnemyAttack({ x, y, color: C('g') })) return;
  const sprite = ctx.fx.image(x, y, 'px').setTint(C('g')).setScale(5, 1).setDepth(6);
  const sx = x;
  const sy = y;
  let t = 0;
  ctx.addActor({
    update: () => {
      t++;
      const k = t / steps;
      const px = sx + (ctx.sling.x - sx) * k;
      const py = sy + (ctx.sling.y + 6 - sy) * k - Math.sin(Math.PI * k) * 22;
      sprite.setRotation(Math.atan2(py - sprite.y, px - sprite.x));
      sprite.setPosition(px, py);
      if (t >= steps) {
        ctx.fx.sparks(px, py, ['g', 'c'], 4);
        return true;
      }
      return false;
    },
    destroy: () => sprite.destroy(),
  });
}

/** Stands on a tower and shoots arrows at the launcher while the player is lining up a shot. */
export const archer: MonsterBehavior = {
  onSpawn(ctx, m) {
    m.fireT = m.params.fireMin + Math.floor(ctx.rng.next() * m.params.fireSpread);
  },
  onUpdate(ctx, m) {
    m.fireT--;
    if (m.fireT <= 0 && ['ready', 'aiming', 'loading', 'flying', 'settling'].includes(ctx.phase)) {
      m.fireT = m.params.fireEvery;
      fireArrow(ctx, m.body.position.x, m.body.position.y - 2, m.params.arrowSteps);
    }
  },
};
