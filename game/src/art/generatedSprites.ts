// Sprites made with the RUN CLI (`rundot generate sprite`) and processed by tools/process_sprites.ps1.
// A weapon row with `sprite: "sprites/relics/<id>"` gets <path>.png (in flight, on the sling, in the queue) and <path>_card.png (cards),
// replacing the procedural textures of the same keys. Weapons without the field keep their procedural art.
import Phaser from 'phaser';
import { data } from '../data/load';
import { weaponTexture } from './textures';

const flightKey = (id: string): string => `gen_${id}`;
const cardKey = (id: string): string => `gen_card_${id}`;

export function preloadGeneratedSprites(scene: Phaser.Scene): void {
  for (const m of data.content.monsters) if (m.sprite) scene.load.image(`gen_mon_${m.id}`, `${m.sprite}.png`);
  for (const w of data.content.weapons) {
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
