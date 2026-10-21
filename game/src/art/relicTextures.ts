import type Phaser from 'phaser';
import { Px } from './textures';
import { gridTexture } from './pix';

const N = 32;

// ------------------------------------------------------------------ modular emblem layers

/** Knot plate emblem for the Skyforge Maul (separate function so it can be swapped with a 1-line change). */
export function drawKnotEmblem(p: Px, x0: number, y0: number, color = 'f'): void {
  const kn = ['.ee.ee.', 'e.eee.e', 'e..e..e', '.ee.ee.'];
  kn.forEach((r, j) => {
    [...r].forEach((ch, i) => {
      if (ch !== '.') p.set(x0 + i, y0 + j, color);
    });
  });
}

/** Crown emblem for the Bulwark Disc (separate function so it can be swapped with a 1-line change). */
export function drawCrownEmblem(p: Px, x0: number, y0: number, color = '1'): void {
  const cr = ['0..0.0..0', '00.000.00', '000000000', '000000000', '.0000000.'];
  cr.forEach((r, j) => {
    [...r].forEach((ch, i) => {
      if (ch === '0') p.set(x0 + i, y0 + j, color);
    });
  });
  p.rect(x0, y0 + 5, 9, 1, color);
}

/** Reactor-style segmented core for the Kinetic Palms (separate function so it can be swapped with a 1-line change). */
export function drawReactorCoreEmblem(p: Px, cx: number, cy: number): void {
  for (let y = cy - 8; y <= cy + 8; y++) {
    for (let x = cx - 8; x <= cx + 8; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy);
      if (d > 7.4) continue;
      if (d > 6.2) {
        p.set(x, y, '8'); // navy ring
        continue;
      }
      if (d > 4.2) {
        const an = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
        const nearSpoke = [90, 210, 330].some((a) => Math.min(Math.abs(an - a), 360 - Math.abs(an - a)) < 9);
        p.set(x, y, nearSpoke ? '8' : 'a'); // 3 cyan segments separated by navy spokes
        continue;
      }
      // Inner pale cyan disc with white inverted triangle
      const top = cy - 3;
      if (y >= top && Math.abs(dx) <= 3.3 - (y - top) * 0.55) {
        p.set(x, y, 'c'); // white triangle
      } else {
        p.set(x, y, 'b'); // pale cyan disc
      }
    }
  }
}

// ------------------------------------------------------------------ 1. Skyforge Maul (32x32)

export function buildSkyforgeMaul(): Px {
  const p = new Px(N, N);
  // Squared silver head: 18x11
  p.rect(7, 3, 18, 11, 'l');
  // Highlight top and left edge
  p.rect(7, 3, 18, 1, 'c');
  p.rect(7, 3, 1, 11, 'c');
  // Shade bottom and right edge
  p.rect(8, 13, 17, 1, 'f');
  p.rect(24, 4, 1, 10, 'f');
  p.rect(8, 12, 16, 1, 'k');
  p.rect(23, 5, 1, 8, 'k');

  // Hatched end caps
  for (let y = 3; y <= 13; y++) {
    for (const x of [8, 9, 22, 23]) {
      p.set(x, y, (x + y) % 2 ? 'k' : 'l');
    }
  }

  // Face plate bevel
  p.rect(10, 5, 12, 7, 'l');
  p.rect(10, 5, 12, 1, 'k');
  p.rect(10, 11, 12, 1, 'c');
  p.rect(10, 5, 1, 7, 'k');
  p.rect(21, 5, 1, 7, 'c');

  // Engraved knot plate
  drawKnotEmblem(p, 13, 7, 'f');

  // Collar
  p.rect(13, 14, 6, 2, 'k');
  p.rect(13, 14, 6, 1, 'c');

  // Rope-wrapped handle: diagonal tan/brown bands with silver thread
  for (let y = 16; y <= 26; y++) {
    for (let x = 14; x <= 17; x++) {
      const q = (x + y) % 4;
      p.set(x, y, q < 2 ? 'i' : 'g');
      if (q === 0) p.set(x, y, 'l');
      if (x === 17) p.set(x, y, 'h');
    }
  }

  // Bottom strap collar
  p.rect(13, 26, 6, 2, 'k');
  p.rect(13, 26, 6, 1, 'c');

  // Bottom leather loop
  for (let y = 26; y <= 31; y++) {
    for (let x = 11; x <= 20; x++) {
      const d = Math.hypot(x - 15.5, y - 29);
      if (d > 1.4 && d <= 3.2) p.set(x, y, d < 2.3 ? 'i' : 'g');
    }
  }

  return p.outline();
}

