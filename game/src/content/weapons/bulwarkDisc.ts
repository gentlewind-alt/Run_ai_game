import Phaser from 'phaser';
import { sfx } from '../../audio/sfx';
import { C } from '../../art/palette';
import { weaponTexture } from '../../art/textures';
import type { BattleCtx, LegendVisual, Proj } from '../../battle/BattleCtx';
import type { ImpactInfo, WeaponImpl } from './types';

interface LightFlight {
  velocity: { x: number; y: number };
  mirrors: [number, number];
  flash: [number, number];
}

function countBounce(ctx: BattleCtx, p: Proj, key: string): boolean {
  const P = p.def.params;
  if (p.data.ended || p.data.pendingFinal || p.data.bounces >= P.maxBounces) return false;
  // Separate surfaces still count; the gap only suppresses another knock on the same contact.
  if (p.data.lastBounceKey === key && ctx.step - p.data.lastBounce < P.bounceGapSteps) return false;
  p.data.lastBounceKey = key;
  p.data.lastBounce = ctx.step;
  p.data.bounces++;
  p.body.proj.mul = p.data.damageMult * P.lightHitMult;
  const b = p.body.position;
  sfx.ping();
  ctx.fx.pingStar?.(b.x, b.y);
  ctx.fx.sparks(b.x, b.y, ['c', '4', 'b'], P.bounceSparkCount);
  ctx.fx.legendWave(b.x, b.y, P.bounceRuneRadius, P.bounceRuneRadius, P.bounceRuneSteps, 0xffd66e, P.bounceRuneWidth);
  if (p.data.bounces === P.maxBounces) p.data.pendingFinal = true;
  return true;
}

function showMirrors(ctx: BattleCtx, p: Proj, light: LightFlight): void {
  const P = p.def.params;
  const sides = light.mirrors.map((x) => {
    const height = ctx.groundAt(x);
    const glow = ctx.fx.image(x, height / 2, 'px').setTint(C('a')).setDisplaySize(P.mirrorGlowWidth, height).setDepth(p.sprite.depth - 1);
    const core = ctx.fx.image(x, height / 2, 'px').setTint(C('b')).setDisplaySize(P.mirrorWidth, height).setDepth(p.sprite.depth - 1);
    const runes: Phaser.GameObjects.Image[] = [];
    for (let i = 1; i <= P.mirrorRuneMarks; i++) {
      const y = height * i / (P.mirrorRuneMarks + 1);
      for (const sign of [-1, 1]) {
        runes.push(ctx.fx.image(x, y, 'px').setTint(C('b')).setDisplaySize(P.mirrorRuneSize, P.mirrorWidth).setRotation(sign * Math.PI / 4).setDepth(p.sprite.depth - 1));
      }
    }
    glow.setAlpha(P.mirrorGlowAlpha);
    core.setAlpha(P.mirrorAlpha);
    runes.forEach((rune) => rune.setAlpha(P.mirrorAlpha));
    return { glow, core, runes };
  });
  let age = 0;
  let fade = 0;
  ctx.addActor({
    update() {
      age++;
      if (p.data.ended || !p.sprite.active) fade++;
      const alpha = 1 - Math.min(1, fade / P.mirrorFadeSteps);
      const pulse = Math.sin(age * Math.PI * 2 / P.mirrorPulseSteps) * P.mirrorPulseAlpha;
      sides.forEach((side, i) => {
        const flash = light.flash[i] / P.mirrorFlashSteps * P.mirrorFlashAlpha;
        side.glow.setAlpha(Phaser.Math.Clamp(P.mirrorGlowAlpha + pulse + flash, 0, 1) * alpha);
        const coreAlpha = Phaser.Math.Clamp(P.mirrorAlpha + pulse + flash, 0, 1) * alpha;
        side.core.setAlpha(coreAlpha);
        side.runes.forEach((rune) => rune.setAlpha(coreAlpha));
        light.flash[i] = Math.max(0, light.flash[i] - 1);
      });
      return fade >= P.mirrorFadeSteps;
    },
    destroy() {
      sides.forEach(({ glow, core, runes }) => {
        glow.destroy();
        core.destroy();
        runes.forEach((rune) => rune.destroy());
      });
    },
  });
}

