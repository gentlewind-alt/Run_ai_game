// Dev-only sanity check: every data row has an implementation (otherwise it falls back to the default behaviour).
import { data } from '../data/load';
import { ARTIFACTS } from './artifacts';
import { CONSUMABLES } from './consumables';
import { MONSTERS } from './monsters';
import { WEAPONS } from './weapons';

export function checkRegistries(): void {
  for (const w of data.content.weapons) if (!WEAPONS[w.id]) console.warn(`[data] weapon ${w.id} has no implementation in content/weapons`);
  for (const m of data.content.monsters) {
    const key = m.behavior ?? m.id;
    if (!MONSTERS[key] && m.behavior) console.warn(`[data] monster ${m.id} names behavior "${key}" which is not in content/monsters`);
  }
  for (const a of data.content.artifacts) if (!ARTIFACTS[a.id]) console.warn(`[data] artifact ${a.id} has no implementation in content/artifacts`);
  for (const id of Object.keys(ARTIFACTS)) {
    if (!data.content.artifacts.some((a) => a.id === id)) console.warn(`[data] artifact implementation ${id} is not in content.json`);
  }
  for (const c of data.content.consumables) if (!CONSUMABLES[c.id]) console.warn(`[data] consumable ${c.id} has no implementation in content/consumables`);
  for (const id of Object.keys(CONSUMABLES)) {
    if (!data.content.consumables.some((c) => c.id === id)) console.warn(`[data] consumable implementation ${id} is not in content.json`);
  }
}
