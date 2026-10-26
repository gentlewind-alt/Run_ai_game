import { sfx } from '../../audio/sfx';
import { C } from '../../art/palette';
import { weaponTexture } from '../../art/textures';
import type { Actor, Ent } from '../../battle/BattleCtx';
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

      // Screen white flash and hit-stop
      ctx.flash?.(0xffffff, 70);
      ctx.hitStop?.(P.boltHitStop ?? 3);

      sfx.thunder();
      ctx.fx.shake(0.04);

      for (const monster of targets) {
        const { x, y } = monster.body.position;
        ctx.fx.bolt(x, y);
        ctx.directHit(monster, p.wid, monster === target ? P.boltDamageMult : P.chainMult, x, y, monster === target);
        ctx.addStatus(monster, 'chain', 60);
      }
      if (!target) ctx.fx.bolt(tx, ty);

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