function shieldBlast(ctx: BattleCtx, p: Proj): void {
  const P = p.def.params;
  const { x, y } = p.body.position;
  ctx.blast(x, y, P.finalRadius, P.finalMult * (p.data.damageMult ?? 1), p.wid);
  ctx.fx.ring(x, y, P.finalRadius, C('4'));
  ctx.fx.shake(P.finalShake);
  ctx.hitStop?.(P.legendHitStopSteps);
  ctx.fx.legendOverlay(0xc9f5ff, P.legendFlashAlpha, P.legendFlashSteps, 'flash');
  ctx.fx.legendWave(x, y, P.finalVisualRadiusX, P.finalVisualRadiusY, P.finalWaveSteps, 0x8feaff, P.finalWaveWidth);
  ctx.fx.legendShards(x, y, P.glassShardCount, P.glassShardSpread, P.glassShardSteps, 0xc5f4ff);
  ctx.fx.legendRuneLink(x, y, x, y, P.domeRuneRadius, P.domeSteps, P.legendRuneMarks, P.legendRuneWidth);
  const dome: LegendVisual = ctx.fx.legendArt('legend_shield_dome', x, y, P.domeSize, P.domeSize).setScale(P.domeStartScale).setAlpha(P.domeAlpha);
  let domeStep = 0;
  ctx.addActor({
    pos: () => ({ x, y }),
    update() {
      domeStep++;
      const f = Math.min(1, domeStep / P.domeSteps);
      const scale = P.domeStartScale + (P.domeScale - P.domeStartScale) * f;
      dome.setScale(scale).setRotation(f * P.domeTurns * Math.PI * 2).setAlpha(P.domeAlpha * (1 - f * P.domeFade));
      return domeStep >= P.domeSteps;
    },
    destroy: () => dome.destroy(),
  });
  ctx.endProj(p);
}

function contactKey(hit?: ImpactInfo, axis?: 'x' | 'y', side?: number): string {
  return hit?.label === 'ground' ? 'ground' : `body:${hit?.bodyId ?? hit?.target?.body.id}:${axis ?? ''}:${side ?? ''}`;
}