export function buildSkyforgeMaulCharged(): Px {
  const p = buildSkyforgeMaul();
  // Cyan-white electric sparks at head corners
  const sparks = [[6, 2], [7, 1], [25, 2], [26, 1], [6, 14], [25, 14], [16, 1]];
  sparks.forEach(([x, y]) => {
    p.set(x, y, 'b');
    p.set(x + 1, y, 'c');
  });
  return p;
}

export function buildSkyforgeMaulPlanted(): Px {
  const p = new Px(N, N);
  // Rubble mound at base
  for (let y = 18; y <= 30; y++) {
    for (let x = 3; x <= 28; x++) {
      const d = Math.hypot((x - 15.5) / 12, (y - 28) / 8);
      if (d <= 1) p.set(x, y, (x + y) % 3 === 0 ? 'f' : (x + y) % 2 === 0 ? 'k' : 'l');
    }
  }
  // Maul head planted upside down
  p.rect(9, 14, 14, 8, 'l');
  p.rect(9, 14, 14, 1, 'c');
  p.rect(9, 21, 14, 1, 'f');
  drawKnotEmblem(p, 12, 16, 'f');
  // Handle sticking up
  for (let y = 4; y <= 13; y++) {
    for (let x = 14; x <= 17; x++) {
      p.set(x, y, (x + y) % 2 ? 'i' : 'g');
    }
  }
  // Bottom loop at top
  p.rect(13, 2, 6, 2, 'k');
  // Radiating bolts
  const bolts = [[7, 12], [8, 10], [5, 16], [26, 13], [24, 10], [27, 17]];
  bolts.forEach(([x, y]) => {
    p.set(x, y, 'c');
    p.set(x - 1, y, 'b');
  });
  return p.outline();
}

// ------------------------------------------------------------------ 2. Comet Fists (32x32)

export function buildCometFists(): Px {
  const p = new Px(N, N);
  // Four curled fingers (4px wide, shaded with crease row)
  for (let f = 0; f < 4; f++) {
    const x0 = 5 + f * 5;
    for (let y = 3; y <= 12; y++) {
      const cut = (y === 3);
      for (let i = 0; i < 4; i++) {
        if (cut && (i === 0 || i === 3)) continue;
        const c = i === 0 ? 'n' : i === 1 ? '6' : i === 2 ? 's' : '6';
        p.set(x0 + i, y, c);
      }
    }
    // Highlights
    p.set(x0 + 2, 5, '5');
    p.set(x0 + 2, 6, '5');
    p.set(x0 + 1, 5, 's');
    // Crease line
    for (let i = 0; i < 4; i++) p.set(x0 + i, 8, 'n');
    // Gaps between fingers
    if (f < 3) for (let y = 4; y <= 12; y++) p.set(x0 + 4, y, '0');
  }

  // Knuckle bar
  p.rect(5, 13, 20, 1, '0');

  // Palm mass
  for (let y = 14; y <= 24; y++) {
    for (let x = 4; x <= 25; x++) {
      const e = Math.hypot((x - 14.5) / 12, (y - 19) / 7);
      if (e <= 1) {
        p.set(x, y, e > 0.8 ? 'n' : e > 0.45 ? '6' : 's');
      }
    }
  }

  // Thumb folded across palm
  for (let y = 13; y <= 22; y++) {
    for (let x = 2; x <= 13; x++) {
      const e = Math.hypot((x - 8) / 6.4, (y - 17.5) / 4.2);
      if (e <= 1) p.set(x, y, e > 0.82 ? '0' : e > 0.55 ? '6' : 's');
    }
  }
  p.set(6, 15, '5');
  p.set(7, 15, '5');
  p.set(6, 16, '5');

  // Heavy metal gauntlet wrist band
  p.rect(9, 25, 14, 5, 'n');
  for (let i = 0; i < 10; i++) {
    p.set(Math.round(10 + i * 1.2), 26 + (i % 2), '6');
  }
  p.rect(9, 30, 14, 1, '0');

  return p.outline();
}

