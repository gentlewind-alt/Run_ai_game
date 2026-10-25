// TypeScript mirrors of game/schemas/*.json (only the fields the code reads).
export type Element = 'physical' | 'hellfire' | 'radiant' | 'void';
export type Params = Record<string, number>;
export type AbilityMode = 'button' | 'impact' | 'both' | 'none';
export type WeaponUnlock = string | { boss?: string; chest?: string; shop?: boolean; level?: number };

export interface WeaponDef {
  id: string;
  name: string;
  archetype?: string;
  element: Element;
  rarity?: 'common' | 'uncommon' | 'rare' | 'legendary';
  baseDamage: number;
  unlock: WeaponUnlock;
  price?: number;
  enabled?: boolean;
  extraSprites?: string[]; // more generated art loaded under its file name as the texture key (see art/generatedSprites.ts)
  launch?: string;
  sprite?: string;
  tap?: string;
  display?: { px?: number }; // flight size in world px for long items (arrows, spears); overrides config.display.weapon.flightPx
  physics: { radius: number; density: number; spin: number; gravity?: number; align?: boolean; friction?: number; restitution?: number; frictionAir?: number };
  ability: { mode: AbilityMode; label: string; charges?: number };
  params: Params;
}

export interface MonsterDef {
  id: string;
  name?: string;
  hp: number;
  weak: Element | null;
  resist: Element | null;
  sprite?: string; // generated art under public/ without extension (see art/generatedSprites.ts)
  behavior?: string;
  density?: number;
  boss?: boolean;
  flying?: boolean;
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
  homeMarginRight?: number;
  homeSlingFrac?: number;
  chestHp?: number;
  aimGrabRadius: number;
  minPull: number;
  debrisMinSpeed: number;
  projMinSpeed: number;
  bossRehitSteps: number;
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
  upgradeDamagePerStep: number;
  upgradeCostMultiplier: number;
  upgradeBaseCost: number;
  forgeRarityMultiplier?: Record<string, number>;
  maxUpgradeLevel: number;
}

export interface Economy {
  startCoins: number;
  replayCoinFactor: number;
  lossCoinFactor: number;
  maxConsumableStack: number;
  loadoutSize: number;
  artifactSlots: number;
  secondArtifactAfterLevel: number;
  dailyStreakRewardDay?: number;
  dailyStreakRewardCoins?: number;
  relicPityLosses?: number;
  relicMarketPrice?: Record<string, number>;
  /** Rewarded ads: coins per ad, ads per rolling window, window length, shots an out-of-shots ad gives. */
  ads?: { coinReward: number; perWindow: number; windowHours: number; extraShots: number };
}

export interface ArtifactDef { id: string; name: string; rarity?: string; price: number; effect: string; params?: Record<string, number | string | boolean> }
export interface ConsumableDef { id: string; name: string; price: number; effect: string; targeted?: boolean; params?: Record<string, number | string | boolean> }
export interface CosmeticDef {
  id: string;
  name: string;
  kind: 'sling_skin' | 'trail' | 'banner' | 'slot';
  slot?: boolean;
  priceCoins?: number;
  priceBits?: number;
  reward?: string;
  desc?: string;
  mods?: {
    launchSpeedMult?: number;
    twinFraction?: number;
    twinDelaySteps?: number;
  };
}

export interface Content {
  builder: BuilderConfig;
  tuning: Tuning;
  damageRules: DamageRules;
  economy: Economy;
  artifacts: ArtifactDef[];
  consumables: ConsumableDef[];
  cosmetics?: CosmeticDef[];
  weapons: WeaponDef[];
  monsters: MonsterDef[];
  materials: MaterialDef[];
  realms: { id: string; name?: string; levels: number[]; monsters: string[]; background?: string }[];
}

export interface LevelMonster { t: string; x: number; y: number; dir?: number; speed?: number; delay?: number; path?: number[][] }
export interface LevelBlock {
  m: string; x: number; y: number; w: number; h: number;
  id?: string; angle?: number; static?: boolean; shape?: 'rectangle' | 'circle' | 'triangle';
}
export interface LevelConnection {
  id: string;
  type: 'lock' | 'rope';
  a: string | null;
  b: string;
  pointA: { x: number; y: number };
  pointB: { x: number; y: number };
  length?: number;
}
export interface BuilderConfig {
  grid: number; worldW: number; groundY: number; minX: number; minY: number;
  maxBlocks: number; maxConnections: number; maxMonsters: number;
  materials: string[]; targets: string[]; loadout: string[];
  presets: { id: string; name: string; w: number; h: number; shape: 'rectangle' | 'circle' | 'triangle' }[];
  physics: { lockStiffness: number; lockSpan: number; ropeStiffness: number; ropeDamping: number };
}
export interface LevelChest { id: string; x: number; y: number; hp: number; reward: string }
export interface Level {
  id: number;
  name: string;
  realm?: string;
  kind?: string;
  _archetype?: string;
  worldW: number;
  homeZoom?: number;
  shots?: number;
  loadout?: string[];
  scoreTarget?: number;
  escapeLimit?: number;
  runnersStartOnShot?: boolean; // runners hold still until the first shot is fired, so the player is never out of time before they act
  hints?: string[];
  exit?: { x: number; y: number };
  terrain?: number[][];
  sling?: { x?: number; y?: number };
  overrides?: Record<string, Record<string, unknown>>;
  blocks: LevelBlock[];
  connections?: LevelConnection[];
  monsters: LevelMonster[];
  chests?: LevelChest[];
}

/** How big weapons are drawn, in world px (the viewport is 480x270; a goblin is about 16 px). Relic art is 32 px, so relicBonus applies to it. */
export interface WeaponDisplay { flightPx: number; slingPx: number; queuePx: number; relicBonus: number }

export interface Config {
  version: number;
  levels: number[];
  display: { pixelArt: boolean; maxParticles: number; weapon: WeaponDisplay };
  world: { groundY: number; slingX: number; slingY: number };
  physics: { stepHz: number; gravityY: number; positionIterations: number; velocityIterations: number; enableSleeping: boolean; maxStepsPerFrame: number };
  camera: {
    introPan: boolean; followShot: boolean; maxZoom: number; introMs: number; introHoldMs: number; toggleMs: number;
    followLead: number; followEase: number; groundFrac: number; zoomOutRise: number;
  };
  features: Record<string, boolean>;
  debug: { urlOverrides: boolean; testHook: boolean };
}
