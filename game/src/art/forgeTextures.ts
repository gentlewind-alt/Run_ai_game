import type Phaser from 'phaser';
import { C } from './palette';

/** Six original silhouettes, drawn on the same 24 px canvas and palette as the game. */
export function registerForgeTextures(scene: Phaser.Scene): void {
  const shapes: Record<string, (g: Phaser.GameObjects.Graphics) => void> = {
    sword: (g) => { g.fillRect(10, 3, 4, 12); g.fillRect(7, 14, 10, 2); },
    longsword: (g) => { g.fillRect(10, 1, 4, 15); g.fillRect(6, 15, 12, 2); },
    dagger: (g) => { g.fillTriangle(10, 14, 14, 14, 12, 6); g.fillRect(8, 14, 8, 2); },
    cleaver: (g) => { g.fillRect(9, 4, 10, 11); g.fillRect(8, 14, 9, 2); },
    spear: (g) => { g.fillRect(11, 7, 2, 15); g.fillTriangle(8, 8, 16, 8, 12, 1); },
    double_sword: (g) => { g.fillRect(5, 3, 3, 12); g.fillRect(16, 3, 3, 12); g.fillRect(3, 14, 7, 2); g.fillRect(14, 14, 7, 2); },
  };
  for (const [id, draw] of Object.entries(shapes)) {
    const key = `wpn_w_forge_${id}`;
    if (scene.textures.exists(key)) continue;
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(C('0')).fillRect(9, 15, 6, 8);
    g.fillStyle(C('g')).fillRect(10, 15, 4, 7);
    g.fillStyle(C('d')); draw(g);
    g.fillStyle(C('c')).fillRect(id === 'double_sword' ? 5 : 10, id === 'dagger' ? 12 : 4, 1, id === 'dagger' ? 2 : 9);
    if (id === 'double_sword') g.fillRect(16, 4, 1, 9);
    g.fillStyle(C('4')).fillRect(10, 16, 4, 2);
    g.generateTexture(key, 24, 24);
    g.destroy();
  }
}