export function buildCometFistsCharged(): Px {
  const p = buildCometFists();
  // Emerald / lime charge aura particles around knuckles
  for (let x = 4; x <= 26; x += 3) {
    p.set(x, 1, '5');
    p.set(x + 1, 2, 's');
  }
  return p;
}

// ------------------------------------------------------------------ 3. Bulwark Disc (32x32)

export function buildBulwarkDisc(): Px {
  const p = new Px(N, N);
  const cx = 15.5;
  const cy = 15.5;

  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > 15) continue;
      // Concentric rings: outer blue rim, sky blue, bone/white, red, yellow center
      let c = d > 13.6 ? '9' : d > 11 ? 'a' : d > 8.6 ? 'c' : d > 5.8 ? '2' : '4';
      if (d > 13.6 && (x + y) % 4 === 0) c = '8'; // navy hatch on rim
      p.set(x, y, c);
    }
  }

  // Upper-left gloss arc (angles 200° to 300°)
  for (let a = 200; a < 300; a += 4) {
    const gx = Math.round(cx + Math.cos(a * Math.PI / 180) * 12.3);
    const gy = Math.round(cy + Math.sin(a * Math.PI / 180) * 12.3);
    p.set(gx, gy, 'c');
  }

  // Crown emblem on yellow center (different emblem, no star)
  drawCrownEmblem(p, 11, 12, '1');

  return p.outline();
}

// ------------------------------------------------------------------ 4. Steersong Arrow (32x32)

export function buildSteersongArrow(): Px {
  const p = new Px(N, N);
  // Shaded shaft (3px wide) from (6, 26) to (23, 9)
  p.line(6, 26, 23, 9, 'g');
  p.line(6, 25, 22, 9, 'i');
  p.line(7, 27, 23, 10, 'h');

  // Red fletchings with plum underside and white edge
  for (let k = 0; k < 3; k++) {
    p.line(3 + k * 2, 29 - k * 2, 9 + k * 2, 23 - k * 2, '2');
    p.line(3 + k * 2, 29 - k * 2 + 1, 9 + k * 2, 24 - k * 2, '1');
  }
  p.line(3, 28, 9, 22, 'c');

  // Steel arrow head
  for (let i = 0; i < 5; i++) {
    p.line(22 + i, 10 - i, Math.round(26 + i * 0.2), Math.round(6 - i * 0.2), 'l');
  }
  p.line(22, 10, 27, 5, 'c');

  // Glowing explosive bulb at tip
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const d = Math.hypot(x - 27.5, y - 4.5);
      if (d <= 3.6) {
        p.set(x, y, d > 2.4 ? '3' : d > 1.2 ? '4' : 't');
      }
    }
  }

  return p.outline();
}

export function buildSteersongArrowArmed(): Px {
  const p = buildSteersongArrow();
  // Glowing yellow dots surrounding the bulb
  const dots = [[24, 1], [27, 0], [30, 2], [31, 5], [29, 8], [25, 7]];
  dots.forEach(([x, y]) => p.set(x, y, '4'));
  return p;
}

export function buildSteersongArrowSplit(): Px {
  const p = new Px(N, N);
  // Three fanned arrows (-14 deg, 0 deg, +14 deg)
  // Center arrow
  p.line(4, 27, 24, 7, 'g');
  p.line(3, 29, 7, 25, '2');
  p.rect(23, 5, 4, 4, '3');
  p.rect(24, 6, 2, 2, 't');
  // Upper arrow (-14 deg)
  p.line(6, 24, 23, 3, 'g');
  p.line(5, 26, 8, 22, '2');
  p.rect(22, 1, 3, 3, '3');
  p.set(23, 2, 't');
  // Lower arrow (+14 deg)
  p.line(6, 29, 26, 15, 'g');
  p.line(5, 30, 8, 28, '2');
  p.rect(25, 14, 3, 3, '3');
  p.set(26, 15, 't');
  return p.outline();
}

