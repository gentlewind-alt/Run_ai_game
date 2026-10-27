import { sfx } from '../../audio/sfx';
import { C } from '../../art/palette';
import { weaponTexture } from '../../art/textures';
import type { Actor, BattleCtx, Proj } from '../../battle/BattleCtx';
import type { WeaponImpl } from './types';
import { aimFrom } from './util';

// A flying cannon: it keeps its muzzle on the nearest monster, and on the tap (or when it crashes into anything)
// it fires one shell straight at it. The shell bursts as a nuke where it hits: a white flash, a fireball, three
// shock rings and a heavy shake, with damage falling off from the centre.
function detonate(ctx: BattleCtx, p: Proj, x: number, y: number): void {
  const r: number = p.def.params.radius;
  ctx.flash?.(0xffffff, 120);
  ctx.hitStop?.(4);
  ctx.blast(x, y, r, p.def.params.mult, p.wid);
  ctx.fx.flameBlast?.(x, y, r, 40);
  ctx.fx.ring(x, y, r * 0.55, C('c'));
  ctx.fx.ring(x, y, r * 0.8, C('4'));
  ctx.fx.ring(x, y, r, C('3'));
  ctx.fx.sparks(x, y, ['4', '3', 'c'], 14);
  ctx.fx.shake(0.03);
  sfx.quake();
}

function fire(ctx: BattleCtx, p: Proj): void {
  if (p.data.fired) return;
  p.data.fired = true;
  const P = p.def.params;
  const b = p.body;
  const { dx, dy } = aimFrom(ctx, b.position.x, b.position.y, b.velocity.x, b.velocity.y);
  let x = b.position.x + dx * P.muzzle;
  let y = b.position.y + dy * P.muzzle;
  ctx.fx.flameBlast?.(x, y, 8, 10);
  ctx.fx.sparks(x, y, ['4', '3', 'c'], 8);
  sfx.crunch();
  const shell = ctx.fx.image(x, y, 'px').setTint(C('3')).setScale(4, 3).setRotation(Math.atan2(dy, dx)).setDepth(6);
  let steps = 0;
  const actor: Actor = {
    pos: () => ({ x, y }),
    update() {
      steps++;
      x += dx * P.shellSpeed;
      y += dy * P.shellSpeed;
      shell.setPosition(x, y);
      if (steps % 2 === 0) ctx.fx.sparks(x, y, ['3', '4'], 1);
      const hitMonster = ctx.within(x, y, P.shellHit)[0];
      const hitBlock = ctx.blocks().find((e) => !e.dead && Math.abs(e.body.position.x - x) <= e.w / 2 + 2 && Math.abs(e.body.position.y - y) <= e.h / 2 + 2);
      if (hitMonster || hitBlock || y >= ctx.groundAt(x)) {
        detonate(ctx, p, x, Math.min(y, ctx.groundAt(x)));
        return true;
      }
      return steps > P.shellSteps || x < -40 || x > ctx.worldW + 40;
    },
    destroy() {
      shell.destroy();
    },
  };
  ctx.addActor(actor);
  ctx.endProj(p);
}

export const blastTube: WeaponImpl = {
  texture: weaponTexture('w_blast_tube'),
  onAbility: fire,
  onImpact: fire,
};
