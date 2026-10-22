// Board names the game uses, and how a board name maps onto the RUN leaderboard options.
// RUN has `mode` (a named board) and `period` (daily or alltime) as separate options: the Daily Mash is the daily period of the
// default board, every other board is an all-time board with its own mode. Modes must exist in rundot/leaderboard.config.json.
export const DAILY_BOARD = 'daily';
export const OVERALL_BOARD = 'overall';
export const levelBoard = (levelId: number): string => `level_${levelId}`;

export interface BoardRoute { period: string; mode?: string }

export function boardRoute(board: string): BoardRoute {
  return board === DAILY_BOARD ? { period: 'daily' } : { period: 'alltime', mode: board };
}
