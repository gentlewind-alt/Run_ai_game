// Dev-only sanity check: every data row has an implementation (otherwise it falls back to the default behaviour).
import { data } from '../data/load';
import { MONSTERS } from './monsters';
import { WEAPONS } from './weapons';

export function checkRegistries(): void {
  for (const w of data.content.weapons) if (!WEAPONS[w.id]) console.warn(`[data] weapon ${w.id} has no implementation in content/weapons`);
  for (const m of data.content.monsters) {
    const key = m.behavior ?? m.id;
    if (!MONSTERS[key] && m.behavior) console.warn(`[data] monster ${m.id} names behavior "${key}" which is not in content/monsters`);
  }
}
