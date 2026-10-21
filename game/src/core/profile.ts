// The player's state: coins, what they own, upgrades, stars, loadout. Persisted by core/save.ts.
// Every mutator emits 'profile:changed' so the save (debounced) and the shop UI can react.
import { data } from '../data/load';
import type { Economy } from '../data/types';
import { getDailySeed } from '../content/levelKinds/dailyLogic.js';
import { events } from './events';

const query = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);

export const DEBUG = query.get('debug') === '1';
export const debugLevel = query.get('sandbox') === '1' ? 99 : null;
/** `?level=N` (with ?debug=1) jumps straight into that level. */
export const startLevelParam = Number(query.get('level')) || 0;

export const SAVE_VERSION = 2;
export const GOLD_QUIVER = 'gold_quiver'; // cosmetic id that adds a fifth weapon slot (S5-04)

export interface DailyInfo {
  lastDay?: string; // YYYY-MM-DD
  streak: number;
  best: number;
  rewardsClaimed: string[];
}

export interface ProfileStats {
  bossLosses: Record<string, number>;
}

export interface Profile {
  version: number;
  coins: number;
  owned: { weapons: string[]; artifacts: string[]; consumables: Record<string, number>; cosmetics: string[] };
  upgrades: Record<string, number>;
  equipped: { loadout: string[]; artifacts: string[]; slingSkin?: string };
  stars: Record<string, number>;
  best: Record<string, number>;
  daily: DailyInfo;
  flags: Record<string, boolean>;
  stats: ProfileStats;
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
  relicUnlocked?: string;
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
    daily: { streak: 0, best: 0, rewardsClaimed: [] },
    flags: {},
    stats: { bossLosses: {} },
    settings: { muted: false, musicOn: true },
  };
}

export const profile: Profile = freshProfile();

/** Replace the contents of `profile` in place (so importers keep their reference). */
export function setProfile(p: Profile): void {
  Object.assign(profile, p);
}

export let lastResult: ResultInfo | null = null;

export const changed = (field: string): void => events.emit('profile:changed', { field });

// ------------------------------------------------------------------ levels

/** Highest story level in the data (ids 90+ are test levels). */
export const lastLevel = (): number => Math.max(1, ...Object.keys(data.levels).map(Number).filter((n) => n < 90));

export const clearedLevel = (): number => {
  let top = 0;
  for (const [k, v] of Object.entries(profile.stars)) if (v > 0) top = Math.max(top, Number(k));
  return top;
};

export function hasSeenHint(levelId: number, hintIdx = 0): boolean {
  return !!profile.flags[`hint_l${levelId}_${hintIdx}`];
}

export function markHintSeen(levelId: number, hintIdx = 0): void {
  profile.flags[`hint_l${levelId}_${hintIdx}`] = true;
  changed('flags');
}

/** The highest level the player may start. */
export const reachedLevel = (): number => (DEBUG ? lastLevel() : Math.min(lastLevel(), clearedLevel() + 1));
export const levelUnlocked = (id: number): boolean => id <= reachedLevel() && !!data.levels[id];
export const starsFor = (id: number): number => profile.stars[String(id)] ?? 0;

// ------------------------------------------------------------------ ownership and slots

export const weaponLevel = (id: string): number => profile.upgrades[id] ?? 0;
export const owns = (kind: 'weapons' | 'artifacts' | 'cosmetics', id: string): boolean => profile.owned[kind]?.includes(id) ?? false;
export const ownsCosmetic = (id: string): boolean => profile.owned.cosmetics.includes(id);
export const equipSlingSkin = (id?: string): void => {
  profile.equipped.slingSkin = id;
  changed('equipped');
};
export const consumableCount = (id: string): number => profile.owned.consumables[id] ?? 0;

/** "start" or "level N": a weapon can be bought once the player has reached level N. */
export function weaponUnlockLevel(unlock: unknown): number {
  if (typeof unlock !== 'string') return 999;
  return unlock === 'start' ? 1 : Number(unlock.replace(/\D/g, '')) || 1;
}

