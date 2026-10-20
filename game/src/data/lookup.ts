import { data } from './load';
import type { Level, MaterialDef, MonsterDef, WeaponDef } from './types';
import { generateDailyLevel } from '../content/levelKinds/daily';

const byId = <T extends { id: string }>(list: T[], id: string): T | undefined => list.find((x) => x.id === id);

export const weaponDef = (id: string): WeaponDef => byId(data.content.weapons, id)!;
export const monsterDef = (id: string): MonsterDef | undefined => byId(data.content.monsters, id);
export const materialDef = (id: string): MaterialDef | undefined => byId(data.content.materials, id);

export const setDailyLevel = (lvl: Level): void => {
  data.levels[0] = lvl;
};

/** Level 1 is the fallback for an unknown id. Level 0 is generated daily. */
export const levelDef = (id: number): Level => {
  if (id === 0) {
    if (!data.levels[0]) data.levels[0] = generateDailyLevel(Date.now());
    return data.levels[0];
  }
  return data.levels[id] ?? data.levels[1];
};

const SHORT: Record<string, string> = {
  w_militia_blade: 'Blade', w_iron_cleaver: 'Cleaver', w_ashwood_staff: 'Staff', w_scrapheap_scattergun: 'Scatter',
  w_hunters_pike: 'Pike', w_hunters_boomerang: 'Boomerang', w_blast_tube: 'Blast tube', w_horned_scepter: 'Scepter',
};
/** Card-sized weapon names (cards are about 99 px wide). */
export const shortWeaponName = (id: string, fallback = id): string => SHORT[id] ?? fallback;
