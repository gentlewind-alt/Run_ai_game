import Phaser from 'phaser';
import { C, css } from './palette';
import { gridTexture } from './pix';
import { BLADE, GOBLIN_IDLE } from './sprites';

// ---------------------------------------------------------------- tiny palette-bound drawing kit

export type Tone = [string, string, string]; // highlight, base, shade (light from the top left)

export class Px {
  g: string[][];
  constructor(public w: number, public h: number) {
    this.g = Array.from({ length: h }, () => Array<string>(w).fill('.'));
  }
  set(x: number, y: number, ch: string): void {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.g[y][x] = ch;
  }
  rect(x: number, y: number, w: number, h: number, ch: string): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, ch);
    return this;
  }
  /** Filled rect with 3-tone shading: highlight top and left, shade bottom and right. */
  rectT(x: number, y: number, w: number, h: number, t: Tone): this {
    this.rect(x, y, w, h, t[1]);
    if (w > 2 && h > 2) {
      this.rect(x, y, w, 1, t[0]);
      this.rect(x, y, 1, h, t[0]);
      this.rect(x, y + h - 1, w, 1, t[2]);
      this.rect(x + w - 1, y, 1, h, t[2]);
      this.set(x + w - 1, y, t[1]);
      this.set(x, y + h - 1, t[1]);
    }
    return this;
  }
  disc(cx: number, cy: number, r: number, t: Tone | string): this {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d > r) continue;
        if (typeof t === 'string') this.set(x, y, t);
        else this.set(x, y, d > r - 1.2 && x + y > cx + cy ? t[2] : d > r - 1.2 && x + y <= cx + cy - r * 0.4 ? t[0] : t[1]);
      }
    }
    return this;
  }
  line(x0: number, y0: number, x1: number, y1: number, ch: string): this {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) {
      const t = n === 0 ? 0 : i / n;
      this.set(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), ch);
    }
    return this;
  }
  poly(pts: [number, number][], ch: string): this {
    for (let y = 0; y < this.h; y++) {
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[(i + 1) % pts.length];
        if ((ay <= y + 0.5 && by > y + 0.5) || (by <= y + 0.5 && ay > y + 0.5)) {
          xs.push(ax + ((y + 0.5 - ay) / (by - ay)) * (bx - ax));
        }
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.round(xs[i]); x < Math.round(xs[i + 1]); x++) this.set(x, y, ch);
    }
    return this;
  }
  mirrorLeftToRight(): this {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w / 2; x++) if (this.g[y][x] !== '.' && this.g[y][this.w - 1 - x] === '.') this.g[y][this.w - 1 - x] = this.g[y][x];
    return this;
  }
  /** Ink outline around every filled pixel (4-neighbour), the house rule for all sprites. */
  outline(): this {
    const add: [number, number][] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.g[y][x] !== '.') continue;
        const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => (this.g[y + dy]?.[x + dx] ?? '.') !== '.' && this.g[y + dy][x + dx] !== '0');
        if (n) add.push([x, y]);
      }
    }
    for (const [x, y] of add) this.g[y][x] = '0';
    return this;
  }
  rows(): string[] {
    return this.g.map((r) => r.join(''));
  }
}

const WOOD: Tone = ['i', 'g', 'h'];
const STEEL: Tone = ['c', 'd', 'e'];
const DARK: Tone = ['e', 'm', 'f'];

export function addTexture(scene: Phaser.Scene, key: string, p: Px): void {
  gridTexture(scene, key, p.rows());
}

// ---------------------------------------------------------------- small monsters (16x16 grids, '!' eye, '?' pupil, '@' mouth)

function face(rows: string[], hurt: boolean): string[] {
  return rows.map((r, i) => {
    const o = r.replace(/!/g, hurt ? '0' : 'c').replace(/\?/g, '0').replace(/@/g, hurt ? '2' : '0');
    return hurt && i === 8 ? o.replace(/.cc./, '2222') : o;
  });
}

