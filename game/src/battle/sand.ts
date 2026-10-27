// Sand terrain (experimental): the ground is a row of narrow columns instead of a fixed polyline.
// Blasts and hard hits dig craters, the dug sand slumps and piles on the rim, and Sandbag shots build mounds.
// The ground under the slingshot is a solid rock base that never changes. Numbers live in config.json "sand".
// Digging only changes the heights; the physics surface and the pixels are rebuilt once after the physics
// step (sandStep), never inside a collision callback, so nothing gets caught inside the new ground.
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
  /** the smooth collision surface: one slab per straight run of the simplified outline */
  bodies: any[];
  bedrock: number;
  top: number;
  canvas: Phaser.Textures.CanvasTexture;
  dirty: Set<number>;
  x0: number;
}

interface SandCfg { columnWidth: number; baseLeft: number; baseRight: number; repose: number; rimShare: number; hitCrater: number; hitCraterMax: number; digSpeed: number; tolerance: number }

const THICK = 90;
const MARGIN = 200; // sand drawn past both world edges so the screen never shows the background there
const BOTTOM = 400; // the texture runs to the bottom of the screen
export const sandCfg = (): SandCfg => (data.config as any).sand;

export const sandOn = (b: BattleState): boolean => !!b.sand;

/** Ground height at x from the columns (linear between column centres). */
export function sandHeight(s: Sand, x: number): number {
  const f = Math.max(0, Math.min(s.h.length - 1, (x - s.x0) / s.cw - 0.5));
  const i = Math.floor(f);
  const j = Math.min(s.h.length - 1, i + 1);
  return s.h[i] + (s.h[j] - s.h[i]) * (f - i);
}

export function buildSand(b: BattleState, groundAtPoints: (x: number) => number): void {
  const k = sandCfg();
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
  const sand: Sand = { cw, h, solid, bodies: [], bedrock, top, canvas, dirty: new Set(), x0: 0 };
  b.sand = sand;
  // solid floor below the sand so a deep crater can never open onto empty space, and the world walls
  const m = b.scene.matter;
  m.add.rectangle(b.worldW / 2, bedrock + THICK / 2, b.worldW + 400, THICK, { isStatic: true, friction: 1, frictionStatic: 1, label: 'ground' });
  m.add.rectangle(-10, 200, 20, 800, { isStatic: true, label: 'wall' });
  m.add.rectangle(b.worldW + 10, 200, 20, 800, { isStatic: true, label: 'wall' });
  rebuildBodies(b);
  paintRange(sand, -MARGIN, n * cw + MARGIN);
  canvas.refresh();
  b.scene.add.image(-MARGIN, top, canvas.key).setOrigin(0).setDepth(0);
}

/** Keeps only the outline points needed to stay within `tol` px of the columns (Douglas-Peucker). */
function simplify(pts: [number, number][], tol: number): [number, number][] {
  const keep = new Array(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, z] = stack.pop()!;
    const [ax, ay] = pts[a];
    const [zx, zy] = pts[z];
    let far = -1;
    let best = tol;
    for (let i = a + 1; i < z; i++) {
      const d = Math.abs(pts[i][1] - (ay + ((zy - ay) * (pts[i][0] - ax)) / (zx - ax)));
      if (d > best) { best = d; far = i; }
    }
    if (far < 0) continue;
    keep[far] = true;
    stack.push([a, far], [far, z]);
  }
  return pts.filter((_, i) => keep[i]);
}

/**
 * How far a slab's side spreads out at the bedrock, going from (x, y) in direction `dir`. Slabs widen downward
 * and overlap under the ground, so a body resting on a seam is pushed up rather than sideways (vertical seams let
 * heavy blocks sink). The side is the shallowest slope (from about 35 degrees) that keeps the slab convex and
 * stays under the sand outline next to it.
 */
