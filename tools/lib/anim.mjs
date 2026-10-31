// Measures an enemy animation strip against the enemy's still sprite. Used by tools/anim_convert.mjs (to pick the best conversion)
// and game/scripts/check-anims.mjs (so a bad strip fails `npm run check`). A strip is square frames side by side, RGBA.

/** Limits per animation kind. Every number is a measured fraction or a pixel count, not a taste. */
/** `flicker` is a preference, not a pass mark: an AI strip that redraws more than this share of its pixels beyond plain movement loses to the computed one. */
export const LIMITS = {
  idle: { accent: 0.6, motionMin: 0.04, motionMax: 0.80, flicker: 0.25, areaVar: 0.15, bottomDrift: 2, centroidX: 0.07, centroidY: 0.10 },
  fly: { accent: 0.5, motionMin: 0.06, motionMax: 0.90, flicker: 0.35, areaVar: 0.35, bottomDrift: 99, centroidX: 0.12, centroidY: 0.18 },
  run: { accent: 0.5, motionMin: 0.08, motionMax: 0.95, flicker: 0.65, areaVar: 0.30, bottomDrift: 3, centroidX: 0.12, centroidY: 0.12 },
  all: { minFrames: 4, seam: 1.8, stall: 0.3, accent: 0.6, sizeMin: 0.75, sizeMax: 1.25, noise: 1.0, likeness: 0.55, palette: 0.95 },
};

const opaque = (d, i) => d[i + 3] >= 128;

function frameOf(strip, k, S) {
  const px = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const s = (y * strip.w + k * S + x) * 4, t = (y * S + x) * 4;
    px[t] = strip.data[s]; px[t + 1] = strip.data[s + 1]; px[t + 2] = strip.data[s + 2]; px[t + 3] = strip.data[s + 3];
  }
  return px;
}

function stats(px, S) {
  let area = 0, minX = S, maxX = -1, minY = S, maxY = -1, sx = 0, sy = 0, isolated = 0;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    if (!opaque(px, (y * S + x) * 4)) continue;
    area++; sx += x; sy += y;
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    let near = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < S && ny < S && opaque(px, (ny * S + nx) * 4)) near++; }
    if (!near) isolated++;
  }
  return { area, bottom: maxY, cx: area ? sx / area : 0, cy: area ? sy / area : 0, isolated, minX, maxX, minY, maxY };
}

function difference(a, b, S) {
  let diff = 0, union = 0;
  for (let i = 0; i < S * S * 4; i += 4) {
    const oa = opaque(a, i), ob = opaque(b, i);
    if (!oa && !ob) continue;
    union++;
    if (oa !== ob || Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 60) diff++;
  }
  return union ? diff / union : 0;
}

/** Difference between two frames after the best slide of up to 2 px each way: plain movement scores 0, redrawn or flickering pixels do not. */
function churn(a, b, S) {
  let best = 1;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    let diff = 0, union = 0;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4, nx = x + dx, ny = y + dy;
      const oa = opaque(a, i);
      const j = nx >= 0 && ny >= 0 && nx < S && ny < S ? (ny * S + nx) * 4 : -1;
      const ob = j >= 0 && opaque(b, j);
      if (!oa && !ob) continue;
      union++;
      if (oa !== ob || Math.abs(a[i] - b[j]) + Math.abs(a[i + 1] - b[j + 1]) + Math.abs(a[i + 2] - b[j + 2]) > 60) diff++;
    }
    if (union && diff / union < best) best = diff / union;
  }
  return best;
}

