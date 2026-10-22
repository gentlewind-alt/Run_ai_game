import Phaser from 'phaser';
import { C, css } from './palette';
import { gridTexture } from './pix';
import { BLADE } from './sprites';
import { registerMonsterTextures } from './monsterTextures';
import { registerOmnitrixTextures } from './omnitrixTextures';
import { registerRelicTextures } from './relicTextures';

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

export const WOOD: Tone = ['i', 'g', 'h'];
export const STEEL: Tone = ['c', 'd', 'e'];
export const DARK: Tone = ['e', 'm', 'f'];

export function addTexture(scene: Phaser.Scene, key: string, p: Px): void {
  gridTexture(scene, key, p.rows());
}

// ---------------------------------------------------------------- weapons (16x16, pointing up)

function weaponSprite(id: string): Px {
  const p = new Px(16, 16);
  switch (id) {
    case 'w_militia_blade':
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const ch = BLADE[y]?.[x] ?? '.';
          if (ch !== '.') p.set(x, y, ch);
        }
      }
      return p;
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
  size: number;
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
  goblin_chief: { w: 18, h: 21, size: 24 },
  dark_elf_matron: { w: 17, h: 20, size: 24 },
  frost_wolf: { w: 22, h: 14, size: 32 },
  ice_golem: { w: 28, h: 30, size: 40 },
  frost_giant: { w: 36, h: 46, size: 56 },
  lava_imp: { w: 12, h: 12, size: 24 },
  forge_ogre: { w: 30, h: 34, size: 40 },
  forge_tyrant: { w: 36, h: 46, size: 56 },
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

/** Create every sprite texture once. Safe to call on every scene start. */
export function registerArt(scene: Phaser.Scene): void {
  registerMonsterTextures(scene);
  registerRelicTextures(scene);
  registerOmnitrixTextures(scene);
  for (const id of WEAPON_IDS) {
    addTexture(scene, weaponTexture(id), weaponSprite(id));
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