// ------------------------------------------------------------------ 5. Silkline Shooters (32x32)

export function buildSilklineShooters(): Px {
  const p = new Px(N, N);
  // Wrist bracer
  p.rect(2, 12, 16, 11, 'k');
  p.rect(2, 12, 16, 1, 'l');
  p.rect(2, 22, 16, 1, 'f');
  // Two red straps
  p.rect(4, 12, 2, 11, '2');
  p.rect(11, 12, 2, 11, '2');

  // Gem window
  p.rect(6, 14, 5, 7, 'f');
  p.rect(7, 15, 3, 5, 'e');
  p.rect(7, 15, 3, 1, 'l');

  // Nozzle
  p.rect(18, 15, 5, 5, 'l');
  p.rect(18, 15, 5, 1, 'c');
  p.rect(18, 19, 5, 1, 'f');
  p.rect(21, 16, 2, 3, 'e');

  // Web spokes and rings around nozzle
  const cx = 27;
  const cy = 17;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
  dirs.forEach(([dx, dy]) => {
    for (let k = 1; k <= 4; k++) p.set(cx + dx * k, cy + dy * k, 'c');
  });
  const ringDots = [
    [3, 1], [3, -1], [-3, 1], [-3, -1], [1, 3], [-1, 3], [1, -3], [-1, -3],
    [2, 2], [-2, 2], [2, -2], [-2, -2],
  ];
  ringDots.forEach(([dx, dy]) => p.set(cx + dx, cy + dy, 'l'));
  p.set(cx, cy, 'c');

  return p.outline();
}

// ------------------------------------------------------------------ 6. Kinetic Palms (32x32)

export function buildKineticPalms(): Px {
  const p = new Px(N, N);
  // Armoured palm plate with bevel
  p.rect(8, 13, 17, 15, 'k');
  p.rect(8, 13, 17, 1, 'l');
  p.rect(8, 13, 1, 15, 'l');
  p.rect(9, 27, 16, 1, 'f');
  p.rect(24, 14, 1, 14, 'f');

  // Four finger plates
  for (let f = 0; f < 4; f++) {
    p.rect(9 + f * 4, 6, 3, 7, 'k');
    p.rect(9 + f * 4, 6, 1, 7, 'l');
    p.rect(9 + f * 4, 6, 3, 1, 'c');
  }

  // Thumb plate
  p.rect(3, 15, 6, 6, 'k');
  p.rect(3, 15, 6, 1, 'l');

  // Wrist band with cyan stripe
  p.rect(10, 28, 13, 4, 'f');
  p.rect(10, 29, 13, 1, 'a');

  // Segmented reactor-style core in the center of the palm
  drawReactorCoreEmblem(p, 16, 20);

  return p.outline();
}

// ------------------------------------------------------------------ Slingshots (16x48)

export function buildSlingQuicksilver(): Px {
  const p = new Px(16, 48);
  // Sleek silver/chrome post
  p.rect(6, 15, 5, 33, 'f');
  p.rect(7, 16, 3, 32, 'l');
  p.rect(8, 16, 1, 32, 'c');
  // Quicksilver swept fork
  p.rect(2, 3, 5, 16, 'f');
  p.rect(10, 3, 5, 16, 'f');
  p.rect(3, 4, 3, 14, 'l');
  p.rect(11, 4, 3, 14, 'l');
  p.rect(3, 4, 1, 14, 'c');
  p.rect(11, 4, 1, 14, 'c');
  // Cyan core ring on fork crossbar
  p.rect(5, 16, 7, 3, 'a');
  p.rect(7, 17, 3, 1, 'b');
  return p.outline();
}

