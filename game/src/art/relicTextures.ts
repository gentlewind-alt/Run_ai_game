import type Phaser from 'phaser';
import { Px } from './textures';
import { gridTexture } from './pix';

const N = 32;

// ------------------------------------------------------------------ modular emblem layers

/** Knot plate emblem for the Skyforge Maul (separate function so it can be swapped with a 1-line change). */
export function drawKnotEmblem(p: Px, x0: number, y0: number, color = 'f'): void {
  // 9x7 Celtic knot plate with interlocking bands and highlights
  const kn = [
    '.ff.ff.ff.',
    'f..f..f..f',
    'f.ff.ff.f.',
    '.f..f..f..',
    'f.ff.ff.f.',
    'f..f..f..f',
    '.ff.ff.ff.',
  ];
  kn.forEach((r, j) => {
    [...r].forEach((ch, i) => {
      if (ch === 'f') p.set(x0 + i, y0 + j, color);
      else if (ch === '.') {
        if ((i + j) % 2 === 0) p.set(x0 + i, y0 + j, 'l');
      }
    });
  });
}

/** Crown emblem for the Bulwark Disc: flat 3-point crown with horizontal bar (never reads as a face). */
export function drawCrownEmblem(p: Px, x0: number, y0: number, color = '2'): void {
  // Horizontal base bar 9x2
  p.rect(x0, y0 + 4, 9, 2, color);
  p.rect(x0 + 1, y0 + 5, 7, 1, '0');
  // Three distinct pointed crown prongs
  // Center prong (tallest)
  p.rect(x0 + 4, y0, 1, 4, color);
  p.set(x0 + 3, y0 + 1, color);
  p.set(x0 + 5, y0 + 1, color);
  // Left prong
  p.rect(x0 + 1, y0 + 2, 1, 2, color);
  p.set(x0, y0 + 2, color);
  // Right prong
  p.rect(x0 + 7, y0 + 2, 1, 2, color);
  p.set(x0 + 8, y0 + 2, color);
  // Jewels on the base bar
  p.set(x0 + 2, y0 + 4, '4');
  p.set(x0 + 4, y0 + 4, '4');
  p.set(x0 + 6, y0 + 4, '4');
}

/** Reactor-style segmented core for Kinetic Palms: 3 cyan sectors separated by dark navy spokes, inner disc with white triangle. */
export function drawReactorCoreEmblem(p: Px, cx: number, cy: number): void {
  for (let y = cy - 8; y <= cy + 8; y++) {
    for (let x = cx - 8; x <= cx + 8; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy);
      if (d > 7.5) continue;
      if (d > 6.2) {
        p.set(x, y, '0'); // dark ink outer rim
        continue;
      }
      if (d > 5.2) {
        p.set(x, y, '8'); // navy housing ring
        continue;
      }
      if (d > 3.4) {
        const an = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
        // 3 dark navy spokes separating 3 cyan glowing segments at 90°, 210°, 330°
        const nearSpoke = [90, 210, 330].some((a) => Math.min(Math.abs(an - a), 360 - Math.abs(an - a)) < 16);
        if (nearSpoke) {
          p.set(x, y, '0'); // dark divider spoke
        } else {
          p.set(x, y, d > 4.6 ? 'a' : 'b'); // glowing cyan with sky blue rim
        }
        continue;
      }
      if (d > 2.6) {
        p.set(x, y, '8'); // inner ring divider
        continue;
      }
      // Inner pale cyan core with crisp inverted white triangle
      const top = cy - 2;
      const relY = y - top;
      if (relY >= 0 && relY <= 3 && Math.abs(dx) <= 2.2 - relY * 0.65) {
        p.set(x, y, 'c'); // white triangle
      } else {
        p.set(x, y, 'b'); // pale cyan core disc
      }
    }
  }
}

// ------------------------------------------------------------------ 1. Skyforge Maul (32x32 Hero)

