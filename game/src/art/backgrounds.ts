// Realm backdrops: sky, three parallax ridges and (optionally) a flat ground. Layers scroll slower than the camera.
// Each realm has its own light, not just its own tint: hills are daylight, the wood is dusk, the keep glows from below.
import Phaser from 'phaser';
import { H } from '../config/constants';
import { C, css } from './palette';

const SKY_BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

export interface RealmStyle {
  sky: [string, string, string]; // top, middle, horizon
  edges: [number, number]; // y where the sky bands meet
  far: [string, string]; // base, crest
  mid: [string, string];
  near: [string, string];
  trees: { fill: string; light: string; trunk: string; kind: 'pine' | 'spire' | 'none' };
  clouds: boolean;
  stars: boolean;
  moon: boolean;
  motes: string | null; // fireflies or embers drifting in the near layer
  grass: [string, string, string]; // terrain surface: edge, body, shadow
  dirt: string;
  dirtDark: string;
  pebble: string;
}

export const STYLES: Record<string, RealmStyle> = {
  hills: {
    sky: ['9', 'a', 'b'], edges: [95, 205], far: ['e', 'd'], mid: ['7', 'n'], near: ['n', '6'],
    trees: { fill: 'o', light: 'n', trunk: 'h', kind: 'pine' }, clouds: true, stars: false, moon: false, motes: null,
    grass: ['5', '6', 'o'], dirt: 'g', dirtDark: 'h', pebble: 'i',
  },
  wood: {
    sky: ['1', '8', '7'], edges: [80, 185], far: ['f', 'e'], mid: ['1', 'u'], near: ['o', '7'],
    trees: { fill: 'f', light: '8', trunk: 'v', kind: 'spire' }, clouds: false, stars: true, moon: true, motes: 'b',
    grass: ['7', 'n', 'o'], dirt: 'u', dirtDark: 'f', pebble: 'r',
  },
  keep: {
    sky: ['f', 'q', '3'], edges: [90, 195], far: ['m', 'e'], mid: ['f', 'm'], near: ['v', 'f'],
    trees: { fill: 'v', light: 'f', trunk: 'v', kind: 'none' }, clouds: false, stars: false, moon: false, motes: '4',
    grass: ['e', 'm', 'f'], dirt: 'm', dirtDark: 'f', pebble: 'k',
  },
};

// Frost Peaks: cold blue dusk, snowy ridges, drifting snowflakes, snow-covered ground.
STYLES.frost = {
  sky: ['8', '9', 'a'], edges: [80, 185], far: ['d', 'c'], mid: ['e', 'd'], near: ['f', 'e'],
  trees: { fill: 'e', light: 'd', trunk: 'f', kind: 'pine' }, clouds: false, stars: true, moon: false, motes: 'c',
  grass: ['c', 'd', 'e'], dirt: 'e', dirtDark: 'f', pebble: 'd',
};

// Ember Forge: a furnace cave, plum to red to orange sky from the glow below, basalt ground and drifting embers.
STYLES.ember = {
  sky: ['1', '2', '3'], edges: [85, 190], far: ['f', 'e'], mid: ['f', 'm'], near: ['0', 'f'],
  trees: { fill: '0', light: 'f', trunk: '0', kind: 'none' }, clouds: false, stars: false, moon: false, motes: '3',
  grass: ['3', 'f', '0'], dirt: 'f', dirtDark: '0', pebble: '2',
};

export const styleFor = (realm: string): RealmStyle => STYLES[realm] ?? STYLES.hills;

const hash = (n: number): number => {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
};

/** Paints a texture one pixel at a time from a palette-char function (null = transparent). */
export function pixelTexture(scene: Phaser.Scene, key: string, w: number, h: number, f: (x: number, y: number) => string | null): void {
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
}

