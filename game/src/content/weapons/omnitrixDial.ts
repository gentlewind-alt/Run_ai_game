import { sfx } from '../../audio/sfx';
import { C } from '../../art/palette';
import { OMNI_ARM_COLORS, omniArmKey } from '../../art/omnitrixTextures';
import { weaponTexture } from '../../art/textures';
import type { Actor, BattleCtx, Proj } from '../../battle/BattleCtx';
import type { WeaponImpl } from './types';

const KINDS = Object.keys(OMNI_ARM_COLORS); // fire, brute, crystal, stone, lightning
const RING_COLOR: Record<string, number> = { fire: C('3'), brute: C('6'), crystal: C('b'), stone: C('d'), lightning: C('4') };
const SPARKS: Record<string, string[]> = { fire: ['3', '4'], brute: ['6', '5'], crystal: ['a', 'b'], stone: ['d', 'c'], lightning: ['4', 't'] };

/** Where an arm stops: the ground, or the top of the first block or monster under it. */
function landingY(ctx: BattleCtx, x: number): number {
  let y = ctx.groundAt(x);
  for (const e of [...ctx.monsters(), ...ctx.blocks()]) {
    if (e.dead) continue;
    if (Math.abs(e.body.position.x - x) <= e.w / 2 + 6) y = Math.min(y, e.body.position.y - e.h / 2);
  }
  return y;
}

/** One falling forearm: waits its turn, drops, hits, bounces once, hits again, then rises back into the sky. */
function makeArm(ctx: BattleCtx, p: Proj, index: number, x: number, kind: string, done: () => void): Actor {
  const P = p.def.params;
  const img = ctx.fx.image(x, -30, omniArmKey(kind)).setOrigin(0.5, 1).setDepth(12).setVisible(false);
  img.setScale(P.armHeight / img.height);
  const landY = landingY(ctx, x);
  const base = { fire: P.multFire, brute: P.multBrute, crystal: P.multCrystal, stone: P.multStone, lightning: P.multLightning }[kind] ?? 0.7;
  const delay = index * P.staggerSteps;
  let t = 0;
  let y = -30;
  let vy = P.fallSpeed;
  let phase: 'wait' | 'fall' | 'up' | 'fall2' | 'retract' = 'wait';

  const impact = (mult: number): void => {
    const r = P.impactRadius;
    ctx.damageAround(x, landY, r, base * mult, p.wid);
    const near = ctx.within(x, landY, r);
    if (kind === 'fire') near.forEach((m) => ctx.addStatus(m, 'burn', P.burnSteps));
    if (kind === 'brute') {
      ctx.push(x, landY, r * 1.6, P.pushStrength);
      near.forEach((m) => ctx.addStatus(m, 'stun', P.knockSteps));
    }
    if (kind === 'crystal') {
      for (const b of ctx.blocks()) {
        if (b.dead || (b.type !== 'iron' && b.type !== 'crystal')) continue;
        if (Math.hypot(b.body.position.x - x, b.body.position.y - landY) > r + 8) continue;
        ctx.damage(b, p.def.baseDamage * P.crystalBonusMult * mult, b.body.position.x, b.body.position.y, { strong: false, tag: 'norm', quiet: true });
      }
    }
    if (kind === 'lightning') {
      near.forEach((m) => {
        ctx.addStatus(m, 'stun', P.stunSteps);
        ctx.addStatus(m, 'chain', 30);
      });
    }
    ctx.fx.ring(x, landY, r, RING_COLOR[kind]);
    ctx.fx.sparks(x, landY, SPARKS[kind], 5);
    ctx.fx.shake(0.012 * mult);
  };

  return {
    update() {
      t++;
      if (phase === 'wait') {
        if (t >= delay) {
          phase = 'fall';
          img.setVisible(true);
        }
        return false;
      }
      if (phase === 'fall' || phase === 'fall2') {
        y += vy;
        if (y >= landY) {
          y = landY;
          if (phase === 'fall') {
            impact(1);
            phase = 'up';
            vy = -P.bounceSpeed;
          } else {
            impact(P.bounceMult);
            phase = 'retract';
            vy = -P.fallSpeed;
          }
        }
      } else if (phase === 'up') {
        y += vy;
        vy += P.bounceGravity;
        if (vy >= 0) {
          phase = 'fall2';
          vy = P.fallSpeed * 0.8;
        }
      } else {
        y += vy;
        if (y < -40) {
          done();
          return true;
        }
      }
      img.setY(y);
      return false;
    },
    destroy() {
      img.destroy();
    },
  };
}

/**
 * Omnitrix Dial (legendary): the tap flashes the dial green and five giant alien forearms crash down across a band centred on
 * the nearest monster. Each arm has its own effect (fire, knock-flat, crystal-breaker, heavy stone, lightning stun), bounces
 * once for a second hit at reduced damage, then retracts back into the sky. One charge per level.
 */
export const omnitrixDial: WeaponImpl = {
  texture: weaponTexture('w_omnitrix_dial'),
  onAbility(ctx, p) {
    const P = p.def.params;
    const b = p.body;
    const target = ctx.nearestMonsters(b.position.x, b.position.y, 1)[0];
    const cx = target ? target.body.position.x : b.position.x + 60;
    // the dial hangs where it was tapped and fades; the arms do the work
    ctx.M.Body.setVelocity(b, { x: 0, y: 0 });
    ctx.M.Body.setAngularVelocity(b, 0);
    ctx.setGravity(b, 0);
    p.sprite.setAlpha(0.5);
    ctx.flash?.(0x7cff7c, 90);
    ctx.fx.ring(b.position.x, b.position.y, 16, C('5'));
    ctx.fx.sparks(b.position.x, b.position.y, ['5', '6', 'a'], 10);
    sfx.omnitrix();
    let remaining = KINDS.length;
    KINDS.forEach((kind, i) => {
      const x = cx + (i - (KINDS.length - 1) / 2) * (P.bandWidth / (KINDS.length - 1));
      ctx.addActor(makeArm(ctx, p, i, x, kind, () => {
        remaining--;
        if (remaining === 0) ctx.endProj(p);
      }));
    });
  },
};
