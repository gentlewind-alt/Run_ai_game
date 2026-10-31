import { C } from '../../art/palette';
import type { ArtifactImpl } from './types';

const num = (v: unknown): number => v as number;

/** Gale Eye: the ability also releases a wind burst that knocks monsters and light blocks back. */
const galeEye: ArtifactImpl = {
  install(ctx, p) {
    return ctx.events.on('shot:ability', (e) => {
      ctx.fx.ring(e.x, e.y, num(p.radius), C('b'));
      ctx.fx.sparks(e.x, e.y, ['b', 'c'], 8);
      ctx.push(e.x, e.y, num(p.radius), num(p.strength));
    });
  },
};

/** Echo Stone: a ghost copy of the shot follows a moment behind and deals reduced damage. */
const echoStone: ArtifactImpl = {
  install(ctx, p) {
    return ctx.events.on('shot:launched', (e) => {
      let wait = num(p.delaySteps);
      ctx.addActor({
        update() {
          wait--;
          if (wait > 0) return false;
          ctx.spawnPellet({ x: e.x, y: e.y, vx: e.vx, vy: e.vy, radius: e.radius, density: e.density, mul: num(p.mult), wid: e.weaponId, color: 'b', gravity: e.gravity });
          ctx.fx.ring(e.x, e.y, 10, C('b'));
          return true;
        },
        destroy() { /* nothing to clean up */ },
      });
    });
  },
};

/** Lodestone Bracer: kills close to the flying weapon drop extra coins. */
const lodestoneBracer: ArtifactImpl = {
  install(ctx, p) {
    return ctx.events.on('kill', (e) => {
      const at = ctx.shotPos();
      if (!at || e.target.kind !== 'monster') return;
      if (Math.hypot(at.x - e.x, at.y - e.y) <= num(p.radius)) {
        ctx.addCoins(Math.round((ctx.tune.coins[e.target.type] ?? ctx.tune.coins.monster) * num(p.bonus)));
        ctx.fx.word(e.x, e.y - 22, 'magnet!');
      }
    });
  },
};

/** Analyst Lens: a longer aim preview, and every monster shows its element and HP from the start. */
const analystLens: ArtifactImpl = {
  install(ctx, p) {
    const base = ctx.mods.previewMult;
    ctx.mods.previewMult = base * num(p.previewMult);
    for (const m of ctx.monsters()) ctx.reveal(m);
    return () => { ctx.mods.previewMult = base; };
  },
};

/** Stormcaller Torc: every Nth hit calls a lightning bolt on the target. */
const stormcallerTorc: ArtifactImpl = {
  install(ctx, p) {
    let hits = 0;
    let striking = false;
    return ctx.events.on('hit', (e) => {
      if (striking || e.quiet) return;
      hits++;
      if (hits % num(p.everyHits) !== 0 || e.target.dead) return;
      striking = true;
      ctx.fx.bolt(e.x, e.y);
      ctx.directHit(e.target, 'w_ashwood_staff', num(p.mult), e.x, e.y, false);
      striking = false;
    });
  },
};

/** Gambler's Charm: more coins, and one hit in ten crits for extra damage and coins. */
const gamblersCharm: ArtifactImpl = {
  install(ctx, p) {
    ctx.mods.coinMult = num(p.coinMult);
    let busy = false;
    const off = ctx.events.on('hit', (e) => {
      if (busy || e.quiet || e.target.dead || ctx.rng.next() >= num(p.critChance)) return;
      busy = true;
      ctx.damage(e.target, e.amount * (num(p.critMult) - 1), e.x, e.y, { strong: false, tag: 'weak' });
      ctx.addCoins(num(p.critCoins));
      ctx.fx.word(e.x, e.y - 18, 'crit!');
      busy = false;
    });
    return () => { off(); ctx.mods.coinMult = 1; };
  },
};

/** Behaviour per artifact id in content.json. */
export const ARTIFACTS: Record<string, ArtifactImpl> = {
  r_gale_eye: galeEye,
  r_echo_stone: echoStone,
  r_lodestone_bracer: lodestoneBracer,
  r_analyst_lens: analystLens,
  r_stormcaller_torc: stormcallerTorc,
  r_gamblers_charm: gamblersCharm,
};
