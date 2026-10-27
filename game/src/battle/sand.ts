// Sand terrain (experimental): the ground is a row of narrow columns instead of a fixed polyline.
// Blasts and hard hits dig craters, the dug sand slumps and piles on the rim, and Sandbag shots build mounds.
// The ground under the slingshot is a solid rock base that never changes. Numbers live in config.json "sand".
import Phaser from 'phaser';
import { C } from '../art/palette';
import { data } from '../data/load';
import { MatterLib } from './matter';
import type { BattleState } from './state';

export interface Sand {
  cw: number;
  /** surface y of each column (y grows downward) */
  h: number[];
  /** columns that can never change: the sling base */
  solid: boolean[];
  bodies: (any | undefined)[];
  bedrock: number;
  top: number;
  canvas: Phaser.Textures.CanvasTexture;
  dirty: Set<number>;
  x0: number;
}

const THICK = 90;
const MARGIN = 200; // sand drawn past both world edges so the screen never shows the background there
const BOTTOM = 400; // the texture runs to the bottom of the screen
const cfg = (): { columnWidth: number; baseLeft: number; baseRight: number; repose: number; rimShare: number; hitCrater: number } =>
  (data.config as any).sand ?? { columnWidth: 4, baseLeft: 26, baseRight: 14, repose: 5, rimShare: 0.45, hitCrater: 9 };

export const sandOn = (b: BattleState): boolean => !!b.sand;

/** Ground height at x from the columns (linear between column centres). */
export function sandHeight(s: Sand, x: number): number {
  const f = Math.max(0, Math.min(s.h.length - 1, (x - s.x0) / s.cw - 0.5));
  const i = Math.floor(f);
  const j = Math.min(s.h.length - 1, i + 1);
  return s.h[i] + (s.h[j] - s.h[i]) * (f - i);
}

export function buildSand(b: BattleState, groundAtPoints: (x: number) => number): void {
  const k = cfg();
  const cw = k.columnWidth;
  const n = Math.ceil(b.worldW / cw);
  const h = Array.from({ length: n }, (_, i) => groundAtPoints(i * cw + cw / 2));
  const solid = h.map((_, i) => {
    const x = i * cw + cw / 2;
    return x >= b.slingX - k.baseLeft && x <= b.slingX + k.baseRight;
  });
  const bedrock = Math.max(...h, b.groundY) + 26;
  const top = Math.floor(Math.min(...h)) - 90;
  const rows = Math.ceil(Math.max(bedrock + 8, BOTTOM) - top);
  const canvas = b.scene.textures.createCanvas(`sand_${b.levelId}_${b.worldW}_${b.scene.time.now | 0}`, n * cw + MARGIN * 2, rows)!;
  const sand: Sand = { cw, h, solid, bodies: new Array(n).fill(undefined), bedrock, top, canvas, dirty: new Set(), x0: 0 };
  b.sand = sand;
  // solid floor below the sand so a deep crater can never open onto empty space, and the world walls
  const m = b.scene.matter;
  m.add.rectangle(b.worldW / 2, bedrock + THICK / 2, b.worldW + 400, THICK, { isStatic: true, friction: 1, frictionStatic: 1, label: 'ground' });
  m.add.rectangle(-10, 200, 20, 800, { isStatic: true, label: 'wall' });
  m.add.rectangle(b.worldW + 10, 200, 20, 800, { isStatic: true, label: 'wall' });
  for (let i = 0; i < n; i++) sand.dirty.add(i);
  flush(b);
  for (let x = 0; x < MARGIN; x += cw) { paintAt(sand, x, h[0], false); paintAt(sand, MARGIN + n * cw + x, h[n - 1], false); }
  canvas.refresh();
  b.scene.add.image(-MARGIN, top, canvas.key).setOrigin(0).setDepth(0);
}

function column(b: BattleState, i: number): void {
  const s = b.sand!;
  if (s.bodies[i]) { b.scene.matter.world.remove(s.bodies[i]); s.bodies[i] = undefined; }
  const depth = s.bedrock - s.h[i];
  if (depth < 2) return;
  s.bodies[i] = b.scene.matter.add.rectangle(s.x0 + i * s.cw + s.cw / 2, s.h[i] + depth / 2, s.cw + 0.6, depth, { isStatic: true, friction: 1, frictionStatic: 1, label: 'ground' });
}

const realmSand = (): { lip: string[]; body: string[]; deep: string; stone: string[] } => ({ lip: ['t', 'p'], body: ['i', 'p', 'i'], deep: 'g', stone: ['k', 'l', 'm'] });

const paint = (b: BattleState, i: number): void => paintAt(b.sand!, MARGIN + i * b.sand!.cw, b.sand!.h[i], b.sand!.solid[i]);

