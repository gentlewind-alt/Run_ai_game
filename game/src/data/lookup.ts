import { data } from './load';
import type { Level, MaterialDef, MonsterDef, WeaponDef } from './types';

const byId = <T extends { id: string }>(list: T[], id: string): T | undefined => list.find((x) => x.id === id);

export const weaponDef = (id: string): WeaponDef => byId(data.content.weapons, id)!;
export const monsterDef = (id: string): MonsterDef | undefined => byId(data.content.monsters, id);
export const materialDef = (id: string): MaterialDef | undefined => byId(data.content.materials, id);
/** Level 1 is the fallback for an unknown id. */
export const levelDef = (id: number): Level => data.levels[id] ?? data.levels[1];