/** Per-pixel patches on top of a grid: [x, y, char]. */
function patch(rows: string[], ps: [number, number, string][]): string[] {
  const g = rows.map((r) => r.split(''));
  for (const [x, y, ch] of ps) if (g[y]?.[x] !== undefined) g[y][x] = ch;
  return g.map((r) => r.join(''));
}

function recolor(rows: string[], map: Record<string, string>): string[] {
  return rows.map((r) => [...r].map((ch) => map[ch] ?? ch).join(''));
}

// goblin: add a shade tone on the right edge so it reads in 3 tones
const GOBLIN = GOBLIN_IDLE.map((r, i) => (i === 6 ? r.replace(/c0/g, '!?') : i >= 5 && i <= 8 ? r.replace(/6(0\.*)$/, 'n$1') : r));

const BOMBER = patch(recolor(GOBLIN, { '2': '3', q: 'g' }), [
  [12, 8, '4'], [13, 7, '3'], [13, 9, '0'], [12, 10, '0'], [13, 10, '0'], [14, 10, '0'],
  [11, 11, '0'], [12, 11, 'e'], [13, 11, 'm'], [14, 11, 'm'], [15, 11, '0'],
  [11, 12, '0'], [12, 12, 'm'], [13, 12, 'm'], [14, 12, 'f'], [15, 12, '0'],
  [12, 13, '0'], [13, 13, '0'], [14, 13, '0'],
]);

const ARCHER = patch(recolor(GOBLIN, { '6': 'u', '5': 'r', n: '1', '2': 'f', q: '8' }), [
  [0, 3, '0'], [0, 2, 'u'], [15, 3, '0'], [15, 2, 'u'],
  [5, 3, 'c'], [6, 3, 'c'], [7, 3, 'c'], [8, 3, 'c'], [9, 3, 'c'], [10, 3, 'c'],
  [14, 5, 'g'], [15, 6, 'g'], [15, 7, 'g'], [15, 8, 'g'], [15, 9, 'g'], [15, 10, 'g'], [14, 11, 'g'],
  [14, 6, 'c'], [14, 7, 'c'], [14, 8, 'c'], [14, 9, 'c'], [14, 10, 'c'],
]);

const HEXER = patch([
  '.....000000.....',
  '....0rrrrrr0....',
  '...0rrrrrrrr0...',
  '..0rrr0000rrr0..',
  '..0rr0!00!0rr0..',
  '..0rr000000rr0..',
  '...0rrr00rrr0...',
  '...0rrrrrrrr0...',
  '..0rrrrrrrrrr0..',
  '.0rrrrrrrrrrrr0.',
  '.0rrr44rr44rrr0.',
  '.0rrrrrrrrrrrr0.',
  '0rrrrrrrrrrrrrr0',
  '0rrrrrrrrrrrrrr0',
  '0rrrrrrrrrrrrrr0',
  '0000000000000000',
].map((r, i) => (i >= 8 && i <= 14 ? r.replace(/r0$/, '10').replace(/rr0\./, '1r0.') : r)), [
  [14, 5, '4'], [14, 6, 'g'], [14, 7, 'g'], [14, 8, 'g'], [14, 9, 'g'], [14, 10, 'g'], [14, 11, 'g'], [14, 12, 'g'],
]);

const SKELETON = patch([
  '................',
  '.....000000.....',
  '....0cccccc0....',
  '...0cccccccc0...',
  '...0c00cc00c0...',
  '...0c00cc00c0...',
  '...0cccccccc0...',
  '....0c0cc0c0....',
  '.....022220.....',
  '....0cccccc0....',
  '...0c0c00c0c0...',
  '...0cccccccc0...',
  '....0c0cc0c0....',
  '.....0cddc0.....',
  '....0c0..0c0....',
  '...0c0....0c0...',
], [[5, 5, '4'], [10, 5, '4']]);