export function buildSkyforgeMaul(): Px {
  const p = new Px(N, N);
  // Heavy warhammer head: 22x12 (x=5..26, y=2..13)
  p.rect(5, 2, 22, 12, 'l');
  // Highlight top and left edges
  p.rect(5, 2, 22, 1, 'c');
  p.rect(5, 2, 1, 12, 'c');
  // Bevel shading: lower edge and right edge
  p.rect(6, 13, 21, 1, 'f');
  p.rect(26, 3, 1, 11, 'f');
  p.rect(6, 12, 20, 1, 'k');
  p.rect(25, 4, 1, 9, 'k');

  // Hatched end caps (left x=5..7, right x=24..26)
  for (let y = 3; y <= 12; y++) {
    for (const x of [6, 7, 24, 25]) {
      p.set(x, y, (x + y) % 2 ? 'k' : 'l');
    }
  }
  p.rect(5, 3, 1, 10, 'c');
  p.rect(26, 3, 1, 10, 'f');

  // Central recessed face plate (x=9..22, y=4..11)
  p.rect(9, 4, 14, 8, 'l');
  p.rect(9, 4, 14, 1, 'k');
  p.rect(9, 11, 14, 1, 'c');
  p.rect(9, 4, 1, 8, 'k');
  p.rect(22, 4, 1, 8, 'c');

  // Engraved Celtic knot emblem
  drawKnotEmblem(p, 12, 5, 'f');

  // Steel & brass collar connecting head to handle (x=13..18, y=14..15)
  p.rect(13, 14, 6, 2, 'k');
  p.rect(13, 14, 6, 1, 'c');
  p.rect(13, 15, 6, 1, 'e');

  // Rope-wrapped handle (x=14..17, y=16..26): diagonal tan/brown bands with silver thread
  for (let y = 16; y <= 26; y++) {
    for (let x = 14; x <= 17; x++) {
      const q = (x + y) % 4;
      p.set(x, y, q < 2 ? 'i' : 'g');
      if (q === 0) p.set(x, y, 'c'); // silver cross-thread highlight
      if (x === 17) p.set(x, y, 'h'); // shadow side
    }
  }

  // Bottom strap collar (x=13..18, y=27..28)
  p.rect(13, 27, 6, 2, 'k');
  p.rect(13, 27, 6, 1, 'c');

  // Bottom leather/steel pommel loop (x=11..20, y=27..31)
  for (let y = 27; y <= 31; y++) {
    for (let x = 11; x <= 20; x++) {
      const d = Math.hypot(x - 15.5, y - 29);
      if (d > 1.4 && d <= 3.4) p.set(x, y, d < 2.4 ? 'i' : 'g');
    }
  }

  return p.outline();
}

export function buildSkyforgeMaulCharged(): Px {
  const p = buildSkyforgeMaul();
  // Crackling cyan-white electric sparks at corners and along head
  const sparks = [
    [4, 1], [5, 0], [26, 1], [27, 0], [4, 13], [27, 13], [15, 0],
    [8, 1], [23, 1], [11, 14], [20, 14], [15, 31],
  ];
  sparks.forEach(([x, y]) => {
    p.set(x, y, 'b');
    p.set(x + 1, y, 'c');
  });
  return p;
}

