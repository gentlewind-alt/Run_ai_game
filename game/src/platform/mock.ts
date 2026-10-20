import { noopPlatform, type Platform, type Row } from './types';

/** Local dev without the RUN host: in-memory storage, console logging, no ads or purchases. */
const store = new Map<string, string>();
let mockTimeOffset = 0;

export const setMockTimeOffset = (ms: number): void => {
  mockTimeOffset = ms;
};

export const getMockTimeOffset = (): number => mockTimeOffset;

const mockLeaderboardRows: Row[] = [
  { rank: 1, name: 'DragonSlayer', score: 2850 },
  { rank: 2, name: 'GoblinCrusher', score: 2420 },
  { rank: 3, name: 'ShadowBow', score: 2190 },
  { rank: 4, name: 'IronShield', score: 1980 },
  { rank: 5, name: 'MashMaster', score: 1850 },
  { rank: 6, name: 'HexBreaker', score: 1720 },
  { rank: 7, name: 'BoulderToss', score: 1540 },
  { rank: 8, name: 'ImpCatcher', score: 1390 },
  { rank: 9, name: 'StoneWall', score: 1210 },
  { rank: 10, name: 'RookieSling', score: 1050 },
];

export const mockPlatform: Platform = {
  ...noopPlatform,
  hosted: false,
  async init(): Promise<void> { /* nothing to do */ },
  storage: {
    async get(key) { return store.get(key) ?? null; },
    async set(key, v) { store.set(key, v); },
  },
  async serverTime(): Promise<number> {
    return Date.now() + mockTimeOffset;
  },
  safeArea: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  lifecycle: { onPause() {}, onResume() {}, onSleep() {}, onQuit() {} },
  leaderboard: {
    async submit(board, score) {
      console.debug('[mock] leaderboard submit', board, score);
      const existing = mockLeaderboardRows.find((r) => r.name === 'You');
      if (existing) {
        existing.score = Math.max(existing.score, score);
      } else {
        mockLeaderboardRows.push({ rank: 0, name: 'You', score });
      }
      mockLeaderboardRows.sort((a, b) => b.score - a.score);
      mockLeaderboardRows.forEach((r, i) => { r.rank = i + 1; });
    },
    async top(_board, n) {
      return mockLeaderboardRows.slice(0, n);
    },
    async myRank(_board) {
      const found = mockLeaderboardRows.find((r) => r.name === 'You');
      return found ?? { rank: mockLeaderboardRows.length + 1, name: 'You', score: 0 };
    },
  },
  async share(text, params) {
    console.debug('[mock] share:', text, params ?? '');
    return true;
  },
  track(event, data) { console.debug('[mock] track', event, data ?? ''); },
  funnel(step, name, funnel) { console.debug('[mock] funnel', funnel, step, name); },
  log(message) { console.debug('[mock]', message); },
};
