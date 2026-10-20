import type { MonsterBehavior } from './types';

/**
 * Runs along the ground toward the exit door; reaching it counts as an escape.
 * It waits out the intro pan and the weapon hop, so the player always gets the first shot at a runner standing where the
 * level put it, then starts after the level's `delay` (seconds).
 */
export const runner: MonsterBehavior = {
  onUpdate(ctx, m) {
    if (m.runFrom === undefined) {
      if (ctx.phase === 'intro' || ctx.phase === 'loading') return;
      m.runFrom = ctx.step + Math.round(m.delay * ctx.stepHz);
    }
    if (ctx.step < m.runFrom) return;
    const b = m.body;
    const grounded = Math.abs(b.velocity.y) < 1.2 && b.position.y > ctx.groundAt(b.position.x) - 12;
    if (grounded) {
      const sp = m.speed * (m.status.slow > 0 ? ctx.tune.status.slowSpeedMult : 1);
      ctx.M.Body.setVelocity(b, { x: m.dir * sp, y: b.velocity.y });
      ctx.M.Body.setAngularVelocity(b, 0);
      ctx.M.Body.setAngle(b, b.angle * 0.6);
    }
    const exitX = ctx.level.exit?.x ?? 99999;
    if ((m.dir > 0 && b.position.x >= exitX) || (m.dir < 0 && b.position.x <= exitX)) ctx.escape(m);
  },
};
