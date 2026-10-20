import type { Level } from '../../data/types';
import type { LevelKind } from './types';
import { generateDailyLevel as genLevel, getDailySeed as getSeed } from './dailyLogic.js';

export const getDailySeed = (epochMs: number): { seed: number; dateStr: string; weekday: number } => getSeed(epochMs);
export const generateDailyLevel = (epochMs: number): Level => genLevel(epochMs) as Level;

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
