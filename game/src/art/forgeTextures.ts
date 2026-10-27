import type Phaser from 'phaser';
import { forgeRecipe } from '../core/forge';
import { data } from '../data/load';
import type { ForgeRecipe } from '../data/forgeTypes';
import { C } from './palette';

type G = Phaser.GameObjects.Graphics;
const shade = (c: number, f: number): number => {
  const ch = (v: number): number => Math.max(0, Math.min(255, Math.round(v * f)));
  return (ch((c >> 16) & 255) << 16) | (ch((c >> 8) & 255) << 8) | ch(c & 255);
};

// The jewel on the guard says which trait the weapon carries.
const GEM: Record<string, string> = {
  balanced: 'c', overcharge: 'q', fortune: '4', reach: 'a', critical: '3',
  vulnerable: 'r', poison: '6', zap: 'b', shieldbreak: 'k', wither: 'u',
};

interface Look { blade: number; edge: number; dark: number; gem: number; curse: boolean; ability: string; trait: string }

/** Blade silhouettes: x range of the blade and where the guard sits, so the extras can hug any shape. */
const SHAPES: Record<string, { blades: [number, number, number, number][]; guard: [number, number, number, number]; tip: number; tipY: number; draw: (g: G, l: Look) => void }> = {
  sword: { blades: [[10, 3, 4, 12]], guard: [7, 14, 10, 2], tip: 12, tipY: 2, draw: (g, l) => { g.fillStyle(l.blade).fillRect(10, 3, 4, 12).fillRect(11, 2, 2, 1); } },
  longsword: { blades: [[10, 1, 4, 15]], guard: [6, 15, 12, 2], tip: 12, tipY: 0, draw: (g, l) => { g.fillStyle(l.blade).fillRect(10, 1, 4, 15).fillRect(11, 0, 2, 1); } },
  dagger: { blades: [[10, 6, 4, 8]], guard: [8, 14, 8, 2], tip: 12, tipY: 5, draw: (g, l) => { g.fillStyle(l.blade).fillTriangle(10, 14, 14, 14, 12, 5); } },
  cleaver: { blades: [[9, 4, 10, 11]], guard: [8, 14, 9, 2], tip: 14, tipY: 3, draw: (g, l) => { g.fillStyle(l.blade).fillRect(9, 5, 10, 10).fillRect(10, 4, 8, 1).fillStyle(l.edge).fillRect(18, 5, 1, 9); } },
  spear: { blades: [[8, 1, 8, 8]], guard: [10, 9, 4, 1], tip: 12, tipY: 0, draw: (g, l) => { g.fillStyle(l.blade).fillTriangle(8, 8, 16, 8, 12, 0); } },
  double_sword: { blades: [[5, 3, 3, 12], [16, 3, 3, 12]], guard: [3, 14, 18, 2], tip: 12, tipY: 2, draw: (g, l) => { g.fillStyle(l.blade).fillRect(5, 3, 3, 12).fillRect(16, 3, 3, 12).fillRect(6, 2, 1, 1).fillRect(17, 2, 1, 1); } },
};

function drawHandle(g: G, shape: string, l: Look): void {
  if (shape === 'spear') {
    g.fillStyle(C('0')).fillRect(10, 8, 4, 15);
    g.fillStyle(C('g')).fillRect(11, 9, 2, 13);
    g.fillStyle(C('i')).fillRect(11, 12, 2, 1).fillRect(11, 16, 2, 1);
    return;
  }
  g.fillStyle(C('0')).fillRect(9, 15, 6, 8);
  g.fillStyle(C('g')).fillRect(10, 15, 4, 7);
  g.fillStyle(C('i')).fillRect(10, 18, 4, 1);
  g.fillStyle(l.gem).fillRect(11, 21, 2, 2);
}

function drawBlade(g: G, shape: string, l: Look): void {
  const s = SHAPES[shape];
  s.draw(g, l);
  // a lit edge on the left and a shaded one on the right make the blade read as steel
  for (const [x, y, w, h] of s.blades) {
    g.fillStyle(l.edge).fillRect(x, y + 1, 1, Math.max(1, h - 2));
    g.fillStyle(l.dark).fillRect(x + w - 1, y + 2, 1, Math.max(1, h - 3));
  }
  if (shape === 'spear') g.fillStyle(l.edge).fillRect(10, 3, 1, 4);
  if (shape === 'dagger') g.fillStyle(l.edge).fillRect(11, 8, 1, 5);
}

