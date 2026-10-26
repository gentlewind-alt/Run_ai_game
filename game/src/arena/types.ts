import type { BuilderDocument } from '../builder/document';

export const ARENA_ROOM = 'mm_arena';
export const ARENA_KEY = 'global-v1';
export const ARENA_START_COINS = 100;
export const ARENA_REJECT_LIMIT = 3;
export const ARENA_BLOCK_MS = 3600000;
export const ARENA_INVITE_MS = 120000;
export const ARENA_READY_MS = 90000;
export const ARENA_TURN_MS = 600000;
export const ARENA_MAX_FRAMES = 36000;
export const ARENA_MAX_ACTIONS = 128;
export const ARENA_STAKES = [0, 10, 25, 50] as const;

export interface ArenaPlayer { id: string; name: string; busy: boolean; wins: number; losses: number; draws: number }
export interface ArenaInvitation { id: string; from: string; fromName: string; to: string; toName: string; challengeId: string; title: string; wager: number; expiresAt: number }
export interface ArenaResult { cleared: boolean; score: number; shotsUsed: number; steps: number; forfeit: boolean }
export interface ArenaMatch {
  id: string; players: [string, string]; names: [string, string]; challengeId: string; title: string;
  wager: number; turn: 0 | 1; state: 'ready' | 'playing' | 'finished'; revision: number; deadline: number;
  results: [ArenaResult | null, ArenaResult | null]; winnerId: string | null; resolution: 'win' | 'draw' | 'cancelled' | null;
}
export interface ArenaSnapshot {
  me: string; coins: number; wins: number; losses: number; draws: number; players: ArenaPlayer[];
  invitations: ArenaInvitation[]; match: ArenaMatch | null; cooldowns: Record<string, number>; serverNow: number;
}
export type ArenaAction = { type: 'fire'; frame: number; angle: number; power: number } | { type: 'ability'; frame: number };
export interface ArenaReplay { frames: number; actions: ArenaAction[] }
export interface ArenaSetup { matchId: string; revision: number; doc: BuilderDocument; loadout: string[]; engineVersion: string }
export interface ArenaChallenge { doc: BuilderDocument; loadout: string[] }
export type ArenaCommand =
  | { type: 'arena:sync' }
  | { type: 'arena:invite'; targetId: string; challengeId: string; wager: number }
  | { type: 'arena:respond'; inviteId: string; accept: boolean; wager: number }
  | { type: 'arena:cancel'; inviteId: string }
  | { type: 'arena:start'; matchId: string; revision: number }
  | { type: 'arena:input'; matchId: string; revision: number; action: ArenaAction }
  | { type: 'arena:submit'; matchId: string; revision: number; replay: ArenaReplay }
  | { type: 'arena:forfeit'; matchId: string; revision: number };
export type ArenaMessage =
  | (ArenaCommand & { engineVersion: string })
  | { type: 'arena:snapshot'; data: ArenaSnapshot; engineVersion: string }
  | { type: 'arena:error'; message: string }
  | { type: 'arena:snapshot-chunk'; id: string; index: number; total: number; json: string }
  | { type: 'arena:chunk'; matchId: string; revision: number; index: number; total: number; json: string };