function imp(hurt: boolean): Px {
  const p = new Px(16, 16);
  p.poly([[0, 3], [5, 6], [5, 10], [3, 8], [2, 11], [1, 8], [0, 9]], '1');
  p.poly([[16, 3], [11, 6], [11, 10], [13, 8], [14, 11], [15, 8], [16, 9]], '1');
  p.disc(8, 9.5, 3.6, ['3', '2', 'q']);
  p.disc(8, 6.5, 4, ['3', '2', 'q']);
  p.line(5, 1, 6, 3, 'c'); p.line(11, 1, 10, 3, 'c');
  p.set(5, 2, 'c'); p.set(10, 2, 'c');
  p.set(6, 6, hurt ? '0' : 'c'); p.set(7, 6, '0'); p.set(9, 6, '0'); p.set(10, 6, hurt ? '0' : 'c');
  p.rect(7, 8, 3, 1, hurt ? '4' : '0');
  p.rect(6, 12, 1, 2, '2'); p.rect(9, 12, 1, 2, '2');
  p.line(11, 12, 14, 13, '2'); p.set(14, 14, '2');
  return p.outline();
}

// ---------------------------------------------------------------- big monsters (32x32, drawn with the kit)

function orc(hurt: boolean): Px {
  const p = new Px(32, 32);
  const skin: Tone = ['5', '6', 'n'];
  const armor: Tone = ['d', 'e', 'm'];
  p.rectT(10, 21, 5, 6, skin); p.rectT(17, 21, 5, 6, skin);
  p.rectT(9, 26, 6, 4, DARK); p.rectT(17, 26, 6, 4, DARK);
  p.rectT(6, 12, 20, 11, armor);
  p.rect(6, 21, 20, 2, 'g'); p.rect(14, 21, 4, 2, '4');
  p.rect(13, 14, 6, 1, 'c'); p.rect(15, 15, 2, 5, 'd');
  p.rectT(1, 13, 5, 11, skin); p.rectT(26, 13, 5, 11, skin);
  p.rectT(1, 23, 6, 4, skin); p.rectT(25, 23, 6, 4, skin);
  p.rectT(3, 9, 8, 5, armor); p.rectT(21, 9, 8, 5, armor);
  p.set(5, 8, 'd'); p.set(26, 8, 'd');
  p.rectT(10, 1, 12, 10, skin);
  p.rect(11, 4, 4, 1, 'h'); p.rect(17, 4, 4, 1, 'h');
  p.rect(12, 6, 2, 2, hurt ? '0' : 'c'); p.rect(18, 6, 2, 2, hurt ? '0' : 'c');
  p.set(13, 7, hurt ? '0' : '2'); p.set(19, 7, hurt ? '0' : '2');
  p.rect(13, 9, 6, 1, hurt ? '2' : '0');
  p.rect(12, 9, 2, 3, 'c'); p.rect(18, 9, 2, 3, 'c');
  return p.outline();
}

function troll(hurt: boolean): Px {
  const p = new Px(32, 32);
  const skin: Tone = ['d', 'e', 'f'];
  p.rectT(8, 22, 7, 8, skin); p.rectT(17, 22, 7, 8, skin);
  p.rectT(4, 11, 24, 13, skin);
  p.rectT(8, 20, 16, 5, WOOD);
  p.rect(11, 14, 10, 4, 'd');
  p.rectT(0, 12, 5, 15, skin); p.rectT(27, 12, 5, 15, skin);
  p.rectT(0, 25, 6, 4, skin); p.rectT(26, 25, 6, 4, skin);
  p.rectT(10, 2, 12, 10, skin);
  p.rect(14, 7, 4, 3, 'd');
  p.rect(12, 5, 2, 2, hurt ? '0' : '4'); p.rect(18, 5, 2, 2, hurt ? '0' : '4');
  p.set(13, 6, '0'); p.set(19, 6, '0');
  p.rect(12, 10, 8, 1, hurt ? '2' : '0');
  p.rect(10, 0, 3, 2, 'n'); p.rect(15, 0, 3, 2, 'n'); p.rect(20, 0, 2, 2, 'n');
  p.set(6, 12, 'n'); p.set(7, 12, 'n'); p.set(24, 13, 'n'); p.set(25, 13, 'n'); p.set(5, 17, 'o'); p.set(26, 18, 'o');
  p.rectT(28, 3, 3, 12, WOOD); p.set(31, 5, 'c'); p.set(31, 9, 'c'); p.set(27, 7, 'c');
  return p.outline();
}

