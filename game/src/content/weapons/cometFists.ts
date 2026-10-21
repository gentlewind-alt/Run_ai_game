import { sfx } from '../../audio/sfx';
import { C } from '../../art/palette';
import { weaponTexture } from '../../art/textures';
import type { WeaponImpl } from './types';

export const cometFists: WeaponImpl = {
  texture: weaponTexture('w_comet_fists'),
  onLaunch(_ctx, p) {
    p.data.slamming = false;
  },
  onAbility(ctx, p) {
    const P = p.def.params;
    // Dive-slam straight down
    p.data.slamming = true;
    ctx.M.Body.setVelocity(p.body, { x: 0, y: P.slamSpeed ?? 14 });
    ctx.M.Body.setAngularVelocity(p.body, 0);
    sfx.saw();
    ctx.fx.sparks(p.body.position.x, p.body.position.y, ['5', '6', 's'], 8);
  },
  onImpact(ctx, p) {
    if (!p.data.slamming && !p.tapped) return;
    p.data.slamming = false;
    const P = p.def.params;
    const ix = p.body.position.x;
    const iy = p.body.position.y;

    // Earthquake: expanding ground rings, low rumble and thud
    sfx.quake();
    ctx.fx.shake(0.04);
    const rangeX = P.quakeRangeX ?? 90;
    ctx.fx.quakeRings?.(ix, iy, rangeX);
    ctx.fx.sparks(ix, iy, ['6', '5', 'd', 'e', 'c'], 24);

    const hopVy = P.quakeHopVy ?? -4.5;
    const dmgMult = P.quakeDamageMult ?? 0.9;
    const stunSteps = P.quakeStunSteps ?? 40; // 40 steps stun

    // Blocks within +-90 px along the ground hop and take damage (does NOT launch debris into the sky)
    const blocks = ctx.blocks().filter((b) => !b.dead && Math.abs(b.body.position.x - ix) <= rangeX);
    for (const b of blocks) {
      ctx.M.Body.setVelocity(b.body, { x: b.body.velocity.x * 0.5, y: hopVy });
      ctx.damage(b, p.def.baseDamage * dmgMult, b.body.position.x, b.body.position.y, { strong: false, tag: 'norm' });
    }

    // Monsters in the wave are knocked flat and stunned 40 steps and take damage
    const monsters = ctx.monsters().filter((m) => !m.dead && Math.abs(m.body.position.x - ix) <= rangeX);
    for (const m of monsters) {
      ctx.damage(m, p.def.baseDamage * dmgMult, m.body.position.x, m.body.position.y, { strong: false, tag: 'norm' });
      ctx.addStatus(m, 'stun', stunSteps);
      const dir = m.body.position.x >= ix ? 1 : -1;
      ctx.M.Body.setVelocity(m.body, { x: dir * 3.0, y: -2.5 });
      ctx.M.Body.setAngle(m.body, dir * Math.PI / 2);
    }
  },
  onUpdate(ctx, p) {
    if (p.data.slamming) {
      const v = p.body.velocity;
      if (v.y < (p.def.params.slamSpeed ?? 14)) {
        ctx.M.Body.setVelocity(p.body, { x: 0, y: p.def.params.slamSpeed ?? 14 });
      }
    }
  },
  drawFx(_ctx, p, g) {
    if (p.data.slamming) {
      const b = p.body.position;
      g.lineStyle(2, C('5'), 0.8).lineBetween(b.x, b.y - 18, b.x, b.y + 4);
      g.lineStyle(1, C('s'), 1).lineBetween(b.x - 4, b.y - 12, b.x - 4, b.y + 2);
      g.lineStyle(1, C('s'), 1).lineBetween(b.x + 4, b.y - 12, b.x + 4, b.y + 2);
    }
  },
};
