import { sfx } from '../../audio/sfx';
import { C } from '../../art/palette';
import { weaponTexture } from '../../art/textures';
import type { Actor } from '../../battle/BattleCtx';
import type { WeaponImpl } from './types';
import { landingY } from './util';

/** Alien Dial keeps its saved weapon ID; its single stomp shakes the whole level. */
export const omnitrixDial: WeaponImpl = {
  texture: weaponTexture('w_omnitrix_dial'),
  onAbility(ctx, p) {
    if (p.data.stompActive) return;
    const P = p.def.params;
    const target = ctx.nearestMonsters(p.body.position.x, p.body.position.y, 1)[0];
    const x = Math.max(0, Math.min(ctx.worldW, target?.body.position.x ?? p.body.position.x));
    const landY = landingY(ctx, x);
    const footWidth = P.footWidth * P.footScale;
    const footHeight = P.footHeight * P.footScale;
    const fromY = Math.min(-P.skyGap, landY - footHeight - P.skyGap);
    const range = ctx.worldW * P.quakeRangeFraction;
    const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
    p.data.stompActive = true;
    ctx.M.Body.setVelocity(p.body, { x: 0, y: 0 });
    ctx.M.Body.setAngularVelocity(p.body, 0);
    ctx.M.Body.setPosition(p.body, { x, y: landY - P.markerHeight });
    p.body.isSensor = true;
    ctx.setGravity(p.body, 0);
    p.sprite.setVisible(false);
    ctx.fx.legendOverlay(0x55ed87, P.hourglassFlashAlpha, P.hourglassFlashSteps, 'hourglass');
    ctx.fx.legendGroundGlow(x, landY, P.shadowRadiusX, P.shadowRadiusY, 0x071412, P.shadowAlpha, P.shadowSteps);
    ctx.fx.ring(x, landY, P.splashRadius, C('5'));
    ctx.fx.word(x, landY - P.markerHeight, 'STOMP!');
    sfx.alienScreech();

    const foot = ctx.fx.legendArt('legend_alien_foot', x, fromY + footHeight / 2, footWidth, footHeight).setDepth(12).setVisible(false);
    let phase: 'warning' | 'fall' | 'hold' | 'lift' = 'warning';
    let elapsed = 0;
    let quakeElapsed = -1;
    let impacted = false;
    let finished = false;

    const impact = (): void => {
      if (impacted) return;
      impacted = true;
      p.data.stompImpactStep = ctx.step;
      quakeElapsed = 0;
      ctx.hitStop?.(ctx.tune.hitStopFrames);
      ctx.blast(x, landY, P.splashRadius, P.splashMult, p.wid);
      for (const block of ctx.blocks()) {
        if (block.dead || Math.abs(block.body.position.x - x) > range) continue;
        if (!block.body.isStatic) ctx.M.Body.setVelocity(block.body, { x: block.body.velocity.x * 0.5, y: P.quakeHopVy });
        ctx.damage(block, p.def.baseDamage * P.quakeMult, block.body.position.x, block.body.position.y, { strong: false, tag: 'norm', quiet: true, silent: true });
      }
      for (const monster of ctx.monsters()) {
        if (monster.dead || Math.abs(monster.body.position.x - x) > range) continue;
        const dir = monster.body.position.x >= x ? 1 : -1;
        ctx.damage(monster, p.def.baseDamage * P.quakeMult, monster.body.position.x, monster.body.position.y, { strong: false, tag: 'norm', silent: true });
        if (monster.dead) continue;
        ctx.addStatus(monster, 'stun', P.stunSteps);
        ctx.M.Body.setVelocity(monster.body, { x: dir * P.knockX, y: P.knockY });
        ctx.M.Body.setAngle(monster.body, dir * Math.PI / 2);
      }
      ctx.fx.quakeRings?.(x, landY, range);
      for (let i = 0; i < P.dustBursts; i++) {
        const dustX = ctx.worldW * (i + 0.5) / P.dustBursts;
        ctx.fx.sparks(dustX, ctx.groundAt(dustX), ['k', 'l', 'm', 'd'], 4);
      }
      ctx.fx.legendWave(x, landY, P.visualWaveRangeX, P.dustWaveHeight, P.dustWaveSteps, 0x73f078, P.dustWaveWidth);
      ctx.fx.legendWave(x, landY, P.energyRingRadius, P.energyRingRadius, P.energyRingSteps, 0x59ff8c, P.energyRingWidth);
      ctx.fx.ring(x, landY, P.splashRadius, C('c'));
      if (!reducedMotion) { ctx.fx.shake(P.legendShakeIntensity); ctx.flash?.(0xdaf7e5, 80); }
      sfx.alienStomp();
      foot.setScale(1.08, 0.88);
    };
    const finish = (): void => {
      if (finished) return;
      finished = true;
      p.data.stompActive = false;
      foot.destroy();
      ctx.endProj(p);
    };
    const stomp: Actor = {
      pos: () => ({ x, y: landY }),
      update() {
        if (finished) return true;
        elapsed++;
        if (quakeElapsed >= 0 && quakeElapsed++ < P.shakeSteps && quakeElapsed % P.shakeEverySteps === 0 && !reducedMotion) ctx.fx.shake(P.shakeIntensity * (1 - quakeElapsed / P.shakeSteps));
        if (phase === 'warning') {
          if (elapsed >= P.warningSteps) { phase = 'fall'; elapsed = 0; foot.setVisible(true); }
        } else if (phase === 'fall') {
          const progress = Math.min(1, elapsed / P.fallSteps);
          const fromCenterY = fromY + footHeight / 2;
          const landCenterY = landY - footHeight / 2;
          foot.setPosition(x, fromCenterY + (landCenterY - fromCenterY) * progress * progress);
          if (elapsed >= P.fallSteps) { foot.setPosition(x, landY - footHeight / 2); impact(); phase = 'hold'; elapsed = 0; }
        } else if (phase === 'hold') {
          const progress = Math.min(1, elapsed / P.holdSteps);
          foot.setScale(1 + 0.08 * (1 - progress), 1 - 0.12 * (1 - progress));
          if (elapsed >= P.holdSteps) { phase = 'lift'; elapsed = 0; foot.setScale(1, 1); }
        } else {
          const progress = Math.min(1, elapsed / P.liftSteps);
          const landCenterY = landY - footHeight / 2;
          const fromCenterY = fromY + footHeight / 2;
          foot.setPosition(x, landCenterY + (fromCenterY - landCenterY) * progress * progress);
          if (elapsed >= P.liftSteps) { finish(); return true; }
        }
        return false;
      },
      destroy: finish,
    };
    ctx.addActor(stomp);
  },
  onUpdate(_ctx, p) {
    if (p.data.stompActive) p.slow = 0;
  },
};
