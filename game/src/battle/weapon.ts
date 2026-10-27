import { weaponDef } from '../data/lookup';
import type { WeaponDef } from '../data/types';
import type { BattleState } from './state';

export const battleWeapon = (b: BattleState, id: string): WeaponDef => b.forgeWeapons[id] ?? weaponDef(id);
