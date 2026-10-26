import { sfx } from '../../audio/sfx';
import { weaponTexture } from '../../art/textures';
import type { Ent } from '../../battle/BattleCtx';
import type { WeaponImpl } from './types';

/** A warned column of sky light, locked to one impact position for the entire cast. */
export const brahmastraArrow: WeaponImpl = {
  texture: weaponTexture('w_brahmastra_arrow'),
  onAbility(ctx, p) {
    if (p.data.skyBeamActive) return;
    const P = p.def.params;
    const body = p.body;
    const target = ctx.nearestMonsters(body.position.x, body.position.y, 1)[0];
    const x = Math.max(0, Math.min(ctx.worldW, target?.body.position.x ?? body.position.x));
    const groundY = ctx.groundAt(x);
    const segment = { x0: x, y0: P.skyTopY, x1: x, y1: groundY };
    const chargeSteps = P.beamChargeSteps;
    const activeSteps = P.beamSteps;
    const totalSteps = chargeSteps + activeSteps;
    p.data.skyBeamActive = true;
    body.isSensor = true;
    ctx.M.Body.setPosition(body, { x, y: groundY - P.beamMarkerHeight });
    ctx.M.Body.setVelocity(body, { x: 0, y: 0 });
    ctx.M.Body.setAngularVelocity(body, 0);
    ctx.setGravity(body, 0);
    let t = 0;
    let finished = false;
    const finish = (): void => {
      if (finished) return;
      finished = true;
      p.data.skyBeamActive = false;
      ctx.endProj(p);
    };
    sfx.brahmastra();
    ctx.flash?.(0xfff0b0, 90);
    ctx.fx.shake(0.02);
    ctx.fx.beam?.(() => segment, totalSteps, P.beamWidth, chargeSteps);
    ctx.addActor({
      pos: () => ({ x, y: groundY }),
      update() {
        t++;
        const active = t - chargeSteps;
        if (active > 0 && active <= activeSteps && active % P.tickSteps === 0) {
          const targets: Ent[] = [...ctx.monsters(), ...ctx.blocks()];
          for (const e of targets) {
            if (e.dead) continue;
            const ex = e.body.position.x;
            const ey = e.body.position.y;
            if (Math.abs(ex - x) > P.beamWidth / 2 + e.w / 2 || ey + e.h / 2 < segment.y0 || ey - e.h / 2 > segment.y1) continue;
            const mult = e.kind === 'block' ? (e.type === 'wood' ? P.woodMult : e.type === 'crystal' ? P.crystalMult : 1) : 1;
            ctx.damage(e, p.def.baseDamage * P.tickMult * mult, ex, ey, { strong: false, tag: 'norm', quiet: true, silent: true, ignoreArmour: true });
            ctx.fx.sparks(ex, ey, ['4', 't'], 2);
          }
        }
        if (t >= totalSteps) {
          finish();
          return true;
        }
        return false;
      },
      destroy: finish,
    });
  },
  onUpdate(_ctx, p) {
    if (p.data.skyBeamActive) p.slow = 0;
  },
};
