// TypeScript mirrors of game/schemas/*.json (only the fields the code reads).
import type { ForgeRecipe } from './forgeTypes';
export type Element = 'physical' | 'hellfire' | 'radiant' | 'void';
export type Params = Record<string, number>;
export type AbilityMode = 'button' | 'impact' | 'both' | 'none';
export type WeaponUnlock = string | { boss?: string; chest?: string; shop?: boolean; level?: number };

export interface WeaponDef {
  forge?: ForgeRecipe;
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
  anim?: WeaponAnim; // launch/ability animation style (battle/weaponAnim.ts)
  display?: { px?: number }; // flight size in world px for long items (arrows, spears); overrides config.display.weapon.flightPx
  physics: { radius: number; density: number; spin: number; gravity?: number; tempo?: number; align?: boolean; friction?: number; restitution?: number; frictionAir?: number };
  ability: { mode: AbilityMode; label: string; charges?: number };
  params: Params;
}

export interface MonsterWandDef {
  length: number; handX: number; handY: number; shaftWidth: number;
  woodColor: string; tipColor: string; tipRadius: number; glowRadius: number; glowAlpha: number; depthOffset: number;
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
  wand?: MonsterWandDef;
  params?: Params;
}

export interface MaterialDef {
  id: string;
  hp: number;
  weak: Element | null;
  density?: number;
  friction?: number;
}

export interface StandTuning {
  standAspect: number; tipAngleDeg: number; restoreTorque: number; standDamping: number; standFrictionStatic: number; restSpeed: number; fallAwakeSteps: number; chainSpin: number;
}

export interface Tuning {
  physics: { stand: StandTuning };
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
  status: {
    burnDamage: number; burnTickSteps: number; curseMult: number; slowSpeedMult: number; slingStatusSteps: number;
    burning: {
      durationSteps: number; fadeSteps: number; tongueCount: number; tongueWidth: number; tongueHeight: number;
      tongueSpacing: number; flickerSteps: number; emberCount: number; emberRise: number; contactRadius: number;
    };
  };
  flow: {
    projectileSlowSteps: number; projectileMaxSteps: number; settleCalmSpeed: number; settleMinSteps: number;
    settleMaxSteps: number; winDelaySteps: number; homeSettleSteps: number;
  };
}

export interface DamageRules {
  globalScale: number;
  bias?: number; // per-level multiplier on all weapon and ability damage (a level's overrides.damageRules.bias); 1 when absent
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
  /** Multiplier on every coin payout from a win (first clear and replay); 1 = unchanged. */
  winCoinFactor?: number;
  maxConsumableStack: number;
  loadoutSize: number;
  artifactSlots: number;
  secondArtifactAfterLevel: number;
  dailyStreakRewardDay?: number;
  dailyStreakRewardCoins?: number;
  relicPityLosses?: number;
  relicMarketPrice?: Record<string, number>;
  /** Rewarded ads: coins per ad, ads per rolling window, window length, shots an out-of-shots ad gives. */
  ads?: { coinReward: number; perWindow: number; windowHours: number; extraShots: number; bonusDamage?: number };
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
    damageMult?: number;
    previewMult?: number;
    explosionRadiusMult?: number;
    poisonChance?: number;
    curseChance?: number;
  };
  upgrade?: {
    stat: 'launchSpeedMult' | 'twinFraction' | 'curseChance' | 'damageMult' | 'explosionRadiusMult' | 'poisonChance';
    perLevel: number;
    prices: number[];
  };
}

export interface ArenaMods {
  launchSpeedMult?: number;
  twinFraction?: number;
  twinDelaySteps?: number;
  previewMult?: number;
  damageMult?: number;
}
export interface ArenaSling { id: string; name: string; desc: string; price: number; skin: string | null; mods: ArenaMods }
export interface ArenaBoost {
  id: string; name: string; desc: string; mod: 'damageMult' | 'launchSpeedMult' | 'previewMult'; perLevel: number; prices: number[];
}
export interface ArenaCatalog { startCoins: number; stakes: number[]; slings: ArenaSling[]; boosts: ArenaBoost[] }

export interface Content {
  builder: BuilderConfig;
  tuning: Tuning;
  damageRules: DamageRules;
  economy: Economy;
  artifacts: ArtifactDef[];
  consumables: ConsumableDef[];
  cosmetics?: CosmeticDef[];
  arena: ArenaCatalog;
  weapons: WeaponDef[];
  monsters: MonsterDef[];
  materials: MaterialDef[];
  realms: { id: string; name?: string; levels: number[]; monsters: string[]; background?: string; music?: string }[];
}