export function buildSkyforgeMaulPlanted(): Px {
  const p = new Px(N, N);
  // Rubble mound at base
  for (let y = 16; y <= 30; y++) {
    for (let x = 2; x <= 29; x++) {
      const d = Math.hypot((x - 15.5) / 13, (y - 27) / 9);
      if (d <= 1) p.set(x, y, (x + y) % 3 === 0 ? 'f' : (x + y) % 2 === 0 ? 'k' : 'l');
    }
  }
  // Maul head planted upside down
  p.rect(8, 13, 16, 9, 'l');
  p.rect(8, 13, 16, 1, 'c');
  p.rect(8, 21, 16, 1, 'f');
  drawKnotEmblem(p, 11, 14, 'f');
  // Handle sticking up
  for (let y = 3; y <= 12; y++) {
    for (let x = 14; x <= 17; x++) {
      const q = (x + y) % 4;
      p.set(x, y, q < 2 ? 'i' : 'g');
      if (q === 0) p.set(x, y, 'c');
    }
  }
  p.rect(13, 2, 6, 2, 'k');
  // Radiating lightning arcs
  const bolts = [[6, 11], [7, 9], [4, 15], [27, 12], [25, 9], [28, 16]];
  bolts.forEach(([x, y]) => {
    p.set(x, y, 'c');
    p.set(x - 1, y, 'b');
  });
  return p.outline();
}

// ------------------------------------------------------------------ 2. Comet Fists (32x32 Hero)

export function buildCometFists(): Px {
  const p = new Px(N, N);
  // Four segmented curved fingers (x=4..26, y=2..12)
  for (let f = 0; f < 4; f++) {
    const x0 = 4 + f * 6;
    for (let y = 2; y <= 12; y++) {
      const cut = (y === 2);
      for (let i = 0; i < 5; i++) {
        if (cut && (i === 0 || i === 4)) continue;
        const c = i === 0 ? 'n' : i === 1 ? '6' : i === 2 ? 's' : i === 3 ? '6' : 'o';
        p.set(x0 + i, y, c);
      }
    }
    // Knuckle highlight cap
    p.set(x0 + 2, 3, '5');
    p.set(x0 + 3, 3, 'c');
    p.set(x0 + 2, 4, 's');
    // Crease & rivet line at y=7
    for (let i = 0; i < 5; i++) p.set(x0 + i, 7, 'n');
    p.set(x0 + 2, 7, 'c'); // silver rivet
    // Gap outline between fingers
    if (f < 3) for (let y = 3; y <= 12; y++) p.set(x0 + 5, y, '0');
  }

  // Knuckle bar base
  p.rect(4, 13, 23, 1, '0');

  // Main armored palm mass (x=3..27, y=14..24)
  for (let y = 14; y <= 24; y++) {
    for (let x = 3; x <= 27; x++) {
      const e = Math.hypot((x - 15) / 12, (y - 19) / 6.5);
      if (e <= 1) {
        p.set(x, y, e > 0.8 ? 'n' : e > 0.45 ? '6' : 's');
      }
    }
  }

  // Thumb folded across the palm (x=2..13, y=13..22)
  for (let y = 13; y <= 22; y++) {
    for (let x = 2; x <= 13; x++) {
      const e = Math.hypot((x - 7.5) / 5.8, (y - 17.5) / 4.2);
      if (e <= 1) p.set(x, y, e > 0.82 ? '0' : e > 0.5 ? '6' : 's');
    }
  }
  p.set(5, 15, '5');
  p.set(6, 15, 'c');
  p.set(5, 16, '5');

  // Reinforced wrist band / gauntlet cuff with brass rivets (x=7..24, y=25..30)
  p.rect(7, 25, 17, 5, 'n');
  for (let i = 0; i < 14; i++) {
    p.set(Math.round(8 + i * 1.1), 26 + (i % 2), '6');
  }
  p.rect(8, 28, 15, 1, 's');
  p.rect(7, 30, 17, 1, '0');
  // Rivets on cuff
  p.set(9, 26, 'c');
  p.set(15, 26, 'c');
  p.set(21, 26, 'c');

  return p.outline();
}

export function buildCometFistsCharged(): Px {
  const p = buildCometFists();
  // Emerald / lime charge aura particles around knuckles and wrist
  for (let x = 3; x <= 27; x += 3) {
    p.set(x, 0, '5');
    p.set(x + 1, 1, 's');
  }
  p.set(2, 14, '5');
  p.set(28, 14, '5');
  return p;
}

