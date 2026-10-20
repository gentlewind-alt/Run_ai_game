import type { LevelKind } from './types';
import { bossKind } from './boss';
import { dailyKind } from './daily';

export const LEVEL_KINDS: Record<string, LevelKind> = {
  boss: bossKind,
  daily: dailyKind,
};

export const kindFor = (kind?: string): LevelKind | undefined => {
  return kind ? LEVEL_KINDS[kind] : undefined;
};
