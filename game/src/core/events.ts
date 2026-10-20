import type { Ent } from '../battle/BattleCtx';

/** Event payloads. Add an event to the table in architecture/ARCHITECTURE.md first. */
export interface GameEvents {
  'level:start': { levelId: number; kind: string };
  'shot:launched': { weaponId: string; index: number };
  'shot:ability': { weaponId: string; x: number; y: number };
  'shot:ended': { weaponId: string };
  hit: { target: Ent; amount: number; x: number; y: number };
  kill: { target: Ent; x: number; y: number };
  combo: { count: number; mult: number };
  'runner:escaped': { count: number; limit: number };
  'coins:gained': { amount: number; total: number };
  'score:changed': { score: number; delta: number };
  'level:won': { levelId: number; stars: number; score: number; coins: number; shotsLeft: number };
  'level:lost': { levelId: number; reason: 'shots' | 'escaped'; score: number; coins: number };
  'profile:changed': { field: string };
}

type Fn = (payload: never) => void;
interface Listener { fn: Fn; battle: boolean }

export class EventBus {
  private map = new Map<string, Listener[]>();
  private inBattle = false;

  /** Listeners added after this call are removed by clearBattle(). */
  beginBattle(): void {
    this.inBattle = true;
  }

  on<K extends keyof GameEvents>(name: K, fn: (p: GameEvents[K]) => void): () => void {
    const l: Listener = { fn: fn as Fn, battle: this.inBattle };
    this.map.set(name, [...(this.map.get(name) ?? []), l]);
    return () => this.map.set(name, (this.map.get(name) ?? []).filter((x) => x !== l));
  }

  emit<K extends keyof GameEvents>(name: K, payload: GameEvents[K]): void {
    for (const l of this.map.get(name) ?? []) (l.fn as (p: GameEvents[K]) => void)(payload);
  }

  clearBattle(): void {
    this.inBattle = false;
    for (const [k, v] of this.map) this.map.set(k, v.filter((l) => !l.battle));
  }
}

export const events = new EventBus();
