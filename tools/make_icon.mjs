// Renders tools/make_icon.html in Node (no browser) and writes the Play Store icon and the Android launcher icons.
//   node tools/make_icon.mjs
// Outputs: docs/release/icon_512.png (store, with wordmark) and game/android/app/src/main/res/mipmap-*/ic_launcher*.png
// (art without wordmark: legacy square and round icons, plus adaptive foreground and background layers).
import fs from 'node:fs';
import vm from 'node:vm';
import { encodePng } from './lib/png.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const html = fs.readFileSync(`${ROOT}tools/make_icon.html`, 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const relics = fs.readFileSync(`${ROOT}docs/handoff/relic_art_reference.js`, 'utf8');

/** Runs the icon script in one mode and returns the 128x128 RGBA image. */
function render(mode) {
  const img = { w: 128, h: 128, data: new Uint8Array(128 * 128 * 4) };
  let fill = [0, 0, 0];
  const ctx = {
    set fillStyle(c) { fill = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)); },
    fillRect(x, y) { img.data.set([...fill, 255], (y * 128 + x) * 4); },
  };
  vm.runInNewContext(`${relics}\n${script}`, { location: { search: `?mode=${mode}` }, URLSearchParams, document: { getElementById: () => ({ getContext: () => ctx }) }, Math, Array });
  return img;
}

/** Area-average resample of a square region (sx, sy, side) into an out x out image; keeps transparency. */
function resample(src, sx, sy, side, out) {
  const img = { w: out, h: out, data: new Uint8Array(out * out * 4) };
  const k = side / out;
  for (let y = 0; y < out; y++) for (let x = 0; x < out; x++) {
    const acc = [0, 0, 0, 0];
    let n = 0;
    for (let v = 0; v < 4; v++) for (let u = 0; u < 4; u++) {
      const px = Math.floor(sx + (x + (u + 0.5) / 4) * k), py = Math.floor(sy + (y + (v + 0.5) / 4) * k);
      n++;
      if (px < 0 || py < 0 || px >= src.w || py >= src.h) continue;
      const i = (py * src.w + px) * 4, a = src.data[i + 3];
      acc[0] += src.data[i] * a; acc[1] += src.data[i + 1] * a; acc[2] += src.data[i + 2] * a; acc[3] += a;
    }
    const d = (y * out + x) * 4;
    if (acc[3]) { img.data[d] = acc[0] / acc[3]; img.data[d + 1] = acc[1] / acc[3]; img.data[d + 2] = acc[2] / acc[3]; }
    img.data[d + 3] = acc[3] / n;
  }
  return img;
}

const over = (a, b) => { const o = { ...a, data: a.data.slice() }; for (let i = 0; i < o.data.length; i += 4) if (b.data[i + 3]) o.data.set(b.data.subarray(i, i + 4), i); return o; };
const circle = (img) => { const o = { ...img, data: img.data.slice() }; const r = img.w / 2; for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (Math.hypot(x + 0.5 - r, y + 0.5 - r) > r) o.data[(y * img.w + x) * 4 + 3] = 0; return o; };
const write = (path, img) => { fs.writeFileSync(`${ROOT}${path}`, encodePng(img)); console.log(path, `${img.w}x${img.h}`); };

const store = render('store'), fg = render('fg'), bg = render('bg');
write('docs/release/icon_512.png', resample(store, 0, 0, 128, 512));

// the art's bounding box, so the launcher icons can centre it
let x0 = 128, y0 = 128, x1 = 0, y1 = 0;
for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) if (fg.data[(y * 128 + x) * 4 + 3]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
const cx = (x0 + x1 + 1) / 2, cy = (y0 + y1 + 1) / 2, art = Math.max(x1 - x0 + 1, y1 - y0 + 1);
const full = over(bg, fg);
const RES = 'game/android/app/src/main/res/mipmap-';
for (const [dpi, s] of [['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192]]) {
  // legacy icons: the art fills about 90% of the icon
  const side = art / 0.9;
  const legacy = resample(full, cx - side / 2, cy - side / 2, side, s);
  write(`${RES}${dpi}/ic_launcher.png`, legacy);
  write(`${RES}${dpi}/ic_launcher_round.png`, circle(legacy));
  // adaptive layers are 108dp; launchers show the middle 66-72dp, so the art spans 62% of the layer
  const layer = s * 108 / 48, aside = art / 0.62;
  write(`${RES}${dpi}/ic_launcher_foreground.png`, resample(fg, cx - aside / 2, cy - aside / 2, aside, layer));
  write(`${RES}${dpi}/ic_launcher_background.png`, resample(bg, 0, 0, 128, layer));
}
