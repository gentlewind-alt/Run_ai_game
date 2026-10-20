// Read-only view of a battle for scripted tests (the fuller window.__mm API arrives with card S2-04).
import type { BattleState } from '../battle/state';

export function snapshot(b: BattleState): {
  state: string; score: number; coins: number; chain: number; escaped: number; shotIdx: number; projSteps: number;
  ents: { type: string; kind: string; dead: boolean; hp: number; x: number; y: number }[];
} {
  return {
    state: b.state, score: b.score, coins: b.coins, chain: b.chain, escaped: b.escaped, shotIdx: b.shotIdx, projSteps: b.proj ? b.proj.steps : -1,
    ents: b.ents.map((e) => ({ type: e.type, kind: e.kind, dead: e.dead, hp: e.hp, x: e.body.position.x, y: e.body.position.y })),
  };
}
