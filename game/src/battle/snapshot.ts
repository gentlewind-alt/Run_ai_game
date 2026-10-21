import type { BattleState } from './state';

export interface BattleView {
  state: string;
  shotsLeft: number;
  monsters: number;
  blocks: number;
  score: number;
  coins: number;
  chain: number;
  escaped: number;
  steps: number;
  won: boolean;
  lost: boolean;
  projSteps: number;
  ents?: { type: string; kind: string; dead: boolean; hp: number; x: number; y: number }[];
}

export function snapshot(b: BattleState): BattleView {
  const alive = b.ents.filter((e) => !e.dead);
  return {
    state: b.state,
    shotsLeft: b.loadout.length - b.shotIdx,
    monsters: alive.filter((e) => e.kind === 'monster').length,
    blocks: alive.filter((e) => e.kind === 'block').length,
    score: b.score,
    coins: b.coins,
    chain: b.chain,
    escaped: b.escaped,
    steps: b.steps,
    won: b.state === 'won',
    lost: b.state === 'lost',
    projSteps: b.proj ? b.proj.steps : -1,
    ents: b.ents.map((e) => ({
      type: e.type,
      kind: e.kind,
      dead: e.dead,
      hp: e.hp,
      x: e.body.position.x,
      y: e.body.position.y,
    })),
  };
}
