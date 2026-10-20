// Battle backdrop: sky, three parallax ridges and the ground. Layers scroll slower than the camera.
import Phaser from 'phaser';
import { H } from '../config/constants';
import { C, css } from './palette';

const SKY_BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

export function buildBackground(scene: Phaser.Scene, worldW: number, groundY: number): void {
  const WW = worldW;
  const LW = WW + 700;
  const pixels = (key: string, w: number, h: number, f: (x: number, y: number) => string | null): void => {
    if (scene.textures.exists(key)) return;
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext('2d')!;
    const img = ctx.createImageData(w, h);
    const cache: Record<string, number> = {};
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ch = f(x, y);
        if (!ch) continue;
        const col = (cache[ch] ??= C(ch));
        const i = (y * w + x) * 4;
        img.data[i] = (col >> 16) & 255;
        img.data[i + 1] = (col >> 8) & 255;
        img.data[i + 2] = col & 255;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    scene.textures.addCanvas(key, cv);
  };
  const hash = (n: number): number => {
    const s = Math.sin(n * 127.1) * 43758.5453;
    return s - Math.floor(s);
  };

  // flat sky bands (deep blue, blue, cyan) with a thin ordered dither where they meet
  const band = (y: number, x: number, edge: number, a: string, b: string): string => {
    const d = (y - edge) / 7 + 0.5; // 0..1 across a 7px seam
    return d <= 0 ? a : d >= 1 ? b : d > SKY_BAYER[(y % 4) * 4 + (x % 4)] / 16 ? b : a;
  };
  pixels(`par_sky_${WW}`, LW, H, (x, y) => (y < 140 ? band(y, x, 95, '9', 'a') : band(y, x, 205, 'a', 'b')));
  {
    const tex = scene.textures.get(`par_sky_${WW}`);
    const ctx = (tex.getSourceImage() as HTMLCanvasElement).getContext('2d')!;
    ctx.fillStyle = css(C('c'));
    for (let cx = 10; cx < LW; cx += 118) {
      const cy = 30 + hash(cx) * 90;
      ctx.fillRect(cx, cy, 28, 6);
      ctx.fillRect(cx + 8, cy - 6, 14, 6);
      ctx.fillRect(cx + 4, cy + 6, 18, 2);
    }
    (tex as Phaser.Textures.CanvasTexture).refresh();
  }

  const ridge = (base: number, amp: number, f1: number, ph: number, f2: number) => (x: number): number =>
    Math.round(groundY - base - amp * Math.abs(Math.sin(x / f1 + ph)) - 6 * Math.sin(x / f2));
  const far = ridge(110, 34, 70, 1, 23);
  const mid = ridge(70, 24, 52, 2, 17);
  const near = ridge(38, 15, 33, 4, 11);
  pixels(`par_far_${WW}`, LW, H, (x, y) => {
    const r = far(x);
    return y < r ? null : y < r + 2 ? 'd' : 'e';
  });
  pixels(`par_mid_${WW}`, LW, H, (x, y) => {
    const r = mid(x);
    return y < r ? null : y < r + 2 ? 'n' : '7';
  });
  pixels(`par_near_${WW}`, LW, H, (x, y) => {
    const r = near(x);
    if (y >= r) return y < r + 2 ? '6' : 'n';
    const cell = Math.floor(x / 29);
    if (hash(cell) < 0.55) {
      const cx = cell * 29 + 8 + Math.floor(hash(cell + 7) * 12);
      const th = 12 + Math.floor(hash(cell + 3) * 9);
      const top = near(cx) - th;
      const dy = y - top;
      if (dy >= 0 && dy < th) {
        const half = Math.floor(dy / 3) + 1;
        if (Math.abs(x - cx) < half && dy < th - 1) return Math.abs(x - cx) === half - 1 && x < cx ? 'n' : 'o';
        if (dy >= th - 3 && x === cx) return 'h';
      }
    }
    return null;
  });
  pixels(`ground_${WW}`, LW, H - groundY + 3, (x, y) => {
    if (y === 0) return x % 7 === 0 ? '6' : '5';
    if (y === 1) return '6';
    if (y === 2) return 'o';
    if (y < 7) return (x * 3 + y * 5) % 11 === 0 ? 'i' : 'g';
    if (y === 8) return 'h';
    return (x * 7 + y * 13) % 29 === 0 ? 'i' : (x * 5 + y * 3) % 31 === 0 ? 'h' : 'g';
  });

  const layer = (name: string, f: number, depth: number, y = 0): void => {
    scene.add.image(-350, y, `${name}_${WW}`).setOrigin(0).setScrollFactor(f, 1).setDepth(depth);
  };
  scene.add.rectangle(WW / 2, -300, WW + 1400, 700, C('9')).setDepth(-5).setScrollFactor(0.05, 1);
  scene.add.rectangle(WW / 2, H + 300, WW + 1400, 600, C('g')).setDepth(-5);
  layer('par_sky', 0.05, -4);
  layer('par_far', 0.25, -3);
  layer('par_mid', 0.5, -2);
  layer('par_near', 0.75, -1);
  layer('ground', 1, 0, groundY - 3);
}