export interface LevelMonster { id?: string; t: string; x: number; y: number; dir?: number; speed?: number; delay?: number; path?: number[][] }
export type BlockVariant = 'hollow' | 'wheel' | 'wheel_plank' | 'wheel_wedge';
export interface LevelBlock {
  m: string; x: number; y: number; w: number; h: number;
  id?: string; angle?: number; static?: boolean; shape?: 'rectangle' | 'circle' | 'triangle';
  variant?: BlockVariant;
}
export interface LevelConnection {
  id: string;
  type: 'lock' | 'rope' | 'pin';
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
  presets: { id: string; name: string; family: 'Planks' | 'Square' | 'Circle' | 'Wedge'; w: number; h: number; shape: 'rectangle' | 'circle' | 'triangle'; variant?: BlockVariant }[];
  physics: { lockStiffness: number; lockSpan: number; ropeStiffness: number; ropeDamping: number };
  surprise: BuilderSurpriseConfig;
}
export interface BuilderSurpriseConfig {
  retryLimit: number; edgePadding: number; structureGap: number; headroom: number;
  supportInset: number; contactTolerance: number; maxSupportWidth: number; maxFloorMass: number; damageBias: number; namePrefix: string; fortMinX: number; fortMaxX: number; excludeBehaviors: string[]; offsetMax: number; taperChance: number;
  pieces: { post: string; floor: string; taperFloor: string; wall: string; crenellation: string };
  sizes: Record<'small' | 'medium' | 'large', { tiers: number; bays: number; towers: number; stacks: number; monsters: number }>;
  styles: {
    towers: { minTiers: number };
    bunker: { tiers: number; wallLayers: number };
    bridge: { pillarTiers: number; topTierReduction: number };
    castle: { wallTiers: number };
    stacks: { minTiers: number; maxTiers: number };
  };
  realmMaterials: Record<string, string[]>;
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
/** Timings (steps) and sizes for the code-drawn launch and ability animation (battle/weaponAnim.ts). */
export interface WeaponAnimConfig {
  launchSteps: number; launchPop: number; launchSparks: number;
  abilitySteps: number; abilityPunch: number; abilityRing: number; abilitySparks: number; flashSteps: number;
  trailEvery: number; ghostAlpha: number; ghostMs: number;
  tumble: number; rock: number; rockSpeed: number; pulse: number; pulseSpeed: number;
  slashMs: number; kick: number; impactMinSpeed: number; impactSteps: number; impactSquash: number; aimTurn: number;
  flipSteps: number; flipTurns: number; flipLazy: number; frisbeeSpeed: number; corkSpeed: number; twirlSpeed: number; windmill: number;
}
/**
 * How a weapon moves: flight spin (physics spin), point (nose first), tumble (lazy spin), rock (upright sway), pulse (throbs),
 * aim (turns its muzzle to the nearest monster), flip, frisbee, corkscrew, twirl, windmill (see weaponAnim.ts flightMove); trail; and the ability move (slash, charge, slam, recoil, burst).
 */
export interface WeaponAnim { flight: 'spin' | 'point' | 'tumble' | 'rock' | 'pulse' | 'aim' | 'flip' | 'frisbee' | 'corkscrew' | 'twirl' | 'windmill'; trail: 'ghost' | 'sparks' | 'none'; ability: 'slash' | 'charge' | 'slam' | 'recoil' | 'burst'; colors: string[] }

export interface Config {
  version: number;
  levels: number[];
  display: { pixelArt: boolean; maxParticles: number; weapon: WeaponDisplay; weaponAnim: WeaponAnimConfig;
    ui: { buttonCorner: number; panelCorner: number; iconPx: number; iconGap: number; buttonPadding: number; disabledAlpha: number; backdropAlpha: number;
      plainPanelMinWidth: number; plainPanelMinHeight: number; listBackdropDimAlpha: number;
      title: { plateX: number; plateY: number; plateW: number; insetX: number; insetY: number; rowGap: number; emblemPx: number; playH: number; tileH: number; tileGap: number; tileRowH: number; captionOffset: number; tileIconPx: number; utilityH: number; utilityGap: number; utilityPadding: number; helpGap: number } } };
  world: { groundY: number; slingX: number; slingY: number };
  physics: { stepHz: number; gravityY: number; positionIterations: number; velocityIterations: number; enableSleeping: boolean; maxStepsPerFrame: number };
  camera: {
    introPan: boolean; followShot: boolean; maxZoom: number; introMs: number; introHoldMs: number; toggleMs: number;
    followLead: number; followEase: number; groundFrac: number; zoomOutRise: number;
  };
  features: Record<string, boolean>;
  links?: Record<string, string>;
  practice?: { levels: number[]; loadout: string[]; stakes: number[]; startCoins: number; botThinkMs: number; botSkill: number };
  debug: { urlOverrides: boolean; testHook: boolean };
}