function warlord(hurt: boolean, open = false): Px {
  const p = new Px(32, 32);
  const armor: Tone = ['d', 'e', 'm'];
  const iron: Tone = ['c', 'd', 'f'];
  p.rectT(9, 22, 6, 6, DARK); p.rectT(17, 22, 6, 6, DARK);
  p.rectT(8, 27, 7, 4, STEEL); p.rectT(17, 27, 7, 4, STEEL);
  p.rectT(5, 11, 22, 12, armor);
  p.rect(5, 20, 22, 2, 'g'); p.rect(13, 20, 6, 2, '4');
  p.rect(12, 13, 8, 1, 'c'); p.rect(15, 14, 2, 6, 'd');
  p.rectT(2, 9, 8, 6, iron); p.rectT(22, 9, 8, 6, iron);
  p.set(4, 7, 'c'); p.set(27, 7, 'c');
  p.rectT(1, 14, 5, 10, armor); p.rectT(26, 14, 5, 10, armor);
  p.rectT(9, 1, 14, 11, armor);
  p.line(7, 0, 9, 3, '4'); p.line(24, 0, 22, 3, '4');
  p.set(6, 0, '4'); p.set(25, 0, '4');
  if (open) {
    p.rect(11, 3, 10, 4, '0');
    p.rect(13, 4, 6, 2, hurt ? '1' : '3');
    p.set(15, 4, '4'); p.set(16, 4, '4');
    p.rect(10, 2, 12, 1, 'c');
  } else {
    p.rect(11, 5, 10, 2, '0');
    p.line(12, 5, 20, 5, hurt ? '2' : '4');
    p.set(14, 6, '0'); p.set(17, 6, '0');
  }
  return p.outline();
}

// ---------------------------------------------------------------- weapons (16x16, pointing up)

function weaponSprite(id: string): Px {
  const p = new Px(16, 16);
  switch (id) {
    case 'w_iron_cleaver':
      p.rectT(4, 0, 8, 9, STEEL); p.set(4, 0, '.'); p.set(11, 0, '.'); p.rect(5, 2, 1, 5, 'c');
      p.rect(5, 9, 6, 1, 'g'); p.rectT(7, 10, 2, 5, WOOD); p.rect(6, 15, 4, 1, '4');
      break;
    case 'w_ashwood_staff':
      p.rectT(7, 5, 2, 11, WOOD); p.rect(6, 5, 4, 1, 'g');
      p.disc(8, 3, 3.2, ['c', 'b', 'a']); p.set(7, 2, 'c');
      break;
    case 'w_scrapheap_scattergun':
      p.rectT(5, 0, 6, 2, DARK); p.rectT(6, 2, 4, 6, DARK); p.rectT(5, 8, 6, 3, ['d', 'e', 'm']);
      p.rectT(6, 11, 4, 4, WOOD); p.rect(10, 9, 2, 2, '4');
      break;
    case 'w_hunters_pike':
      p.rect(8, 0, 1, 1, 'c'); p.rect(7, 1, 3, 1, 'c'); p.rectT(6, 2, 5, 3, STEEL); p.rect(7, 5, 3, 1, 'd');
      p.rectT(7, 6, 2, 10, WOOD); p.rect(5, 7, 6, 2, '2');
      break;
    case 'w_hunters_boomerang':
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 8);
          if (d <= 7 && d >= 3.6) p.set(x, y, x + y < 14 ? 'c' : x + y > 17 ? 'e' : 'd');
        }
      }
      p.rect(7, 0, 2, 2, 'd'); p.rect(7, 14, 2, 2, 'e'); p.rect(0, 7, 2, 2, 'd'); p.rect(14, 7, 2, 2, 'e');
      break;
    case 'w_blast_tube':
      p.rectT(5, 3, 6, 11, DARK); p.rect(5, 6, 6, 1, '4'); p.rect(5, 10, 6, 1, '4');
      p.rect(6, 0, 4, 3, '3'); p.rect(7, 0, 2, 2, '4'); p.rectT(7, 14, 2, 2, WOOD);
      break;
    case 'w_horned_scepter':
      p.rectT(7, 6, 2, 10, ['2', 'q', '1']);
      p.line(7, 5, 4, 1, 'c'); p.line(8, 5, 11, 1, 'c'); p.set(4, 0, 'c'); p.set(11, 0, 'c');
      p.set(6, 4, 'c'); p.set(9, 4, 'c');
      p.disc(8, 4, 1.8, ['4', '3', '2']);
      break;
    default:
      break;
  }
  return p.outline();
}

