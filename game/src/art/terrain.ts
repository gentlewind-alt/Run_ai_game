// Draws the ground profile of a level as a pixel texture: a grass lip following the surface, then layered dirt.
import Phaser from 'phaser';
import { H } from '../config/constants';
import { pixelTexture, styleFor } from './backgrounds';

/** `surface(x)` gives the ground height at world x. The texture covers x0..x1 and the rows from `top` down to the screen bottom. */
export function terrainTexture(
  scene: Phaser.Scene, key: string, realm: string, surface: (x: number) => number, x0: number, x1: number, top: number,
): void {
  const S = styleFor(realm);
  const w = Math.ceil(x1 - x0);
  const h = Math.ceil(H - top + 4);
  pixelTexture(scene, key, w, h, (px, py) => {
    const wx = x0 + px;
    const sy = Math.round(surface(wx)) - top;
    const dy = py - sy;
    if (dy < 0) return null;
    // exposed vertical faces: rows between this column's surface and a lower neighbour's surface
    const left = Math.round(surface(wx - 1)) - top;
    const right = Math.round(surface(wx + 1)) - top;
    const face = (left > sy + 2 && py < left) || (right > sy + 2 && py < right);
    if (dy === 0) return px % 7 === 0 ? S.grass[1] : S.grass[0];
    if (dy === 1) return S.grass[1];
    if (dy === 2) return S.grass[2];
    if (face && dy < 14) return dy % 5 === 0 ? S.dirtDark : S.dirt;
    if (dy < 7) return (px * 3 + py * 5) % 11 === 0 ? S.pebble : S.dirt;
    if (dy === 8) return S.dirtDark;
    return (px * 7 + py * 13) % 29 === 0 ? S.pebble : (px * 5 + py * 3) % 31 === 0 ? S.dirtDark : S.dirt;
  });
}
