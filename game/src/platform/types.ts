import { openLink } from './link';

export interface Row { rank: number; name: string; score: number; /** This row is the signed-in player. */ mine?: boolean }

/** A user-generated entry in the shared community store (the Global Challenge levels and their scores). */
export interface UgcRow {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  data: Record<string, unknown>;
  uses: number;
  createdAt: number;
  updatedAt: number;
}

/** The only way game code talks to the host. Every method catches its own errors and returns a safe default. */
export interface Platform {
  hosted: boolean; // false under the mock
  init(): Promise<void>;
  storage: { get(key: string): Promise<string | null>; set(key: string, v: string): Promise<void> };
  serverTime(): Promise<number>; // ms epoch
  /** The signed-in player. `anonymous` is true for a guest (no RUN account). */
  profile(): Promise<{ id: string; name: string; avatarUrl?: string; anonymous?: boolean }>;
  safeArea(): { top: number; bottom: number; left: number; right: number };
  leaderboard: { submit(board: string, score: number, seconds?: number, displayName?: string): Promise<void>; top(board: string, n: number): Promise<Row[]>; myRank(board: string): Promise<Row | null> };
  /** Shared community store. Only the author of an entry can update or remove it (the host enforces this). */
  ugc: {
    create(type: string, title: string, data: Record<string, unknown>): Promise<UgcRow | null>;
    update(id: string, patch: { title?: string; data?: Record<string, unknown> }): Promise<UgcRow | null>;
    remove(id: string): Promise<boolean>;
    get(id: string): Promise<UgcRow | null>;
    browse(type: string, sort: 'mostUsed' | 'recent', limit: number): Promise<UgcRow[]>;
    mine(type: string, limit: number): Promise<UgcRow[]>;
    recordUse(id: string): Promise<number | null>;
    /** Owner and editors only (the host refuses anyone else): remove any entry, list any entries. */
    adminRemove(id: string): Promise<boolean>;
    adminBrowse(type: string, limit: number): Promise<UgcRow[]>;
    /** Optional: flag an entry for review (the Android app); one report per player. */
    report?(id: string): Promise<boolean>;
  };
  /** Full screen. `toggle` must run straight from a tap (the browser drops the gesture otherwise) and returns whether the game is full screen afterwards. */
  /** Opens a web link from a tap and copies it as a fallback. */
  openLink(url: string): Promise<{ copied: boolean }>;
  fullscreen: { available(): boolean; active(): boolean; toggle(): Promise<boolean>; /** Why the last toggle did nothing, or '' */ note(): string; /** Called whenever full screen turns on or off. */ onChange(f: () => void): () => void };
  share(text: string, params?: Record<string, string>): Promise<boolean>;
  /** Optional (the Android app): gives the player a new generated name and returns it. */
  rerollName?(): Promise<string>;
  ads: { rewardedReady(): Promise<boolean>; showRewarded(placementId?: string, placementName?: string): Promise<boolean>; /** Full-screen ad between battles; false where there are none. */ showInterstitial(): Promise<boolean> };
  iap: { available(): boolean; buy(itemId: string): Promise<boolean>; owned(itemId: string): Promise<boolean> };
  lifecycle: { onPause(f: () => void): void; onResume(f: () => void): void; onSleep(f: () => void): void; onQuit(f: () => void): void; /** The Android back button (app only). */ onBack?(f: () => void): void };
  haptic(kind: 'light' | 'heavy'): void;
  track(event: string, data?: object): void; // analytics
  funnel(step: number, name: string, funnel: string): void;
  log(message: string): void;
}

/** Shared safe defaults for everything the game does not use yet. */
export const noopPlatform = {
  async serverTime(): Promise<number> {
    return Date.now();
  },
  async profile(): Promise<{ id: string; name: string; anonymous?: boolean }> {
    return { id: 'local', name: 'Player', anonymous: true };
  },
  leaderboard: {
    async submit(): Promise<void> { /* later */ },
    async top(): Promise<Row[]> { return []; },
    async myRank(): Promise<Row | null> { return null; },
  },
  openLink,
  ugc: {
    async create(): Promise<UgcRow | null> { return null; },
    async update(): Promise<UgcRow | null> { return null; },
    async remove(): Promise<boolean> { return false; },
    async get(): Promise<UgcRow | null> { return null; },
    async browse(): Promise<UgcRow[]> { return []; },
    async mine(): Promise<UgcRow[]> { return []; },
    async recordUse(): Promise<number | null> { return null; },
    async adminRemove(): Promise<boolean> { return false; },
    async adminBrowse(): Promise<UgcRow[]> { return []; },
  },
  fullscreen: { available: (): boolean => false, active: (): boolean => false, async toggle(): Promise<boolean> { return false; }, note: (): string => '', onChange: (): (() => void) => () => {} },
  async share(): Promise<boolean> {
    return false;
  },
  ads: { async rewardedReady(): Promise<boolean> { return false; }, async showRewarded(): Promise<boolean> { return false; }, async showInterstitial(): Promise<boolean> { return false; } },
  iap: { available: (): boolean => false, async buy(): Promise<boolean> { return false; }, async owned(): Promise<boolean> { return false; } },
  haptic(): void { /* later */ },
};
