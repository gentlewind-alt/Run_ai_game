import { data } from '../data/load';
import {
  DEBUG, changed, consumableCount, economy, owns, profile, reachedLevel, weaponLevel, weaponUnlockLevel,
} from './profile';

export function addCoins(n: number): void {
  profile.coins += Math.max(0, Math.round(n));
  changed('coins');
}

export function spendCoins(n: number): boolean {
  if (profile.coins < n) return false;
  profile.coins -= n;
  changed('coins');
  return true;
}

export type BuyResult = 'ok' | 'coins' | 'locked' | 'owned' | 'full';

export function buyWeapon(id: string): BuyResult {
  const def = data.content.weapons.find((w) => w.id === id);
  if (!def) return 'locked';
  if (owns('weapons', id)) return 'owned';
  let price = def.price ?? 0;
  if (typeof def.unlock === 'object') {
    if (def.unlock.boss) {
      const bossLvl = def.unlock.level ?? (def.unlock.boss === 'goblin_chief' ? 4 : def.unlock.boss === 'dark_elf_matron' ? 8 : 12);
      const losses = profile.stats.bossLosses[String(bossLvl)] ?? 0;
      const pityLosses = economy().relicPityLosses ?? 3;
      if (losses < pityLosses) return 'locked';
      price = economy().relicMarketPrice?.[def.rarity ?? 'legendary'] ?? economy().relicMarketPrice?.legendary ?? 1500;
    } else if (def.unlock.shop) {
      price = def.price ?? 0;
    } else {
      if (!DEBUG) return 'locked';
    }
  } else if (!DEBUG && weaponUnlockLevel(def.unlock) > reachedLevel()) {
    return 'locked';
  }
  if (!spendCoins(price)) return 'coins';
  profile.owned.weapons.push(id);
  changed('owned');
  return 'ok';
}

export function buyArtifact(id: string): BuyResult {
  const def = data.content.artifacts.find((a) => a.id === id);
  if (!def) return 'locked';
  if (owns('artifacts', id)) return 'owned';
  if (!spendCoins(def.price)) return 'coins';
  profile.owned.artifacts.push(id);
  changed('owned');
  return 'ok';
}

export function buyConsumable(id: string): BuyResult {
  const def = data.content.consumables.find((c) => c.id === id);
  if (!def) return 'locked';
  if (consumableCount(id) >= economy().maxConsumableStack) return 'full';
  if (!spendCoins(def.price)) return 'coins';
  profile.owned.consumables[id] = consumableCount(id) + 1;
  changed('owned');
  return 'ok';
}

/** Uses one consumable from the stock; false if there is none. */
export function useConsumable(id: string): boolean {
  const n = consumableCount(id);
  if (n <= 0) return false;
  profile.owned.consumables[id] = n - 1;
  changed('owned');
  return true;
}

/** Forge cost to go from the current level to the next: base x multiplier ^ level. null at the maximum. */
export function upgradeCost(id: string): number | null {
  const R = data.content.damageRules;
  const lv = weaponLevel(id);
  const w = data.content.weapons.find((x) => x.id === id);
  const rarityMult = (R.forgeRarityMultiplier as Record<string, number> | undefined)?.[w?.rarity ?? ''] ?? (w?.rarity === 'rare' ? 1.5 : w?.rarity === 'legendary' ? 2.5 : 1);
  return lv >= R.maxUpgradeLevel ? null : Math.round(R.upgradeBaseCost * rarityMult * Math.pow(R.upgradeCostMultiplier, lv));
}

export function upgradeWeapon(id: string): 'ok' | 'coins' | 'max' | 'unowned' {
  if (!owns('weapons', id)) return 'unowned';
  const cost = upgradeCost(id);
  if (cost === null) return 'max';
  if (!spendCoins(cost)) return 'coins';
  profile.upgrades[id] = weaponLevel(id) + 1;
  changed('upgrades');
  return 'ok';
}

/** Damage multiplier from forge upgrades: 1 + upgradeDamagePerStep x level. */
export const upgradeMult = (id: string): number => 1 + data.content.damageRules.upgradeDamagePerStep * weaponLevel(id);
