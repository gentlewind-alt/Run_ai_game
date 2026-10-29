import type { BattleCtx } from '../../battle/BattleCtx';
import { enemyWandPose, initEnemyWand } from './wand';
import { data } from '../../data/load';
import type { MonsterBehavior } from './types';

/** The visual fallback follows the same wand direction as a physical shot. */
function fireArrow(ctx: BattleCtx, x: number, y: number, steps: number, aim: { x: number; y: number }, color: number, shooter: any): void {
  if (ctx.spawnEnemyAttack({ x, y, color, aim, shooter })) return;
  const sprite = ctx.fx.image(x, y, 'px').setTint(color).setScale(5, 1).setDepth(6).setRotation(Math.atan2(aim.y, aim.x));
  const speed = data.forge.enemyAttack.speed;
  let t = 0;
  ctx.addActor({
    update: () => {
      t++;
      const px = x + aim.x * speed * t;
      const py = y + aim.y * speed * t;
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
    initEnemyWand(ctx, m);
  },
  onUpdate(ctx, m) {
    m.fireT--;
    if (m.fireT <= 0 && ['ready', 'aiming', 'loading', 'flying', 'settling'].includes(ctx.phase)) {
      m.fireT = m.params.fireEvery;
      const { tip, aim } = enemyWandPose(m);
      fireArrow(ctx, tip.x, tip.y, m.params.arrowSteps, aim, parseInt(m.def!.wand!.tipColor.slice(1), 16), m.body);
    }
  },
};
