// The only file that imports the RUN SDK.
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { noopPlatform, type Platform, type Row } from './types';

const safe = <T>(f: () => T, fallback: T): T => {
  try {
    return f();
  } catch {
    return fallback;
  }
};

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
    async submit(board: string, score: number): Promise<void> {
      try {
        await RundotGameAPI.leaderboard.submitScore({ score, duration: 60, period: board });
      } catch (e) {
        console.warn('leaderboard submit failed', e);
      }
    },
    async top(board: string, n: number): Promise<Row[]> {
      try {
        const res: any = await RundotGameAPI.leaderboard.getPagedScores({ period: board, limit: n });
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
        const res: any = await RundotGameAPI.leaderboard.getMyRank({ period: board });
        return res ? { rank: res.rank, name: 'You', score: res.score } : null;
      } catch {
        return null;
      }
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
  track: (event) => safe(() => RundotGameAPI.analytics.recordCustomEvent(event), undefined),
  funnel: (step, name, funnel) => safe(() => RundotGameAPI.analytics.trackFunnelStep(step, name, funnel, 1), undefined),
  log: (message) => safe(() => RundotGameAPI.log(message), undefined),
};
