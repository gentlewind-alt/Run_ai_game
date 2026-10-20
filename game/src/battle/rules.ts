// Win and lose: all monsters dead, out of shots, too many runners escaped. Only this module moves the battle to won/lost.
import { sfx } from '../audio/sfx';
import { atHome } from './camera';
import { groundAt } from './terrain';
import { discard } from './damage';
import { popWord } from './fx';
import { finalize } from './score';
import { kindFor } from '../content/levelKinds';
import { loadNext } from './sling';
import type { Ent } from './BattleCtx';
import type { BattleState } from './state';

/** A runner reached the exit door. */
export function escape(b: BattleState, e: Ent): void {
  discard(b, e);
  b.escaped++;
  sfx.lose();
  popWord(b, b.level.exit!.x - 10, groundAt(b, b.level.exit!.x) - 30, 'it got away!');
  const limit = b.level.escapeLimit ?? 0;
  b.ui.setEscaped(b.escaped, limit);
  b.events.emit('runner:escaped', { count: b.escaped, limit });
}

/** Once per gameplay step, after the projectile and actors have updated. */
export function step(b: BattleState): void {
  const F = b.tune.flow;
  const alive = b.ents.filter((e) => !e.dead);
  const monsters = alive.filter((e) => e.kind === 'monster').length;
  if (b.state !== 'won' && b.state !== 'lost' && b.escaped > (b.level.escapeLimit ?? 99)) {
    finish(b, false, 'escaped');
    return;
  }
  if (b.state === 'flying' || b.state === 'settling' || b.state === 'ready' || b.state === 'loading') {
    if (monsters === 0) {
      b.endTimer++;
      if (b.endTimer > F.winDelaySteps) finish(b, true);
      return;
    }
  }

  if (b.state === 'settling') {
    b.settleSteps++;
    const calm = alive.every((e) => e.body.speed < F.settleCalmSpeed || e.params.selfMoving === 1);
    if (((calm && b.settleSteps > F.settleMinSteps) || b.settleSteps > F.settleMaxSteps) && atHome(b)) {
      if (b.shotIdx < b.loadout.length) loadNext(b);
      else finish(b, false, 'shots');
    }
  }
}

export function finish(b: BattleState, won: boolean, why: 'shots' | 'escaped' = 'shots'): void {
  if (b.state === 'won' || b.state === 'lost') return;
  b.state = won ? 'won' : 'lost';
  won ? sfx.win() : sfx.lose();
  const { stars, shotsLeft } = finalize(b, won);
  if (won) {
    kindFor(b.level.kind)?.onWin?.(b.ctx, b.level);
    b.events.emit('level:won', { levelId: b.levelId, stars, score: b.score, coins: b.coins, shotsLeft });
  } else {
    b.events.emit('level:lost', { levelId: b.levelId, reason: why, score: b.score, coins: b.coins });
  }
}
