// TypeScript mirrors of game/schemas/*.json (only the fields the code reads).
export type Element = 'physical' | 'hellfire' | 'radiant' | 'void';
export type Params = Record<string, number>;
export type AbilityMode = 'button' | 'impact' | 'both' | 'none';

export interface WeaponDef {
  id: string;
  name: string;
  element: Element;
  baseDamage: number;
  unlock: string;
  physics: { radius: number; density: number; spin: number; gravity?: number; align?: boolean; friction?: number; restitution?: number; frictionAir?: number };
  ability: { mode: AbilityMode; label: string };
  params: Params;
}

export interface MonsterDef {
  id: string;
  hp: number;
  weak: Element | null;
  resist: Element | null;
  behavior?: string;
  density?: number;
  params?: Params;
}

export interface MaterialDef {
  id: string;
  hp: number;
  weak: Element | null;
  density?: number;
  friction?: number;
}

export interface Tuning {
  launchK: number;
  maxPull: number;
  debrisK: number;
  blockDebrisFactor: number;
  fallThreshold: number;
  fallK: number;
  hitStopFrames: number;
  stretchSoundMs: number;
  homeZoomMin: number;
  homeLeft: number;
  aimGrabRadius: number;
  minPull: number;
  debrisMinSpeed: number;
  projMinSpeed: number;
  hitCooldownSteps: number;
  minImpactDamage: number;
  impactBase: number;
  explosionFalloff: number;
  explosionPush: number;
  explosionHitStop: number;
  mashHitStop: number;
  mashAt: number;
  coins: Record<string, number>;
  points: Record<string, number>;
  shotBonusPoints: number;
  shotBonusCoins: number;
  status: { burnDamage: number; burnTickSteps: number; curseMult: number; slowSpeedMult: number };
  flow: {
    projectileSlowSteps: number; projectileMaxSteps: number; settleCalmSpeed: number; settleMinSteps: number;
    settleMaxSteps: number; winDelaySteps: number; homeSettleSteps: number;
  };
}

export interface DamageRules {
  globalScale: number;
  elementWeak: number;
  elementResist: number;
  impactFactorMin: number;
  impactFactorMax: number;
  comboWindowSeconds: number;
  comboMultipliers: number[];
}

export interface Content {
  tuning: Tuning;
  damageRules: DamageRules;
  weapons: WeaponDef[];
  monsters: MonsterDef[];
  materials: MaterialDef[];
  realms: { id: string; levels: number[] }[];
}

export interface LevelMonster { t: string; x: number; y: number; dir?: number; speed?: number; delay?: number; path?: number[][] }
export interface LevelBlock { m: string; x: number; y: number; w: number; h: number }
export interface Level {
  id: number;
  name: string;
  realm?: string;
  kind?: string;
  worldW: number;
  shots?: number;
  loadout?: string[];
  scoreTarget?: number;
  escapeLimit?: number;
  hints?: string[];
  exit?: { x: number; y: number };
  overrides?: Record<string, Record<string, unknown>>;
  blocks: LevelBlock[];
  monsters: LevelMonster[];
}

export interface Config {
  version: number;
  levels: number[];
  display: { pixelArt: boolean; maxParticles: number };
  world: { groundY: number; slingX: number; slingY: number };
  physics: { stepHz: number; gravityY: number; positionIterations: number; velocityIterations: number; enableSleeping: boolean; maxStepsPerFrame: number };
  camera: {
    introPan: boolean; followShot: boolean; maxZoom: number; introMs: number; introHoldMs: number; toggleMs: number;
    followLead: number; followEase: number; groundFrac: number; zoomOutRise: number;
  };
  features: Record<string, boolean>;
  debug: { urlOverrides: boolean; testHook: boolean };
}