/** Scores a strip. `still` is { w, h, data } of the enemy's current sprite; `kind` is idle, fly or run. */
export function analyze(strip, still, kind) {
  const S = strip.h;
  const frames = strip.w / S;
  const L = LIMITS[kind], A = LIMITS.all;
  if (!Number.isInteger(frames) || frames < 2 || still.w !== S || still.h !== S) return { ok: false, fails: [`bad shape: strip ${strip.w}x${strip.h}, still ${still.w}x${still.h}`], m: {} };
  const px = Array.from({ length: frames }, (_v, k) => frameOf(strip, k, S));
  const st = px.map((p) => stats(p, S));
  const stillStats = stats(still.data, S);
  const pair = px.map((p, k) => difference(p, px[(k + 1) % frames], S));
  const churnAvg = px.reduce((a, p, k) => a + churn(p, px[(k + 1) % frames], S), 0) / frames;
  const inner = pair.slice(0, -1);
  const motion = inner.reduce((a, b) => a + b, 0) / inner.length;
  const seam = motion > 0 ? pair[frames - 1] / motion : 0;
  // a frame that barely differs from the next one makes the animation hold still for a beat
  const stall = motion > 0 ? Math.min(...pair) / motion : 1;
  const areas = st.map((s) => s.area);
  const meanArea = areas.reduce((a, b) => a + b, 0) / frames;
  const areaVar = (Math.max(...areas) - Math.min(...areas)) / meanArea;
  const bottoms = st.map((s) => s.bottom);
  const cxs = st.map((s) => s.cx), cys = st.map((s) => s.cy);
  const stillColours = new Set();
  for (let i = 0; i < S * S * 4; i += 4) if (opaque(still.data, i)) stillColours.add((still.data[i] << 16) | (still.data[i + 1] << 8) | still.data[i + 2]);
  let inPalette = 0, total = 0;
  px.forEach((p) => { for (let i = 0; i < S * S * 4; i += 4) if (opaque(p, i)) { total++; if (stillColours.has((p[i] << 16) | (p[i + 1] << 8) | p[i + 2])) inPalette++; } });
  // likeness: how much of the still's silhouette the frames cover on average, and how little they add outside it
  let iou = 0;
  px.forEach((p) => {
    let both = 0, either = 0;
    for (let i = 0; i < S * S * 4; i += 4) { const a = opaque(p, i), b = opaque(still.data, i); if (a && b) both++; if (a || b) either++; }
    iou += either ? both / either : 0;
  });
  iou /= frames;
  // accents: the small bright details of the still (eyes, glows, jewels). An animation that redraws the face loses them.
  const hist = new Map();
  for (let i = 0; i < S * S * 4; i += 4) if (opaque(still.data, i)) { const k = (still.data[i] << 16) | (still.data[i + 1] << 8) | still.data[i + 2]; hist.set(k, (hist.get(k) ?? 0) + 1); }
  const stillArea = stillStats.area || 1;
  const accents = [...hist].filter(([k, n]) => n / stillArea <= 0.1 && ((k >> 16) & 255) + ((k >> 8) & 255) + (k & 255) > 330);
  let accentWant = 0, accentKept = 0;
  for (const [k, n] of accents) {
    let seen = 0;
    px.forEach((p) => { for (let i = 0; i < S * S * 4; i += 4) if (opaque(p, i) && ((p[i] << 16) | (p[i + 1] << 8) | p[i + 2]) === k) seen++; });
    accentWant += n; accentKept += Math.min(n, seen / frames);
  }
  const m = {
    churn: churnAvg,
    frames,
    accent: accentWant ? accentKept / accentWant : 1,
    motion, seam, stall, areaVar,
    size: meanArea / Math.max(1, stillStats.area),
    bottomDrift: Math.max(...bottoms) - Math.min(...bottoms),
    centroidX: (Math.max(...cxs) - Math.min(...cxs)) / S,
    centroidY: (Math.max(...cys) - Math.min(...cys)) / S,
    noise: Math.max(0, st.reduce((a, s) => a + s.isolated, 0) / frames - stillStats.isolated), // stray pixels the still itself does not have
    palette: total ? inPalette / total : 0,
    likeness: iou,
  };
  const fails = [];
  if (m.motion < L.motionMin) fails.push(`barely moves (${m.motion.toFixed(3)} < ${L.motionMin})`);
  if (m.motion > L.motionMax) fails.push(`changes almost every pixel (${m.motion.toFixed(3)} > ${L.motionMax})`);
  if (m.frames < A.minFrames) fails.push(`only ${m.frames} frames`);
  if (m.stall < A.stall) fails.push(`a frame repeats, so it stalls (${m.stall.toFixed(2)}x)`);
  if (m.seam > A.seam) fails.push(`loop seam jumps (${m.seam.toFixed(2)}x)`);
  if (m.areaVar > L.areaVar) fails.push(`size pulses (${m.areaVar.toFixed(2)} > ${L.areaVar})`);
  if (m.size < A.sizeMin || m.size > A.sizeMax) fails.push(`size vs still ${m.size.toFixed(2)}`);
  if (m.bottomDrift > L.bottomDrift) fails.push(`feet drift ${m.bottomDrift}px`);
  if (m.centroidX > L.centroidX) fails.push(`slides sideways (${m.centroidX.toFixed(2)})`);
  if (m.centroidY > L.centroidY) fails.push(`bounces too much (${m.centroidY.toFixed(2)})`);
  if (m.noise > A.noise) fails.push(`stray pixels (${m.noise.toFixed(1)} per frame)`);
  if (m.accent < L.accent) fails.push(`loses the details of the still, like eyes or glows (${(m.accent * 100).toFixed(0)}% kept)`);
  if (m.palette < A.palette) fails.push(`off-palette colours (${(m.palette * 100).toFixed(0)}% match)`);
  if (m.likeness < A.likeness) fails.push(`does not look like the still (${m.likeness.toFixed(2)})`);
  return { ok: fails.length === 0, fails, m, frames, S, flickers: m.churn > L.flicker };
}
