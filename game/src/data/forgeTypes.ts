import type { WeaponDef } from './types';

export interface ForgeRecipe { weaponId: string; traitId: string; abilityId: string; radianceId: string }
export interface ForgeOption { id: string; name: string; description: string; params: Record<string, number> }
export interface ForgeTrait extends ForgeOption { kind: 'bless' | 'curse' }
export interface ForgeRadiance { id: string; name: string; color: string }
export interface ForgeConfig {
  weapons: WeaponDef[];
  abilities: ForgeOption[];
  traits: ForgeTrait[];
  radiances: ForgeRadiance[];
  defaults: { traitId: string; abilityId: string; radianceId: string };
  limits: { maxCopies: number; poisonTickSteps: number; poisonDamage: number; shieldBreakSteps: number; traitCooldownSteps: number };
  enemyAttack: { radius: number; density: number; speed: number; lifetimeSteps: number; bossDensity: number; bossSpeed: number; volleyCount: number; volleySpacing: number; gravity: number; bossGravity: number; jitter: number; friction: number; restitution: number };
}
