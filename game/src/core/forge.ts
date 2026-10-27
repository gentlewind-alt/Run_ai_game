import { feature } from '../config/settings';
import { data } from '../data/load';
import type { ForgeRecipe } from '../data/forgeTypes';
import type { WeaponDef } from '../data/types';
import { platform } from '../platform';
import { changed, profile } from './profile';

const KEY = 'monster-mash.forge.v1';
let recipes: Record<string, ForgeRecipe> = {};
export const forgeEnabled = (): boolean => feature('weaponForge');
export const isForgeWeapon = (id: string): boolean => data.forge.weapons.some((w) => w.id === id);

/** How many forged weapons a level lets you bring: floor(shots x forgedShare) between minForged and maxForged, less on boss levels. */
export function forgeLimit(level: { shots?: number; kind?: string }): number {
  const L = data.forge.limits;
  const shots = level.shots ?? data.content.economy.loadoutSize;
  const n = Math.max(L.minForged, Math.min(L.maxForged, Math.floor(shots * L.forgedShare)));
  return level.kind === 'boss' ? Math.min(n, L.bossForged) : n;
}

export function validateRecipe(raw: unknown): ForgeRecipe {
  if (!raw || typeof raw !== 'object') throw new Error('Choose a weapon build.');
  const r = raw as ForgeRecipe;
  const f = data.forge;
  if (!f.weapons.some((w) => w.id === r.weaponId) || !f.traits.some((t) => t.id === r.traitId) ||
      !f.abilities.some((a) => a.id === r.abilityId) || !f.radiances.some((a) => a.id === r.radianceId)) {
    throw new Error('This build contains an unknown choice.');
  }
  return { weaponId: r.weaponId, traitId: r.traitId, abilityId: r.abilityId, radianceId: r.radianceId };
}

export const forgeRecipe = (id: string): ForgeRecipe => ({ ...(recipes[id] ?? { weaponId: id, ...data.forge.defaults }) });
export const forgeRecipes = (): ForgeRecipe[] => Object.values(recipes).map((r) => ({ ...r }));
const sameRecipe = (a: ForgeRecipe, b: ForgeRecipe): boolean => a.weaponId === b.weaponId && a.traitId === b.traitId && a.abilityId === b.abilityId && a.radianceId === b.radianceId;

/** Full price of a build: body + ability + trait + radiance, so every combination costs differently. */
export function forgeCost(raw: ForgeRecipe): { total: number; parts: { body: number; ability: number; trait: number; radiance: number } } {
  const c = data.forge.costs;
  const parts = { body: c.weapons[raw.weaponId] ?? 0, ability: c.abilities[raw.abilityId] ?? 0, trait: c.traits[raw.traitId] ?? 0, radiance: c.radiances[raw.radianceId] ?? 0 };
  return { total: parts.body + parts.ability + parts.trait + parts.radiance, parts };
}

/** What saving costs right now: full for a new build, a fraction for changing a saved one, nothing for no change. */
export function forgePrice(raw: ForgeRecipe): number {
  const saved = recipes[raw.weaponId];
  if (!saved) return forgeCost(raw).total;
  if (sameRecipe(saved, raw)) return 0;
  return Math.round(forgeCost(raw).total * data.forge.costs.reforgeFactor);
}

export function compileForgeRecipe(raw: ForgeRecipe): WeaponDef {
  const r = validateRecipe(raw);
  const f = data.forge;
  const base = f.weapons.find((w) => w.id === r.weaponId)!;
  const ability = f.abilities.find((a) => a.id === r.abilityId)!;
  const trait = f.traits.find((t) => t.id === r.traitId)!;
  const aura = f.radiances.find((a) => a.id === r.radianceId)!;
  return {
    ...base, physics: { ...base.physics }, ability: { ...base.ability, label: ability.name }, forge: r,
    params: { ...base.params, ...ability.params, ...trait.params, auraColor: parseInt(aura.color, 32) },
    launch: `${trait.name}: ${trait.description}`, tap: ability.description,
  };
}

function applyRecipes(): void {
  for (const base of data.forge.weapons) {
    const i = data.content.weapons.findIndex((w) => w.id === base.id);
    if (i >= 0) data.content.weapons[i] = compileForgeRecipe(forgeRecipe(base.id));
  }
  for (const id of Object.keys(recipes)) if (!profile.owned.weapons.includes(id)) profile.owned.weapons.push(id);
}

export async function loadForge(): Promise<void> {
  recipes = {};
  if (!forgeEnabled()) return;
  try {
    const saved = await platform.storage.get(KEY);
    if (saved) {
      const blob = JSON.parse(saved);
      if (blob?.version === 1 && Array.isArray(blob.recipes)) {
        for (const raw of blob.recipes) {
          try { const r = validateRecipe(raw); recipes[r.weaponId] = r; } catch { /* ignore a retired or malformed build */ }
        }
      }
    }
  } catch { platform.log('Forge builds could not be loaded; default builds are available.'); }
  applyRecipes();
}

let saving: Promise<void> = Promise.resolve();
export function saveForgeRecipe(raw: ForgeRecipe): Promise<void> {
  if (!forgeEnabled()) return Promise.reject(new Error('The Forge is unavailable.'));
  const r = validateRecipe(raw);
  saving = saving.catch(() => {}).then(async () => {
    const price = forgePrice(r);
    if (price > profile.coins) throw new Error('Not enough coins.');
    const next = { ...recipes, [r.weaponId]: r };
    const serialized = JSON.stringify({ version: 1, recipes: Object.values(next) });
    await platform.storage.set(KEY, serialized);
    if (await platform.storage.get(KEY) !== serialized) throw new Error('The build could not be saved.');
    if (price > 0) { profile.coins -= price; changed('coins'); } // not economy.spendCoins: the Arena verifier bundle stubs profile
    recipes = next;
    applyRecipes();
    changed('owned');
  });
  return saving;
}

/** A battle keeps its own definitions even if a later menu edits the saved build. */
export function forgeSnapshot(): Record<string, WeaponDef> {
  return forgeEnabled() ? Object.fromEntries(data.forge.weapons.map((w) => [w.id, compileForgeRecipe(forgeRecipe(w.id))])) : {};
}
