// The RUN web build's '@target-platform' (vite.config.ts alias): no extra platform, no age screen, no app exit.
// The Android build points the alias at android.ts instead, so Capacitor code never ships on RUN.
import type { Platform } from './types';

export const targetPlatform: Platform | null = null;
export const targetAgeGate: { key: string; startAds(): Promise<void> } | null = null;
export const targetExit: (() => void) | null = null;
