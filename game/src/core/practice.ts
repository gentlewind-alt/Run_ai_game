// Offline practice match (Handshake build): the Arena rules without needing another player online. One full attempt each on the
// same sample level with the same weapons: a clear beats no clear, then the higher score wins. The opponent is a Rival Bot that
// plays its turn on screen, or a second person on the same device. Practice coins are separate from Arena and campaign coins
// and are not saved.
import type { Level } from '../data/types';
import { data } from '../data/load';

export interface PracticeResult { cleared: boolean; score: number; shotsUsed: number }
export interface PracticeMatch {
  levelId: number;
  bot: boolean;
  stake: number;
  turn: 0 | 1;
  results: [PracticeResult | null, PracticeResult | null];
}
/** What BattleScene needs to play one practice turn. */
export interface PracticeTurn { who: 0 | 1; bot: boolean; vsBot: boolean; level: Level; loadout: string[] }

export const practiceConfig = (): NonNullable<typeof data.config.practice> => data.config.practice ?? {
  levels: [31], loadout: ['w_iron_cleaver', 'w_ashwood_staff', 'w_hunters_pike', 'w_blast_tube', 'w_scrapheap_scattergun'], stakes: [0], startCoins: 100, botThinkMs: 1100, botSkill: 0.7,
};

let coins = -1;
let match: PracticeMatch | null = null;
let record = { wins: 0, losses: 0, draws: 0 };
let outcome: 'win' | 'loss' | 'draw' | null = null;

export const practiceCoins = (): number => (coins < 0 ? (coins = practiceConfig().startCoins) : coins);
export const practiceRecord = (): typeof record => record;
export const currentMatch = (): PracticeMatch | null => match;
export const clearMatch = (): void => { match = null; outcome = null; };
export const matchOutcome = (): typeof outcome => outcome;

export function startMatch(levelId: number, bot: boolean, stake: number): PracticeMatch {
  const staked = bot ? Math.max(0, Math.min(stake, practiceCoins())) : 0; // pass and play is always friendly
  coins = practiceCoins() - staked;
  outcome = null;
  match = { levelId, bot, stake: staked, turn: 0, results: [null, null] };
  return match;
}

export function turnFor(m: PracticeMatch): PracticeTurn {
  const base = data.levels[m.levelId];
  const loadout = practiceConfig().loadout.slice();
  const level: Level = { ...JSON.parse(JSON.stringify(base)) as Level, id: 1000, shots: loadout.length, loadout, overrides: { features: { tutorial: false, consumables: false, artifacts: false }, camera: { introPan: false } } };
  return { who: m.turn, bot: m.bot && m.turn === 1, vsBot: m.bot, level, loadout };
}

/** Stores the finished turn. Returns the match when both turns are done. */
export function recordTurn(result: PracticeResult): PracticeMatch | null {
  if (!match) return null;
  match.results[match.turn] = result;
  if (match.turn === 0) { match.turn = 1; return null; }
  return match;
}

/** 1 when player one wins, -1 when player two wins, 0 for a draw: clear first, then score. */
export function compare(m: PracticeMatch): number {
  const [a, b] = m.results as [PracticeResult, PracticeResult];
  return Math.sign(Number(a.cleared) - Number(b.cleared)) || Math.sign(a.score - b.score);
}

/** Pays out a finished match and updates the record. Returns the outcome from player one's side. */
export function settle(m: PracticeMatch): 'win' | 'loss' | 'draw' {
  const c = compare(m);
  if (c === 0) { coins = practiceCoins() + m.stake; record = { ...record, draws: record.draws + 1 }; return (outcome = 'draw'); }
  if (c > 0) { coins = practiceCoins() + m.stake * 2; record = { ...record, wins: record.wins + 1 }; return (outcome = 'win'); }
  record = { ...record, losses: record.losses + 1 };
  return (outcome = 'loss');
}
