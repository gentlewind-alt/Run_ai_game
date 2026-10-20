// In-memory progress for Stage 2. Stage 3 replaces this with a cloud save through RundotGameAPI.appStorage.
const params = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);

export const DEBUG = params.get('debug') === '1';
export const MAX_LEVEL = 4; // Goblin Hills; later realms extend this
export const LOADOUT_SIZE = 4;

export const progress = {
  level: Math.max(1, Math.min(MAX_LEVEL, Number(params.get('level')) || 1)), // level the player is about to play
  reached: 1, // highest level reached; weapons unlock from this
  loadout: [] as string[],
  bestStars: {} as Record<number, number>,
};
progress.reached = Math.max(progress.reached, progress.level);

/** Weapons unlock as the player reaches levels ("start" or "level N" in content.json). */
export function isUnlocked(unlock: string): boolean {
  if (DEBUG || unlock === 'start') return true;
  const n = Number(unlock.replace(/\D/g, ''));
  return n <= progress.reached;
}

export const debugLevel = params.get('sandbox') === '1' ? 99 : null;