function drawGuard(g: G, shape: string, l: Look): void {
  const [x, y, w, h] = SHAPES[shape].guard;
  const metal = l.curse ? C('m') : C('4');
  g.fillStyle(C('0')).fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle(metal).fillRect(x, y, w, h);
  g.fillStyle(l.curse ? C('u') : C('t')).fillRect(x, y, w, 1);
  if (l.curse) { // a cursed guard grows thorns
    g.fillStyle(C('r')).fillRect(x - 1, y - 2, 1, 2).fillRect(x + w, y - 2, 1, 2);
  } else { // a blessed guard carries a halo spark
    g.fillStyle(C('4')).fillRect(x - 1, y + 1, 1, 1).fillRect(x + w, y + 1, 1, 1);
  }
  if (shape !== 'spear') g.fillStyle(l.gem).fillRect(11, y, 2, h).fillStyle(C('c')).fillRect(11, y, 1, 1);
}

/** Trait detail on the blade itself. */
function drawTrait(g: G, shape: string, l: Look): void {
  const s = SHAPES[shape];
  const cx = s.tip;
  if (!l.curse) {
    g.fillStyle(C('4')); // blessed: a glint at the tip
    g.fillRect(cx, s.tipY - (s.tipY > 1 ? 2 : 0), 1, 1);
    if (s.tipY > 1) g.fillRect(cx - 1, s.tipY - 1, 3, 1).fillRect(cx, s.tipY - 2, 1, 3);
    if (l.trait === 'overcharge') g.fillStyle(C('q')).fillRect(cx - 1, 8, 3, 1);
    if (l.trait === 'fortune') g.fillStyle(C('4')).fillRect(cx, 7, 1, 1).fillRect(cx - 1, 10, 1, 1);
    if (l.trait === 'critical') g.fillStyle(C('3')).fillRect(cx - 1, 6, 1, 1).fillRect(cx + 1, 9, 1, 1);
    if (l.trait === 'reach') g.fillStyle(C('a')).fillRect(cx, 5, 1, 1).fillRect(cx, 8, 1, 1).fillRect(cx, 11, 1, 1);
  } else {
    const [bx, by] = s.blades[0];
    g.fillStyle(C('v')); // cursed: cracks run down the blade
    g.fillRect(bx + 1, by + 3, 1, 2).fillRect(bx + 2, by + 5, 1, 2).fillRect(bx + 1, by + 7, 1, 2);
    const drip: Record<string, string> = { vulnerable: 'r', poison: '6', zap: 'b', shieldbreak: 'k', wither: 'u' };
    g.fillStyle(C(drip[l.trait] ?? 'r')).fillRect(8, 18, 1, 3).fillRect(15, 17, 1, 4).fillRect(7, 22, 1, 1);
  }
}

