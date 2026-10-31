// Animation computed straight from an enemy's own still sprite: the result always looks exactly like the enemy (same pixels, same
// colours), it only breathes, sways, hovers or flaps. Used when no AI animation meets the quality bar (tools/lib/anim.mjs).
//   idle: the body stretches and squashes a little from the feet up and the top sways side to side
//   fly:  the whole sprite bobs and the outer columns (the wings) swing up and down
//   run:  a quick bob with a stride squash and stretch and a lean
const opaque = (d, i) => d[i + 3] >= 128;

function footprint(still) {
  const S = still.w;
  let minX = S, maxX = -1, minY = S, maxY = -1;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (opaque(still.data, (y * S + x) * 4)) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  return { minX, maxX, minY, maxY, cx: (minX + maxX + 1) / 2, bottom: maxY + 1, height: maxY - minY + 1, half: (maxX - minX + 1) / 2 };
}

/** The bright small details of the still (eyes, glows, jewels): their colours cover little of the sprite and are not dark. */
function accentColours(still, fp) {
  const S = still.w, hist = new Map();
  let area = 0;
  for (let i = 0; i < S * S * 4; i += 4) if (opaque(still.data, i)) { area++; const k = (still.data[i] << 16) | (still.data[i + 1] << 8) | still.data[i + 2]; hist.set(k, (hist.get(k) ?? 0) + 1); }
  return new Set([...hist].filter(([k, n]) => n / area <= 0.1 && ((k >> 16) & 255) + ((k >> 8) & 255) + (k & 255) > 330).map(([k]) => k));
}

/** One frame: for every target pixel, where to read from in the still. */
function frame(still, fp, kind, phase, gain, N, accents) {
  const S = still.w;
  const out = new Uint8Array(S * S * 4);
  const sin = Math.sin(phase);
  const big = S >= 40;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let sx = x, sy = y;
    const up = Math.max(0, (fp.bottom - y) / fp.height); // 0 at the feet, 1 at the top of the sprite
    if (kind === 'idle') {
      const stretch = 1 + (big ? 0.035 : 0.05) * gain * sin;
      sy = fp.bottom - (fp.bottom - y) / stretch;
      sx = x - Math.sin(phase + 0.9) * (big ? 1.6 : 1.0) * gain * up;
    } else if (kind === 'fly') {
      const bob = (big ? 1.6 : 1.2) * gain * sin;
      const edge = Math.abs(x - fp.cx) / fp.half; // 0 in the middle, 1 at the wing tips
      const flap = edge > 0.3 ? -(S * 0.1) * gain * edge * Math.sin(2 * phase) : 0;
      sy = y - bob - flap;
    } else {
      const stretch = 1 + 0.06 * gain * Math.sin(2 * phase);
      sx = fp.cx + (x - fp.cx) / stretch - Math.sin(phase) * 0.8 * gain * up;
      sy = y + 1.4 * gain * Math.abs(sin) - 0.7 * gain;
    }
    const ix = Math.round(sx), iy = Math.round(sy);
    if (ix < 0 || iy < 0 || ix >= S || iy >= S) continue;
    const s = (iy * S + ix) * 4, d = (y * S + x) * 4;
    out[d] = still.data[s]; out[d + 1] = still.data[s + 1]; out[d + 2] = still.data[s + 2]; out[d + 3] = still.data[s + 3] >= 128 ? 255 : 0;
  }
  // thin details (an eye two pixels high) can fall between sampled rows: stamp each one again at its moved position
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const s = (y * S + x) * 4;
    if (!opaque(still.data, s) || !accents.has((still.data[s] << 16) | (still.data[s + 1] << 8) | still.data[s + 2])) continue;
    const up = Math.max(0, (fp.bottom - y) / fp.height);
    let nx = x, ny = y;
    if (kind === 'idle') {
      const stretch = 1 + (S >= 40 ? 0.035 : 0.05) * gain * sin;
      ny = fp.bottom - (fp.bottom - y) * stretch;
      nx = x + Math.sin(phase + 0.9) * (S >= 40 ? 1.6 : 1.0) * gain * up;
    } else if (kind === 'fly') {
      const edge = Math.abs(x - fp.cx) / fp.half;
      ny = y + (S >= 40 ? 1.6 : 1.2) * gain * sin + (edge > 0.3 ? -(S * 0.1) * gain * edge * Math.sin(2 * phase) : 0);
    } else {
      nx = fp.cx + (x - fp.cx) * (1 + 0.06 * gain * Math.sin(2 * phase)) + Math.sin(phase) * 0.8 * gain * up;
      ny = y - 1.4 * gain * Math.abs(sin) + 0.7 * gain;
    }
    const ix = Math.round(nx), iy = Math.round(ny);
    if (ix < 0 || iy < 0 || ix >= S || iy >= S) continue;
    const d = (iy * S + ix) * 4;
    out[d] = still.data[s]; out[d + 1] = still.data[s + 1]; out[d + 2] = still.data[s + 2]; out[d + 3] = 255;
  }
  return out;
}

/** A looping strip of `N` frames. `gain` scales the motion (the builder tries several to find one that scores well). */
export function procedural(still, kind, gain = 1, N = 6) {
  const fp = footprint(still);
  const accents = accentColours(still, fp);
  const S = still.w;
  const strip = { w: S * N, h: S, data: new Uint8Array(S * N * S * 4) };
  for (let k = 0; k < N; k++) {
    const px = frame(still, fp, kind, (2 * Math.PI * k) / N, gain, N, accents);
    for (let y = 0; y < S; y++) strip.data.set(px.subarray(y * S * 4, (y + 1) * S * 4), (y * strip.w + k * S) * 4);
  }
  return strip;
}
