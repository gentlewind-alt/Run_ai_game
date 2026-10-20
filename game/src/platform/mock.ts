import { noopPlatform, type Platform } from './types';

/** Local dev without the RUN host: in-memory storage, console logging, no ads or purchases. */
const store = new Map<string, string>();

export const mockPlatform: Platform = {
  ...noopPlatform,
  hosted: false,
  async init(): Promise<void> { /* nothing to do */ },
  storage: {
    async get(key) { return store.get(key) ?? null; },
    async set(key, v) { store.set(key, v); },
  },
  safeArea: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  lifecycle: { onPause() {}, onResume() {}, onSleep() {}, onQuit() {} },
  track(event, data) { console.debug('[mock] track', event, data ?? ''); },
  funnel(step, name, funnel) { console.debug('[mock] funnel', funnel, step, name); },
  log(message) { console.debug('[mock]', message); },
};
