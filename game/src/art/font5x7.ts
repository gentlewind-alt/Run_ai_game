import Phaser from 'phaser';
import { C, css } from './palette';

// "Mash Sans": 5x7 caps and digits, lowercase with descenders (9 rows total). Rows separated by '/'.
// Caps/digits are 7 rows and padded; lowercase is written out in full (rows 2..6 x-height, 7..8 descenders).
const CAPS: Record<string, string> = {
  A: '.###./#...#/#...#/#####/#...#/#...#/#...#', B: '####./#...#/#...#/####./#...#/#...#/####.',
  C: '.####/#..../#..../#..../#..../#..../.####', D: '####./#...#/#...#/#...#/#...#/#...#/####.',
  E: '#####/#..../#..../####./#..../#..../#####', F: '#####/#..../#..../####./#..../#..../#....',
  G: '.####/#..../#..../#.###/#...#/#...#/.####', H: '#...#/#...#/#...#/#####/#...#/#...#/#...#',
  I: '.###./..#../..#../..#../..#../..#../.###.', J: '..###/...#./...#./...#./...#./#..#./.##..',
  K: '#...#/#..#./#.#../##.../#.#../#..#./#...#', L: '#..../#..../#..../#..../#..../#..../#####',
  M: '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#', N: '#...#/##..#/#.#.#/#..##/#...#/#...#/#...#',
  O: '.###./#...#/#...#/#...#/#...#/#...#/.###.', P: '####./#...#/#...#/####./#..../#..../#....',
  Q: '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#', R: '####./#...#/#...#/####./#.#../#..#./#...#',
  S: '.####/#..../#..../.###./....#/....#/####.', T: '#####/..#../..#../..#../..#../..#../..#..',
  U: '#...#/#...#/#...#/#...#/#...#/#...#/.###.', V: '#...#/#...#/#...#/#...#/#...#/.#.#./..#..',
  W: '#...#/#...#/#...#/#.#.#/#.#.#/##.##/#...#', X: '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
  Y: '#...#/#...#/.#.#./..#../..#../..#../..#..', Z: '#####/....#/...#./..#../.#.../#..../#####',
  '0': '.###./#...#/#..##/#.#.#/##..#/#...#/.###.', '1': '..#../.##../..#../..#../..#../..#../.###.',
  '2': '.###./#...#/....#/...#./..#../.#.../#####', '3': '####./....#/....#/.###./....#/....#/####.',
  '4': '...#./..##./.#.#./#..#./#####/...#./...#.', '5': '#####/#..../####./....#/....#/#...#/.###.',
  '6': '.###./#..../#..../####./#...#/#...#/.###.', '7': '#####/....#/...#./..#../.#.../.#.../.#...',
  '8': '.###./#...#/#...#/.###./#...#/#...#/.###.', '9': '.###./#...#/#...#/.####/....#/....#/.###.',
  '!': '..#../..#../..#../..#../..#../...../..#..', '?': '.###./#...#/....#/...#./..#../...../..#..',
  '#': '.#.#./.#.#./#####/.#.#./#####/.#.#./.#.#.', ':': '...../..#../...../...../..#../...../.....', '-': '...../...../...../#####/...../...../.....',
  '+': '...../..#../..#../#####/..#../..#../.....', "'": '..#../..#../...../...../...../...../.....',
  '/': '....#/....#/...#./..#../.#.../#..../#....', '*': '.#.#./..#../#####/..#../.#.#./...../.....',
  '>': '#..../.#.../..#../...#./..#../.#.../#....', '<': '...#./..#../.#.../#..../.#.../..#../...#.',
  '(': '..#../.#.../#..../#..../#..../.#.../..#..', ')': '..#../...#./....#/....#/....#/...#./..#..',
  '%': '##..#/##.#./...#./..#../.#.../#.###/..###',
};

const LOWER: Record<string, string> = {
  a: '...../...../.###./....#/.####/#...#/.####/...../.....', b: '#..../#..../####./#...#/#...#/#...#/####./...../.....',
  c: '...../...../.###./#...#/#..../#...#/.###./...../.....', d: '....#/....#/.####/#...#/#...#/#...#/.####/...../.....',
  e: '...../...../.###./#...#/#####/#..../.####/...../.....', f: '..##./.#..#/.#.../###../.#.../.#.../.#.../...../.....',
  g: '...../...../.####/#...#/#...#/#...#/.####/....#/.###.', h: '#..../#..../####./#...#/#...#/#...#/#...#/...../.....',
  i: '..#../...../.##../..#../..#../..#../.###./...../.....', j: '...#./...../..##./...#./...#./...#./...#./#..#./.##..',
  k: '#..../#..../#..#./#.#../##.../#.#../#..#./...../.....', l: '.##../..#../..#../..#../..#../..#../.###./...../.....',
  m: '...../...../##.#./#.#.#/#.#.#/#...#/#...#/...../.....', n: '...../...../####./#...#/#...#/#...#/#...#/...../.....',
  o: '...../...../.###./#...#/#...#/#...#/.###./...../.....', p: '...../...../####./#...#/#...#/#...#/####./#..../#....',
  q: '...../...../.####/#...#/#...#/#...#/.####/....#/....#', r: '...../...../#.##./##..#/#..../#..../#..../...../.....',
  s: '...../...../.####/#..../.###./....#/####./...../.....', t: '.#.../.#.../###../.#.../.#.../.#..#/..##./...../.....',
  u: '...../...../#...#/#...#/#...#/#...#/.####/...../.....', v: '...../...../#...#/#...#/#...#/.#.#./..#../...../.....',
  w: '...../...../#...#/#...#/#.#.#/#.#.#/.#.#./...../.....', x: '...../...../#...#/.#.#./..#../.#.#./#...#/...../.....',
  y: '...../...../#...#/#...#/#...#/#...#/.####/....#/.###.', z: '...../...../#####/...#./..#../.#.../#####/...../.....',
  ',': '...../...../...../...../...../..#../..#../.#.../.....', '.': '...../...../...../...../...../...../..#../...../.....',
};