// ------------------------------------------------------------------ 3. Bulwark Disc (32x32 Hero)

export function buildBulwarkDisc(): Px {
  const p = new Px(N, N);
  const cx = 15.5;
  const cy = 15.5;

  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > 15) continue;
      // Concentric rings: outer blue rim, sky blue, bone/white, red, yellow center
      let c = d > 13.6 ? '9' : d > 11.2 ? 'a' : d > 8.8 ? 'c' : d > 5.8 ? '2' : '4';
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

  // Flat 3-point royal crown emblem on yellow center (cannot read as a face)
  drawCrownEmblem(p, 11, 12, '2');

  return p.outline();
}

// ------------------------------------------------------------------ 4. Steersong Arrow (32x32 Hero)

export function buildSteersongArrow(): Px {
  const p = new Px(N, N);
  // Shaded diagonal shaft (3px wide) from (5, 27) to (24, 8)
  p.line(5, 27, 24, 8, 'g');
  p.line(5, 26, 23, 8, 'i');
  p.line(6, 28, 24, 9, 'h');

  // Red and plum fletchings with white crest edges
  for (let k = 0; k < 4; k++) {
    p.line(2 + k * 2, 30 - k * 2, 9 + k * 2, 23 - k * 2, '2');
    p.line(2 + k * 2, 31 - k * 2, 9 + k * 2, 24 - k * 2, '1');
  }
  p.line(2, 29, 9, 22, 'c');

  // Chiseled steel arrowhead
  for (let i = 0; i < 6; i++) {
    p.line(22 + i, 10 - i, Math.round(27 + i * 0.2), Math.round(5 - i * 0.2), 'l');
  }
  p.line(22, 10, 28, 4, 'c');

  // Glowing explosive bulb at tip
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const d = Math.hypot(x - 27.5, y - 4.5);
      if (d <= 3.8) {
        p.set(x, y, d > 2.5 ? '3' : d > 1.2 ? '4' : 't');
      }
    }
  }

  return p.outline();
}

export function buildSteersongArrowArmed(): Px {
  const p = buildSteersongArrow();
  // Glowing yellow spark ring surrounding the explosive bulb
  const dots = [[23, 1], [27, 0], [31, 2], [31, 5], [29, 9], [25, 8], [24, 5]];
  dots.forEach(([x, y]) => p.set(x, y, '4'));
  return p;
}

export function buildSteersongArrowSplit(): Px {
  const p = new Px(N, N);
  // Three distinct fanned arrows (-14 deg, 0 deg, +14 deg)
  // Center arrow
  p.line(3, 28, 25, 6, 'g');
  p.line(2, 30, 7, 25, '2');
  p.rect(24, 4, 4, 4, '3');
  p.rect(25, 5, 2, 2, 't');
  // Upper arrow (-14 deg)
  p.line(5, 25, 24, 2, 'g');
  p.line(4, 27, 8, 23, '2');
  p.rect(23, 1, 3, 3, '3');
  p.set(24, 2, 't');
  // Lower arrow (+14 deg)
  p.line(5, 30, 27, 14, 'g');
  p.line(4, 31, 8, 29, '2');
  p.rect(26, 13, 3, 3, '3');
  p.set(27, 14, 't');
  return p.outline();
}

// ------------------------------------------------------------------ 5. Silkline Shooters (32x32 Hero)

