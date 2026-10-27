import { sfx } from '../../audio/sfx';
import { C } from '../../art/palette';
import { weaponTexture } from '../../art/textures';
import type { WeaponImpl } from './types';

/**
 * Black Hole Marble (legendary): the tap leaves a singularity hanging in the air. For `holeSteps` it pulls everything within its
 * radius toward it with growing force, then it collapses in a shock wave. One charge per level. Numbers are in the data row.
 */
export const blackHoleMarble: WeaponImpl = {
  texture: weaponTexture('w_black_hole_marble'),
  onAbility(ctx, p) {
    const P = p.def.params;
    const b = p.body;
    ctx.M.Body.setVelocity(b, { x: 0, y: 0 });
    ctx.M.Body.setAngularVelocity(b, 0);
    ctx.setGravity(b, 0);
    p.sprite.setAlpha(0.35);
    const x = b.position.x;
    const y = b.position.y;
    const core = ctx.fx.dot(x, y, 4, C('0'), C('7'));
    core.setDepth(11);
    const hole = ctx.fx.legendArt('legend_black_hole', x, y, P.legendHoleSize, P.legendHoleSize).setScale(P.holeStartScale);
    ctx.fx.legendOverlay(0x08040d, P.vignetteAlpha, P.vignetteSteps, 'vignette');
    ctx.fx.legendSpiral(x, y, P.streakRadius, P.streakCount, P.holeSteps, 0xbba3ff);
    ctx.fx.legendStretch(x, y, P.stretchRadius, P.stretchStrength, P.holeSteps);
    ctx.flash?.(0x7a3b8c, 80);
    sfx.omnitrix();
    let t = 0;
    let collapseStep = 0;
    let collapsing = false;
    ctx.addActor({
      pos: () => ({ x, y }),
      update() {
        if (!collapsing) {
          t++;
          const grow = t / P.holeSteps;
          core.setRadius(4 + grow * 6);
          const scale = P.holeStartScale + (P.holeFullScale - P.holeStartScale) * Math.min(1, grow);
          hole.setScale(scale).setRotation(t * P.swirlRotationSpeed);
          if (t % 6 === 0) {
            ctx.fx.ring(x, y, P.holeRadius * (1 - ((t / 6) % 5) / 5), C(t % 12 === 0 ? '7' : 'b'));
            const a = ctx.rng.next() * Math.PI * 2;
            ctx.fx.sparks(x + Math.cos(a) * P.holeRadius * 0.8, y + Math.sin(a) * P.holeRadius * 0.8, ['7', 'b'], 1);
          }
          // pull: a negative push draws things in, stronger as the hole grows
          ctx.push(x, y, P.holeRadius, -P.pullStrength * (0.4 + grow));
          if (t % P.tickSteps === 0) ctx.damageAround(x, y, P.holeRadius * 0.5, P.tickMult, p.wid);
          if (t < P.holeSteps) return false;
          collapsing = true;
        }
        collapseStep++;
        const shrink = Math.max(0.02, 1 - Math.min(1, collapseStep / P.collapseSteps));
        hole.setScale(P.holeFullScale * shrink).setRotation((t + collapseStep * 3) * P.swirlRotationSpeed);
        core.setRadius((4 + P.holeFullScale * 3) * shrink);
        if (collapseStep < P.collapseSteps + P.collapsePauseSteps) return false;
        // collapse
        ctx.blast(x, y, P.collapseRadius, P.collapseMult, p.wid);
        ctx.fx.legendWave(x, y, P.novaRadius, P.novaRadius, P.novaSteps, 0xd6b9ff, P.novaWaveWidth);
        ctx.fx.legendOverlay(0xf4eaff, P.novaFlashAlpha, P.novaFlashSteps, 'flash');
        ctx.fx.sparks(x, y, ['7', 'b', 'c'], 14);
        ctx.fx.shake(0.03);
        ctx.flash?.(0xffffff, 100);
        sfx.quake();
        core.destroy();
        hole.destroy();
        ctx.endProj(p);
        return true;
      },
      destroy() {
        core.destroy();
        hole.destroy();
      },
    });
  },
};
