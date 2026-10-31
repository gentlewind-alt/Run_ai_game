import { data } from '../data/load';
import type { CosmeticDef } from '../data/types';
import { changed, profile } from './profile';

export const slingLevel = (id: string): number => {
  const max = data.content.cosmetics?.find((c) => c.id === id)?.upgrade?.prices.length ?? 0;
  return Math.min(max, Math.max(0, Math.floor(profile.slingUpgrades?.[id] ?? 0)));
};

/** A fresh copy: campaign upgrades never change the shared catalogue or Arena frames. */
export function slingMods(def?: CosmeticDef): NonNullable<CosmeticDef['mods']> {
  const mods = { ...def?.mods };
  if (def?.upgrade) {
    const { stat, perLevel } = def.upgrade;
    mods[stat] = (mods[stat] ?? 0) + perLevel * slingLevel(def.id);
  }
  return mods;
}

export const slingUpgradeCost = (id: string): number | null => {
  const prices = data.content.cosmetics?.find((c) => c.id === id)?.upgrade?.prices;
  return prices?.[slingLevel(id)] ?? null;
};

export function upgradeSling(id: string): 'ok' | 'coins' | 'max' | 'unowned' {
  if (!profile.owned.cosmetics.includes(id)) return 'unowned';
  const price = slingUpgradeCost(id);
  if (price === null) return 'max';
  if (profile.coins < price) return 'coins';
  profile.coins -= price;
  changed('coins');
  (profile.slingUpgrades ??= {})[id] = slingLevel(id) + 1;
  changed('slingUpgrades');
  return 'ok';
}

export function slingLines(def: CosmeticDef): { pro: string; con: string } {
  const mods = slingMods(def);
  const pros: string[] = [];
  const cons: string[] = [];
  const mults = { damageMult: 'damage', launchSpeedMult: 'launch speed', previewMult: 'aim preview', explosionRadiusMult: 'blast radius' } as const;
  for (const [key, label] of Object.entries(mults)) {
    const value = mods[key as keyof typeof mults];
    if (value === undefined || value === 1) continue;
    const amount = Math.round((value - 1) * 100);
    (amount > 0 ? pros : cons).push(`${amount > 0 ? '+' : ''}${amount}% ${label}`);
  }
  if (mods.twinFraction) pros.push(`Twin shot (${Math.round(mods.twinFraction * 100)}% damage)`);
  if (mods.poisonChance) pros.push(`+${Math.round(mods.poisonChance * 100)}% poison chance`);
  if (mods.curseChance) pros.push(`+${Math.round(mods.curseChance * 100)}% curse chance`);
  return { pro: pros.join(', '), con: cons.join(', ') };
}
