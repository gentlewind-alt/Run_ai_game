// Loads and saves the player's profile through platform.storage as one versioned JSON blob (schemas/save.schema.json).
import { platform } from '../platform';
import { events } from './events';
import { DEBUG, SAVE_VERSION, freshProfile, profile, setProfile, type Profile } from './profile';

const KEY = 'save';
const BACKUP = 'save.bak';
const DEBOUNCE_MS = 500;

/** Upgrades a blob one version at a time: migrations[n] turns version n into n + 1. Add one with every schema bump. */
const migrations: Record<number, (s: Record<string, unknown>) => Record<string, unknown>> = {
  1: (s) => ({
    ...s,
    version: 2,
    stats: isObj(s.stats) ? s.stats : { bossLosses: {} },
  }),
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const numMap = (v: unknown, max = Infinity): Record<string, number> => {
  const out: Record<string, number> = {};
  if (isObj(v)) for (const [k, x] of Object.entries(v)) if (typeof x === 'number' && Number.isFinite(x) && x >= 0) out[k] = Math.min(Math.floor(x), max);
  return out;
};

/** Fills every field with a sane value so a hand-edited or old blob can never crash the game. */
export function sanitize(raw: Record<string, unknown>): Profile {
  const d = freshProfile();
  const owned = isObj(raw.owned) ? raw.owned : {};
  const eq = isObj(raw.equipped) ? raw.equipped : {};
  const st = isObj(raw.settings) ? raw.settings : {};
  const flags: Record<string, boolean> = {};
  if (isObj(raw.flags)) for (const [k, v] of Object.entries(raw.flags)) if (typeof v === 'boolean') flags[k] = v;
  const statsObj = isObj(raw.stats) ? raw.stats : {};
  const bossLosses = numMap(statsObj.bossLosses);
  const adWatches = Array.isArray(statsObj.adWatches) ? statsObj.adWatches.filter((t): t is number => typeof t === 'number' && Number.isFinite(t) && t > 0).slice(-20) : [];
  const weapons = strs(owned.weapons);
  const starterWeapon = (weapons.length ? weapons[0] : d.owned.weapons[0]) ?? 'w_militia_blade';
  const rawLoadout = strs(eq.loadout);
  const cosmetics = strs(owned.cosmetics);
  const hasQuiver = cosmetics.includes('gold_quiver') || cosmetics.includes('s_gold_quiver');
  const targetLoadoutSize = 6 + (hasQuiver ? 1 : 0);
  const loadout = rawLoadout.slice();
  if (loadout.length > 0 && loadout.length < targetLoadoutSize) {
    while (loadout.length < targetLoadoutSize) {
      loadout.push(starterWeapon);
    }
  }
  return {
    version: SAVE_VERSION,
    coins: Math.max(0, Math.floor(num(raw.coins, d.coins))),
    owned: {
      weapons: weapons.length ? weapons : d.owned.weapons,
      artifacts: strs(owned.artifacts),
      consumables: numMap(owned.consumables),
      cosmetics: strs(owned.cosmetics),
    },
    upgrades: numMap(raw.upgrades),
    equipped: { loadout, artifacts: strs(eq.artifacts), slingSkin: typeof eq.slingSkin === 'string' ? eq.slingSkin : undefined },
    stars: numMap(raw.stars, 3),
    best: numMap(raw.best),
    daily: {
      lastDay: isObj(raw.daily) && typeof raw.daily.lastDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.daily.lastDay) ? raw.daily.lastDay : undefined,
      streak: isObj(raw.daily) ? Math.max(0, Math.floor(num(raw.daily.streak, 0))) : 0,
      best: isObj(raw.daily) ? Math.max(0, Math.floor(num(raw.daily.best, 0))) : 0,
      rewardsClaimed: isObj(raw.daily) ? strs(raw.daily.rewardsClaimed) : [],
    },
    flags,
    stats: {
      bossLosses,
      adWatches,
    },
    settings: { muted: typeof st.muted === 'boolean' ? st.muted : false, musicOn: typeof st.musicOn === 'boolean' ? st.musicOn : true },
  };
}

/** Reads the save at boot. A corrupt blob is copied to a backup key and the player starts fresh; the game never crashes. */
export async function loadSave(): Promise<'fresh' | 'loaded' | 'recovered'> {
  let raw: string | null = null;
  try {
    raw = await platform.storage.get(KEY);
  } catch (e) {
    platform.log(`storage get failed, starting fresh: ${String(e)}`);
    setProfile(freshProfile());
    return 'recovered';
  }
  if (!raw) return 'fresh';
  try {
    let blob: unknown = JSON.parse(raw);
    if (!isObj(blob)) throw new Error('save is not an object');
    let v = num(blob.version, 1);
    while (v < SAVE_VERSION) {
      const mig = migrations[v];
      if (!mig) throw new Error(`no migration from save version ${v}`);
      blob = mig(blob as Record<string, unknown>);
      v++;
    }
    setProfile(sanitize(blob as Record<string, unknown>));
    return 'loaded';
  } catch (err) {
    platform.log(`save unreadable, backed up and starting fresh: ${String(err)}`);
    try {
      await platform.storage.set(BACKUP, raw);
    } catch {
      // backup best-effort
    }
    setProfile(freshProfile());
    return 'recovered';
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;

/** Writes the profile now. Debug sessions never write. */
export async function flushSave(): Promise<void> {
  if (timer !== undefined) {
    clearTimeout(timer);
    timer = undefined;
  }
  if (DEBUG) return;
  try {
    await platform.storage.set(KEY, JSON.stringify(profile));
  } catch (e) {
    platform.log(`flushSave failed: ${String(e)}`);
  }
}

export function scheduleSave(): void {
  if (DEBUG || timer !== undefined) return;
  timer = setTimeout(() => { void flushSave(); }, DEBOUNCE_MS);
}

let wired = false;
/** Saves (debounced) whenever the profile changes, and immediately when the host pauses or quits. */
export function wireSave(): void {
  if (wired) return;
  wired = true;
  events.on('profile:changed', scheduleSave);
  platform.lifecycle.onPause(() => { void flushSave(); });
  platform.lifecycle.onQuit(() => { void flushSave(); });
}