/** Ability signature: each power leaves its own mark so the icon tells what the weapon does. */
function drawAbility(g: G, shape: string, l: Look): void {
  const s = SHAPES[shape];
  const [bx, by, bw, bh] = s.blades[0];
  const light = C('c');
  switch (l.ability) {
    case 'dance': g.fillStyle(light).fillRect(3, 6, 1, 1).fillRect(19, 9, 1, 1).fillRect(5, 1, 1, 1).fillRect(21, 3, 1, 1).fillStyle(l.blade).fillRect(2, 11, 2, 1).fillRect(20, 5, 2, 1); break;
    case 'rain': g.fillStyle(C('a')).fillRect(4, 1, 1, 3).fillRect(8, 0, 1, 3).fillRect(17, 0, 1, 3).fillRect(20, 2, 1, 3).fillStyle(light).fillRect(4, 1, 1, 1).fillRect(17, 0, 1, 1); break;
    case 'burst': g.fillStyle(C('p')).fillRect(bx + 1, by + 4, Math.max(2, bw - 2), 3).fillStyle(light).fillRect(bx + 1 + (bw > 4 ? 2 : 0), by + 5, 1, 1).fillStyle(C('q')).fillRect(bx - 2, by + 3, 1, 1).fillRect(bx + bw + 1, by + 7, 1, 1).fillRect(bx - 1, by + 9, 1, 1); break;
    case 'whip': g.fillStyle(C('0')).fillRect(10, 22, 6, 1).fillRect(15, 21, 4, 1).fillRect(18, 19, 3, 1).fillStyle(C('i')).fillRect(10, 22, 5, 1).fillRect(15, 21, 3, 1).fillRect(18, 20, 2, 1).fillStyle(light).fillRect(20, 18, 1, 1); break;
    case 'clone': g.fillStyle(l.blade, 0.42); for (const [x, y, w, h] of s.blades) g.fillRect(Math.min(21, x + 3), y + 2, Math.min(w, 24 - Math.min(21, x + 3)), h); g.fillStyle(light, 0.5).fillRect(Math.min(21, bx + 3), by + 3, 1, 4); break;
    case 'strike': g.fillStyle(C('0')).fillRect(5, 12, 14, 1).fillStyle(C('p')).fillRect(bx + (bw >> 1) - 1, by - 1, 2, 2).fillRect(bx - 3, by + 5, 2, 1).fillRect(bx + bw + 1, by + 2, 2, 1).fillStyle(light).fillRect(s.tip, Math.max(0, s.tipY - 1), 1, 1); break;
    case 'slash': g.fillStyle(light).fillRect(6, 2, 1, 2).fillRect(5, 5, 1, 3).fillRect(5, 9, 1, 3).fillRect(6, 13, 1, 1).fillStyle(l.blade).fillRect(7, 1, 2, 1).fillRect(7, 14, 1, 1); break;
    case 'spirit': g.fillStyle(light, 0.28).fillRect(Math.max(0, bx - 2), Math.max(0, by - 1), Math.min(24, bw + 4), bh + 2); g.fillStyle(light).fillRect(8, 3, 1, 2).fillRect(17, 1, 1, 2).fillRect(20, 8, 1, 2).fillRect(4, 9, 1, 1); break;
    case 'phantom': g.fillStyle(C('r'), 0.5); for (const [x, y, w, h] of s.blades) g.fillRect(Math.max(0, x - 3), y + 1, w, h); g.fillStyle(C('v')).fillRect(7, 20, 1, 3).fillRect(17, 19, 1, 3).fillStyle(C('r')).fillRect(6, 22, 1, 1).fillRect(18, 21, 1, 1); break;
    default: break;
  }
}

function lookOf(recipe: ForgeRecipe): Look {
  const aura = data.forge.radiances.find((r) => r.id === recipe.radianceId);
  const trait = data.forge.traits.find((t) => t.id === recipe.traitId);
  const blade = C(aura?.color ?? 'c');
  return { blade, edge: shade(blade, 1.55), dark: shade(blade, 0.55), gem: C(GEM[recipe.traitId] ?? 'c'), curse: trait?.kind === 'curse', ability: recipe.abilityId, trait: recipe.traitId };
}

/** Draws one forged weapon from its build (shape + trait + power + radiance) into `wpn_<id>`. */
export function drawForgeWeapon(scene: Phaser.Scene, recipe: ForgeRecipe, key = `wpn_${recipe.weaponId}`): void {
  const shape = recipe.weaponId.replace('w_forge_', '');
  if (!SHAPES[shape]) return;
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const l = lookOf(recipe);
  const g = scene.make.graphics({ x: 0, y: 0 });
  drawHandle(g, shape, l);
  drawAbility(g, shape, l); // behind the blade for echoes and wisps
  drawBlade(g, shape, l);
  drawGuard(g, shape, l);
  drawTrait(g, shape, l);
  g.generateTexture(key, 24, 24);
  g.destroy();
}

/** Every forged weapon, drawn for the build the player saved (or the default build). Safe to call again. */
export function registerForgeTextures(scene: Phaser.Scene): void {
  for (const w of data.forge.weapons) if (!scene.textures.exists(`wpn_${w.id}`)) drawForgeWeapon(scene, forgeRecipe(w.id));
}
