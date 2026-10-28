// Rewarded ads: free coins (a few per rolling window) and extra shots when a battle runs out. Never throws into the game.
import { platform } from '../platform';
import { data } from '../data/load';
import { addCoins, changed, profile } from './profile';

export interface AdRules { coinReward: number; perWindow: number; windowHours: number; extraShots: number; bonusDamage?: number; interstitialEvery?: number; interstitialFromLevel?: number }

const DEFAULTS: AdRules = { coinReward: 300, perWindow: 3, windowHours: 5, extraShots: 2 };
export const adRules = (): AdRules => ({ ...DEFAULTS, ...(data.content.economy.ads ?? {}) });
export const adsEnabled = (): boolean => data.config.features?.ads !== false;

const windowMs = (): number => adRules().windowHours * 3600 * 1000;

async function now(): Promise<number> {
  try {
    return await platform.serverTime();
  } catch {
    return Date.now();
  }
}

/** Watches inside the rolling window, oldest first. Pure: the caller supplies the time. */
export function recentWatches(nowMs: number): number[] {
  return (profile.stats.adWatches ?? []).filter((t) => nowMs - t < windowMs()).sort((a, b) => a - b);
}

/** Free-coin ads left right now, and ms until the next one frees up (0 when one is ready). */
export function coinAdStatus(nowMs: number): { left: number; waitMs: number } {
  const r = adRules();
  const recent = recentWatches(nowMs);
  const left = Math.max(0, r.perWindow - recent.length);
  return { left, waitMs: left > 0 ? 0 : Math.max(0, recent[0] + windowMs() - nowMs) };
}

/** "1h 20m" style countdown. */
export function formatWait(ms: number): string {
  const m = Math.ceil(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

/** Watch one rewarded ad for coins. Returns the coins granted (0 when not allowed, not ready or not watched). */
export async function watchForCoins(): Promise<number> {
  try {
    if (!adsEnabled()) return 0;
    const t = await now();
    if (coinAdStatus(t).left <= 0) return 0;
    if (!(await platform.ads.rewardedReady())) return 0;
    if (!(await platform.ads.showRewarded('free_coins', 'Free Coins'))) return 0;
    const t2 = await now();
    profile.stats.adWatches = [...recentWatches(t2), t2];
    const coins = adRules().coinReward;
    addCoins(coins);
    changed('stats');
    platform.track('rewarded_ad_complete', { placement: 'free_coins', coins });
    return coins;
  } catch {
    return 0;
  }
}

/** Offer for the battle that just ran out of shots: is an ad available at all? */
export async function extraShotsReady(): Promise<boolean> {
  try {
    return adsEnabled() && (await platform.ads.rewardedReady());
  } catch {
    return false;
  }
}

/** Watch one rewarded ad for extra shots. True when the player earned them. */
export async function watchForShots(): Promise<boolean> {
  try {
    const ok = await platform.ads.showRewarded('extra_shots', 'Extra Shots');
    if (ok) platform.track('rewarded_ad_complete', { placement: 'extra_shots' });
    return ok;
  } catch {
    return false;
  }
}

let battlesSinceAd = 0;

/** After a battle: every `interstitialEvery` finished battles (from `interstitialFromLevel` on) shows one full-screen ad. */
export async function maybeInterstitial(levelId: number): Promise<void> {
  try {
    const r = adRules();
    if (!adsEnabled() || !r.interstitialEvery || levelId < (r.interstitialFromLevel ?? 1)) return;
    if (++battlesSinceAd < r.interstitialEvery) return;
    battlesSinceAd = 0;
    if (await platform.ads.showInterstitial()) platform.track('interstitial_ad_shown', { level: levelId });
  } catch { /* never block the game */ }
}
