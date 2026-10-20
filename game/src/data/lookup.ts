import { data } from './load';
import type { Level, MaterialDef, MonsterDef, WeaponDef } from './types';

const byId = <T extends { id: string }>(list: T[], id: string): T | undefined => list.find((x) => x.id === id);

export const weaponDef = (id: string): WeaponDef => byId(data.content.weapons, id)!;
export const monsterDef = (id: string): MonsterDef | undefined => byId(data.content.monsters, id);
export const materialDef = (id: string): MaterialDef | undefined => byId(data.content.materials, id);
/** Level 1 is the fallback for an unknown id. */
export const levelDef = (id: number): Level => data.levels[id] ?? data.levels[1];

const SHORT: Record<string, string> = {
  w_militia_blade: 'Blade', w_iron_cleaver: 'Cleaver', w_ashwood_staff: 'Staff', w_scrapheap_scattergun: 'Scatter',
  w_hunters_pike: 'Pike', w_hunters_boomerang: 'Boomerang', w_blast_tube: 'Blast tube', w_horned_scepter: 'Scepter',
};
/** Card-sized weapon names (cards are about 99 px wide). */
export const shortWeaponName = (id: string, fallback = id): string => SHORT[id] ?? fallback;
