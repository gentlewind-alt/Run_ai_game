import { sfx } from '../../audio/sfx';
import { C } from '../../art/palette';
import { weaponTexture } from '../../art/textures';
import type { LegendVisual } from '../../battle/BattleCtx';
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
    ctx.fx.legendOverlay(0x180d12, P.legendDimAlpha, P.legendDimSteps, 'dim');
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
    ctx.hitStop?.(P.legendHitStopSteps);
    ctx.fx.legendOverlay(0xffffff, P.legendFlashAlpha, P.legendFlashSteps, 'flash');
    const rangeX = P.quakeRangeX ?? 90;
    ctx.fx.quakeRings?.(ix, iy, rangeX);
    ctx.fx.sparks(ix, iy, ['6', '5', 'd', 'e', 'c'], 24);

    const comet = ctx.fx.legendArt('legend_comet', ix - P.cometStartOffset, iy - P.cometStartOffset, P.cometSize, P.cometSize).setScale(P.cometScale);
    let cometStep = 0;
    ctx.addActor({
      pos: () => ({ x: ix, y: iy }),
      update() {
        cometStep++;
        const f = Math.min(1, cometStep / P.cometSteps);
        const eased = f * f * (3 - 2 * f);
        const cx = ix - P.cometStartOffset * (1 - eased);
        const cy = iy - P.cometStartOffset * (1 - eased);
        comet.setPosition(cx, cy).setRotation(Math.PI / 4);
        ctx.fx.sparks(cx - 8, cy - 8, ['3', '4', 't'], P.cometTrailSparks);
        if (cometStep < P.cometSteps) return false;
        ctx.fx.legendWave(ix, iy, P.quakeVisualRadiusX, P.quakeVisualRadiusY, P.quakeVisualSteps, 0xffe8ca, P.quakeVisualWidth);
        comet.destroy();
        return true;
      },
      destroy: () => comet.destroy(),
    });

    const hopVy = P.quakeHopVy ?? -4.5;
    const dmgMult = P.quakeDamageMult ?? 0.9;
    const stunSteps = P.quakeStunSteps ?? 40; // 40 steps stun

    // Blocks within +-90 px along the ground hop and take damage (does NOT launch debris into the sky)
    const blocks = ctx.blocks().filter((b) => !b.dead && Math.abs(b.body.position.x - ix) <= rangeX);
    for (const b of blocks) {
      ctx.M.Body.setVelocity(b.body, { x: b.body.velocity.x * 0.5, y: hopVy });
      ctx.damage(b, p.def.baseDamage * dmgMult, b.body.position.x, b.body.position.y, { strong: false, tag: 'norm', weaponId: p.wid });
    }

    // Monsters in the wave are knocked flat and stunned 40 steps and take damage
    const monsters = ctx.monsters().filter((m) => !m.dead && Math.abs(m.body.position.x - ix) <= rangeX);
    for (const m of monsters) {
      ctx.damage(m, p.def.baseDamage * dmgMult, m.body.position.x, m.body.position.y, { strong: false, tag: 'norm', weaponId: p.wid });
      ctx.addStatus(m, 'stun', stunSteps);
      const dir = m.body.position.x >= ix ? 1 : -1;
      ctx.M.Body.setVelocity(m.body, { x: dir * 3.0, y: -2.5 });
      ctx.M.Body.setAngle(m.body, dir * Math.PI / 2);
    }

    // Rising spikes: rock spears burst from the ground one after another in the direction of the throw
    let k = 0;
    let t = 0;
    const spikes: { art: LegendVisual; x: number; groundY: number; age: number }[] = [];
    ctx.addActor({
      pos: () => ({ x: ix, y: iy }),
      update() {
        t++;
        if (k < P.visualSpikeCount && t % P.spikeEvery === 0) {
          k++;
          const sx = ix + k * P.spikeGap;
          const sy = ctx.groundAt(sx);
          if (k <= P.spikes) {
            ctx.blast(sx, sy - 6, P.spikeRadius, P.spikeMult, p.wid);
            ctx.push(sx, sy - 6, P.spikeRadius * 1.5, P.spikePush);
          }
          const art = ctx.fx.legendArt('legend_rock_spike', sx, sy + P.spikeArtHeight / 2, P.spikeArtWidth, P.spikeArtHeight).setScale(P.spikeArtScale);
          spikes.push({ art, x: sx, groundY: sy, age: 0 });
          ctx.fx.sparks(sx, sy - 4, ['6', '5', 'd'], 5);
          ctx.fx.ring(sx, sy, P.spikeRadius, C('6'));
        }
        for (const spike of spikes) {
          spike.age++;
          const rise = Math.min(1, spike.age / P.spikeRiseSteps);
          spike.art.setPosition(spike.x, spike.groundY + P.spikeArtHeight / 2 - rise * P.spikeArtHeight);
          if (spike.age > P.spikeHoldSteps) spike.art.setAlpha(Math.max(0, 1 - (spike.age - P.spikeHoldSteps) / P.spikeFadeSteps));
        }
        return k >= P.visualSpikeCount && spikes.every((spike) => spike.age >= P.spikeHoldSteps + P.spikeFadeSteps);
      },
      destroy() { for (const spike of spikes) spike.art.destroy(); },
    });
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
