import type { Level } from '../../data/types';

export function getDailySeed(epochMs: number): { seed: number; dateStr: string; weekday: number };
export function generateDailyLevel(epochMs: number): Level;