function spread(s: Sand, x: number, y: number, dir: number, topAngle: number, bed: number): number {
  for (let phi = Math.max(0.6, topAngle + 0.09); phi < 1.55; phi += 0.09) {
    const t = Math.tan(phi);
    const run = (bed - y) / t;
    let under = true;
    for (let d = s.cw; d < run && under; d += s.cw) under = y + d * t >= sandHeight(s, x + dir * d) - 0.5;
    if (under) return run;
  }
  return 0;
}

/** Replaces the collision surface with slabs that follow the sand outline down to the bedrock, so the ground is one smooth line. */
function rebuildBodies(b: BattleState): void {
  const s = b.sand!;
  const world = b.scene.matter.world;
  if (s.bodies.length) world.remove(s.bodies);
  const n = s.h.length;
  const pts: [number, number][] = [[s.x0 - 20, s.h[0]]];
  for (let i = 0; i < n; i++) pts.push([s.x0 + i * s.cw + s.cw / 2, s.h[i]]);
  pts.push([s.x0 + n * s.cw + 20, s.h[n - 1]]);
  const line = simplify(pts, sandCfg().tolerance);
  s.bodies = [];
  const bed = s.bedrock + 4;
  for (let i = 0; i < line.length - 1; i++) {
    const [px, py] = line[i];
    const [qx, qy] = line[i + 1];
    const tilt = Math.atan(Math.abs(qy - py) / (qx - px));
    const verts = [{ x: px, y: py }, { x: qx, y: qy }, { x: qx + spread(s, qx, qy, 1, tilt, bed), y: bed }, { x: px - spread(s, px, py, -1, tilt, bed), y: bed }];
    const c = MatterLib.Vertices.centre(verts);
    s.bodies.push(MatterLib.Bodies.fromVertices(c.x, c.y, [verts], { isStatic: true, friction: 1, frictionStatic: 1, label: 'ground' }));
  }
  world.add(s.bodies);
}

const realmSand = (): { lip: string[]; body: string[]; deep: string; stone: string[] } => ({ lip: ['t', 'p'], body: ['i', 'p', 'i'], deep: 'g', stone: ['k', 'l', 'm'] });

/** Repaints world x range [x0, x1): every pixel column follows the smooth outline, so slopes read as clean diagonals. */
function paintRange(s: Sand, x0: number, x1: number): void {
  const P = realmSand();
  const ctx = s.canvas.getContext();
  const rows = s.canvas.height;
  const cx0 = Math.max(0, Math.floor(x0) + MARGIN);
  const cx1 = Math.min(s.canvas.width, Math.ceil(x1) + MARGIN);
  const w = cx1 - cx0;
  if (w <= 0) return;
  const img = ctx.createImageData(w, rows);
  for (let px = 0; px < w; px++) {
    const wx = cx0 + px;
    const x = wx - MARGIN;
    const col = Math.floor((x - s.x0) / s.cw);
    const isSolid = col >= 0 && col < s.h.length && s.solid[col];
    const top = Math.round(sandHeight(s, x + 0.5)) - s.top;
    for (let y = Math.max(0, top); y < rows; y++) {
      const dy = y - top;
      let ch: string;
      if (isSolid) {
        const brick = Math.floor((y + (Math.floor(dy / 6) % 2) * 5) / 10);
        ch = dy === 0 ? P.stone[0] : dy % 6 === 0 || (wx + brick * 3) % 9 === 0 ? P.stone[2] : P.stone[(wx + dy) % 5 === 0 ? 0 : 1];
      } else if (dy === 0) ch = P.lip[(wx >> 1) % 2];
      else if (dy < 3) ch = P.lip[1];
      else if (dy < 9) ch = (wx * 3 + y * 5) % 9 === 0 ? 'h' : P.body[(wx + y) % 3];
      else ch = (wx * 7 + y * 13) % 23 === 0 ? 'h' : (wx * 5 + y * 3) % 19 === 0 ? P.deep : 'i';
      const c = C(ch);
      const o = (y * w + px) * 4;
      img.data[o] = (c >> 16) & 255;
      img.data[o + 1] = (c >> 8) & 255;
      img.data[o + 2] = c & 255;
      img.data[o + 3] = 255;
    }
  }
  ctx.clearRect(cx0, 0, w, rows);
  ctx.putImageData(img, cx0, 0);
}

