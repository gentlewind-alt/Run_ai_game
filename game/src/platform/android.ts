/// <reference types="vite/client" />
// The Play Store app (Capacitor): saves on the phone, AdMob ads, the Android back button and app pause/resume.
// Ads follow Google's Families policy: the player's age band (asked once, see scenes/AgeScene.ts) picks child-safe
// ads under 13; Google's consent form is shown where the law asks for it (EEA, UK). RUN-only services (leaderboards,
// community levels, Arena) are not here; their features are off for this target in config.json targets.android.
import { AdMob, AdmobConsentStatus, InterstitialAdPluginEvents, MaxAdContentRating, RewardAdPluginEvents } from '@capacitor-community/admob';
import { App } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';
import { Share } from '@capacitor/share';
import { data } from '../data/load';
import { firebaseSocial } from './firebase';
import { noopPlatform, type Platform } from './types';

export const AGE_KEY = 'age.band';
export type AgeBand = 'child' | 'teen';

// Real ads only in the store build (`npm run build:android:release`); every other build shows Google test ads.
const admob = () => { const cfg = data.config.targets?.android?.admob; return cfg && import.meta.env.VITE_LIVE_ADS === '1' ? { ...cfg, testing: false } : cfg; };
let adsReady = false;
let rewardedLoaded = false;

async function get(key: string): Promise<string | null> {
  try { return (await Preferences.get({ key })).value ?? null; } catch { return null; }
}

/** Starts AdMob once the age band is known: child-safe ads under 13, consent form where required, then preloads a rewarded ad. */
export async function startAds(): Promise<void> {
  const cfg = admob();
  const band = (await get(AGE_KEY)) as AgeBand | null;
  if (!cfg || !band || adsReady) return;
  const child = band === 'child';
  try {
    await AdMob.initialize({
      initializeForTesting: cfg.testing,
      tagForChildDirectedTreatment: child,
      tagForUnderAgeOfConsent: child,
      maxAdContentRating: (child ? cfg.childRating : cfg.teenRating) as MaxAdContentRating,
    });
    const consent = await AdMob.requestConsentInfo();
    const info = consent.status === AdmobConsentStatus.REQUIRED && consent.isConsentFormAvailable ? await AdMob.showConsentForm() : consent;
    adsReady = info.canRequestAds;
    if (adsReady) void loadRewarded();
  } catch {
    adsReady = false;
  }
}

async function loadRewarded(): Promise<boolean> {
  const cfg = admob();
  if (!adsReady || !cfg) return false;
  try {
    await AdMob.prepareRewardVideoAd({ adId: cfg.rewardedId, isTesting: cfg.testing });
    rewardedLoaded = true;
  } catch {
    rewardedLoaded = false;
  }
  return rewardedLoaded;
}

/** Resolves true only when the player watched to the reward; always preloads the next one. */
function showRewarded(): Promise<boolean> {
  return new Promise((resolve) => {
    let earned = false;
    const subs: Promise<{ remove(): Promise<void> }>[] = [];
    const done = (): void => {
      for (const s of subs) void s.then((h) => h.remove());
      rewardedLoaded = false;
      void loadRewarded();
      resolve(earned);
    };
    subs.push(AdMob.addListener(RewardAdPluginEvents.Rewarded, () => { earned = true; }));
    subs.push(AdMob.addListener(RewardAdPluginEvents.Dismissed, done));
    subs.push(AdMob.addListener(RewardAdPluginEvents.FailedToShow, done));
    AdMob.showRewardVideoAd().catch(done);
  });
}

function showInterstitial(): Promise<boolean> {
  const cfg = admob();
  if (!adsReady || !cfg) return Promise.resolve(false);
  return new Promise((resolve) => {
    const subs: Promise<{ remove(): Promise<void> }>[] = [];
    const done = (shown: boolean): void => {
      for (const s of subs) void s.then((h) => h.remove());
      resolve(shown);
    };
    subs.push(AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => done(true)));
    subs.push(AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, () => done(false)));
    AdMob.prepareInterstitial({ adId: cfg.interstitialId, isTesting: cfg.testing })
      .then(() => AdMob.showInterstitial())
      .catch(() => done(false));
  });
}

const storage: Platform['storage'] = {
  get,
  async set(key, v) {
    try { await Preferences.set({ key, value: v }); } catch { /* storage is optional */ }
  },
};
/** Online play: an anonymous Firebase account, score boards and shared levels (see firebase.ts). Offline it returns the usual empty answers. */
export const online = firebaseSocial(storage);

export const androidPlatform: Platform = {
  ...noopPlatform,
  hosted: false,
  async init(): Promise<void> { void startAds(); },
  storage,
  leaderboard: online.leaderboard,
  ugc: online.ugc,
  rerollName: online.rerollName,
  async share(text) {
    try {
      await Share.share({ text, dialogTitle: 'Challenge a friend' });
      return true;
    } catch {
      return false; // the player closed the share sheet or sharing is unavailable
    }
  },
  async profile() {
    // The Firebase user id and generated name when online; otherwise a stable id for this install, so builder drafts and stats stay tied to the phone.
    const account = await online.uid();
    if (account) return { id: account, name: await online.name(), anonymous: false };
    let id = (await get('player.id')) ?? '';
    if (!id) { id = `local_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`; await storage.set('player.id', id); }
    return { id, name: 'Player', anonymous: true };
  },
  safeArea: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  fullscreen: {
    available: () => false,
    active: () => true,
    async toggle() { return true; },
    note: () => '',
    onChange: () => () => {},
  },
  ads: {
    async rewardedReady() { return rewardedLoaded || loadRewarded(); },
    showRewarded,
    showInterstitial,
  },
  lifecycle: {
    onPause(f) { void App.addListener('pause', f); },
    onResume(f) { void App.addListener('resume', f); },
    onSleep() { /* pause covers it on Android */ },
    onQuit() { /* Android gives no reliable quit event; saves happen on pause */ },
    onBack(f) { void App.addListener('backButton', f); },
  },
  track() { /* no analytics in the app yet */ },
  funnel() { /* no analytics in the app yet */ },
  log(message) { console.info(message); },
};

/** Closes the app (the back button on the title screen). */
export const exitApp = (): void => { void App.exitApp(); };

// What the build alias '@target-platform' gives the rest of the game (see vite.config.ts and noTarget.ts).
export const targetPlatform: Platform | null = androidPlatform;
export const targetAgeGate: { key: string; startAds(): Promise<void> } | null = { key: AGE_KEY, startAds };
export const targetExit: (() => void) | null = exitApp;
