import { sfx } from '../../audio/sfx';
import { weaponTexture } from '../../art/textures';
import type { Ent } from '../../battle/BattleCtx';
import type { WeaponImpl } from './types';

/** Distance from a point to the segment (x0,y0)-(x1,y1). */
function distToSegment(px: number, py: number, x0: number, y0: number, x1: number, y1: number): number {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / len2));
  return Math.hypot(px - (x0 + dx * t), py - (y0 + dy * t));
}

/**
 * Brahmastra Arrow (legendary): a golden arrow. The tap makes it hang in the air and fire a focused beam of light along its
 * flight line, sweeping slowly. The beam ignores armour, scorches wood and shatters crystal. Numbers are in the data row.
 */
export const brahmastraArrow: WeaponImpl = {
  texture: weaponTexture('w_brahmastra_arrow'),
  onAbility(ctx, p) {
    const P = p.def.params;
    const body = p.body;
    const ang0 = Math.atan2(body.velocity.y, body.velocity.x);
    // the arrow hangs where the tap happened; the beam fires from it
    ctx.M.Body.setVelocity(body, { x: 0, y: 0 });
    ctx.M.Body.setAngularVelocity(body, 0);
    ctx.setGravity(body, 0);
    const x0 = body.position.x;
    const y0 = body.position.y;
    const steps: number = P.beamSteps;
    const length: number = P.beamLength;
    const sweep = (P.sweepDeg * Math.PI) / 180;
    let t = 0;
    const angAt = (k: number): number => ang0 + sweep * (k / steps - 0.5);
    const segAt = (k: number) => {
      const a = angAt(k);
      return { x0, y0, x1: x0 + Math.cos(a) * length, y1: y0 + Math.sin(a) * length };
    };
    sfx.brahmastra();
    ctx.flash?.(0xfff0b0, 90);
    ctx.fx.shake(0.02);
    ctx.fx.beam?.(() => segAt(t), steps);
    ctx.addActor({
      pos: () => ({ x: x0, y: y0 }),
      update() {
        t++;
        if (t % P.tickSteps === 0) {
          const s = segAt(t);
          const targets: Ent[] = [...ctx.monsters(), ...ctx.blocks()];
          for (const e of targets) {
            if (e.dead) continue;
            const ex = e.body.position.x;
            const ey = e.body.position.y;
            if (distToSegment(ex, ey, s.x0, s.y0, s.x1, s.y1) > P.beamWidth / 2 + Math.max(e.w, e.h) / 2) continue;
            const mult = e.kind === 'block' ? (e.type === 'wood' ? P.woodMult : e.type === 'crystal' ? P.crystalMult : 1) : 1;
            ctx.damage(e, p.def.baseDamage * P.tickMult * mult, ex, ey, { strong: false, tag: 'norm', quiet: true, ignoreArmour: true });
            ctx.fx.sparks(ex, ey, ['4', 't'], 2);
          }
        }
        if (t >= steps) {
          ctx.endProj(p);
          return true;
        }
        return false;
      },
      destroy() {},
    });
  },
};
