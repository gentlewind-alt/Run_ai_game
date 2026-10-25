import type { Config, Content, DamageRules, Level, Tuning } from '../data/types';

/** One merged settings object per battle. Order: code defaults, config.json, content.json, level overrides, URL overrides (?debug=1). */
export interface Settings extends Config {
  tune: Tuning;
  rules: DamageRules;
  stepMs: number; // length of one fixed gameplay step
}

// Defaults so a missing key never crashes. config.json is the real source.
const DEFAULTS: Config = {
  version: 1,
  levels: [1],
  display: { pixelArt: true, maxParticles: 90, weapon: { flightPx: 16, slingPx: 24, queuePx: 24, relicBonus: 1.25 } },
  world: { groundY: 320, slingX: 56, slingY: 262 },
  physics: { stepHz: 60, gravityY: 1, positionIterations: 8, velocityIterations: 6, enableSleeping: true, maxStepsPerFrame: 3 },
  camera: {
    introPan: true, followShot: true, maxZoom: 1.8, introMs: 900, introHoldMs: 450, toggleMs: 260,
    followLead: 0.15, followEase: 0.1, groundFrac: 0.83, zoomOutRise: 0.4,
  },
  features: { combo: true, zoom: true },
  debug: { urlOverrides: true, testHook: true },
};

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

function merge(target: Obj, src: Obj | undefined): Obj {
  if (!src) return target;
  for (const [k, v] of Object.entries(src)) {
    if (k.startsWith('_') || v === undefined) continue;
    if (isObj(v)) target[k] = merge(isObj(target[k]) ? (target[k] as Obj) : {}, v);
    else target[k] = v;
  }
  return target;
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const query = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
const local = typeof location !== 'undefined' && (['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) || location.hostname.endsWith('.localhost'));
/** Debug mode (cheats, the debug panel, the test hook): ?debug=1, and only on localhost or the dev server, never on the hosted game. */
export const DEBUG = query.get('debug') === '1' && (local || !!(import.meta as any).env?.DEV);

let config: Config = DEFAULTS;
let content: Content | undefined;
let current: Settings | undefined;

export function initSettings(c: Config, ct: Content): void {
  config = merge(clone(DEFAULTS) as unknown as Obj, c as unknown as Obj) as unknown as Config;
  content = ct;
  current = undefined;
}

/** Config merged with content tuning, level overrides and (in debug) URL overrides like `tune.launchK=0.3`. */
export function levelSettings(level?: Level): Settings {
  const s = clone(config) as unknown as Obj;
  s.tune = clone(content!.tuning);
  s.rules = clone(content!.damageRules);
  const ov = level?.overrides ?? {};
  merge(s, { tune: ov.tuning, rules: ov.damageRules, features: ov.features, camera: ov.camera });
  if (DEBUG && config.debug.urlOverrides) {
    for (const [k, raw] of query) {
      const path = k.split('.');
      if (path.length < 2 || !['tune', 'rules', 'features', 'camera', 'physics', 'world', 'display'].includes(path[0])) continue;
      const v = raw === 'true' ? true : raw === 'false' ? false : Number.isNaN(Number(raw)) ? raw : Number(raw);
      let o = s;
      for (const p of path.slice(0, -1)) o = (isObj(o[p]) ? o[p] : (o[p] = {})) as Obj;
      o[path[path.length - 1]] = v;
    }
  }
  const out = s as unknown as Settings;
  out.stepMs = 1000 / out.physics.stepHz;
  return out;
}

/** Settings without a level (menus, Phaser config). */
export function getSettings(): Settings {
  return (current ??= levelSettings());
}

export const feature = (name: string): boolean => getSettings().features[name] === true;
