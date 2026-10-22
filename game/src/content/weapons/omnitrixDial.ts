import { sfx } from '../../audio/sfx';
import { C } from '../../art/palette';
import { omniArmKey } from '../../art/omnitrixTextures';
import { weaponTexture } from '../../art/textures';
import type { Actor } from '../../battle/BattleCtx';
import type { WeaponImpl } from './types';
import { landingY } from './util';

/**
 * Omnitrix Dial (legendary): the tap flashes the dial green and a giant four-armed alien drops from the sky onto the nearest
 * monster. The landing deals splash damage and sends an earthquake along the ground (blocks hop, monsters are stunned and
 * knocked flat), then the alien leaps back up into the sky. One charge per level. Numbers are in the data row.
 */
export const omnitrixDial: WeaponImpl = {
  texture: weaponTexture('w_omnitrix_dial'),
  onAbility(ctx, p) {
    const P = p.def.params;
    const b = p.body;
    const target = ctx.nearestMonsters(b.position.x, b.position.y, 1)[0];
    const x = target ? target.body.position.x : b.position.x + 60;
    const landY = landingY(ctx, x);
    // the dial hangs where it was tapped and fades; the alien does the work
    ctx.M.Body.setVelocity(b, { x: 0, y: 0 });
    ctx.M.Body.setAngularVelocity(b, 0);
    ctx.setGravity(b, 0);
    p.sprite.setAlpha(0.4);
    ctx.flash?.(0x38b764, 90);
    ctx.fx.ring(b.position.x, b.position.y, 16, C('5'));
    ctx.fx.sparks(b.position.x, b.position.y, ['5', '6', 'a'], 10);
    sfx.omnitrix();

    const img = ctx.fx.image(x, -P.alienHeight, 'omni_alien').setOrigin(0.5, 1).setDepth(12);
    if (img.texture.key === '__MISSING') img.setTexture(omniArmKey('brute')); // the arm art is the fallback if the sprite never loaded
    img.setScale(P.alienHeight / img.height);
    const baseScaleX = img.scaleX;
    const baseScaleY = img.scaleY;
    let y = -P.alienHeight;
    let phase: 'fall' | 'hold' | 'leap' = 'fall';
    let holdLeft = P.holdSteps;
    let vy = P.fallSpeed;
    let finished = false;

    const impact = (): void => {
      ctx.hitStop?.(4);
      ctx.blast(x, landY, P.splashRadius, P.splashMult, p.wid);
      // the earthquake: blocks hop and take damage, monsters take damage, are stunned and knocked flat
      for (const blk of ctx.blocks()) {
        if (blk.dead || Math.abs(blk.body.position.x - x) > P.quakeRangeX) continue;
        ctx.M.Body.setVelocity(blk.body, { x: blk.body.velocity.x * 0.5, y: P.quakeHopVy });
        ctx.damage(blk, p.def.baseDamage * P.quakeMult, blk.body.position.x, blk.body.position.y, { strong: false, tag: 'norm', quiet: true });
      }
      for (const m of ctx.monsters()) {
        if (m.dead || Math.abs(m.body.position.x - x) > P.quakeRangeX) continue;
        ctx.damage(m, p.def.baseDamage * P.quakeMult, m.body.position.x, m.body.position.y, { strong: false, tag: 'norm' });
        ctx.addStatus(m, 'stun', P.stunSteps);
        const dir = m.body.position.x >= x ? 1 : -1;
        ctx.M.Body.setVelocity(m.body, { x: dir * P.knockX, y: -2.5 });
        ctx.M.Body.setAngle(m.body, (dir * Math.PI) / 2);
      }
      ctx.fx.quakeRings?.(x, landY, P.quakeRangeX);
      [P.splashRadius * 0.6, P.splashRadius, P.splashRadius * 1.5].forEach((r) => ctx.fx.ring(x, landY, r, C('6')));
      ctx.fx.sparks(x, landY, ['6', '5', 'k', 'm'], 16);
      ctx.fx.shake(0.03);
      sfx.quake();
      img.setScale(baseScaleX * 1.12, baseScaleY * 0.82); // squash on landing (visual only)
    };

    const finish = (): void => {
      if (finished) return;
      finished = true;
      ctx.endProj(p);
    };

    const alien: Actor = {
      update() {
        if (phase === 'fall') {
          y += vy;
          if (ctx.rng.next() < 0.6) ctx.fx.sparks(x, y - P.alienHeight * 0.5, ['5', '2'], 1);
          if (y >= landY) {
            y = landY;
            impact();
            phase = 'hold';
          }
        } else if (phase === 'hold') {
          if (--holdLeft <= 0) {
            phase = 'leap';
            vy = -P.bounceSpeed;
            img.setScale(baseScaleX, baseScaleY);
          }
        } else {
          y += vy;
          vy = Math.min(vy + P.bounceGravity, -2); // slows as it climbs, never stops
          img.setRotation(img.rotation + 0.04);
          if (y < -P.alienHeight - 10) {
            img.destroy();
            finish();
            return true;
          }
        }
        img.setY(y);
        return false;
      },
      destroy() {
        img.destroy();
        finish();
      },
    };
    ctx.addActor(alien);
  },
};