// ---------------------------------------------------------------- element icons (7x7)

const ICONS: Record<string, string[]> = {
  physical: ['d.....d', '.d...d.', '..d.d..', '...c...', '..d.d..', '.d...d.', 'd.....d'],
  hellfire: ['...3...', '..33...', '..343..', '.3443..', '.34443.', '.34443.', '..333..'],
  radiant: ['...c...', '.c.4.c.', '..444..', 'c44444c', '..444..', '.c.4.c.', '...c...'],
  void: ['..111..', '.1rr1..', '1r..r1.', '1r.1r1.', '.1r.r1.', '..1rr1.', '...11..'],
};

// ---------------------------------------------------------------- registry

export interface MonsterArt {
  w: number; // physics body width
  h: number; // physics body height
  size: 16 | 32;
}

export const MONSTER_ART: Record<string, MonsterArt> = {
  goblin_grunt: { w: 12, h: 14, size: 16 },
  goblin_bomber: { w: 12, h: 14, size: 16 },
  dark_elf_archer: { w: 12, h: 14, size: 16 },
  dark_elf_hexer: { w: 12, h: 14, size: 16 },
  skeleton_runner: { w: 9, h: 14, size: 16 },
  imp: { w: 10, h: 10, size: 16 },
  orc_brute: { w: 22, h: 28, size: 32 },
  troll: { w: 24, h: 28, size: 32 },
  iron_warlord: { w: 26, h: 30, size: 32 },
};

export const WEAPON_IDS = [
  'w_militia_blade', 'w_iron_cleaver', 'w_ashwood_staff', 'w_scrapheap_scattergun',
  'w_hunters_pike', 'w_hunters_boomerang', 'w_blast_tube', 'w_horned_scepter',
];

export const weaponTexture = (id: string): string => `wpn_${id}`;

export const blockKey = (m: string, w: number, h: number, cracked: boolean): string => `blk_${m}_${w}x${h}${cracked ? '_c' : ''}`;