export function buildSilklineShooters(): Px {
  const p = new Px(N, N);
  // Curved wrist bracer body
  p.rect(2, 11, 16, 12, 'e');
  p.rect(2, 11, 16, 1, 'l');
  p.rect(2, 22, 16, 1, 'f');

  // Two bold red straps with silver buckles
  p.rect(4, 10, 3, 14, '2');
  p.rect(11, 10, 3, 14, '2');
  p.set(5, 16, 'c'); // silver buckle pin
  p.set(12, 16, 'c');

  // Gem chamber in center
  p.rect(7, 13, 4, 8, 'f');
  p.rect(8, 14, 2, 6, 'b');
  p.set(8, 14, 'c');

  // Front spinneret nozzle (x=18..23, y=14..20)
  p.rect(18, 14, 5, 6, 'l');
  p.rect(18, 14, 5, 1, 'c');
  p.rect(18, 19, 5, 1, 'f');
  p.rect(21, 15, 2, 4, 'e');

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

// ------------------------------------------------------------------ 6. Kinetic Palms (32x32 Hero)

export function buildKineticPalms(): Px {
  const p = new Px(N, N);
  // Armoured palm plate with bevel
  p.rect(7, 12, 18, 16, 'k');
  p.rect(7, 12, 18, 1, 'l');
  p.rect(7, 12, 1, 16, 'l');
  p.rect(8, 27, 17, 1, 'f');
  p.rect(24, 13, 1, 15, 'f');

  // Four articulated finger plates across top
  for (let f = 0; f < 4; f++) {
    p.rect(8 + f * 4, 5, 3, 8, 'k');
    p.rect(8 + f * 4, 5, 1, 8, 'l');
    p.rect(8 + f * 4, 5, 3, 1, 'c');
    p.set(9 + f * 4, 8, 'f'); // knuckle rivet
  }

  // Thumb plate
  p.rect(2, 14, 6, 7, 'k');
  p.rect(2, 14, 6, 1, 'l');
  p.rect(2, 14, 1, 7, 'c');

  // Wrist band with cyan conduit stripe
  p.rect(9, 28, 14, 4, 'f');
  p.rect(9, 29, 14, 1, 'a');
  p.rect(13, 29, 6, 1, 'b');

  // Sharp segmented reactor core in center of palm
  drawReactorCoreEmblem(p, 16, 20);

  return p.outline();
}

// ------------------------------------------------------------------ Dedicated 24x24 Card Icons

export function buildCardSkyforgeMaul(): Px {
  const p = new Px(24, 24);
  // 24x24 card icon: Head (16x8), knot plate, rope handle, loop
  p.rect(4, 2, 16, 9, 'l');
  p.rect(4, 2, 16, 1, 'c');
  p.rect(4, 2, 1, 9, 'c');
  p.rect(5, 10, 15, 1, 'f');
  p.rect(19, 3, 1, 8, 'f');
  // End caps
  for (let y = 3; y <= 9; y++) {
    p.set(5, y, y % 2 ? 'k' : 'l');
    p.set(18, y, y % 2 ? 'k' : 'l');
  }
  // Knot plate
  p.rect(8, 4, 8, 5, 'k');
  p.set(9, 5, 'c');
  p.set(11, 5, 'c');
  p.set(13, 5, 'c');
  p.set(10, 7, 'c');
  p.set(12, 7, 'c');
  // Collar
  p.rect(10, 11, 4, 1, 'c');
  // Rope-wrapped handle
  for (let y = 12; y <= 19; y++) {
    for (let x = 11; x <= 13; x++) {
      p.set(x, y, (x + y) % 2 ? 'i' : 'g');
      if ((x + y) % 3 === 0) p.set(x, y, 'c');
    }
  }
  // Bottom loop
  p.rect(10, 20, 4, 1, 'k');
  p.set(10, 21, 'i');
  p.set(13, 21, 'i');
  p.rect(11, 22, 2, 1, 'g');
  return p.outline();
}

export function buildCardCometFists(): Px {
  const p = new Px(24, 24);
  // 24x24 card icon: Clenched green gauntlet fist
  for (let f = 0; f < 4; f++) {
    const x0 = 3 + f * 4;
    p.rect(x0, 2, 3, 8, '6');
    p.set(x0 + 1, 2, '5');
    p.set(x0 + 1, 3, 'c');
    p.set(x0 + 1, 6, 'n');
    p.set(x0 + 1, 7, 'c');
  }
  p.rect(3, 10, 16, 7, '6');
  // Thumb folded across
  p.rect(2, 9, 8, 4, 's');
  p.rect(2, 9, 8, 1, '5');
  p.set(4, 10, 'c');
  // Wrist cuff
  p.rect(5, 17, 13, 4, 'n');
  p.rect(5, 18, 13, 1, '6');
  p.set(7, 18, 'c');
  p.set(11, 18, 'c');
  p.set(15, 18, 'c');
  return p.outline();
}

export function buildCardBulwarkDisc(): Px {
  const p = new Px(24, 24);
  const cx = 11.5;
  const cy = 11.5;
  // Concentric 22px shield
  for (let y = 0; y < 24; y++) {
    for (let x = 0; x < 24; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > 10.5) continue;
      const c = d > 9.0 ? '9' : d > 7.2 ? 'a' : d > 5.5 ? 'c' : d > 3.8 ? '2' : '4';
      p.set(x, y, c);
    }
  }
  // Gloss shine
  p.set(6, 4, 'c');
  p.set(7, 4, 'c');
  p.set(5, 5, 'c');
  p.set(4, 6, 'c');
  // Flat 3-point crown on gold center
  p.rect(8, 12, 7, 2, '2');
  p.set(8, 10, '2');
  p.set(11, 9, '2');
  p.set(14, 10, '2');
  p.set(10, 12, '4');
  p.set(12, 12, '4');
  return p.outline();
}

