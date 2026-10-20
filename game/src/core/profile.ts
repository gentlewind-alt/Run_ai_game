// The player's state: coins, what they own, upgrades, stars, loadout. Persisted by core/save.ts.
// Every mutator emits 'profile:changed' so the save (debounced) and the shop UI can react.
import { data } from '../data/load';
import type { Economy } from '../data/types';
import { events } from './events';

const query = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);

export const DEBUG = query.get('debug') === '1';
export const debugLevel = query.get('sandbox') === '1' ? 99 : null;
/** `?level=N` (with ?debug=1) jumps straight into that level. */
export const startLevelParam = Number(query.get('level')) || 0;

export const SAVE_VERSION = 1;
export const GOLD_QUIVER = 'gold_quiver'; // cosmetic id that adds a fifth weapon slot (S5-04)

export interface Profile {
  version: number;
  coins: number;
  owned: { weapons: string[]; artifacts: string[]; consumables: Record<string, number>; cosmetics: string[] };
  upgrades: Record<string, number>;
  equipped: { loadout: string[]; artifacts: string[]; slingSkin?: string };
  stars: Record<string, number>;
  best: Record<string, number>;
  flags: Record<string, boolean>;
  settings: { muted: boolean; musicOn: boolean };
}

export interface ResultInfo {
  levelId: number;
  won: boolean;
  stars: number;
  newStars: number; // stars gained over the previous best
  score: number;
  earned: number; // coins collected in the battle
  credited: number; // coins actually added to the profile
  firstClear: boolean;
}

const DEFAULT_ECONOMY: Economy = {
  startCoins: 0, replayCoinFactor: 0.4, lossCoinFactor: 0.25, maxConsumableStack: 5, loadoutSize: 4, artifactSlots: 1,
  secondArtifactAfterLevel: 8,
};
export const economy = (): Economy => ({ ...DEFAULT_ECONOMY, ...(data.content?.economy ?? {}) });

export function freshProfile(): Profile {
  const e = economy();
  const starters = (data.content?.weapons ?? []).filter((w) => w.enabled !== false && w.unlock === 'start' && w.price === 0).map((w) => w.id);
  return {
    version: SAVE_VERSION,
    coins: e.startCoins,
    owned: { weapons: starters.length ? starters : ['w_militia_blade'], artifacts: [], consumables: {}, cosmetics: [] },
    upgrades: {},
    equipped: { loadout: [], artifacts: [] },
    stars: {},
    best: {},
    flags: {},
    settings: { muted: false, musicOn: true },
  };
}

export const profile: Profile = freshProfile();

/** Replace the contents of `profile` in place (so importers keep their reference). */
export function setProfile(p: Profile): void {
  Object.assign(profile, p);
}

export let lastResult: ResultInfo | null = null;

const changed = (field: string): void => events.emit('profile:changed', { field });

// ------------------------------------------------------------------ levels

/** Highest story level in the data (ids 90+ are test levels). */
export const lastLevel = (): number => Math.max(1, ...Object.keys(data.levels).map(Number).filter((n) => n < 90));

export function clearedLevel(): number {
  let top = 0;
  for (const [k, v] of Object.entries(profile.stars)) if (v > 0) top = Math.max(top, Number(k));
  return top;
}

/** The highest level the player may start. */
export const reachedLevel = (): number => (DEBUG ? lastLevel() : Math.min(lastLevel(), clearedLevel() + 1));
export const levelUnlocked = (id: number): boolean => id <= reachedLevel() && !!data.levels[id];
export const starsFor = (id: number): number => profile.stars[String(id)] ?? 0;

// ------------------------------------------------------------------ ownership and slots

export const weaponLevel = (id: string): number => profile.upgrades[id] ?? 0;
export const owns = (kind: 'weapons' | 'artifacts', id: string): boolean => profile.owned[kind].includes(id);
export const consumableCount = (id: string): number => profile.owned.consumables[id] ?? 0;

/** "start" or "level N": a weapon can be bought once the player has reached level N. */
export function weaponUnlockLevel(unlock: string): number {
  return unlock === 'start' ? 1 : Number(unlock.replace(/\D/g, '')) || 1;
}

export const loadoutSize = (): number => economy().loadoutSize + (profile.owned.cosmetics.includes(GOLD_QUIVER) ? 1 : 0);
export const artifactSlots = (): number => economy().artifactSlots + (DEBUG || clearedLevel() >= economy().secondArtifactAfterLevel ? 1 : 0);

// ------------------------------------------------------------------ coins and purchases

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
  if (!DEBUG && weaponUnlockLevel(def.unlock) > reachedLevel()) return 'locked';
  if (!spendCoins(def.price ?? 0)) return 'coins';
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
  return lv >= R.maxUpgradeLevel ? null : Math.round(R.upgradeBaseCost * Math.pow(R.upgradeCostMultiplier, lv));
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

// ------------------------------------------------------------------ loadout and settings

export function setLoadout(ids: string[]): void {
  profile.equipped.loadout = ids.slice();
  changed('equipped');
}

export function setArtifacts(ids: string[]): void {
  profile.equipped.artifacts = ids.slice(0, artifactSlots());
  changed('equipped');
}

export function setMuted(m: boolean): void {
  profile.settings.muted = m;
  changed('settings');
}

export function setFlag(name: string, on = true): void {
  profile.flags[name] = on;
  changed('flags');
}

// ------------------------------------------------------------------ results

/** Credits coins and records stars and score. First clears pay in full, replays and losses pay less. */
export function recordResult(r: { levelId: number; won: boolean; stars: number; score: number; coins: number }): ResultInfo {
  const e = economy();
  const key = String(r.levelId);
  const prev = profile.stars[key] ?? 0;
  const first = r.won && prev === 0;
  const factor = r.won ? (first ? 1 : e.replayCoinFactor) : e.lossCoinFactor;
  const credited = Math.round(r.coins * factor);
  if (r.won) {
    profile.stars[key] = Math.max(prev, r.stars);
    profile.best[key] = Math.max(profile.best[key] ?? 0, r.score);
  }
  profile.coins += credited;
  lastResult = {
    levelId: r.levelId, won: r.won, stars: r.stars, newStars: Math.max(0, r.stars - prev), score: r.score, earned: r.coins, credited,
    firstClear: first,
  };
  changed('result');
  return lastResult;
}

let wired = false;
/** Subscribes the profile to battle results. Call once at boot, before any battle listener. */
export function wireProfile(): void {
  if (wired) return;
  wired = true;
  events.on('level:won', (e) => { recordResult({ levelId: e.levelId, won: true, stars: e.stars, score: e.score, coins: e.coins }); });
  events.on('level:lost', (e) => { recordResult({ levelId: e.levelId, won: false, stars: 0, score: e.score, coins: e.coins }); });
}

/** Debug sessions start rich with everything unlocked. Never saved. */
export function applyDebug(): void {
  if (!DEBUG) return;
  profile.coins = 99999;
  profile.owned.weapons = data.content.weapons.filter((w) => w.enabled !== false).map((w) => w.id);
  profile.owned.artifacts = data.content.artifacts.map((a) => a.id);
  for (const c of data.content.consumables) profile.owned.consumables[c.id] = 3;
}