/** Lifts anything the new ground closed over back onto the surface, so no body is ever stuck inside the sand. */
function unbury(b: BattleState): void {
  const s = b.sand!;
  for (const body of (b.scene.matter.world.localWorld as any).bodies as any[]) {
    if (body.isStatic || body.isSensor) continue;
    if (body.position.y < sandHeight(s, body.position.x) - 1) continue; // its centre is still above the ground
    let surf = sandHeight(s, body.bounds.max.x);
    for (let x = body.bounds.min.x; x < body.bounds.max.x; x += s.cw) surf = Math.min(surf, sandHeight(s, x));
    const lift = body.bounds.max.y - surf + 0.5;
    if (lift <= 0) continue;
    MatterLib.Body.translate(body, { x: 0, y: -lift });
    MatterLib.Body.setVelocity(body, { x: body.velocity.x, y: Math.min(0, body.velocity.y) });
  }
}

/** Runs once after each physics step: applies pending sand changes to the surface, the pixels and the bodies on it. */
export function sandStep(b: BattleState): void {
  const s = b.sand;
  if (!s || !s.dirty.size) return;
  let lo = Infinity;
  let hi = -Infinity;
  for (const i of s.dirty) { lo = Math.min(lo, i); hi = Math.max(hi, i); }
  s.dirty.clear();
  rebuildBodies(b);
  paintRange(s, s.x0 + (lo - 1) * s.cw, s.x0 + (hi + 2) * s.cw);
  s.canvas.refresh();
  unbury(b);
  for (const body of (b.scene.matter.world.localWorld as any).bodies as any[]) if (!body.isStatic) MatterLib.Sleeping.set(body, false);
}

/** Sand slumps until no slope is steeper than the angle of repose, spreading as far as it needs. Solid columns never move. */
function slump(b: BattleState, from: number, to: number): void {
  const s = b.sand!;
  const lim = sandCfg().repose;
  let lo = Math.max(0, from);
  let hi = Math.min(s.h.length - 2, to);
  for (let pass = 0; pass < 400; pass++) {
    let moved = false;
    for (let i = lo; i <= hi; i++) {
      const a = s.h[i];
      const c = s.h[i + 1];
      const excess = Math.abs(a - c) - lim;
      if (excess <= 0.05) continue;
      const high = a < c ? i : i + 1; // smaller y = higher ground
      const low = a < c ? i + 1 : i;
      if (s.solid[high] || s.solid[low]) continue;
      const t = excess / 2;
      s.h[high] += t;
      s.h[low] -= t;
      s.dirty.add(high);
      s.dirty.add(low);
      moved = true;
      if (i === lo && lo > 0) lo--;
      if (i === hi && hi < s.h.length - 2) hi++;
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
    // the thrown sand lands in a soft ring that thins out away from the crater
    const w = Math.max(3 * s.cw, r * 0.8);
    const rim: [number, number][] = [];
    for (let i = Math.max(0, Math.floor((x - r - w) / s.cw)); i <= Math.min(s.h.length - 1, Math.ceil((x + r + w) / s.cw)); i++) {
      const d = Math.abs(i * s.cw + s.cw / 2 - x) - r;
      if (d > 0 && d < w && !s.solid[i]) rim.push([i, 1 - d / w]);
    }
    const total = rim.reduce((a, [, wt]) => a + wt, 0);
    const share = removed * sandCfg().rimShare;
    for (const [i, wt] of rim) { s.h[i] -= (share * wt) / (total * s.cw); s.dirty.add(i); }
    slump(b, i0 - 2, i1 + 2);
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
    s.h[i] = Math.max(s.top + 20, s.h[i] - height * (1 - dx * dx));
    s.dirty.add(i);
  }
  slump(b, i0 - 2, i1 + 2);
}