/** One column of pixels at canvas x `cx`: lip, grain, deep sand, and stone bricks for the sling base. */
function paintAt(s: Sand, cx: number, height: number, isSolid: boolean): void {
  const P = realmSand();
  const ctx = s.canvas.getContext();
  const rows = s.canvas.height;
  const img = ctx.createImageData(s.cw, rows);
  const top = Math.round(height) - s.top;
  for (let px = 0; px < s.cw; px++) {
    const wx = cx + px;
    for (let y = 0; y < rows; y++) {
      const dy = y - top;
      if (dy < 0) continue;
      let ch: string;
      if (isSolid) {
        const brick = Math.floor((y + (Math.floor(dy / 6) % 2) * 5) / 10);
        ch = dy === 0 ? P.stone[0] : dy % 6 === 0 || (wx + brick * 3) % 9 === 0 ? P.stone[2] : P.stone[(wx + dy) % 5 === 0 ? 0 : 1];
      } else if (dy === 0) ch = P.lip[(wx >> 1) % 2];
      else if (dy < 3) ch = P.lip[1];
      else if (dy < 9) ch = (wx * 3 + y * 5) % 9 === 0 ? 'h' : P.body[(wx + y) % 3];
      else ch = (wx * 7 + y * 13) % 23 === 0 ? 'h' : (wx * 5 + y * 3) % 19 === 0 ? P.deep : 'i';
      const col = C(ch);
      const o = (y * s.cw + px) * 4;
      img.data[o] = (col >> 16) & 255;
      img.data[o + 1] = (col >> 8) & 255;
      img.data[o + 2] = col & 255;
      img.data[o + 3] = 255;
    }
  }
  ctx.clearRect(cx, 0, s.cw, rows);
  ctx.putImageData(img, cx, 0);
}

/** Rebuilds the bodies and pixels of every changed column, then wakes everything so it can fall into new holes. */
function flush(b: BattleState): void {
  const s = b.sand!;
  if (!s.dirty.size) return;
  for (const i of s.dirty) { column(b, i); paint(b, i); }
  s.dirty.clear();
  s.canvas.refresh();
  for (const e of b.ents) if (!e.dead) MatterLib.Sleeping.set(e.body, false);
}

/** Sand slumps until no slope is steeper than the angle of repose. Solid columns never move. */
function slump(b: BattleState, from: number, to: number): void {
  const s = b.sand!;
  const lim = cfg().repose;
  const lo = Math.max(0, from - 2);
  const hi = Math.min(s.h.length - 2, to + 2);
  for (let pass = 0; pass < 40; pass++) {
    let moved = false;
    for (let i = lo; i <= hi; i++) {
      const a = s.h[i];
      const c = s.h[i + 1];
      if (Math.abs(a - c) <= lim) continue;
      const high = a < c ? i : i + 1; // smaller y = higher ground
      const low = a < c ? i + 1 : i;
      if (s.solid[high] || s.solid[low]) continue;
      s.h[high] += 1;
      s.h[low] = Math.max(s.h[low] - 1, s.top + 20);
      s.dirty.add(high);
      s.dirty.add(low);
      moved = true;
    }
    if (!moved) break;
  }
}

/** Digs a round crater centred at (x, y). Part of the dug sand lands on the rim. Returns the volume removed. */
export function carveSand(b: BattleState, x: number, y: number, r: number): number {
  const s = b.sand;
  if (!s || r < 1) return 0;
  const i0 = Math.max(0, Math.floor((x - r) / s.cw));
  const i1 = Math.min(s.h.length - 1, Math.ceil((x + r) / s.cw));
  let removed = 0;
  for (let i = i0; i <= i1; i++) {
    if (s.solid[i]) continue;
    const dx = i * s.cw + s.cw / 2 - x;
    if (Math.abs(dx) >= r) continue;
    const dy = Math.sqrt(r * r - dx * dx);
    if (y - dy > s.h[i] + 1 || y + dy <= s.h[i]) continue; // the circle misses the surface here
    const next = Math.min(s.bedrock - 2, y + dy);
    if (next > s.h[i]) { removed += (next - s.h[i]) * s.cw; s.h[i] = next; s.dirty.add(i); }
  }
  if (removed > 0) {
    const share = removed * cfg().rimShare;
    const rim: number[] = [];
    for (let i = Math.max(0, i0 - 3); i < i0; i++) rim.push(i);
    for (let i = i1 + 1; i <= Math.min(s.h.length - 1, i1 + 3); i++) rim.push(i);
    const each = share / (rim.length * s.cw);
    for (const i of rim) if (!s.solid[i]) { s.h[i] -= each; s.dirty.add(i); }
    slump(b, i0 - 4, i1 + 4);
    flush(b);
  }
  return removed;
}

/** Piles a mound of sand centred at x with the given half-width and height (it settles into a natural heap). */
export function pileSand(b: BattleState, x: number, half: number, height: number): void {
  const s = b.sand;
  if (!s) return;
  const i0 = Math.max(0, Math.floor((x - half) / s.cw));
  const i1 = Math.min(s.h.length - 1, Math.ceil((x + half) / s.cw));
  for (let i = i0; i <= i1; i++) {
    if (s.solid[i]) continue;
    const dx = Math.abs(i * s.cw + s.cw / 2 - x) / half;
    if (dx >= 1) continue;
    s.h[i] -= height * (1 - dx * dx);
    s.dirty.add(i);
  }
  slump(b, i0 - 3, i1 + 3);
  flush(b);
}