type Glyph = { rows: string[]; x0: number; w: number };
const glyphs = new Map<string, Glyph>();

function build(ch: string, src: string): void {
  let rows = src.split('/');
  while (rows.length < 9) rows.push('.....');
  rows = rows.slice(0, 9);
  let x0 = 5;
  let x1 = -1;
  for (const r of rows) {
    for (let x = 0; x < 5; x++) {
      if (r[x] === '#') {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
      }
    }
  }
  glyphs.set(ch, { rows, x0, w: x1 - x0 + 1 });
}
for (const [k, v] of Object.entries(CAPS)) build(k, v);
for (const [k, v] of Object.entries(LOWER)) build(k, v);

const SPACE = 3;
const GAP = 1;

function measure(str: string): number {
  let w = 0;
  for (const ch of str) w += (ch === ' ' ? SPACE : (glyphs.get(ch) ?? glyphs.get('?')!).w) + GAP;
  return Math.max(1, w - GAP);
}

function ensureTexture(scene: Phaser.Scene, str: string, color: number, shade: number | null): string {
  const key = `m5:${str}:${color}:${shade ?? 'n'}`;
  if (scene.textures.exists(key)) return key;
  const w = measure(str);
  const cv = document.createElement('canvas');
  cv.width = w + 2;
  cv.height = 9 + 2 + (shade !== null ? 1 : 0);
  const ctx = cv.getContext('2d')!;
  const cells: [number, number][] = [];
  let cx = 0;
  for (const ch of str) {
    if (ch === ' ') {
      cx += SPACE + GAP;
      continue;
    }
    const g = glyphs.get(ch) ?? glyphs.get('?')!;
    g.rows.forEach((row, ry) => {
      for (let rx = g.x0; rx < g.x0 + g.w; rx++) {
        if (row[rx] === '#') cells.push([1 + cx + rx - g.x0, 1 + ry]);
      }
    });
    cx += g.w + GAP;
  }
  ctx.fillStyle = css(C('0'));
  for (const [x, y] of cells) {
    ctx.fillRect(x - 1, y, 3, 1);
    ctx.fillRect(x, y - 1, 1, 3);
    if (shade !== null) ctx.fillRect(x, y + 1, 1, 1);
  }
  if (shade !== null) {
    ctx.fillStyle = css(shade);
    for (const [x, y] of cells) ctx.fillRect(x, y + 1, 1, 1);
  }
  ctx.fillStyle = css(color);
  for (const [x, y] of cells) ctx.fillRect(x, y, 1, 1);
  scene.textures.addCanvas(key, cv);
  return key;
}

/** Sentence-case UI text in Mash Sans, centred, with an Ink outline and optional drop shade. */
export function text(
  scene: Phaser.Scene, x: number, y: number, str: string, color = 0xf4f4f4, scale = 1, shade: number | null = null,
): Phaser.GameObjects.Image {
  return scene.add.image(x, y, ensureTexture(scene, str, color, shade)).setScale(scale);
}

/** Swap the string of an existing text image (same colour and shade). */
export function setText(
  img: Phaser.GameObjects.Image, scene: Phaser.Scene, str: string, color = 0xf4f4f4, shade: number | null = null,
): void {
  img.setTexture(ensureTexture(scene, str, color, shade));
}

/** Width in internal pixels at scale 1 (without outline). */
export function textWidth(str: string): number {
  return measure(str);
}

/** Shorten a single-line label to its measured space. */
export function fitText(str: string, maxWidth: number): string {
  if (measure(str) <= maxWidth) return str;
  if (measure('...') > maxWidth) return '';
  let prefix = str;
  while (prefix && measure(`${prefix}...`) > maxWidth) prefix = prefix.slice(0, -1);
  return `${prefix}...`;
}

/** Word-wrapped text block, centred on x, first line at y. Returns the line images. */
export function textBlock(
  scene: Phaser.Scene, x: number, y: number, str: string, color = 0xf4f4f4, maxWidth = 196, shade: number | null = null,
): Phaser.GameObjects.Image[] {
  const lines: string[] = [];
  let cur = '';
  for (const word of str.split(' ')) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && measure(next) > maxWidth) {
      lines.push(cur);
      cur = word;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines.map((l, i) => text(scene, x, y + i * 12, l, color, 1, shade));
}
