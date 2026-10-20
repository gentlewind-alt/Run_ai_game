export interface Row { rank: number; name: string; score: number }

/** The only way game code talks to the host. Every method catches its own errors and returns a safe default. */
export interface Platform {
  hosted: boolean; // false under the mock
  init(): Promise<void>;
  storage: { get(key: string): Promise<string | null>; set(key: string, v: string): Promise<void> };
  serverTime(): Promise<number>; // ms epoch
  profile(): Promise<{ id: string; name: string; avatarUrl?: string }>;
  safeArea(): { top: number; bottom: number; left: number; right: number };
  leaderboard: { submit(board: string, score: number): Promise<void>; top(board: string, n: number): Promise<Row[]>; myRank(board: string): Promise<Row | null> };
  share(text: string, params?: Record<string, string>): Promise<boolean>;
  ads: { rewardedReady(): Promise<boolean>; showRewarded(): Promise<boolean> };
  iap: { available(): boolean; buy(itemId: string): Promise<boolean>; owned(itemId: string): Promise<boolean> };
  lifecycle: { onPause(f: () => void): void; onResume(f: () => void): void; onSleep(f: () => void): void; onQuit(f: () => void): void };
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
  async profile(): Promise<{ id: string; name: string }> {
    return { id: 'local', name: 'Player' };
  },
  leaderboard: {
    async submit(): Promise<void> { /* later */ },
    async top(): Promise<Row[]> { return []; },
    async myRank(): Promise<Row | null> { return null; },
  },
  async share(): Promise<boolean> {
    return false;
  },
  ads: { async rewardedReady(): Promise<boolean> { return false; }, async showRewarded(): Promise<boolean> { return false; } },
  iap: { available: (): boolean => false, async buy(): Promise<boolean> { return false; }, async owned(): Promise<boolean> { return false; } },
  haptic(): void { /* later */ },
};