export function buildSlingGemini(): Px {
  const p = new Px(16, 48);
  // Braided golden post
  p.rect(6, 15, 5, 33, 'h');
  p.rect(7, 16, 3, 32, 'i');
  p.rect(8, 16, 1, 32, '4');
  // Twin double fork
  p.rect(1, 2, 4, 17, 'h');
  p.rect(2, 3, 2, 15, '4');
  p.rect(11, 2, 4, 17, 'h');
  p.rect(12, 3, 2, 15, '4');
  // Dual anchor gems
  p.rect(1, 1, 3, 3, '3');
  p.rect(12, 1, 3, 3, '3');
  p.rect(5, 16, 7, 3, 'i');
  return p.outline();
}

// ------------------------------------------------------------------ FX Textures

export function buildFxBolt(): Px {
  const p = new Px(16, 64);
  // Jagged vertical lightning bolt
  const coords: [number, number][] = [
    [8, 0], [7, 8], [9, 14], [6, 22], [10, 30], [7, 38], [11, 46], [8, 54], [8, 63],
  ];
  for (let i = 0; i < coords.length - 1; i++) {
    p.line(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1], 'a');
  }
  for (let i = 0; i < coords.length - 1; i++) {
    p.line(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1], 'c');
  }
  return p;
}

export function buildFxWebSplat(): Px {
  const p = new Px(32, 32);
  const cx = 15;
  const cy = 15;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
  dirs.forEach(([dx, dy]) => {
    for (let k = 1; k <= 7; k++) p.set(cx + dx * k, cy + dy * k, 'c');
  });
  for (let a = 0; a < 360; a += 15) {
    const rad = a * Math.PI / 180;
    p.set(Math.round(cx + Math.cos(rad) * 5), Math.round(cy + Math.sin(rad) * 5), 'l');
    p.set(Math.round(cx + Math.cos(rad) * 9), Math.round(cy + Math.sin(rad) * 9), 'l');
    p.set(Math.round(cx + Math.cos(rad) * 13), Math.round(cy + Math.sin(rad) * 13), 'l');
  }
  return p.outline();
}

export function buildFxPalmBolt(): Px {
  const p = new Px(16, 8);
  // Fast flat cyan energy bolt with white core
  p.rect(0, 2, 16, 4, 'a');
  p.rect(2, 3, 12, 2, 'c');
  p.rect(13, 3, 2, 2, 'b');
  return p;
}

// ------------------------------------------------------------------ Registration

export function registerRelicTextures(scene: Phaser.Scene): void {
  // Weapons
  gridTexture(scene, 'wpn_w_skyforge_maul', buildSkyforgeMaul().rows());
  gridTexture(scene, 'wpn_w_skyforge_maul_charged', buildSkyforgeMaulCharged().rows());
  gridTexture(scene, 'wpn_w_skyforge_maul_planted', buildSkyforgeMaulPlanted().rows());

  gridTexture(scene, 'wpn_w_comet_fists', buildCometFists().rows());
  gridTexture(scene, 'wpn_w_comet_fists_charged', buildCometFistsCharged().rows());

  gridTexture(scene, 'wpn_w_bulwark_disc', buildBulwarkDisc().rows());

  gridTexture(scene, 'wpn_w_steersong_arrow', buildSteersongArrow().rows());
  gridTexture(scene, 'wpn_w_steersong_arrow_armed', buildSteersongArrowArmed().rows());
  gridTexture(scene, 'wpn_w_steersong_arrow_split', buildSteersongArrowSplit().rows());

  gridTexture(scene, 'wpn_w_silkline_shooters', buildSilklineShooters().rows());

  gridTexture(scene, 'wpn_w_kinetic_palms', buildKineticPalms().rows());

  // Slingshots
  gridTexture(scene, 'sling_quicksilver', buildSlingQuicksilver().rows());
  gridTexture(scene, 'sling_gemini', buildSlingGemini().rows());

  // FX Textures
  gridTexture(scene, 'fx_maul_bolt', buildFxBolt().rows());
  gridTexture(scene, 'fx_web_splat', buildFxWebSplat().rows());
  gridTexture(scene, 'fx_palm_bolt', buildFxPalmBolt().rows());
}
