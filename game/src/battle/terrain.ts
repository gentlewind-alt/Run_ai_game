// The ground profile of a level: a polyline of [x, y] points (y grows downward). Builds the static physics and the texture,
// and answers "how high is the ground at x" for the sling, the queue, runners and the aim preview.
import { terrainTexture } from '../art/terrain';
import { data } from '../data/load';
import type { Level } from '../data/types';
import type { BattleState } from './state';

export type Terrain = [number, number][];

/** Sorted by x and extended flat to both ends of the world. Flat at groundY when the level has no terrain. */
export function normalizeTerrain(level: Level, worldW: number, groundY: number): Terrain {
  const pts: Terrain = (level.terrain ?? []).map((p) => [p[0], p[1]] as [number, number]).sort((a, b) => a[0] - b[0]);
  if (pts.length === 0) return [[0, groundY], [worldW, groundY]];
  if (pts[0][0] > 0) pts.unshift([0, pts[0][1]]);
  if (pts[pts.length - 1][0] < worldW) pts.push([worldW, pts[pts.length - 1][1]]);
  return pts;
}

/** Ground height at x (linear between points, flat beyond the ends). A vertical step reports its higher side. */
export function groundAtPoints(pts: Terrain, x: number): number {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      return x1 === x0 ? Math.min(y0, y1) : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return pts[pts.length - 1][1];
}

export const groundAt = (b: BattleState, x: number): number => groundAtPoints(b.terrain, x);

const THICK = 70; // how deep each slab of ground is, so nothing tunnels through

/** Static ground made of rotated slabs along the polyline, plus the left and right walls. */
export function buildTerrain(b: BattleState): void {
  const s = b.scene;
  const pts = b.terrain;
  const slab = (cx: number, cy: number, len: number, angle: number): void => {
    s.matter.add.rectangle(cx, cy, len, THICK, { isStatic: true, friction: 1, frictionStatic: 1, angle, label: 'ground' });
  };
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len < 0.5) continue;
    // the slab sits below the surface line: shift it half its thickness against the upward normal
    const nx = dy / len;
    const ny = -dx / len;
    slab((x0 + x1) / 2 - (nx * THICK) / 2, (y0 + y1) / 2 - (ny * THICK) / 2, len + 6, Math.atan2(dy, dx));
  }
  // flat run-off beyond both ends, and walls so nothing rolls out of the world
  slab(-120, pts[0][1] + THICK / 2, 240, 0);
  slab(b.worldW + 120, pts[pts.length - 1][1] + THICK / 2, 240, 0);
  s.matter.add.rectangle(-10, 200, 20, 800, { isStatic: true, label: 'wall' });
  s.matter.add.rectangle(b.worldW + 10, 200, 20, 800, { isStatic: true, label: 'wall' });

  const realm = data.content.realms.find((r) => r.id === b.level.realm);
  const key = `terrain_${b.levelId}_${b.worldW}`;
  const top = Math.floor(Math.min(...pts.map((p) => p[1]))) - 4;
  terrainTexture(s, key, realm?.background ?? 'hills', (x) => groundAtPoints(pts, x), -200, b.worldW + 200, top);
  s.add.image(-200, top, key).setOrigin(0).setDepth(0);
}
