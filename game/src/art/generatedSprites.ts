// Sprites made with the RUN CLI (`rundot generate sprite`) and processed by tools/process_sprites.ps1.
// A weapon row with `sprite: "sprites/relics/<id>"` gets <path>.png (in flight, on the sling, in the queue) and <path>_card.png (cards),
// replacing the procedural textures of the same keys. Weapons without the field keep their procedural art.
import Phaser from 'phaser';
import { data } from '../data/load';
import { MONSTER_ART, weaponTexture } from './textures';

const flightKey = (id: string): string => `gen_${id}`;
const cardKey = (id: string): string => `gen_card_${id}`;

export function preloadGeneratedSprites(scene: Phaser.Scene): void {
  for (const m of data.content.monsters) if (m.sprite) scene.load.image(`gen_mon_${m.id}`, `${m.sprite}.png`);
  for (const w of data.content.weapons) {
    for (const path of w.extraSprites ?? []) scene.load.image(path.split('/').pop() as string, `${path}.png`);
    if (!w.sprite) continue;
    scene.load.image(flightKey(w.id), `${w.sprite}.png`);
    scene.load.image(cardKey(w.id), `${w.sprite}_card.png`);
  }
}

function replace(scene: Phaser.Scene, key: string, from: string): void {
  if (!scene.textures.exists(from)) return;
  const img = scene.textures.get(from).getSourceImage() as HTMLImageElement;
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addImage(key, img);
}

/** Call after registerArt(): swaps in the generated art, including the state variants (charged, armed, split, planted) so a weapon never changes look mid-flight. */
export function applyGeneratedSprites(scene: Phaser.Scene): void {
  for (const m of data.content.monsters) if (m.sprite) replace(scene, m.id, `gen_mon_${m.id}`);
  for (const w of data.content.weapons) {
    if (!w.sprite) continue;
    const base = weaponTexture(w.id);
    replace(scene, base, flightKey(w.id));
    for (const v of ['charged', 'armed', 'split', 'planted']) replace(scene, `${base}_${v}`, flightKey(w.id));
    replace(scene, `wpn_card_${w.id}`, cardKey(w.id));
  }
}

/**
 * Realm 4-6 monsters only have generated art. If a file never loaded (blocked, offline, a CDN hiccup) draw a plain
 * silhouette instead of Phaser's green missing-texture box.
 */
export function ensureMonsterTextures(scene: Phaser.Scene): void {
  for (const m of data.content.monsters) {
    if (scene.textures.exists(m.id)) continue;
    const art = MONSTER_ART[m.id];
    if (!art) continue;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    const px = art.size;
    const w = Math.round(px * 0.8);
    const h = Math.round(px * 0.9);
    g.fillStyle(0x1a1c2c, 1).fillRoundedRect((px - w) / 2, px - h, w, h, 4);
    g.fillStyle(m.boss ? 0xb13e53 : 0x5d275d, 1).fillRoundedRect((px - w) / 2 + 2, px - h + 2, w - 4, h - 4, 3);
    g.fillStyle(0xffcd75, 1).fillRect(px / 2 - w * 0.22, px - h * 0.72, 3, 3).fillRect(px / 2 + w * 0.22 - 3, px - h * 0.72, 3, 3);
    g.generateTexture(m.id, px, px);
    g.destroy();
  }
}
