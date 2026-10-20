import { C } from '../../art/palette';
import type { BattleCtx, Ent } from '../../battle/BattleCtx';
import type { Params } from '../../data/types';

export interface ConsumableImpl {
  /** true = the player taps a spot (or a monster) after pressing the icon. */
  targeted: boolean;
  /** For a monster target: how close the tap has to be, in world px. */
  pickRadius?(params: Params): number;
  use(ctx: BattleCtx, params: Params, target?: { x: number; y: number; ent?: Ent }): void;
}

const num = (v: unknown): number => v as number;

/** Jury-Rigged Bomb: a big blast where you tap. One in five fizzles, on purpose. */
const bomb: ConsumableImpl = {
  targeted: true,
  use(ctx, p, t) {
    if (!t) return;
    if (ctx.rng.next() < num(p.fizzleChance)) {
      ctx.fx.word(t.x, t.y - 10, 'pfft!');
      ctx.fx.sparks(t.x, t.y, ['e', 'd', 'k'], 8);
      return;
    }
    ctx.explode(t.x, t.y, num(p.radius), num(p.damage), null, null);
  },
};

/** Prime Serum: the next shots hit harder. */
const serum: ConsumableImpl = {
  targeted: false,
  use(ctx, p) {
    ctx.mods.serumShots += num(p.shots);
    ctx.mods.serumMult = num(p.mult);
    ctx.fx.word(ctx.sling.x, ctx.sling.y - 30, 'primed!');
    ctx.fx.ring(ctx.sling.x, ctx.sling.y, 16, C('5'));
  },
};

/** Mindflash: stuns every monster for a moment. Stops runners mid-sprint. */
const mindflash: ConsumableImpl = {
  targeted: false,
  use(ctx, p) {
    for (const m of ctx.monsters()) {
      ctx.addStatus(m, 'stun', num(p.steps));
      ctx.fx.ring(m.body.position.x, m.body.position.y, 12, C('c'));
    }
    ctx.fx.shake(0.008);
  },
};

/** Chainward Talisman: chains one monster in place. */
const chainward: ConsumableImpl = {
  targeted: true,
  pickRadius: (p) => num(p.pickRadius),
  use(ctx, p, t) {
    const e = t?.ent;
    if (!e) return;
    ctx.addStatus(e, 'chain', e.def?.boss ? num(p.bossSteps) : num(p.steps));
    ctx.fx.ring(e.body.position.x, e.body.position.y, 14, C('d'));
    ctx.fx.word(e.body.position.x, e.body.position.y - 18, 'chained!');
  },
};

/** Behaviour per consumable id in content.json. */
export const CONSUMABLES: Record<string, ConsumableImpl> = {
  c_jury_rigged_bomb: bomb,
  c_prime_serum: serum,
  c_mindflash: mindflash,
  c_chainward_talisman: chainward,
};
