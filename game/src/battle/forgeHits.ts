import { data } from '../data/load';
import { damage } from './damage';
import { battleWeapon } from './weapon';
import type { DamageOpts, Ent } from './BattleCtx';
import type { BattleState } from './state';

/** All crafted attacks share one trait gateway; secondary poison/lightning never re-enter it. */
export function forgeHit(b: BattleState, t: Ent, wid: string, amount: number, x: number, y: number, opts: DamageOpts): void {
  if (t.dead || b.closing) return;
  const w = battleWeapon(b, wid);
  if (!w.forge) { damage(b, t, amount, x, y, opts); return; }
  const P = w.params;
  amount *= P.damageMult ?? 1;
  if (P.critChance && b.rng.next() < P.critChance) {
    amount *= P.critMult;
    b.ctx.fx.word(x, y - 16, 'CRIT!');
  }
  if (t.kind === 'monster') {
    const hits = (t.params.forgeHits ??= {}) as Record<string, number>;
    if (b.steps - (hits[wid] ?? -Infinity) >= data.forge.limits.traitCooldownSteps) {
      hits[wid] = b.steps;
      if (P.shieldBreak) {
        t.shield = 0;
        t.shieldSprite?.destroy();
        t.shieldSprite = undefined;
        t.shieldedBy = undefined;
        t.status.shieldBreak = data.forge.limits.shieldBreakSteps;
      }
      if (t.shield <= 0) {
        if (P.curseSteps) t.status.curse = P.curseSteps;
        if (P.poisonSteps) { t.status.poison = P.poisonSteps; t.params.poisonWeaponId = wid; }
        if (P.healthFraction) amount += t.maxHp * P.healthFraction;
        if (P.zapTargets) {
          const others = b.ctx.nearestMonsters(x, y, P.zapTargets + 1).filter((e) => e !== t && Math.hypot(e.body.position.x - x, e.body.position.y - y) <= P.zapRange).slice(0, P.zapTargets);
          for (const e of others) {
            b.ctx.fx.bolt(e.body.position.x, e.body.position.y);
            damage(b, e, amount * P.zapMult, e.body.position.x, e.body.position.y, { strong: false, tag: 'norm', quiet: true, weaponId: wid });
          }
        }
      }
    }
  }
  damage(b, t, amount, x, y, { ...opts, weaponId: wid });
}
