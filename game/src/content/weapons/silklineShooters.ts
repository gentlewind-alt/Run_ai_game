import { sfx } from '../../audio/sfx';
import { C } from '../../art/palette';
import { weaponTexture } from '../../art/textures';
import type { Ent } from '../../battle/BattleCtx';
import type { WeaponImpl } from './types';

export const silklineShooters: WeaponImpl = {
  texture: weaponTexture('w_silkline_shooters'),
  onLaunch(_ctx, p) {
    p.data.webbed = false;
  },
  onAbility(ctx, p) {
    const P = p.def.params;
    // Find nearest monster, or nearest block if no monsters
    const monsters = ctx.nearestMonsters(p.body.position.x, p.body.position.y, 1);
    let target: Ent | undefined = monsters[0];
    if (!target) {
      const blocks = ctx.blocks().filter((b) => !b.dead);
      blocks.sort(
        (a, b) => Math.hypot(a.body.position.x - p.body.position.x, a.body.position.y - p.body.position.y) -
                  Math.hypot(b.body.position.x - p.body.position.x, b.body.position.y - p.body.position.y)
      );
      target = blocks[0];
    }
    if (!target) return;

    sfx.thwip();
    const tx = target.body.position.x;
    const ty = target.body.position.y;

    // Pull target 16 px toward the sling
    const toSlingX = ctx.sling.x - tx;
    const toSlingY = ctx.sling.y - ty;
    const d = Math.hypot(toSlingX, toSlingY);
    if (d > 0.1) {
      const pull = P.pullDist ?? 16;
      ctx.M.Body.setPosition(target.body, {
        x: tx + (toSlingX / d) * pull,
        y: ty + (toSlingY / d) * pull,
      });
    }

    // Webbed monsters are slowed 50% for 4 s (240 steps)
    if (target.kind === 'monster') {
      const slowSteps = P.slowSteps ?? 240;
      ctx.addStatus(target, 'slow', slowSteps);
      ctx.damage(target, p.def.baseDamage * 0.5, tx, ty, { strong: false, tag: 'norm' });
    }

    // Splat effect at target (24px splat held at peak for 30 steps)
    ctx.fx.webSplat?.(tx, ty, 30);
    ctx.fx.sparks(tx, ty, ['c', 'l', 'b'], 14);

    // 2 px strand with a white outline from shooter to target (held for 26 steps)
    ctx.fx.webStrand?.(p.body.position.x, p.body.position.y, tx, ty, 26);

    p.data.webLine = {
      tx, ty, steps: 26,
    };
  },
  drawFx(_ctx, p, g) {
    if (p.data.webLine && p.data.webLine.steps > 0) {
      p.data.webLine.steps--;
      // 2 px strand with white outline
      g.lineStyle(4, 0xffffff, 1);
      g.lineBetween(p.body.position.x, p.body.position.y, p.data.webLine.tx, p.data.webLine.ty);
      g.lineStyle(2, C('b'), 1);
      g.lineBetween(p.body.position.x, p.body.position.y, p.data.webLine.tx, p.data.webLine.ty);
    }
  },
};