/** Textures a battle needs that depend on the level: one per block size and material (plus a cracked frame), the sling and the exit door. */
export function makeBattleTextures(scene: Phaser.Scene, blocks: { m: string; w: number; h: number }[]): void {
  const make = (key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): void => {
    if (scene.textures.exists(key)) return;
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    draw(cv.getContext('2d')!);
    scene.textures.addCanvas(key, cv);
  };
  const rect = (g: CanvasRenderingContext2D, ch: string, x: number, y: number, w: number, h: number): void => {
    g.fillStyle = css(C(ch));
    g.fillRect(x, y, w, h);
  };

  for (const b of blocks) {
    for (const cracked of [false, true]) {
      make(blockKey(b.m, b.w, b.h, cracked), b.w, b.h, (g) => {
        const m = b.m;
        rect(g, 'v', 0, 0, b.w, b.h);
        if (m === 'iron') {
          rect(g, 'e', 1, 1, b.w - 2, b.h - 2);
          rect(g, 'd', 1, 1, b.w - 2, 1);
          rect(g, 'd', 1, 1, 1, b.h - 2);
          rect(g, 'f', 1, b.h - 2, b.w - 2, 1);
          rect(g, 'f', b.w - 2, 1, 1, b.h - 2);
          if (b.w >= 10 && b.h >= 10) {
            rect(g, 'c', 2, 2, 2, 2);
            rect(g, 'c', b.w - 4, 2, 2, 2);
            rect(g, 'd', 2, b.h - 4, 2, 2);
            rect(g, 'd', b.w - 4, b.h - 4, 2, 2);
          }
        } else if (m === 'crystal') {
          rect(g, 'b', 1, 1, b.w - 2, b.h - 2);
          rect(g, 'c', 1, 1, b.w - 2, 1);
          rect(g, 'c', 1, 1, 1, b.h - 2);
          rect(g, 'a', 1, b.h - 2, b.w - 2, 1);
          rect(g, 'a', b.w - 2, 1, 1, b.h - 2);
          if (b.w >= 8 && b.h >= 8) {
            rect(g, 'c', Math.floor(b.w / 2) - 1, Math.floor(b.h / 2) - 1, 2, 2);
          }
        } else if (m === 'stone') {
          rect(g, 'k', 1, 1, b.w - 2, b.h - 2);
          rect(g, 'l', 1, 1, b.w - 2, 1);
          rect(g, 'l', 1, 1, 1, b.h - 2);
          rect(g, 'm', 1, b.h - 2, b.w - 2, 1);
          rect(g, 'm', b.w - 2, 1, 1, b.h - 2);
          if (b.w >= 10 && b.h >= 10) {
            rect(g, 'm', 3, 3, 2, 1);
            rect(g, 'l', b.w - 5, b.h - 4, 2, 1);
          }
        } else {
          rect(g, 'g', 1, 1, b.w - 2, b.h - 2);
          rect(g, 'i', 1, 1, b.w - 2, 1);
          rect(g, 'i', 1, 1, 1, b.h - 2);
          rect(g, 'h', 1, b.h - 2, b.w - 2, 1);
          rect(g, 'h', b.w - 2, 1, 1, b.h - 2);
          const long = Math.max(b.w, b.h);
          for (let i = 6; i < long - 2; i += 7) {
            if (b.w >= b.h) rect(g, 'h', i, 2, 1, b.h - 4);
            else rect(g, 'h', 2, i, b.w - 4, 1);
          }
        }
        if (cracked) {
          rect(g, 'v', Math.floor(b.w * 0.3), 1, 1, Math.floor(b.h * 0.5));
          rect(g, 'v', Math.floor(b.w * 0.3) + 1, Math.floor(b.h * 0.5), 1, Math.floor(b.h * 0.4));
          rect(g, 'v', Math.floor(b.w * 0.7), Math.floor(b.h * 0.3), 1, Math.floor(b.h * 0.6));
        }
      });
    }
  }

  make('sling', 16, 48, (g) => {
    rect(g, 'v', 6, 15, 5, 33);
    rect(g, 'h', 7, 16, 3, 32);
    rect(g, 'g', 8, 16, 1, 32);
    rect(g, 'v', 2, 3, 5, 16);
    rect(g, 'v', 10, 3, 5, 16);
    rect(g, 'h', 3, 4, 3, 14);
    rect(g, 'h', 11, 4, 3, 14);
    rect(g, 'i', 3, 4, 1, 14);
    rect(g, 'i', 11, 4, 1, 14);
    rect(g, 'h', 5, 16, 7, 3);
  });

  make('sling_bone', 16, 48, (g) => {
    rect(g, '0', 6, 15, 5, 33);
    rect(g, 'c', 7, 16, 3, 32);
    rect(g, 'b', 8, 16, 1, 32);
    rect(g, '0', 2, 3, 5, 16);
    rect(g, '0', 10, 3, 5, 16);
    rect(g, 'c', 3, 4, 3, 14);
    rect(g, 'c', 11, 4, 3, 14);
    rect(g, 'b', 3, 4, 1, 14);
    rect(g, 'b', 11, 4, 1, 14);
    rect(g, 'd', 5, 16, 7, 3);
  });

  make('sling_iron', 16, 48, (g) => {
    rect(g, '0', 6, 15, 5, 33);
    rect(g, 'f', 7, 16, 3, 32);
    rect(g, 'e', 8, 16, 1, 32);
    rect(g, '0', 2, 3, 5, 16);
    rect(g, '0', 10, 3, 5, 16);
    rect(g, 'e', 3, 4, 3, 14);
    rect(g, 'e', 11, 4, 3, 14);
    rect(g, 'c', 3, 4, 1, 14);
    rect(g, 'c', 11, 4, 1, 14);
    rect(g, 'f', 5, 16, 7, 3);
  });

  make('door', 16, 26, (g) => {
    rect(g, 'v', 0, 2, 16, 24);
    rect(g, 'v', 2, 0, 12, 2);
    rect(g, 'h', 1, 3, 14, 23);
    rect(g, 'g', 2, 3, 12, 23);
    rect(g, 'i', 2, 3, 12, 1);
    rect(g, 'h', 8, 4, 1, 22);
    rect(g, '4', 6, 14, 2, 2);
    rect(g, '2', 3, 8, 2, 3);
    rect(g, '2', 11, 8, 2, 3);
  });
}

