import type Phaser from 'phaser';
import { Px } from './textures';
import { gridTexture } from './pix';

// ------------------------------------------------------------------ Slingshots (16x48)

export function buildSlingQuicksilver(): Px {
  const p = new Px(16, 48);
  // Sleek silver/chrome post
  p.rect(6, 15, 5, 33, 'f');
  p.rect(7, 16, 3, 32, 'l');
  p.rect(8, 16, 1, 32, 'c');
  // Quicksilver swept fork
  p.rect(2, 3, 5, 16, 'f');
  p.rect(10, 3, 5, 16, 'f');
  p.rect(3, 4, 3, 14, 'l');
  p.rect(11, 4, 3, 14, 'l');
  p.rect(3, 4, 1, 14, 'c');
  p.rect(11, 4, 1, 14, 'c');
  // Cyan core ring on fork crossbar
  p.rect(5, 16, 7, 3, 'a');
  p.rect(7, 17, 3, 1, 'b');
  return p.outline();
}

export function buildSlingGemini(): Px {
  const p = new Px(16, 48);
  // Braided golden post
  p.rect(6, 15, 5, 33, 'h');
  p.rect(7, 16, 3, 32, 'i');
  p.rect(8, 16, 1, 32, '4');
  // Twin double fork
  p.rect(1, 2, 4, 17, 'h');
  p.rect(2, 3, 2, 15, '4');
  p.rect(11, 2, 4, 17, 'h');
  p.rect(12, 3, 2, 15, '4');
  // Dual anchor gems
  p.rect(1, 1, 3, 3, '3');
  p.rect(12, 1, 3, 3, '3');
  p.rect(5, 16, 7, 3, 'i');
  return p.outline();
}

function buildSlingEmberFork(): Px {
  const p = new Px(16, 48);
  p.rect(6, 15, 5, 33, 'v');
  p.rect(7, 17, 3, 30, '2');
  p.rect(2, 4, 4, 15, 'h'); p.rect(11, 4, 4, 15, 'h');
  p.rect(3, 4, 2, 12, '3'); p.rect(12, 4, 2, 12, '3');
  p.rect(3, 0, 2, 6, '4'); p.rect(12, 0, 2, 6, '4');
  p.rect(5, 16, 7, 3, '3');
  for (let y = 24; y < 45; y += 7) p.rect(6, y, 5, 2, 'h');
  return p.outline();
}

function buildSlingVenomCoil(): Px {
  const p = new Px(16, 48);
  p.rect(6, 15, 5, 33, 'h');
  p.rect(7, 17, 3, 30, '6');
  p.rect(1, 2, 4, 17, '6'); p.rect(12, 2, 4, 17, '6');
  p.rect(2, 1, 3, 3, '5'); p.rect(12, 1, 3, 3, '5');
  p.rect(4, 16, 9, 3, '6');
  for (let y = 21; y < 45; y += 6) p.line(5, y + 4, 12, y, '5');
  p.set(3, 3, '4'); p.set(13, 3, '4');
  return p.outline();
}

function buildSlingHexwood(): Px {
  const p = new Px(16, 48);
  p.rect(7, 15, 4, 33, 'v'); p.rect(6, 27, 4, 12, 'h');
  p.rect(2, 1, 4, 16, 'v'); p.rect(11, 5, 4, 14, 'v');
  p.line(5, 14, 9, 21, 'h'); p.line(12, 15, 9, 21, 'h');
  p.rect(2, 1, 3, 4, '8'); p.rect(12, 5, 3, 4, '8');
  for (let y = 24; y < 44; y += 7) {
    p.set(8, y, '9'); p.set(7, y + 1, '9'); p.set(9, y + 1, '9'); p.set(8, y + 2, '9');
  }
  return p.outline();
}

function buildSlingTitanBrace(): Px {
  const p = new Px(16, 48);
  p.rect(5, 15, 7, 33, 'f'); p.rect(6, 17, 5, 30, 'e');
  p.rect(0, 2, 6, 18, 'f'); p.rect(11, 2, 5, 18, 'f');
  p.rect(1, 3, 4, 15, 'l'); p.rect(12, 3, 3, 15, 'l');
  p.rect(4, 16, 9, 5, 'e'); p.rect(6, 17, 5, 2, 'c');
  for (let y = 26; y < 47; y += 8) p.rect(4, y, 9, 3, 'l');
  p.rect(7, 22, 3, 23, 'h');
  return p.outline();
}

// ------------------------------------------------------------------ FX Textures

export function buildFxBolt(): Px {
  const p = new Px(16, 64);
  // Full-height jagged lightning bolt with cyan halo and white core
  const coords: [number, number][] = [
    [8, 0], [7, 8], [9, 14], [6, 22], [10, 30], [7, 38], [11, 46], [8, 54], [8, 63],
  ];
  for (let i = 0; i < coords.length - 1; i++) {
    p.line(coords[i][0] - 1, coords[i][1], coords[i + 1][0] - 1, coords[i + 1][1], 'a');
    p.line(coords[i][0] + 1, coords[i][1], coords[i + 1][0] + 1, coords[i + 1][1], 'b');
  }
  for (let i = 0; i < coords.length - 1; i++) {
    p.line(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1], 'c');
  }
  return p;
}

export function buildFxWebSplat(): Px {
  const p = new Px(32, 32);
  const cx = 15;
  const cy = 15;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
  dirs.forEach(([dx, dy]) => {
    for (let k = 1; k <= 9; k++) p.set(cx + dx * k, cy + dy * k, 'c');
  });
  for (let a = 0; a < 360; a += 15) {
    const rad = (a * Math.PI) / 180;
    p.set(Math.round(cx + Math.cos(rad) * 4), Math.round(cy + Math.sin(rad) * 4), 'c');
    p.set(Math.round(cx + Math.cos(rad) * 8), Math.round(cy + Math.sin(rad) * 8), 'l');
    p.set(Math.round(cx + Math.cos(rad) * 12), Math.round(cy + Math.sin(rad) * 12), 'l');
  }
  return p.outline();
}

export function buildFxPalmBolt(): Px {
  const p = new Px(16, 8);
  // Fast flat cyan energy bolt with white core
  p.rect(0, 1, 16, 6, 'a');
  p.rect(2, 2, 12, 4, 'b');
  p.rect(4, 3, 10, 2, 'c');
  return p;
}

// ------------------------------------------------------------------ Registration

export function registerRelicTextures(scene: Phaser.Scene): void {
  // Slingshots
  gridTexture(scene, 'sling_quicksilver', buildSlingQuicksilver().rows());
  gridTexture(scene, 'sling_gemini', buildSlingGemini().rows());
  gridTexture(scene, 'sling_ember_fork', buildSlingEmberFork().rows());
  gridTexture(scene, 'sling_venom_coil', buildSlingVenomCoil().rows());
  gridTexture(scene, 'sling_hexwood', buildSlingHexwood().rows());
  gridTexture(scene, 'sling_titan_brace', buildSlingTitanBrace().rows());

  // FX Textures
  gridTexture(scene, 'fx_maul_bolt', buildFxBolt().rows());
  gridTexture(scene, 'fx_web_splat', buildFxWebSplat().rows());
  gridTexture(scene, 'fx_palm_bolt', buildFxPalmBolt().rows());
}
