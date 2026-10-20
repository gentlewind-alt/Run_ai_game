import Phaser from 'phaser';
import { C, css } from './palette';

export function gridTexture(scene: Phaser.Scene, key: string, rows: string[]): void {
  if (scene.textures.exists(key)) return;
  const w = Math.max(...rows.map((r) => r.length));
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = rows.length;
  const ctx = cv.getContext('2d')!;
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) {
      if (r[x] === '.') continue;
      ctx.fillStyle = css(C(r[x]));
      ctx.fillRect(x, y, 1, 1);
    }
  });
  scene.textures.addCanvas(key, cv);
}

// 3x5 pixel font, rows separated by '/'.
const G: Record<string, string> = {
  A: '.X./X.X/XXX/X.X/X.X', B: 'XX./X.X/XX./X.X/XX.', C: '.XX/X../X../X../.XX',
  D: 'XX./X.X/X.X/X.X/XX.', E: 'XXX/X../XX./X../XXX', F: 'XXX/X../XX./X../X..',
  G: '.XX/X../X.X/X.X/.XX', H: 'X.X/X.X/XXX/X.X/X.X', I: 'XXX/.X./.X./.X./XXX',
  J: '..X/..X/..X/X.X/.X.', K: 'X.X/X.X/XX./X.X/X.X', L: 'X../X../X../X../XXX',
  M: 'X.X/XXX/XXX/X.X/X.X', N: 'XX./X.X/X.X/X.X/X.X', O: '.X./X.X/X.X/X.X/.X.',
  P: 'XX./X.X/XX./X../X..', Q: '.X./X.X/X.X/XXX/.XX', R: 'XX./X.X/XX./X.X/X.X',
  S: '.XX/X../.X./..X/XX.', T: 'XXX/.X./.X./.X./.X.', U: 'X.X/X.X/X.X/X.X/XXX',
  V: 'X.X/X.X/X.X/X.X/.X.', W: 'X.X/X.X/XXX/XXX/X.X', X: 'X.X/X.X/.X./X.X/X.X',
  Y: 'X.X/X.X/.X./.X./.X.', Z: 'XXX/..X/.X./X../XXX',
  '0': 'XXX/X.X/X.X/X.X/XXX', '1': '.X./XX./.X./.X./XXX', '2': 'XX./..X/.X./X../XXX',
  '3': 'XX./..X/.X./..X/XX.', '4': 'X.X/X.X/XXX/..X/..X', '5': 'XXX/X../XX./..X/XX.',
  '6': '.XX/X../XXX/X.X/XXX', '7': 'XXX/..X/.X./.X./.X.', '8': 'XXX/X.X/XXX/X.X/XXX',
  '9': 'XXX/X.X/XXX/..X/XX.',
  '+': '.../.X./XXX/.X./...', '-': '.../.../XXX/.../...', x: '.../X.X/.X./X.X/...',
  '!': '.X./.X./.X./.../.X.', '.': '.../.../.../.../.X.', ':': '.../.X./.../.X./...',
  '*': 'X.X/.X./XXX/.X./X.X', ' ': '.../.../.../.../...', '/': '..X/..X/.X./X../X..',
  '?': 'XX./..X/.X./.../.X.',
};

function ensurePixTexture(scene: Phaser.Scene, str: string, color: number): string {
  const key = `t:${str}:${color}`;
  if (scene.textures.exists(key)) return key;
  const w = str.length * 4 - 1;
  const cv = document.createElement('canvas');
  cv.width = w + 2;
  cv.height = 7;
  const ctx = cv.getContext('2d')!;
  const cells: [number, number][] = [];
  [...str.toUpperCase()].forEach((ch, i) => {
    (G[ch] ?? G['?']).split('/').forEach((row, ry) => {
      [...row].forEach((c, rx) => {
        if (c === 'X') cells.push([1 + i * 4 + rx, 1 + ry]);
      });
    });
  });
  ctx.fillStyle = css(C('0'));
  for (const [cx, cy] of cells) {
    ctx.fillRect(cx - 1, cy, 3, 1);
    ctx.fillRect(cx, cy - 1, 1, 3);
  }
  ctx.fillStyle = css(color);
  for (const [cx, cy] of cells) ctx.fillRect(cx, cy, 1, 1);
  scene.textures.addCanvas(key, cv);
  return key;
}

/** Crisp pixel text with a 1px outline, cached per (string, colour). Returns a centred Image. */
export function pixText(
  scene: Phaser.Scene, x: number, y: number, str: string, color = 0xf4f4f4, scale = 1,
): Phaser.GameObjects.Image {
  return scene.add.image(x, y, ensurePixTexture(scene, str, color)).setScale(scale);
}

/** Change an existing pixText image in place. */
export function setPixText(img: Phaser.GameObjects.Image, scene: Phaser.Scene, str: string, color = 0xf4f4f4): void {
  img.setTexture(ensurePixTexture(scene, str, color));
}
