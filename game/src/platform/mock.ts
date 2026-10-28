import { noopPlatform, type Platform, type Row, type UgcRow } from './types';
import { DEV_CHALLENGES } from '../arena/devChallenges';
import { deviceCache } from './rundot';

/**
 * Local dev without the RUN host: console logging, no ads or purchases. Saves (tutorials skipped, builder draft,
 * coins) also go to this device's cache so they survive a reload, except in headless test browsers, which always
 * start from a fresh save.
 */
const store = new Map<string, string>();
const keep = typeof navigator !== 'undefined' && !/HeadlessChrome/.test(navigator.userAgent);
const PREFIX = 'mm_mock:';
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

const mockBoards = new Map<string, Row[]>();
const FAKE_NAMES = ['DragonSlayer', 'GoblinCrusher', 'ShadowBow', 'IronShield', 'MashMaster', 'HexBreaker', 'BoulderToss', 'ImpCatcher', 'StoneWall', 'RookieSling'];

/** Daily keeps the original table; every other board gets believable fake rows scaled to the board. */
function rowsFor(board: string): Row[] {
  let rows = mockBoards.get(board);
  if (!rows) {
    if (board === 'daily') rows = mockLeaderboardRows;
    else {
      const seed = [...board].reduce((n, c) => n + c.charCodeAt(0), 0);
      const top = board === 'overall' ? 18000 : 1800 + (seed % 6) * 500;
      rows = FAKE_NAMES.map((name, i) => ({ rank: i + 1, name, score: Math.round(top * (1 - i * 0.08)) }));
    }
    mockBoards.set(board, rows);
  }
  return rows;
}

/** In-memory community store for local dev: you are 'local'; two seeded authors let the not-my-level view be tried. */
const ugcRows: (UgcRow & { type: string })[] = [];
let ugcSeq = 0;
const nowMs = (): number => Date.now() + mockTimeOffset;
const seedUgc = (): void => {
  if (ugcRows.length) return;
  const mk = (n: number, author: string, uses: number, extra: Record<string, unknown>): void => {
    ugcRows.push({ id: `seed_${n}`, type: 'mm_challenge', authorId: `seed_author_${author}`, authorName: author, title: `${author}'s siege`, data: {
      v: 1, shots: 5, allowed: ['w_militia_blade', 'w_iron_cleaver', 'w_blast_tube'], ...extra,
      doc: DEV_CHALLENGES[n - 1].data.doc,
    }, uses, createdAt: nowMs() - n * 3600000, updatedAt: nowMs() });
  };
  mk(1, 'MashMaster', 42, {});
  mk(2, 'GoblinCrusher', 17, { shots: 3, allowed: ['w_militia_blade'] });
};

export const mockPlatform: Platform = {
  ...noopPlatform,
  hosted: false,
  async init(): Promise<void> { /* nothing to do */ },
  storage: {
    async get(key) { return store.get(key) ?? (keep ? deviceCache.get(PREFIX + key) : null); },
    async set(key, v) { store.set(key, v); if (keep) await deviceCache.set(PREFIX + key, v); },
  },
  async serverTime(): Promise<number> {
    return Date.now() + mockTimeOffset;
  },
  safeArea: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  lifecycle: { onPause() {}, onResume() {}, onSleep() {}, onQuit() {} },
  leaderboard: {
    async submit(board, score, _seconds, displayName) {
      console.debug('[mock] leaderboard submit', board, score);
      const rows = rowsFor(board);
      const existing = rows.find((r) => r.mine);
      if (existing) {
        existing.score = Math.max(existing.score, score);
      } else {
        rows.push({ rank: 0, name: displayName || 'Player', score, mine: true });
      }
      rows.sort((a, b) => b.score - a.score);
      rows.forEach((r, i) => { r.rank = i + 1; });
    },
    async top(board, n) {
      return rowsFor(board).slice(0, n);
    },
    async myRank(board) {
      const rows = rowsFor(board);
      const found = rows.find((r) => r.mine);
      return found ?? { rank: rows.length + 1, name: 'You', score: 0, mine: true };
    },
  },
  ugc: {
    async create(type, title, data) {
      seedUgc();
      const row = { id: `mock_${++ugcSeq}_${Date.now().toString(36)}`, type, authorId: 'local', authorName: 'You', title, data, uses: 0, createdAt: nowMs(), updatedAt: nowMs() };
      ugcRows.push(row);
      return { ...row };
    },
    async update(id, patch) {
      const row = ugcRows.find((r) => r.id === id && r.authorId === 'local');
      if (!row) return null;
      if (patch.title !== undefined) row.title = patch.title;
      if (patch.data) row.data = patch.data;
      row.updatedAt = nowMs();
      return { ...row };
    },
    async remove(id) {
      const i = ugcRows.findIndex((r) => r.id === id && r.authorId === 'local');
      if (i < 0) return false;
      ugcRows.splice(i, 1);
      return true;
    },
    async get(id) { seedUgc(); const r = ugcRows.find((x) => x.id === id); return r ? { ...r } : null; },
    async browse(type, sort, limit) {
      seedUgc();
      return ugcRows.filter((r) => r.type === type).sort((a, b) => (sort === 'mostUsed' ? b.uses - a.uses : b.createdAt - a.createdAt)).slice(0, limit).map((r) => ({ ...r }));
    },
    async mine(type, limit) { seedUgc(); return ugcRows.filter((r) => r.type === type && r.authorId === 'local').slice(0, limit).map((r) => ({ ...r })); },
    async adminRemove(id) {
      const i = ugcRows.findIndex((r) => r.id === id);
      if (i < 0) return false;
      ugcRows.splice(i, 1);
      return true;
    },
    async adminBrowse(type, limit) { seedUgc(); return ugcRows.filter((r) => r.type === type).slice(0, limit).map((r) => ({ ...r })); },
    async recordUse(id) {
      const r = ugcRows.find((x) => x.id === id);
      if (!r) return null;
      r.uses++;
      return r.uses;
    },
  },
  fullscreen: {
    available: () => true,
    onChange: (f: () => void) => { document.addEventListener('fullscreenchange', f); return () => document.removeEventListener('fullscreenchange', f); },
    note: () => (typeof document !== 'undefined' && typeof document.documentElement.requestFullscreen === 'function' ? '' : 'Full screen is not available in this browser.'),
    active: () => typeof document !== 'undefined' && !!document.fullscreenElement,
    async toggle() {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
      } catch { /* refused */ }
      return !!document.fullscreenElement;
    },
  },
  async share(text, params) {
    console.debug('[mock] share:', text, params ?? '');
    return true;
  },
  ads: {
    async rewardedReady() {
      return true;
    },
    async showRewarded() {
      console.debug('[mock] showRewarded watched successfully');
      return true;
    },
    async showInterstitial() {
      console.debug('[mock] showInterstitial');
      return true;
    },
  },
  iap: {
    available: () => true,
    async buy(itemId: string) {
      console.debug('[mock] iap buy:', itemId);
      return true;
    },
    async owned(_itemId: string) {
      return false;
    },
  },
  haptic(kind: 'light' | 'heavy') {
    console.debug('[mock] haptic:', kind);
  },
  track(event, data) { console.debug('[mock] track', event, data ?? ''); },
  funnel(step, name, funnel) { console.debug('[mock] funnel', funnel, step, name); },
  log(message) { console.debug('[mock]', message); },
};
