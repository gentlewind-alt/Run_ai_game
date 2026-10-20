import type { MonsterBehavior } from './types';

/** Flies a sine path around where it spawned. */
export const imp: MonsterBehavior = {
  onSpawn(ctx, m) {
    m.body.ignoreGravity = true;
    ctx.M.Body.setInertia(m.body, Infinity);
  },
  onUpdate(ctx, m) {
    const P = m.params;
    const t = ctx.step / 60;
    const tx = m.ox + P.ampX * Math.sin(t * P.freqX + m.phase);
    const ty = m.oy + P.ampY * Math.sin(t * P.freqY + m.phase * 2);
    ctx.M.Body.setVelocity(m.body, { x: tx - m.body.position.x, y: ty - m.body.position.y });
    ctx.M.Body.setAngularVelocity(m.body, 0);
  },
};
