import { data } from '../data/load';
import { MatterLib } from './matter';
import { setGravity } from './projectiles';
import type { EnemyAttackOpts } from './BattleCtx';
import type { BattleState } from './state';

/** Enemy shots have real mass and fly a fixed line. They hit structures, weapons and any enemy in the way (except their own shooter). */
export function spawnEnemyAttack(b: BattleState, o: EnemyAttackOpts): boolean {
  if (!b.settings.features.enemyAttackPhysics || !['flying', 'settling'].includes(b.state)) return false;
  const R = data.forge.enemyAttack;
  // The wand supplies its current grip direction; callers without one aim toward the sling's place.
  const dx = o.aim ? o.aim.x : b.slingX - o.x;
  const dy = o.aim ? o.aim.y : b.slingY - o.y;
  const d = Math.hypot(dx, dy) || 1;
  if (o.shooter) o.shooter.collisionFilter.group = -o.shooter.id;
  const body: any = b.scene.matter.add.circle(o.x, o.y, R.radius, {
    density: o.boss ? R.bossDensity : R.density, friction: R.friction, restitution: R.restitution,
    label: 'enemyAttack', collisionFilter: { category: 0x4, mask: 0x3, group: o.shooter ? -o.shooter.id : 0 },
  });
  setGravity(body, o.boss ? R.bossGravity : R.gravity);
  const speed = o.boss ? R.bossSpeed : R.speed;
  MatterLib.Body.setVelocity(body, { x: dx / d * speed, y: dy / d * speed });
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
