// Equipped artifacts: installed when the level starts, they subscribe to events and may scale weapon damage.
import { ARTIFACTS } from '../content/artifacts';
import type { Hit } from '../content/artifacts/types';
import { owns, profile } from '../core/profile';
import { data } from '../data/load';
import type { Params } from '../data/types';
import type { BattleState } from './state';

export function installArtifacts(b: BattleState): void {
  for (const id of profile.equipped.artifacts) {
    const def = data.content.artifacts.find((a) => a.id === id);
    const impl = ARTIFACTS[id];
    if (!def || !impl || !owns('artifacts', id)) continue;
    const params = (def.params ?? {}) as Params;
    b.artifacts.push({ id, impl, params, off: impl.install(b.ctx, params) });
  }
}

/** Product of every installed artifact's damage modifier for this hit. */
export function artifactMult(b: BattleState, hit: Hit): number {
  let m = 1;
  for (const a of b.artifacts) m *= a.impl.modifyDamage?.(hit, a.params) ?? 1;
  return m;
}