export function buildCardSteersongArrow(): Px {
  const p = new Px(24, 24);
  // Dedicated 24x24 card icon: Red fletching, diagonal shaft, grey head, orange bulb
  // Diagonal shaft from (4, 19) to (18, 5)
  p.line(4, 19, 18, 5, 'g');
  p.line(4, 18, 17, 5, 'i');
  // Bold red fletching with white edge
  p.line(2, 22, 7, 17, '2');
  p.line(3, 23, 8, 18, '1');
  p.line(1, 20, 6, 15, '2');
  p.line(1, 21, 6, 16, 'c');
  // Chiseled steel head
  p.line(16, 7, 20, 3, 'l');
  p.line(16, 6, 20, 2, 'c');
  // Glowing orange bulb with yellow core
  p.rect(19, 2, 4, 4, '3');
  p.rect(20, 3, 2, 2, '4');
  p.set(20, 3, 't');
  return p.outline();
}

export function buildCardSilklineShooters(): Px {
  const p = new Px(24, 24);
  // Dedicated 24x24 card icon: Strapped wrist bracer with web spokes
  // Bracer body
  p.rect(2, 8, 13, 9, 'e');
  p.rect(2, 8, 13, 1, 'l');
  p.rect(2, 16, 13, 1, 'f');
  // TWO red straps with buckles
  p.rect(4, 7, 2, 11, '2');
  p.rect(9, 7, 2, 11, '2');
  p.set(5, 12, 'c');
  p.set(10, 12, 'c');
  // Front nozzle
  p.rect(15, 10, 3, 5, 'l');
  p.rect(15, 10, 3, 1, 'c');
  // Radiating web spokes
  const cx = 19;
  const cy = 12;
  p.line(cx, cy, cx + 4, cy, 'c');
  p.line(cx, cy, cx + 3, cy - 3, 'c');
  p.line(cx, cy, cx + 3, cy + 3, 'c');
  p.line(cx, cy, cx + 1, cy - 4, 'c');
  p.line(cx, cy, cx + 1, cy + 4, 'c');
  p.set(cx + 2, cy - 1, 'l');
  p.set(cx + 2, cy + 1, 'l');
  return p.outline();
}

