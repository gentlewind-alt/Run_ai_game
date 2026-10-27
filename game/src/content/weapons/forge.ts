import { C } from '../../art/palette';
import { weaponTexture } from '../../art/textures';
import { sfx } from '../../audio/sfx';
import { data } from '../../data/load';
import type { WeaponDef } from '../../data/types';
import type { BattleCtx, Ent, Proj } from '../../battle/BattleCtx';
import type { WeaponImpl } from './types';

type Ability = (ctx: BattleCtx, p: Proj) => void;
const tint = (p: Proj): number => C(p.def.params.auraColor.toString(32));
const power = (p: Proj): number => p.def.params.hitMult * (p.data.forgeMult ?? 1);
const reach = (p: Proj): number => p.def.params.range * (p.def.params.rangeMult ?? 1);
const copies = (p: Proj): number => Math.min(data.forge.limits.maxCopies, p.def.params.copies);
const distance = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);
const targets = (ctx: BattleCtx): Ent[] => [...ctx.monsters(), ...ctx.blocks()];
function center(ctx: BattleCtx, p: Proj): { x: number; y: number } {
  const at = p.body.position;
  const target = ctx.nearestMonsters(at.x, at.y, 1)[0];
  return target && distance(at, target.body.position) <= reach(p) ? { ...target.body.position } : { ...at };
}
function image(ctx: BattleCtx, p: Proj, x: number, y: number) {
  return ctx.fx.image(x, y, p.data.forgeTexture).setScale(p.data.forgeScale).setDepth(6);
}
function pellet(ctx: BattleCtx, p: Proj, x: number, y: number, vx: number, vy: number, gravity = 1): void {
  ctx.spawnPellet({ x, y, vx, vy, gravity, radius: p.def.physics.radius, density: p.def.physics.density,
    mul: power(p), wid: p.wid, color: p.def.params.auraColor.toString(32),
    texture: p.data.forgeTexture, scale: p.data.forgeScale });
}
function hitCircle(ctx: BattleCtx, p: Proj, at: { x: number; y: number }, radius: number, hit?: Set<Ent>): void {
  for (const e of targets(ctx)) {
    if (hit?.has(e) || distance(at, e.body.position) > radius + Math.min(e.w, e.h) / 2) continue;
    hit?.add(e);
    ctx.directHit(e, p.wid, power(p), e.body.position.x, e.body.position.y, false);
  }
}

