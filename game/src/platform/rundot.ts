// The only file that imports the RUN SDK.
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { boardRoute } from './boards';
import { noopPlatform, type Platform, type Row, type UgcRow } from './types';

const safe = <T>(f: () => T, fallback: T): T => {
  try {
    return f();
  } catch {
    return fallback;
  }
};

const toRow = (e: any): UgcRow => ({
  id: String(e.id), authorId: String(e.authorId ?? ''), authorName: String(e.authorName ?? 'Player'), title: String(e.title ?? ''),
  data: (e.data ?? {}) as Record<string, unknown>, uses: Number(e.useCount ?? 0), createdAt: Number(e.createdAt ?? 0), updatedAt: Number(e.updatedAt ?? 0),
});

export function sdkAvailable(): boolean {
  return safe(() => RundotGameAPI.isAvailable(), false);
}

export const rundotPlatform: Platform = {
  ...noopPlatform,
  hosted: true,
  async init(): Promise<void> { /* the SDK needs no explicit init */ },
  storage: {
    async get(key) {
      try {
        return (await RundotGameAPI.appStorage.getItem(key)) ?? null;
      } catch {
        return null;
      }
    },
    async set(key, v) {
      try {
        await RundotGameAPI.appStorage.setItem(key, v);
      } catch { /* storage is optional */ }
    },
  },
  async serverTime(): Promise<number> {
    try {
      const res = await RundotGameAPI.requestTimeAsync();
      return res.serverTime;
    } catch {
      return Date.now();
    }
  },
  safeArea: () => {
    const sa = safe(() => RundotGameAPI.system.getSafeArea(), undefined);
    return { top: sa?.top ?? 0, bottom: sa?.bottom ?? 0, left: sa?.left ?? 0, right: sa?.right ?? 0 };
  },
  lifecycle: {
    onPause: (f) => safe(() => RundotGameAPI.lifecycles.onPause(f), undefined),
    onResume: (f) => safe(() => RundotGameAPI.lifecycles.onResume(f), undefined),
    onSleep: (f) => safe(() => RundotGameAPI.lifecycles.onSleep(f), undefined),
    onQuit: (f) => safe(() => RundotGameAPI.lifecycles.onQuit(f), undefined),
  },
  leaderboard: {
    async submit(board: string, score: number, seconds?: number): Promise<void> {
      try {
        await RundotGameAPI.leaderboard.submitScore({ score, duration: Math.max(1, seconds ?? 60), ...boardRoute(board) });
      } catch (e) {
        console.warn('leaderboard submit failed', e);
      }
    },
    async top(board: string, n: number): Promise<Row[]> {
      try {
        const res: any = await RundotGameAPI.leaderboard.getPagedScores({ limit: n, ...boardRoute(board) });
        return (res?.entries ?? []).map((e: any, i: number) => ({
          rank: e.rank ?? i + 1,
          name: e.player?.username ?? 'Player',
          score: e.score ?? 0,
        }));
      } catch {
        return [];
      }
    },
    async myRank(board: string): Promise<Row | null> {
      try {
        const res: any = await RundotGameAPI.leaderboard.getMyRank({ ...boardRoute(board) });
        return res ? { rank: res.rank, name: 'You', score: res.score } : null;
      } catch {
        return null;
      }
    },
  },
  async role() {
    try { return await RundotGameAPI.app.getMyRole(); } catch { return 'none'; }
  },
  ugc: {
    async create(type, title, data) {
      try {
        return toRow(await RundotGameAPI.ugc.create({ contentType: type, title, data, isPublic: true }));
      } catch (e) { console.warn('ugc create failed', e); return null; }
    },
    async update(id, patch) {
      try {
        return toRow(await RundotGameAPI.ugc.update({ id, ...patch }));
      } catch (e) { console.warn('ugc update failed', e); return null; }
    },
    async remove(id) {
      try { await RundotGameAPI.ugc.delete(id); return true; } catch (e) { console.warn('ugc delete failed', e); return false; }
    },
    async get(id) {
      try { const e = await RundotGameAPI.ugc.get(id); return e ? toRow(e) : null; } catch { return null; }
    },
    async browse(type, sort, limit) {
      try {
        const res: any = await RundotGameAPI.ugc.browse({ contentType: type, sortBy: sort, sortOrder: 'desc', limit });
        return (res?.entries ?? []).map(toRow);
      } catch { return []; }
    },
    async mine(type, limit) {
      try {
        const res: any = await RundotGameAPI.ugc.listMine({ contentType: type, limit });
        return (res?.entries ?? []).map(toRow);
      } catch { return []; }
    },
    async recordUse(id) {
      try { return (await RundotGameAPI.ugc.recordUse(id)).useCount; } catch { return null; }
    },
    async adminRemove(id) {
      try { await RundotGameAPI.app.adminUgc.removeEntry(id); return true; } catch (e) { console.warn('admin remove failed', e); return false; }
    },
    async adminBrowse(type, limit) {
      try {
        const res: any = await RundotGameAPI.app.adminUgc.browse({ contentType: type, limit });
        return (res?.entries ?? []).map(toRow);
      } catch { return []; }
    },
  },
  async share(text: string, params?: Record<string, string>): Promise<boolean> {
    try {
      await RundotGameAPI.social.shareLinkAsync({
        shareParams: params ?? {},
        metadata: { title: 'MONSTER MASH: Slingshot Siege', description: text },
      });
      return true;
    } catch {
      return false;
    }
  },
  ads: {
    async rewardedReady(): Promise<boolean> {
      try {
        return await RundotGameAPI.ads.isRewardedAdReadyAsync();
      } catch {
        return false;
      }
    },
    async showRewarded(placementId = 'double_coins', placementName = 'Double Battle Coins'): Promise<boolean> {
      try {
        return await RundotGameAPI.ads.showRewardedAdAsync({
          adDisplayId: placementId,
          adDisplayName: placementName,
        });
      } catch {
        return false;
      }
    },
  },
  iap: {
    available: () => safe(() => RundotGameAPI.isAvailable(), false),
    async buy(itemId: string): Promise<boolean> {
      try {
        const key = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `buy_${Date.now()}_${Math.random()}`;
        const res = await RundotGameAPI.shop.purchase(itemId, key);
        return Boolean(res?.success || (res as any)?.orderId || (res as any)?.order?.orderId);
      } catch (e) {
        console.warn('IAP purchase error:', e);
        return false;
      }
    },
    async owned(itemId: string): Promise<boolean> {
      try {
        const entitlements: any = await RundotGameAPI.entitlements.listEntitlements();
        return (entitlements?.items ?? []).some((e: any) => e.entitlementId === itemId);
      } catch {
        return false;
      }
    },
  },
  haptic: (kind: 'light' | 'heavy') => {
    safe(() => {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(kind === 'heavy' ? [45, 30, 75] : 30);
      }
      (RundotGameAPI as any).system?.vibrateAsync?.(kind);
    }, undefined);
  },
  track: (event) => safe(() => RundotGameAPI.analytics.recordCustomEvent(event), undefined),
  funnel: (step, name, funnel) => safe(() => RundotGameAPI.analytics.trackFunnelStep(step, name, funnel, 1), undefined),
  log: (message) => safe(() => RundotGameAPI.log(message), undefined),
};