export const loadoutSize = (): number => {
  const bonus = (data.content?.cosmetics ?? []).some((c) => (c.slot || c.kind === 'slot') && ownsCosmetic(c.id)) || ownsCosmetic(GOLD_QUIVER) ? 1 : 0;
  return economy().loadoutSize + bonus;
};
export const artifactSlots = (): number => economy().artifactSlots + (DEBUG || clearedLevel() >= economy().secondArtifactAfterLevel ? 1 : 0);

// ------------------------------------------------------------------ coins, purchases and economy
export * from './economy';

// ------------------------------------------------------------------ loadout and settings

export function setLoadout(ids: string[]): void {
  let hasLegendary = false;
  const filtered: string[] = [];
  for (const id of ids) {
    const w = data.content.weapons.find((x) => x.id === id);
    if (w?.rarity === 'legendary') {
      if (hasLegendary) continue;
      hasLegendary = true;
    }
    filtered.push(id);
  }
  profile.equipped.loadout = filtered;
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

export function daysBetween(dateStrA: string, dateStrB: string): number {
  const [y1, m1, d1] = dateStrA.split('-').map(Number);
  const [y2, m2, d2] = dateStrB.split('-').map(Number);
  const utcA = Date.UTC(y1, m1 - 1, d1);
  const utcB = Date.UTC(y2, m2 - 1, d2);
  return Math.round((utcB - utcA) / (24 * 60 * 60 * 1000));
}

export function recordDailyResult(score: number, dateStr: string): { streak: number; rewardCoins: number; newBest: boolean } {
  const d = profile.daily;
  const last = d.lastDay;
  let rewardCoins = 0;
  let newBest = false;

  if (last !== dateStr) {
    if (!last) {
      d.streak = 1;
    } else {
      const diff = daysBetween(last, dateStr);
      if (diff === 1) {
        d.streak++;
      } else if (diff > 1) {
        d.streak = 1;
      }
    }
    d.lastDay = dateStr;

    const rewardDay = economy().dailyStreakRewardDay ?? 7;
    const rewardCoinAmount = economy().dailyStreakRewardCoins ?? 500;
    const claimKey = `streak_${d.streak}`;
    if (d.streak % rewardDay === 0 && !d.rewardsClaimed.includes(claimKey)) {
      d.rewardsClaimed.push(claimKey);
      rewardCoins = rewardCoinAmount;
      profile.coins += rewardCoins;
    }
  }

  if (score > d.best) {
    d.best = score;
    newBest = true;
  }

  changed('daily');
  return { streak: d.streak, rewardCoins, newBest };
}

// ------------------------------------------------------------------ results

/** Credits coins and records stars and score. First clears pay in full, replays and losses pay less. */
export function recordResult(r: { levelId: number; won: boolean; stars: number; score: number; coins: number; dateStr?: string }): ResultInfo {
  const e = economy();
  const key = String(r.levelId);
  const prev = profile.stars[key] ?? 0;
  const first = r.won && prev === 0;
  const factor = r.won ? (first ? 1 : e.replayCoinFactor) : e.lossCoinFactor;
  const credited = Math.round(r.coins * factor);
  if (r.won) {
    profile.stars[key] = Math.max(prev, r.stars);
    profile.best[key] = Math.max(profile.best[key] ?? 0, r.score);
    if (first) {
      delete profile.stats.bossLosses[key];
      changed('stats');
    }
    if (r.levelId === 0) {
      const dateStr = r.dateStr ?? getDailySeed(Date.now()).dateStr;
      recordDailyResult(r.score, dateStr);
    }
  } else {
    const lvl = data.levels[r.levelId];
    const isBossLvl = r.levelId === 4 || r.levelId === 8 || r.levelId === 12 || lvl?.kind === 'boss' ||
      (lvl?.monsters ?? []).some((m) => data.content?.monsters?.find((def) => def.id === m.t)?.boss);
    if (isBossLvl) {
      profile.stats.bossLosses[key] = (profile.stats.bossLosses[key] ?? 0) + 1;
      changed('stats');
    }
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
