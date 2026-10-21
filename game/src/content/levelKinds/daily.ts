import type { Level } from '../../data/types';
import type { LevelKind } from './types';
import { generateDailyLevel as genLevel, getDailySeed as getSeed } from './dailyLogic.js';

export const getDailySeed = (epochMs: number): { seed: number; dateStr: string; weekday: number } => getSeed(epochMs);
export const generateDailyLevel = (epochMs: number): Level => genLevel(epochMs) as Level;

export function check30DaysDailyVariety(startEpochMs = Date.UTC(2026, 9, 1, 12, 0, 0)): { ok: boolean; errors: string[] } {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const errors: string[] = [];
  let prevArchetype = '';
  let prevMix = '';
  let prevName = '';

  for (let i = 0; i < 30; i++) {
    const t = startEpochMs + i * MS_PER_DAY;
    const level = generateDailyLevel(t);
    const archetype = level._archetype ?? '';
    const mix = level.monsters.map((m) => m.t).sort().join(',');

    if (i > 0) {
      if (archetype && prevArchetype && archetype === prevArchetype) {
        errors.push(`Day ${i} (${level.name}): consecutive shared fort archetype "${archetype}" with Day ${i - 1} (${prevName})`);
      }
      if (mix && prevMix && mix === prevMix) {
        errors.push(`Day ${i} (${level.name}): consecutive shared monster mix [${mix}] with Day ${i - 1} (${prevName})`);
      }
    }
    prevArchetype = archetype;
    prevMix = mix;
    prevName = level.name;
  }

  return { ok: errors.length === 0, errors };
}

export const dailyKind: LevelKind = {
  id: 'daily',
  name: 'Daily Mash',
  onStart(ctx) {
    ctx.fx.word(180, 240, 'DAILY MASH');
  },
  onWin(ctx) {
    ctx.fx.word(180, 240, 'DAILY CLEARED!');
  },
};
