// The only file that imports the RUN SDK.
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { noopPlatform, type Platform } from './types';

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
  track: (event) => safe(() => RundotGameAPI.analytics.recordCustomEvent(event), undefined),
  funnel: (step, name, funnel) => safe(() => RundotGameAPI.analytics.trackFunnelStep(step, name, funnel, 1), undefined),
  log: (message) => safe(() => RundotGameAPI.log(message), undefined),
};