function ghost(armsUp: boolean): Px {
  const p = new Px(16, 16);
  p.disc(8, 6, 4.5, ['b', 'c', 'd']);
  p.rectT(4, 6, 8, 7, ['b', 'c', 'd']);
  p.set(6, 5, '0');
  p.set(10, 5, '0');
  p.set(8, 7, '0');
  if (armsUp) {
    p.rectT(1, 3, 3, 4, ['b', 'c', 'd']);
    p.rectT(12, 3, 3, 4, ['b', 'c', 'd']);
  } else {
    p.rectT(2, 7, 3, 4, ['b', 'c', 'd']);
    p.rectT(11, 7, 3, 4, ['b', 'c', 'd']);
  }
  p.set(4, 13, 'c'); p.set(6, 13, 'c'); p.set(8, 13, 'c'); p.set(10, 13, 'c');
  p.outline();
  return p;
}

/** Create every sprite texture once. Safe to call on every scene start. */
export function registerArt(scene: Phaser.Scene): void {
  addTexture(scene, 'ghost_dance_1', ghost(false));
  addTexture(scene, 'ghost_dance_2', ghost(true));
  const small: Record<string, string[]> = {
    goblin_grunt: GOBLIN, goblin_bomber: BOMBER, dark_elf_archer: ARCHER, dark_elf_hexer: HEXER, skeleton_runner: SKELETON,
  };
  for (const [id, rows] of Object.entries(small)) {
    gridTexture(scene, id, face(rows, false));
    gridTexture(scene, `${id}_hurt`, face(rows, true));
  }
  addTexture(scene, 'imp', imp(false));
  addTexture(scene, 'imp_hurt', imp(true));
  addTexture(scene, 'orc_brute', orc(false));
  addTexture(scene, 'orc_brute_hurt', orc(true));
  addTexture(scene, 'troll', troll(false));
  addTexture(scene, 'troll_hurt', troll(true));
  addTexture(scene, 'iron_warlord', warlord(false, false));
  addTexture(scene, 'iron_warlord_open', warlord(false, true));
  addTexture(scene, 'iron_warlord_hurt', warlord(true, false));
  // goblin hurt frame (eyes squint) lives in sprites.ts via GOBLIN_HURT; reuse it for the redrawn goblin
  for (const id of WEAPON_IDS) {
    if (id === 'w_militia_blade') gridTexture(scene, weaponTexture(id), BLADE);
    else addTexture(scene, weaponTexture(id), weaponSprite(id));
  }
  for (const [k, rows] of Object.entries(ICONS)) gridTexture(scene, `el_${k}`, rows);
  if (!scene.textures.exists('ring')) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const ctx = cv.getContext('2d')!;
    ctx.strokeStyle = css(C('c'));
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.stroke();
    scene.textures.addCanvas('ring', cv);
  }
}

