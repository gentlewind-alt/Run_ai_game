import { data } from '../data/load';
import { MatterLib } from './matter';
import { setGravity } from './projectiles';
import type { EnemyAttackOpts } from './BattleCtx';
import type { BattleState } from './state';

/** Enemy shots have real mass, hit structures and weapons, and pass through other monsters. */
export function spawnEnemyAttack(b: BattleState, o: EnemyAttackOpts): boolean {
  if (!b.settings.features.enemyAttackPhysics || !['flying', 'settling'].includes(b.state)) return false;
  const R = data.forge.enemyAttack;
  const at = b.proj?.body.position ?? { x: b.slingX, y: b.slingY };
  const dx = at.x - o.x;
  const dy = at.y - o.y;
  const d = Math.max(1, Math.hypot(dx, dy));
  const body: any = b.scene.matter.add.circle(o.x, o.y, R.radius, {
    density: o.boss ? R.bossDensity : R.density, friction: R.friction, restitution: R.restitution,
    label: 'enemyAttack', collisionFilter: { category: 0x4, mask: 0x1 },
  });
  setGravity(body, o.boss ? R.bossGravity : R.gravity);
  MatterLib.Body.setVelocity(body, o.boss ? { x: 0, y: R.bossSpeed } : { x: dx / d * R.speed, y: dy / d * R.speed });
  const sprite = b.scene.add.image(o.x, o.y, 'px').setTint(o.color).setDisplaySize(o.boss ? R.radius * 2 : R.radius * 4, R.radius * 2).setDepth(6);
  let steps = 0;
  b.actors.push({ body,
    update() {
      steps++;
      sprite.setPosition(body.position.x, body.position.y).setRotation(Math.atan2(body.velocity.y, body.velocity.x));
      return body.enemySpent || steps >= R.lifetimeSteps || body.position.y > b.groundY + 40 || body.position.x < -40 || body.position.x > b.worldW + 40;
    },
    destroy() { if (!b.closing) b.scene.matter.world.remove(body); sprite.destroy(); },
  });
  return true;
}