export const bulwarkDisc: WeaponImpl = {
  texture: weaponTexture('w_bulwark_disc'),
  onLaunch(ctx, p) {
    p.data.bounces = 0;
    p.data.trail = [];
    p.data.damageMult = 1;
    p.body.proj.mul = 1;
    const P = p.def.params;
    let label = ctx.fx.label(p.body.position.x, p.body.position.y - P.multiplierOffsetY, 'x1.0');
    const glow = ctx.fx.image(p.sprite.x, p.sprite.y, p.sprite.texture.key).setTintFill(0xffffff).setDepth(p.sprite.depth + 1).setAlpha(0);
    let growthUntil = 0;
    const off = ctx.events.on('kill', ({ target, weaponId }) => {
      if (p.data.ended || !p.sprite.active || target.kind !== 'block' || weaponId !== p.wid) return;
      const previous = p.data.damageMult as number;
      p.data.damageMult = Math.min(P.maxDamageMult, previous * P.blockBreakMult);
      p.body.proj.mul = p.data.damageMult * (p.data.bounces > 0 ? P.lightHitMult : 1);
      if (p.data.damageMult <= previous) return;
      growthUntil = ctx.step + P.growthPulseSteps;
      label.destroy();
      label = ctx.fx.label(p.body.position.x, p.body.position.y - P.multiplierOffsetY, `x${p.data.damageMult.toFixed(1)}`);
    });
    ctx.addActor({
      update() {
        if (p.data.ended || !p.sprite.active) return true;
        label.setPosition(p.body.position.x, p.body.position.y - P.multiplierOffsetY);
        glow.setPosition(p.sprite.x, p.sprite.y).setRotation(p.sprite.rotation).setScale(p.sprite.scaleX, p.sprite.scaleY);
        glow.setAlpha(Math.max(0, (growthUntil - ctx.step) / P.growthPulseSteps));
        return false;
      },
      destroy() { off(); label.destroy(); glow.destroy(); },
    });
  },
  onAbility(ctx, p) {
    // Tap: redirects once toward the nearest monster.
    const P = p.def.params;
    const nearest = ctx.nearestMonsters(p.body.position.x, p.body.position.y, 1)[0];
    if (!nearest) return;
    const dx = nearest.body.position.x - p.body.position.x;
    const dy = nearest.body.position.y - p.body.position.y;
    const d = Math.hypot(dx, dy);
    if (d < P.directionEpsilon) return;
    const light = p.data.light as LightFlight | undefined;
    const sp = light ? P.lightSpeed : P.redirectSpeed;
    const velocity = { x: (dx / d) * sp, y: (dy / d) * sp };
    if (light) light.velocity = velocity;
    else ctx.M.Body.setVelocity(p.body, velocity);
    ctx.fx.legendRuneLink(p.body.position.x, p.body.position.y, nearest.body.position.x, nearest.body.position.y, P.legendRuneRadius, P.legendRuneSteps, P.legendRuneMarks, P.legendRuneWidth);
    ctx.fx.ring(p.body.position.x, p.body.position.y, P.redirectRingRadius, C('b'));
    sfx.saw();
  },
  onImpact(ctx, p, hit) {
    const P = p.def.params;
    if (p.data.ended || p.data.pendingFinal) return;
    const light = p.data.light as LightFlight | undefined;
    const n = hit?.normal ?? (hit ? { x: p.body.position.x - hit.x, y: p.body.position.y - hit.y } : { x: 0, y: -1 });
    const axis = hit?.label === 'ground' || Math.abs(n.y) > Math.abs(n.x) * P.verticalContactRatio ? 'y' : 'x';
    if (!light) {
      // Cache the incoming direction before the solver changes it. Launch physics lasts until this knock.
      if (p.data.firstKnock || (hit && hit.rel < P.minBounceSpeed)) return;
      if (!countBounce(ctx, p, contactKey(hit, axis, Math.sign(n[axis])))) return;
      p.data.firstKnock = { x: hit?.x ?? p.body.position.x, vx: p.body.velocity.x, vy: p.body.velocity.y };
      return;
    }
    if (light.velocity[axis] * n[axis] >= 0) return;
    const mirror = hit?.label === 'wall' ? (n.x > 0 ? 0 : 1) : undefined;
    const key = mirror === undefined ? contactKey(hit, axis, Math.sign(n[axis])) : `mirror:${mirror}`;
    const counted = countBounce(ctx, p, key);
    light.velocity[axis] = -light.velocity[axis];
    if (counted && mirror !== undefined) light.flash[mirror] = P.mirrorFlashSteps;
  },
  onUpdate(ctx, p) {
    const P = p.def.params;
    let light = p.data.light as LightFlight | undefined;
    const first = p.data.firstKnock as { x: number; vx: number; vy: number } | undefined;
    if (first) {
      const angle = Phaser.Math.Clamp(Math.atan2(Math.abs(first.vy), Math.abs(first.vx)), Phaser.Math.DegToRad(P.lightMinAngleDeg), Phaser.Math.DegToRad(P.lightMaxAngleDeg));
      light = {
        velocity: {
          x: (Math.sign(-first.vx) || -1) * Math.cos(angle) * P.lightSpeed,
          y: (Math.sign(first.vy) || -1) * Math.sin(angle) * P.lightSpeed,
        },
        mirrors: [Phaser.Math.Clamp(first.x - P.mirrorSpan / 2, 0, ctx.worldW), Phaser.Math.Clamp(first.x + P.mirrorSpan / 2, 0, ctx.worldW)],
        flash: [0, 0],
      };
      p.data.light = light;
      p.data.maxFlightSteps = p.steps + P.lightMaxSteps;
      p.data.firstKnock = undefined;
      ctx.setGravity(p.body, 0);
      p.body.frictionAir = 0;
      p.body.friction = 0;
      p.body.frictionStatic = 0;
      p.body.restitution = 1;
      ctx.M.Sleeping.set(p.body, false);
      showMirrors(ctx, p, light);
    }
    if (p.data.pendingFinal) {
      shieldBlast(ctx, p);
      return;
    }
    if (light) {
      const flight = light;
      const radius = p.def.physics.radius;
      const pos = { x: p.body.position.x, y: p.body.position.y };
      const reflect = (axis: 'x' | 'y', boundary: number, key: string, mirror?: number): void => {
        const counted = countBounce(ctx, p, key);
        pos[axis] = boundary * 2 - pos[axis];
        flight.velocity[axis] = -flight.velocity[axis];
        if (counted && mirror !== undefined) flight.flash[mirror] = P.mirrorFlashSteps;
      };
      if (pos.x <= light.mirrors[0] + radius && light.velocity.x < 0) reflect('x', light.mirrors[0] + radius, 'mirror:0', 0);
      else if (pos.x >= light.mirrors[1] - radius && light.velocity.x > 0) reflect('x', light.mirrors[1] - radius, 'mirror:1', 1);
      if (!p.data.pendingFinal) {
        const ground = ctx.groundAt(pos.x) - radius;
        if (pos.y <= radius && light.velocity.y < 0) reflect('y', radius, 'top');
        else if (pos.y >= ground && light.velocity.y > 0) reflect('y', ground, 'ground');
      }
      // The solver may leave a little penetration after a physical ground/wall contact already reflected.
      pos.x = Phaser.Math.Clamp(pos.x, light.mirrors[0] + radius, light.mirrors[1] - radius);
      pos.y = Phaser.Math.Clamp(pos.y, radius, ctx.groundAt(pos.x) - radius);
      ctx.M.Body.setPosition(p.body, pos);
      if (p.data.pendingFinal) {
        shieldBlast(ctx, p);
        return;
      }
      // Restore the intended beam velocity after every solver step, including collision steps.
      ctx.M.Body.setVelocity(p.body, light.velocity);
    }
    // Record trail positions for dithered ghost copies.
    const trail = p.data.trail as { x: number; y: number }[];
    if (trail) {
      trail.unshift({ x: p.body.position.x, y: p.body.position.y });
      if (trail.length > P.trailSteps) trail.pop();
    }
  },
  drawFx(_ctx, p, g) {
    const P = p.def.params;
    // Dithered ghost trail behind disc.
    const trail = p.data.trail as { x: number; y: number }[] | undefined;
    if (trail && trail.length > 1) {
      trail.slice(1, P.trailGhostCount + 1).forEach((pt, idx) => {
        const alpha = P.trailAlpha - idx * P.trailFade;
        g.lineStyle(P.trailWidth, C('b'), alpha).strokeCircle(pt.x, pt.y, P.trailRadius - idx * P.trailShrink);
        g.lineStyle(1, C('c'), alpha * P.trailCoreAlpha).strokeCircle(pt.x, pt.y, P.trailCoreRadius - idx);
      });
    }
    // Bounce counter pips floating above disc.
    const bCount = (p.data.bounces as number) ?? 0;
    if (bCount > 0) {
      const bx = p.body.position.x;
      const by = p.body.position.y - P.pipOffsetY;
      const totalPips = Math.min(bCount, P.maxBounces);
      const startX = bx - ((totalPips - 1) * P.pipSpacing) / 2;
      for (let i = 0; i < totalPips; i++) {
        const px = startX + i * P.pipSpacing;
        g.fillStyle(C('0'), 1).fillRect(px - 1, by - 1, P.pipBorderSize, P.pipBorderSize);
        g.fillStyle(C('4'), 1).fillRect(px, by, P.pipSize, P.pipSize);
      }
    }
  },
};