export function buildCardKineticPalms(): Px {
  const p = new Px(24, 24);
  // Dedicated 24x24 card icon: Armoured palm with glowing reactor core
  // Fingers
  for (let f = 0; f < 4; f++) {
    p.rect(6 + f * 3, 3, 2, 6, 'l');
    p.set(6 + f * 3, 3, 'c');
  }
  // Thumb
  p.rect(2, 9, 4, 5, 'l');
  p.set(2, 9, 'c');
  // Palm plate
  p.rect(5, 8, 14, 11, 'k');
  p.rect(5, 8, 14, 1, 'l');
  p.rect(5, 8, 1, 11, 'l');
  p.rect(6, 18, 13, 1, 'f');
  // Reactor core
  const cx = 12;
  const cy = 13;
  p.rect(cx - 3, cy - 3, 7, 7, '8');
  p.rect(cx - 2, cy - 2, 5, 5, 'b');
  p.rect(cx - 1, cy - 1, 3, 3, 'c');
  p.set(cx, cy, 'b');
  // Wrist
  p.rect(7, 19, 10, 3, 'f');
  p.rect(7, 20, 10, 1, 'a');
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
  // Full-height jagged lightning bolt with cyan halo and white core
  const coords: [number, number][] = [
    [8, 0], [7, 8], [9, 14], [6, 22], [10, 30], [7, 38], [11, 46], [8, 54], [8, 63],
  ];
  for (let i = 0; i < coords.length - 1; i++) {
    p.line(coords[i][0] - 1, coords[i][1], coords[i + 1][0] - 1, coords[i + 1][1], 'a');
    p.line(coords[i][0] + 1, coords[i][1], coords[i + 1][0] + 1, coords[i + 1][1], 'b');
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
    for (let k = 1; k <= 9; k++) p.set(cx + dx * k, cy + dy * k, 'c');
  });
  for (let a = 0; a < 360; a += 15) {
    const rad = (a * Math.PI) / 180;
    p.set(Math.round(cx + Math.cos(rad) * 4), Math.round(cy + Math.sin(rad) * 4), 'c');
    p.set(Math.round(cx + Math.cos(rad) * 8), Math.round(cy + Math.sin(rad) * 8), 'l');
    p.set(Math.round(cx + Math.cos(rad) * 12), Math.round(cy + Math.sin(rad) * 12), 'l');
  }
  return p.outline();
}

export function buildFxPalmBolt(): Px {
  const p = new Px(16, 8);
  // Fast flat cyan energy bolt with white core
  p.rect(0, 1, 16, 6, 'a');
  p.rect(2, 2, 12, 4, 'b');
  p.rect(4, 3, 10, 2, 'c');
  return p;
}

// ------------------------------------------------------------------ Registration

export function registerRelicTextures(scene: Phaser.Scene): void {
  // Hero Sprites (32x32)
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

  // Dedicated 24x24 Card Icons (not a downscale)
  gridTexture(scene, 'wpn_card_w_skyforge_maul', buildCardSkyforgeMaul().rows());
  gridTexture(scene, 'wpn_card_w_comet_fists', buildCardCometFists().rows());
  gridTexture(scene, 'wpn_card_w_bulwark_disc', buildCardBulwarkDisc().rows());
  gridTexture(scene, 'wpn_card_w_steersong_arrow', buildCardSteersongArrow().rows());
  gridTexture(scene, 'wpn_card_w_silkline_shooters', buildCardSilklineShooters().rows());
  gridTexture(scene, 'wpn_card_w_kinetic_palms', buildCardKineticPalms().rows());

  // Slingshots
  gridTexture(scene, 'sling_quicksilver', buildSlingQuicksilver().rows());
  gridTexture(scene, 'sling_gemini', buildSlingGemini().rows());

  // FX Textures
  gridTexture(scene, 'fx_maul_bolt', buildFxBolt().rows());
  gridTexture(scene, 'fx_web_splat', buildFxWebSplat().rows());
  gridTexture(scene, 'fx_palm_bolt', buildFxPalmBolt().rows());
}
