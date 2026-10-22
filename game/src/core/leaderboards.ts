// Score boards: one per level (best score) plus an overall board (sum of each level's best). Never throws into the game.
import { platform } from '../platform';
import { OVERALL_BOARD, levelBoard } from '../platform/boards';
import { profile } from './profile';

/** Sum of the best score of every campaign level (the Daily Mash, level 0, has its own board). */
export function overallScore(): number {
  return Object.entries(profile.best).reduce((n, [id, s]) => (Number(id) > 0 ? n + (s ?? 0) : n), 0);
}

/** Submits the level's best score and the new overall total. */
export async function submitBests(levelId: number): Promise<void> {
  try {
    const best = profile.best[String(levelId)] ?? 0;
    if (best > 0) await platform.leaderboard.submit(levelBoard(levelId), best);
    const total = overallScore();
    if (total > 0) await platform.leaderboard.submit(OVERALL_BOARD, total);
  } catch {
    /* scores are a bonus: never block the game */
  }
}

/** "Level rank #N" for the Results screen, or null when scores are unavailable. */
export async function levelRankLine(levelId: number): Promise<string | null> {
  try {
    await submitBests(levelId);
    const me = await platform.leaderboard.myRank(levelBoard(levelId));
    return me && me.rank > 0 ? `Level rank #${me.rank}` : null;
  } catch {
    return null;
  }
}