const dance: Ability = (ctx, p) => {
  const at = center(ctx, p);
  const P = p.def.params;
  const blades = Array.from({ length: copies(p) }, () => image(ctx, p, at.x, at.y));
  let t = 0;
  ctx.addActor({ pos: () => at,
    update() {
      t++;
      blades.forEach((blade, i) => {
        const angle = t * Math.PI * 2 / P.durationSteps + i * Math.PI * 2 / blades.length;
        blade.setPosition(at.x + Math.cos(angle) * P.radius * (P.rangeMult ?? 1), at.y + Math.sin(angle) * P.radius * (P.rangeMult ?? 1)).setRotation(angle);
      });
      if (t % P.intervalSteps === 0) hitCircle(ctx, p, at, P.radius * (P.rangeMult ?? 1));
      if (t < P.durationSteps) return false;
      blades.forEach((blade, i) => {
        const angle = i * Math.PI * 2 / blades.length;
        pellet(ctx, p, blade.x, blade.y, Math.cos(angle) * P.copySpeed, Math.sin(angle) * P.copySpeed);
      });
      return true;
    },
    destroy() { blades.forEach((blade) => blade.destroy()); },
  });
  ctx.endProj(p);
};
const rain: Ability = (ctx, p) => {
  const at = center(ctx, p);
  const P = p.def.params;
  const n = copies(p);
  for (let i = 0; i < n; i++) {
    const x = Math.max(8, Math.min(ctx.worldW - 8, at.x + (i / Math.max(1, n - 1) - 0.5) * P.spread * (P.rangeMult ?? 1)));
    pellet(ctx, p, x, Math.min(-12, at.y - reach(p)), 0, P.copySpeed);
  }
  ctx.endProj(p);
};
const burst: Ability = (ctx, p) => {
  const at = { ...p.body.position };
  ctx.blast(at.x, at.y, p.def.params.radius * (p.def.params.rangeMult ?? 1), power(p), p.wid);
  ctx.endProj(p);
};
const clone: Ability = (ctx, p) => {
  const P = p.def.params;
  const angle = Math.atan2(p.body.velocity.y, p.body.velocity.x);
  const n = copies(p);
  for (let i = 0; i < n; i++) {
    const a = angle + (i - (n - 1) / 2) * P.spread;
    pellet(ctx, p, p.body.position.x, p.body.position.y, Math.cos(a) * P.copySpeed * (P.rangeMult ?? 1), Math.sin(a) * P.copySpeed);
  }
  ctx.endProj(p);
};
const strike: Ability = (ctx, p) => {
  const at = center(ctx, p);
  const from = p.body.position;
  const dx = at.x - from.x;
  const dy = at.y - from.y;
  const d = Math.hypot(dx, dy);
  ctx.M.Body.setVelocity(p.body, { x: d > 1 ? dx / d * p.def.params.copySpeed : 0, y: d > 1 ? dy / d * p.def.params.copySpeed : p.def.params.copySpeed });
  p.body.proj.mul = power(p);
  p.data.striking = true;
};
function sweep(ctx: BattleCtx, p: Proj, isWhip: boolean): void {
  const at = { ...p.body.position };
  const P = p.def.params;
  const blades = Array.from({ length: copies(p) }, () => image(ctx, p, at.x, at.y));
  const link = ctx.fx.image(at.x, at.y, 'px').setTint(tint(p)).setOrigin(0, 0.5).setDepth(5);
  let t = 0;
  let hit = new Set<Ent>();
  ctx.addActor({ pos: () => at,
    update() {
      t++;
      const angle = -Math.PI / 2 + t / P.durationSteps * Math.PI;
      const length = reach(p);
      blades.forEach((blade, i) => {
        const r = isWhip ? length * (i + 1) / blades.length : length;
        const a = isWhip ? angle : angle - i * Math.PI / (blades.length * 2);
        blade.setPosition(at.x + Math.cos(a) * r, at.y + Math.sin(a) * r).setRotation(a + Math.PI / 2);
        hitCircle(ctx, p, blade, p.def.physics.radius * 2, hit);
      });
      link.setDisplaySize(length, 2).setRotation(angle);
      if (isWhip && t % P.intervalSteps === 0) hit = new Set();
      return t >= P.durationSteps;
    }, destroy() { blades.forEach((blade) => blade.destroy()); link.destroy(); },
  });
  ctx.endProj(p);
}
const spirit: Ability = (ctx, p) => {
  const from = { ...p.body.position };
  const at = center(ctx, p);
  const angle = distance(from, at) > 1 ? Math.atan2(at.y - from.y, at.x - from.x) : 0;
  const blade = image(ctx, p, from.x, from.y).setAlpha(0.65);
  const hit = new Set<Ent>();
  let t = 0;
  ctx.addActor({ pos: () => ({ x: blade.x, y: blade.y }),
    update() {
      t++;
      const travel = reach(p) * t / p.def.params.durationSteps;
      blade.setPosition(from.x + Math.cos(angle) * travel, from.y + Math.sin(angle) * travel).setRotation(angle + Math.PI / 2);
      hitCircle(ctx, p, blade, p.def.physics.radius * 2, hit);
      return t >= p.def.params.durationSteps;
    }, destroy() { blade.destroy(); },
  });
  ctx.endProj(p);
};
const phantom: Ability = (ctx, p) => {
  const at = p.body.position;
  const victims = ctx.nearestMonsters(at.x, at.y, copies(p)).filter((e) => distance(at, e.body.position) <= reach(p));
  const blades = victims.map((e) => image(ctx, p, e.body.position.x, e.body.position.y - 30).setAlpha(0.6));
  let t = 0;
  ctx.addActor({ pos: () => at,
    update() {
      t++;
      blades.forEach((blade, i) => {
        const e = victims[i];
        blade.setPosition(e.body.position.x, e.body.position.y - 30 * (1 - t / p.def.params.durationSteps));
      });
      if (t < p.def.params.durationSteps) return false;
      victims.forEach((e) => { if (!e.dead) ctx.directHit(e, p.wid, power(p), e.body.position.x, e.body.position.y); });
      return true;
    }, destroy() { blades.forEach((blade) => blade.destroy()); },
  });
  ctx.endProj(p);
};

const ABILITIES: Record<string, Ability> = { dance, rain, burst, whip: (c, p) => sweep(c, p, true), clone, strike, slash: (c, p) => sweep(c, p, false), spirit, phantom };

const cast = (p: Proj): void => { sfx.sample(`forge_${p.def.forge!.abilityId}`); };

export function forgeWeapon(def: WeaponDef): WeaponImpl {
  return {
    texture: weaponTexture(def.id),
    onLaunch(_ctx, p) { p.data.forgeTexture = p.sprite.texture.key; p.data.forgeScale = p.sprite.scaleX; },
    onAbility(ctx, p) {
      if (p.data.forgeActivated) return;
      p.data.forgeActivated = true;
      cast(p);
      ABILITIES[p.def.forge!.abilityId](ctx, p);
    },
    onImpact(ctx, p, hit) {
      if (!p.data.forgeActivated) {
        p.data.forgeActivated = true;
        cast(p);
        ABILITIES[p.def.forge!.abilityId](ctx, p);
      }
      if (p.data.striking && hit?.target && !p.data.strikeDone) {
        p.data.strikeDone = true;
        ctx.directHit(hit.target, p.wid, power(p), hit.x, hit.y);
        p.body.proj.mul = 0;
        ctx.endProj(p);
      }
    },
    drawFx(_ctx, p, g) {
      g.lineStyle(1, tint(p), 0.55).strokeCircle(p.body.position.x, p.body.position.y, p.def.physics.radius + 4);
    },
  };
}
