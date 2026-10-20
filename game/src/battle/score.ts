// Score, coins and stars for the level in progress.
import { C } from '../art/palette';
import { pixText } from '../art/pix';
import type { BattleState } from './state';

export function addScore(b: BattleState, pts: number, x: number, y: number, quiet = false): void {
  b.score += pts;
  b.events.emit('score:changed', { score: b.score, delta: pts });
  if (!quiet) {
    const ft = pixText(b.scene, x, y - 20, `+${pts}`, C('4')).setDepth(12);
    b.scene.tweens.add({ targets: ft, y: y - 36, alpha: 0, duration: 800, onComplete: () => ft.destroy() });
  }
}

export function addCoins(b: BattleState, amount: number): void {
  b.coins += amount;
  b.events.emit('coins:gained', { amount, total: b.coins });
}

/** Bonus for leftover shots, then 1 star for a win, 2 with a shot left, 3 at the level's score target. */
export function finalize(b: BattleState, won: boolean): { stars: number; shotsLeft: number } {
  const shotsLeft = b.loadout.length - b.shotIdx;
  if (won && shotsLeft > 0) {
    b.score += shotsLeft * b.tune.shotBonusPoints;
    b.coins += shotsLeft * b.tune.shotBonusCoins;
  }
  const target = b.level.scoreTarget ?? 0;
  const stars = won ? 1 + (shotsLeft > 0 ? 1 : 0) + (target > 0 && b.score >= target ? 1 : 0) : 0;
  return { stars, shotsLeft };
}
