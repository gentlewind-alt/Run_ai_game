import { mockPlatform } from './mock';
import { rundotPlatform, sdkAvailable } from './rundot';
import type { Platform } from './types';

/** The RUN adapter when the host is there, the in-memory mock otherwise. */
export const platform: Platform = sdkAvailable() ? rundotPlatform : mockPlatform;
export type { Platform } from './types';
