import { mockPlatform } from './mock';
import { rundotPlatform, sdkAvailable } from './rundot';
import type { Platform } from './types';

/** Testing switch: open the game with ?mock=1 to use the in-memory mock (fake leaderboard rows, no ads) even where the SDK exists. */
const forceMock = typeof location !== 'undefined' && /[?&]mock=1/.test(location.search);

/** The RUN adapter when the host is there, the in-memory mock otherwise. */
export const platform: Platform = !forceMock && sdkAvailable() ? rundotPlatform : mockPlatform;
export type { Platform } from './types';