export function buildBackground(scene: Phaser.Scene, worldW: number, groundY: number, realm = 'hills', ground = true): void {
  const S = styleFor(realm);
  const WW = worldW;
  const LW = WW + 700;
  const BH = Math.max(H, groundY + 120);
  const groundH = Math.max(70, BH - groundY + 3);
  const k = (n: string): string => `${n}_${realm}_${WW}`;

  // flat sky bands with a thin ordered dither where they meet
  const edge0 = Math.round(groundY * 0.32);
  const edge1 = Math.round(groundY * 0.65);
  const band = (y: number, x: number, edge: number, a: string, b: string): string => {
    const d = (y - edge) / 7 + 0.5;
    return d <= 0 ? a : d >= 1 ? b : d > SKY_BAYER[(y % 4) * 4 + (x % 4)] / 16 ? b : a;
  };
  pixelTexture(scene, k('par_sky'), LW, BH, (x, y) => (y < (edge0 + edge1) / 2 ? band(y, x, edge0, S.sky[0], S.sky[1]) : band(y, x, edge1, S.sky[1], S.sky[2])));
  {
    const tex = scene.textures.get(k('par_sky'));
    const ctx = (tex.getSourceImage() as HTMLCanvasElement).getContext('2d')!;
    if (S.clouds) {
      ctx.fillStyle = css(C('c'));
      for (let cx = 10; cx < LW; cx += 118) {
        const cy = 20 + hash(cx) * (groundY * 0.35);
        ctx.fillRect(cx, cy, 28, 6);
        ctx.fillRect(cx + 8, cy - 6, 14, 6);
        ctx.fillRect(cx + 4, cy + 6, 18, 2);
      }
    }
    if (S.stars) {
      for (let i = 0; i < LW / 9; i++) {
        const sx = Math.floor(hash(i) * LW);
        const sy = Math.floor(hash(i + 99) * (edge1 - 20));
        ctx.fillStyle = css(C(hash(i + 5) > 0.8 ? 'b' : 'c'));
        ctx.fillRect(sx, sy, 1, 1);
      }
    }
    if (S.moon) {
      const mx = Math.round(LW * 0.55);
      ctx.fillStyle = css(C('t'));
      ctx.beginPath();
      ctx.arc(mx, Math.round(groundY * 0.18), 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = css(C('1'));
      ctx.beginPath();
      ctx.arc(mx + 6, Math.round(groundY * 0.18) - 4, 13, 0, Math.PI * 2);
      ctx.fill();
    }
    (tex as Phaser.Textures.CanvasTexture).refresh();
  }

  const ridge = (base: number, amp: number, f1: number, ph: number, f2: number) => (x: number): number =>
    Math.round(groundY - base - amp * Math.abs(Math.sin(x / f1 + ph)) - 6 * Math.sin(x / f2));
  const far = ridge(110, 34, 70, 1, 23);
  const mid = ridge(70, 24, 52, 2, 17);
  const near = ridge(38, 15, 33, 4, 11);
  pixelTexture(scene, k('par_far'), LW, BH, (x, y) => {
    const r = far(x);
    return y < r ? null : y < r + 2 ? S.far[1] : S.far[0];
  });
  pixelTexture(scene, k('par_mid'), LW, BH, (x, y) => {
    const r = mid(x);
    return y < r ? null : y < r + 2 ? S.mid[1] : S.mid[0];
  });
  pixelTexture(scene, k('par_near'), LW, BH, (x, y) => {
    const r = near(x);
    if (y >= r) return y < r + 2 ? S.near[1] : S.near[0];
    const T = S.trees;
    if (T.kind === 'none') {
      if (S.motes && hash(x * 3 + y) > 0.9985) return S.motes;
      return null;
    }
    const cell = Math.floor(x / 29);
    if (hash(cell) < 0.55) {
      const cx = cell * 29 + 8 + Math.floor(hash(cell + 7) * 12);
      const th = (T.kind === 'spire' ? 18 : 12) + Math.floor(hash(cell + 3) * 9);
      const top = near(cx) - th;
      const dy = y - top;
      if (dy >= 0 && dy < th) {
        if (T.kind === 'pine') {
          const half = Math.floor(dy / 3) + 1;
          if (Math.abs(x - cx) < half && dy < th - 1) return Math.abs(x - cx) === half - 1 && x < cx ? T.light : T.fill;
          if (dy >= th - 3 && x === cx) return T.trunk;
        } else {
          // tall thin spires with a lit left edge, like a dark wood at dusk
          const half = Math.max(0, 2 - Math.floor(dy / 6));
          if (Math.abs(x - cx) <= half && dy < th - 2) return x < cx ? T.light : T.fill;
          if (dy >= th - 2 && x === cx) return T.trunk;
        }
      }
    }
    if (S.motes && hash(x * 7 + y * 3) > 0.9988) return S.motes;
    return null;
  });
  if (ground) {
    pixelTexture(scene, k('ground'), LW, groundH, (x, y) => {
      if (y === 0) return x % 7 === 0 ? S.grass[1] : S.grass[0];
      if (y === 1) return S.grass[1];
      if (y === 2) return S.grass[2];
      if (y < 7) return (x * 3 + y * 5) % 11 === 0 ? S.pebble : S.dirt;
      if (y === 8) return S.dirtDark;
      return (x * 7 + y * 13) % 29 === 0 ? S.pebble : (x * 5 + y * 3) % 31 === 0 ? S.dirtDark : S.dirt;
    });
  }

  const layer = (name: string, f: number, depth: number, y = 0): void => {
    scene.add.image(-350, y, k(name)).setOrigin(0).setScrollFactor(f, 1).setDepth(depth);
  };
  scene.add.rectangle(WW / 2, -300, WW + 1400, 700, C(S.sky[0])).setDepth(-5).setScrollFactor(0.05, 1);
  scene.add.rectangle(WW / 2, groundY + groundH + 300, WW + 1400, 600, C(S.dirt)).setDepth(-5);
  layer('par_sky', 0.05, -4);
  layer('par_far', 0.25, -3);
  layer('par_mid', 0.5, -2);
  layer('par_near', 0.75, -1);
  if (ground) layer('ground', 1, 0, groundY - 3);
}
