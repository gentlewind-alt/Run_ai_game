import Phaser from 'phaser';
import { gridTexture } from './pix';
import { GOBLIN_IDLE } from './sprites';
import { addTexture, DARK, Px, STEEL, type Tone, WOOD } from './textures';

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

export function imp(hurt: boolean): Px {
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

export function orc(hurt: boolean): Px {
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

export function troll(hurt: boolean): Px {
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

export function warlord(hurt: boolean, open = false): Px {
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

export function chief(hurt: boolean): Px {
  const p = new Px(24, 24);
  const skin: Tone = ['5', '6', 'n'];
  const armor: Tone = ['d', 'e', 'm'];
  p.line(1, 6, 4, 9, skin[0]); p.line(1, 7, 4, 10, skin[1]);
  p.line(22, 6, 19, 9, skin[0]); p.line(22, 7, 19, 10, skin[2]);
  p.rectT(7, 19, 4, 4, DARK); p.rectT(13, 19, 4, 4, DARK);
  p.rectT(5, 12, 14, 8, armor);
  p.rect(5, 17, 14, 2, 'g'); p.rect(10, 17, 4, 2, '4');
  p.rectT(2, 13, 3, 6, skin); p.rectT(19, 13, 3, 6, skin);
  p.rectT(6, 6, 12, 8, skin);
  p.rectT(5, 2, 14, 5, STEEL);
  p.rect(11, 0, 2, 3, '4');
  p.line(5, 7, 18, 7, 'c');
  p.rect(8, 9, 2, 2, hurt ? '0' : 'c'); p.rect(14, 9, 2, 2, hurt ? '0' : 'c');
  p.set(9, 9, '0'); p.set(14, 9, '0');
  p.rect(10, 12, 4, 1, hurt ? '2' : '0');
  p.set(9, 11, 'c'); p.set(14, 11, 'c');
  return p.outline();
}

export function matron(hurt: boolean): Px {
  const p = new Px(24, 24);
  const robe: Tone = ['u', 'r', '1'];
  p.rectT(4, 12, 16, 10, robe);
  p.rect(3, 20, 18, 3, '1');
  p.rect(6, 14, 12, 2, '4');
  p.rect(11, 14, 2, 2, '3');
  p.rectT(6, 4, 12, 9, robe);
  p.line(8, 1, 15, 1, '4');
  p.set(11, 0, '4'); p.set(12, 0, '4');
  p.set(11, 2, '3');
  p.rect(8, 7, 8, 4, '1');
  p.rect(9, 8, 2, 2, hurt ? '2' : 'c'); p.rect(13, 8, 2, 2, hurt ? '2' : 'c');
  p.set(10, 8, hurt ? '0' : '4'); p.set(13, 8, hurt ? '0' : '4');
  p.rectT(20, 6, 2, 17, WOOD);
  p.disc(21, 5, 2.2, ['4', '3', '2']);
  return p.outline();
}

export function chestSprite(): Px {
  const p = new Px(14, 12);
  p.rectT(1, 1, 12, 10, WOOD);
  p.rect(2, 2, 1, 8, 'e');
  p.rect(11, 2, 1, 8, 'e');
  p.line(1, 5, 12, 5, '0');
  p.rect(5, 4, 4, 4, '4');
  p.rect(6, 5, 2, 2, '3');
  p.set(6, 6, '0');
  return p.outline();
}

export function ghost(armsUp: boolean): Px {
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

export function registerMonsterTextures(scene: Phaser.Scene): void {
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
  addTexture(scene, 'goblin_chief', chief(false));
  addTexture(scene, 'goblin_chief_hurt', chief(true));
  addTexture(scene, 'dark_elf_matron', matron(false));
  addTexture(scene, 'dark_elf_matron_hurt', matron(true));
  addTexture(scene, 'chest', chestSprite());
}
