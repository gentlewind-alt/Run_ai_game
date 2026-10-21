import { sfx } from '../../audio/sfx';
import { C } from '../../art/palette';
import { weaponTexture } from '../../art/textures';
import type { Actor } from '../../battle/BattleCtx';
import type { WeaponImpl } from './types';

export const kineticPalms: WeaponImpl = {
  texture: weaponTexture('w_kinetic_palms'),
  onAbility(ctx, p) {
    const P = p.def.params;
    const totalVolleys = P.volleyCount ?? 3;
    const delaySteps = P.volleyDelaySteps ?? 10;
    const boltSpeed = P.boltSpeed ?? 12;
    const boltMult = P.boltMult ?? 0.55;
    const knockback = P.knockback ?? 4.5;
    const recoilVx = P.recoilVx ?? -2.0;
    const recoilVy = P.recoilVy ?? -0.8;

    let fired = 0;
    let timer = 0;

    const fireOneBolt = (): void => {
      sfx.repulsor();
      const sx = p.body.position.x;
      const sy = p.body.position.y;

      // Cyan muzzle flash at palm
      ctx.fx.muzzleFlash?.(sx + 10, sy);

      // Visible recoil on the shot
      ctx.M.Body.setVelocity(p.body, {
        x: p.body.velocity.x + recoilVx,
        y: p.body.velocity.y + recoilVy,
      });
      ctx.fx.sparks(sx, sy, ['b', 'c'], 6);

      let bx = sx + 12;
      const by = sy;
      let bSteps = 0;

      // Visible 3px bolt with white core flying forward
      const boltSprite = ctx.fx.image(bx, by, 'fx_palm_bolt').setDepth(11);

      // Fast flat bolt travelling horizontally forward
      const boltActor: Actor = {
        pos: () => ({ x: bx, y: by }),
        update() {
          bSteps++;
          bx += boltSpeed;
          boltSprite.setPosition(bx, by);
          // Check collision with living monsters or blocks
          const hitMonster = ctx.within(bx, by, 10)[0];
          if (hitMonster) {
            ctx.directHit(hitMonster, p.wid, boltMult, bx, by);
            ctx.M.Body.setVelocity(hitMonster.body, {
              x: hitMonster.body.velocity.x + knockback,
              y: hitMonster.body.velocity.y - 1.5,
            });
            ctx.fx.sparks(bx, by, ['b', 'c', '8'], 8);
            return true;
          }
          const hitBlock = ctx.blocks().find((b) => !b.dead && Math.hypot(b.body.position.x - bx, b.body.position.y - by) <= 10);
          if (hitBlock) {
            ctx.damage(hitBlock, p.def.baseDamage * boltMult, bx, by, { strong: false, tag: 'norm' });
            ctx.M.Body.setVelocity(hitBlock.body, {
              x: hitBlock.body.velocity.x + knockback * 0.7,
              y: hitBlock.body.velocity.y - 1.0,
            });
            ctx.fx.sparks(bx, by, ['b', 'c'], 8);
            return true;
          }
          return bSteps > 90 || bx > ctx.worldW + 30;
        },
        destroy() {
          boltSprite.destroy();
        },
      };
      ctx.addActor(boltActor);
    };

    // First bolt fires immediately
    fireOneBolt();
    fired = 1;

    // Remaining bolts fire 10 steps apart via an Actor
    const volleyActor: Actor = {
      update() {
        if (fired >= totalVolleys) return true;
        timer++;
        if (timer >= delaySteps) {
          timer = 0;
          fireOneBolt();
          fired++;
        }
        return fired >= totalVolleys;
      },
      destroy() {},
    };
    ctx.addActor(volleyActor);
  },
  drawFx(_ctx, p, g) {
    const b = p.body.position;
    g.lineStyle(1, C('b'), 0.8).strokeCircle(b.x, b.y, 8);
    g.lineStyle(1, C('c'), 1).strokeCircle(b.x, b.y, 5);
  },
};
