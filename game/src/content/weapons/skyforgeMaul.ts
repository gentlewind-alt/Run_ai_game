import { sfx } from '../../audio/sfx';
import { C } from '../../art/palette';
import { weaponTexture } from '../../art/textures';
import type { Actor, Ent, LegendVisual } from '../../battle/BattleCtx';
import type { WeaponImpl } from './types';

/** Two lowest HP, a middle target, and the highest HP, without duplicate strikes. */
export function selectLightningTargets(monsters: Ent[]): Ent[] {
  const sorted = [...new Set(monsters.filter((m) => !m.dead && m.hp > 0))]
    .sort((a, b) => a.hp - b.hp || a.body.id - b.body.id);
  if (sorted.length <= 4) return sorted;
  const middle = Math.floor((sorted.length - 1) / 2);
  return [sorted[0], sorted[1], sorted[middle], sorted[sorted.length - 1]];
}

export const skyforgeMaul: WeaponImpl = {
  texture: weaponTexture('w_skyforge_maul'),
  onLaunch(_ctx, p) {
    p.data.taps = 0;
    p.data.recalling = false;
  },
  onAbility(ctx, p) {
    const P = p.def.params;
    p.data.taps = (p.data.taps ?? 0) + 1;

    // First tap: lightning bolt + crackling electric field
    if (p.data.taps === 1) {
      const targets = selectLightningTargets(ctx.monsters());
      const target = targets.reduce<Ent | undefined>((highest, monster) => !highest || monster.hp > highest.hp || (monster.hp === highest.hp && monster.body.id > highest.body.id) ? monster : highest, undefined);
      const tx = target ? target.body.position.x : p.body.position.x;
      const ty = target ? target.body.position.y : p.body.position.y;
      const strikePoints = targets.map((monster) => ({ x: monster.body.position.x, y: monster.body.position.y }));
      const cloudX = strikePoints.length ? strikePoints.reduce((sum, point) => sum + point.x, 0) / strikePoints.length : tx;
      const cloudY = (strikePoints.length ? Math.min(...strikePoints.map((point) => point.y)) : ty) - P.cloudOffsetY;
      const hammerPoint = target ? { x: target.body.position.x, y: target.body.position.y } : { x: tx, y: ty };

      // Screen white flash and hit-stop
      ctx.flash?.(0xffffff, 70);
      ctx.hitStop?.(P.boltHitStop ?? 3);
      ctx.fx.legendOverlay(0x0b1027, P.stormDimAlpha, P.stormSequenceSteps, 'dim');

      const cloud = ctx.fx.legendArt('legend_storm_cloud', cloudX - P.cloudRollDistance, cloudY, P.cloudWidth, P.cloudHeight).setScale(P.cloudScale);
      let cloudStep = 0;
      ctx.addActor({
        pos: () => ({ x: cloudX, y: cloudY }),
        update() {
          cloudStep++;
          const progress = Math.min(1, cloudStep / P.cloudRollSteps);
          const eased = progress * progress * (3 - 2 * progress);
          cloud.setPosition(cloudX - P.cloudRollDistance * (1 - eased), cloudY + Math.sin(cloudStep * P.cloudWobbleSpeed) * P.cloudWobbleHeight);
          if (cloudStep > P.stormSequenceSteps - P.cloudFadeSteps) cloud.setAlpha(P.stormDimAlpha * (P.stormSequenceSteps - cloudStep) / P.cloudFadeSteps);
          return cloudStep >= P.stormSequenceSteps;
        },
        destroy: () => cloud.destroy(),
      });

      sfx.thunder();
      ctx.fx.shake(0.04);

      for (const monster of targets) {
        const { x, y } = monster.body.position;
        ctx.directHit(monster, p.wid, monster === target ? P.boltDamageMult : P.chainMult, x, y, monster === target);
        ctx.addStatus(monster, 'chain', 60);
      }
      let strikeStep = 0;
      let strikeIndex = 0;
      let hammer: LegendVisual | null = null;
      let hammerPhase: 'fall' | 'hold' | 'rise' | 'done' = 'fall';
      let hammerStep = 0;
      const hammerX = hammerPoint.x;
      const hammerFromY = cloudY;
      const hammerLandY = hammerPoint.y - P.hammerSize / 2;
      ctx.addActor({
        pos: () => ({ x: hammerX, y: cloudY }),
        update() {
          strikeStep++;
          if (strikeIndex < strikePoints.length && strikeStep % P.strikeGapSteps === 0) {
            const point = strikePoints[strikeIndex++];
            ctx.fx.legendGroundGlow(point.x, point.y, P.strikeGlowRadiusX, P.strikeGlowRadiusY, 0x79dfff, P.strikeGlowAlpha, P.strikeGlowSteps);
            ctx.fx.bolt(point.x, point.y);
          } else if (!strikePoints.length && strikeIndex === 0 && strikeStep === P.strikeGapSteps) {
            strikeIndex++;
            ctx.fx.legendGroundGlow(tx, ty, P.strikeGlowRadiusX, P.strikeGlowRadiusY, 0x79dfff, P.strikeGlowAlpha, P.strikeGlowSteps);
            ctx.fx.bolt(tx, ty);
          }
          if (strikeIndex >= Math.max(1, strikePoints.length) && !hammer && target) {
            hammer = ctx.fx.legendArt('legend_storm_hammer', hammerX, hammerFromY, P.hammerSize, P.hammerSize).setScale(P.hammerScale);
          }
          if (!hammer) return strikeIndex >= Math.max(1, strikePoints.length) && strikeStep >= P.stormSequenceSteps;
          hammerStep++;
          if (hammerPhase === 'fall') {
            const f = Math.min(1, hammerStep / P.hammerFallSteps);
            const eased = f * f;
            hammer.setPosition(hammerX, hammerFromY + (hammerLandY - hammerFromY) * eased).setRotation((1 - f) * P.hammerTurn);
            if (hammerStep >= P.hammerFallSteps) {
              hammerStep = 0;
              hammerPhase = 'hold';
              ctx.fx.legendWave(hammerX, hammerLandY, P.hammerWaveRangeX, P.hammerWaveHeight, P.hammerWaveSteps, 0x9eeaff, P.hammerWaveWidth);
              ctx.fx.shake(P.hammerShakeIntensity);
              ctx.hitStop?.(P.hammerHitStopSteps);
            }
          } else if (hammerPhase === 'hold') {
            if (hammerStep >= P.hammerHoldSteps) { hammerStep = 0; hammerPhase = 'rise'; }
          } else if (hammerPhase === 'rise') {
            const f = Math.min(1, hammerStep / P.hammerRiseSteps);
            const eased = f * f;
            hammer.setPosition(hammerX, hammerLandY + (hammerFromY - hammerLandY) * eased).setRotation(-f * P.hammerTurn);
            if (hammerStep >= P.hammerRiseSteps) hammerPhase = 'done';
          }
          return hammerPhase === 'done';
        },
        destroy() { hammer?.destroy(); },
      });

      // Crackling blue-white electric field around that spot for 3 s (180 steps)
      // that chains damage (a small tick every 20 steps) between monsters and metal blocks within radius
      const fieldRadius = P.fieldRadius ?? 50;
      const fieldSteps = P.fieldSteps ?? 180;
      const tickSteps = P.fieldTickSteps ?? 20;
      const tickMult = P.fieldTickMult ?? 0.2;

      ctx.fx.electricField?.(tx, ty, fieldRadius, fieldSteps);

      let remaining = fieldSteps;
      let tickCounter = 0;
      const fieldActor: Actor = {
        pos: () => ({ x: tx, y: ty }),
        update() {
          remaining--;
          tickCounter++;
          // Crackle visuals within radius
          if (remaining % 6 === 0) {
            const ang = ctx.rng.next() * Math.PI * 2;
            const r = ctx.rng.next() * fieldRadius;
            ctx.fx.sparks(tx + Math.cos(ang) * r, ty + Math.sin(ang) * r, ['b', 'c', '8'], 1);
          }
          // Chain damage tick every 20 steps
          if (tickCounter >= tickSteps) {
            tickCounter = 0;
            const nearMonsters = ctx.within(tx, ty, fieldRadius);
            const nearIronBlocks = ctx.blocks().filter(
              (b) => b.type === 'iron' && !b.dead && Math.hypot(b.body.position.x - tx, b.body.position.y - ty) <= fieldRadius
            );
            const affected: Ent[] = [...nearMonsters, ...nearIronBlocks];
            for (const ent of affected) {
              ctx.damage(ent, p.def.baseDamage * tickMult, ent.body.position.x, ent.body.position.y, {
                strong: false, tag: 'norm', quiet: true,
              });
              ctx.addStatus(ent, 'chain', 30);
              ctx.fx.sparks(ent.body.position.x, ent.body.position.y, ['b', 'c'], 2);
            }
          }
          return remaining <= 0;
        },
        destroy() {},
      };
      ctx.addActor(fieldActor);

      // Enable second tap to recall
      p.data.allowSecondTap = true;
      p.data.secondTapLabel = 'Recall';
    } else if (p.data.taps >= 2) {
      // Second tap: Recall
      p.data.recalling = true;
      p.data.allowSecondTap = false;
      ctx.setGravity(p.body, 0);
      sfx.ping();
      ctx.fx.ring(p.body.position.x, p.body.position.y, 22, C('b'));
    }
  },
  onUpdate(ctx, p) {
    if (!p.data.recalling) return;
    const P = p.def.params;
    const speed = P.recallSpeed ?? 12;
    const dx = ctx.sling.x - p.body.position.x;
    const dy = ctx.sling.y - p.body.position.y;
    const d = Math.hypot(dx, dy);
    if (d < 16) {
      ctx.endProj(p);
      return;
    }
    ctx.M.Body.setVelocity(p.body, { x: (dx / d) * speed, y: (dy / d) * speed });
    ctx.M.Body.setAngularVelocity(p.body, -0.4);

    // Hit enemies on the way back
    const near = ctx.within(p.body.position.x, p.body.position.y, 16);
    p.data.hitDuringRecall = p.data.hitDuringRecall ?? new Set<number>();
    for (const m of near) {
      const id = m.body?.id ?? m.hp;
      if (!p.data.hitDuringRecall.has(id)) {
        p.data.hitDuringRecall.add(id);
        ctx.directHit(m, p.wid, P.recallDamageMult ?? 0.8, p.body.position.x, p.body.position.y);
        ctx.fx.sparks(p.body.position.x, p.body.position.y, ['c', 'b'], 4);
      }
    }
  },
  drawFx(_ctx, p, g) {
    if (p.data.recalling) {
      g.lineStyle(2, C('b'), 0.8).strokeCircle(p.body.position.x, p.body.position.y, 14);
      g.lineStyle(1, C('c'), 1).strokeCircle(p.body.position.x, p.body.position.y, 9);
    }
  },
};
