// Projectile bodies: the shot in the air, lightweight pellets, and per-body gravity.
import { C } from '../art/palette';
import { H } from '../config/constants';
import { MatterLib } from './matter';
import type { PelletOpts, Proj } from './BattleCtx';
import type { BattleState } from './state';

export function setGravity(body: any, f: number): void {
  body.gScale = f;
  body.ignoreGravity = f === 0;
}

/** Matter ignores per-body gravity scale here, so add the difference as a force before each step. */
export function applyCustomGravity(b: BattleState): void {
  const bodies: any[] = [];
  if (b.proj) bodies.push(b.proj.body);
  for (const a of b.actors) if ((a as any).body) bodies.push((a as any).body);
  for (const body of bodies) {
    if (body.ignoreGravity || body.gScale === undefined || body.gScale === 1) continue;
    MatterLib.Body.applyForce(body, body.position, { x: 0, y: body.mass * (body.gScale - 1) * 0.001 });
  }
}

export function endProj(b: BattleState, p: Proj): void {
  if (b.proj !== p) return;
  b.scene.matter.world.remove(p.body);
  p.sprite.destroy();
  b.proj = null;
  b.events.emit('shot:ended', { weaponId: p.wid });
}

/** Lightweight physics projectile (pellets). Lives until it stops, leaves the world, or times out. */
export function spawnPellet(b: BattleState, o: PelletOpts): void {
  const body: any = b.scene.matter.add.circle(o.x, o.y, o.radius, {
    density: o.density, friction: 0.2, frictionAir: 0, restitution: 0.3, label: 'proj',
  });
  body.proj = { wid: o.wid, mul: o.mul, owner: 'extra', status: o.status };
  MatterLib.Body.setVelocity(body, { x: o.vx, y: o.vy });
  const sprite = b.scene.add.image(o.x, o.y, 'px').setTint(C(o.color)).setScale(o.radius * 1.5).setDepth(5);
  let steps = 0;
  let slow = 0;
  b.actors.push({
    pos: () => body.position,
    update: () => {
      steps++;
      sprite.setPosition(body.position.x, body.position.y);
      slow = Math.hypot(body.velocity.x, body.velocity.y) < 0.3 ? slow + 1 : 0;
      return slow > 30 || steps > 240 || body.position.x > b.worldW + 40 || body.position.x < -40 || body.position.y > H + 40 || body.position.y < -400;
    },
    destroy: () => {
      b.scene.matter.world.remove(body);
      sprite.destroy();
    },
    body,
  } as any);
}
