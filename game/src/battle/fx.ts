// Visual effects: particles, rings, floating words, lightning, shockwaves.
import Phaser from 'phaser';
import { C } from '../art/palette';
import { text } from '../art/font5x7';
import type { LegendVisual } from './BattleCtx';
import type { BattleState } from './state';

export function burst(b: BattleState, x: number, y: number, colors: string[], n: number): void {
  for (let i = 0; i < n && b.parts.length < b.settings.display.maxParticles; i++) {
    const s = b.scene.add.image(x, y, 'px').setTint(C(colors[i % colors.length])).setScale(Phaser.Math.Between(1, 2)).setDepth(11);
    const a = Math.random() * Math.PI * 2;
    const sp = 0.5 + Math.random() * 1.8;
    b.parts.push({ s, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.2, life: 22 + Math.random() * 14 });
  }
}

export function updateParts(b: BattleState): void {
  for (const p of b.parts) {
    p.life--;
    p.vy += 0.12;
    p.s.x += p.vx;
    p.s.y += p.vy;
    p.s.setAlpha(Math.min(1, p.life / 10));
    if (p.life <= 0) p.s.destroy();
  }
  b.parts = b.parts.filter((p) => p.life > 0);
}

export function ring(b: BattleState, x: number, y: number, r: number, color: number): void {
  const c = b.scene.add.circle(x, y, r, 0xffffff, 0).setStrokeStyle(1, color).setDepth(9).setScale(0.2);
  b.scene.tweens.add({ targets: c, scale: 1, alpha: 0, duration: 240, onComplete: () => c.destroy() });
}

/** Full-height lightning bolt 3 px wide with white core and cyan halo, held at peak for 24+ steps. */
export function bolt(b: BattleState, x: number, y: number): void {
  const g = b.scene.add.graphics().setDepth(15);
  // Full-screen white flash overlay for 6 frames
  const flashCover = b.scene.add.rectangle(b.worldW / 2, 135, b.worldW + 100, 300, 0xffffff, 0.9).setDepth(20);
  b.scene.cameras.main.flash(100, 255, 255, 255);

  const top = -10;
  const numPts = 9;
  const pts: [number, number][] = [];
  for (let i = 0; i <= numPts; i++) {
    const t = i / numPts;
    const px = x + (i === 0 || i === numPts ? 0 : Phaser.Math.Between(-10, 10));
    const py = top + (y - top) * t;
    pts.push([px, py]);
  }

  // Branching fork
  const fork: [number, number][] = [];
  const forkStart = pts[Math.floor(numPts * 0.45)];
  fork.push([forkStart[0], forkStart[1]]);
  fork.push([forkStart[0] + Phaser.Math.Between(14, 22), forkStart[1] + 16]);
  fork.push([forkStart[0] + Phaser.Math.Between(22, 34), forkStart[1] + 32]);

  const redraw = () => {
    g.clear();
    // Cyan halo (3-4px)
    g.lineStyle(4, C('b'), 0.9);
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.strokePath();
    g.beginPath();
    g.moveTo(fork[0][0], fork[0][1]);
    for (let i = 1; i < fork.length; i++) g.lineTo(fork[i][0], fork[i][1]);
    g.strokePath();

    // White core (2px)
    g.lineStyle(2, 0xffffff, 1);
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.strokePath();
    g.beginPath();
    g.moveTo(fork[0][0], fork[0][1]);
    for (let i = 1; i < fork.length; i++) g.lineTo(fork[i][0], fork[i][1]);
    g.strokePath();
  };

  redraw();
  let steps = 0;

  b.actors.push({
    pos: () => ({ x, y }),
    update: () => {
      steps++;
      if (steps <= 6) {
        flashCover.setAlpha(Math.max(0, ((6 - steps) / 6) * 0.9));
      } else {
        flashCover.setVisible(false);
      }
      if (steps <= 24) {
        if (steps % 3 === 0) {
          for (let i = 1; i < pts.length - 1; i++) {
            pts[i][0] += Phaser.Math.Between(-1, 1);
          }
          redraw();
        }
      } else {
        const fade = Math.max(0, (28 - steps) / 4);
        g.setAlpha(fade);
      }
      return steps >= 28;
    },
    destroy: () => {
      flashCover.destroy();
      g.destroy();
    },
  });
}

/** Visible electric field: radius ring plus crackling arcs for 180 steps (3s). */
export function electricField(b: BattleState, x: number, y: number, r: number, totalSteps = 180): void {
  const g = b.scene.add.graphics().setDepth(9);
  let steps = 0;

  b.actors.push({
    pos: () => ({ x, y }),
    update: () => {
      steps++;
      g.clear();
      const pulse = 0.75 + 0.2 * Math.sin(steps / 4);
      // Outer electric radius ring
      g.lineStyle(2, C('b'), pulse).strokeCircle(x, y, r);
      // Inner dashed/fine white ring
      g.lineStyle(1, C('c'), 0.85).strokeCircle(x, y, r - 3);

      // Crackling arcs within the circle
      if (steps % 3 === 0) {
        for (let k = 0; k < 2; k++) {
          const a1 = Math.random() * Math.PI * 2;
          const a2 = a1 + (Math.random() - 0.5) * 1.6;
          const r1 = Math.random() * r * 0.4;
          const r2 = r * (0.6 + Math.random() * 0.35);
          const p1x = x + Math.cos(a1) * r1;
          const p1y = y + Math.sin(a1) * r1;
          const p2x = x + Math.cos(a2) * r2;
          const p2y = y + Math.sin(a2) * r2;
          const midX = (p1x + p2x) / 2 + (Math.random() - 0.5) * 8;
          const midY = (p1y + p2y) / 2 + (Math.random() - 0.5) * 8;
          g.lineStyle(2, C('b'), 0.8);
          g.lineBetween(p1x, p1y, midX, midY);
          g.lineBetween(midX, midY, p2x, p2y);
          g.lineStyle(1, 0xffffff, 1);
          g.lineBetween(p1x, p1y, midX, midY);
          g.lineBetween(midX, midY, p2x, p2y);
        }
      }
      return steps >= totalSteps;
    },
    destroy: () => {
      g.destroy();
    },
  });
}

/** Three thick expanding ground rings, visible ground crack lines, rubble and dust for 40 steps. */
export function quakeRings(b: BattleState, x: number, y: number, rangeX = 90): void {
  const g = b.scene.add.graphics().setDepth(8);
  let steps = 0;

  // Generate ground crack lines left and right
  const cracks: [number, number][][] = [];
  [-1, 1].forEach((dir) => {
    let cx = x;
    let cy = y;
    const segs: [number, number][] = [[cx, cy]];
    const count = 5;
    for (let i = 0; i < count; i++) {
      cx += dir * (12 + Math.random() * 8);
      cy += (Math.random() - 0.5) * 4;
      segs.push([cx, cy]);
    }
    cracks.push(segs);
  });

  b.actors.push({
    pos: () => ({ x, y }),
    update: () => {
      steps++;
      g.clear();
      const progress = Math.min(1, steps / 32);

      // 1. Three thick expanding ground rings (flattened ellipses along ground)
      // Ring 1 (outer): 3px emerald
      const r1x = 18 + progress * (rangeX - 18);
      const r1y = 6 + progress * 14;
      g.lineStyle(3, C('6'), Math.max(0, 1 - progress * 0.4)).strokeEllipse(x, y, r1x * 2, r1y * 2);

      // Ring 2 (mid): 3px lime
      const r2x = 12 + progress * (rangeX * 0.72 - 12);
      const r2y = 4 + progress * 10;
      g.lineStyle(3, C('5'), Math.max(0, 1 - progress * 0.3)).strokeEllipse(x, y, r2x * 2, r2y * 2);

      // Ring 3 (inner): 2px white
      const r3x = 6 + progress * (rangeX * 0.42 - 6);
      const r3y = 2 + progress * 7;
      g.lineStyle(2, 0xffffff, Math.max(0, 1 - progress * 0.2)).strokeEllipse(x, y, r3x * 2, r3y * 2);

      // 2. Visible ground crack lines
      g.lineStyle(2, C('0'), 0.9);
      for (const segs of cracks) {
        g.beginPath();
        g.moveTo(segs[0][0], segs[0][1]);
        for (let i = 1; i < segs.length; i++) g.lineTo(segs[i][0], segs[i][1]);
        g.strokePath();
      }

      // 3. Rubble and dust particles kicking up
      if (steps <= 24 && steps % 4 === 0) {
        burst(b, x + (Math.random() - 0.5) * rangeX * 0.8, y - 2, ['k', 'l', 'm', 'd'], 3);
      }

      if (steps > 32) {
        const fade = Math.max(0, (42 - steps) / 10);
        g.setAlpha(fade);
      }

      return steps >= 42;
    },
    destroy: () => {
      g.destroy();
    },
  });
}

/** 12-16 px ping star at every bounce, held bright for 24+ steps. */
export function pingStar(b: BattleState, x: number, y: number): void {
  const g = b.scene.add.graphics().setDepth(13);
  let steps = 0;

  b.actors.push({
    pos: () => ({ x, y }),
    update: () => {
      steps++;
      g.clear();
      // Outer cyan/yellow aura
      g.lineStyle(1, C('b'), 0.8);
      g.strokeCircle(x, y, 7);

      // 8-pointed star: 4 orthogonal rays (7px) + 4 diagonal rays (4px)
      g.lineStyle(2, 0xffffff, 1);
      g.lineBetween(x - 7, y, x + 7, y);
      g.lineBetween(x, y - 7, x, y + 7);
      g.lineStyle(1, C('4'), 1);
      g.lineBetween(x - 4, y - 4, x + 4, y + 4);
      g.lineBetween(x - 4, y + 4, x + 4, y - 4);
      // Bright white central jewel
      g.fillStyle(0xffffff, 1).fillRect(x - 1, y - 1, 3, 3);

      if (steps > 20) {
        g.setAlpha(Math.max(0, (26 - steps) / 6));
      }
      return steps >= 26;
    },
    destroy: () => {
      g.destroy();
    },
  });
}

/** Blast ring at radius 38 with orange/yellow/white flame frames and smoke for 30 steps. */
export function flameBlast(b: BattleState, x: number, y: number, r = 38, totalSteps = 30): void {
  const g = b.scene.add.graphics().setDepth(11);
  let steps = 0;

  b.actors.push({
    pos: () => ({ x, y }),
    update: () => {
      steps++;
      g.clear();
      const p = Math.min(1, steps / 18);
      const curR = 12 + p * (r - 12);

      // Outer fire ring (3px flame orange)
      g.lineStyle(3, C('3'), Math.max(0.2, 1 - (steps / totalSteps) * 0.5));
      g.strokeCircle(x, y, curR);

      // Mid fire ring (3px yellow)
      g.lineStyle(3, C('4'), 0.9);
      g.strokeCircle(x, y, Math.max(6, curR * 0.7));

      // White hot core
      g.fillStyle(0xffffff, Math.max(0, 1 - steps / 20));
      g.fillCircle(x, y, Math.max(3, curR * 0.35));

      // Smoke specks and sparks drifting upward
      if (steps % 3 === 0 && steps <= 24) {
        burst(b, x + (Math.random() - 0.5) * r * 0.6, y - curR * 0.3, ['3', '4', 't', 'm'], 2);
      }

      if (steps > 24) {
        g.setAlpha(Math.max(0, (totalSteps - steps) / 6));
      }
      return steps >= totalSteps;
    },
    destroy: () => {
      g.destroy();
    },
  });
}

/** 2 px web strand with a white outline held for 26 steps. */
export function webStrand(b: BattleState, x0: number, y0: number, x1: number, y1: number, totalSteps = 26): void {
  const g = b.scene.add.graphics().setDepth(10);
  let steps = 0;

  b.actors.push({
    pos: () => ({ x: (x0 + x1) / 2, y: (y0 + y1) / 2 }),
    update: () => {
      steps++;
      g.clear();
      // Outer 4px white outline
      g.lineStyle(4, 0xffffff, 1);
      g.lineBetween(x0, y0, x1, y1);
      // Inner 2px cyan strand
      g.lineStyle(2, C('b'), 1);
      g.lineBetween(x0, y0, x1, y1);

      if (steps > 20) {
        g.setAlpha(Math.max(0, (totalSteps - steps) / 6));
      }
      return steps >= totalSteps;
    },
    destroy: () => {
      g.destroy();
    },
  });
}

/** 24 px web splat held at peak for 30 steps. */
export function webSplat(b: BattleState, x: number, y: number, totalSteps = 30): void {
  const g = b.scene.add.graphics().setDepth(10);
  let steps = 0;

  b.actors.push({
    pos: () => ({ x, y }),
    update: () => {
      steps++;
      g.clear();
      // 8 radiating web spokes extending 12px (24px diameter)
      g.lineStyle(2, 0xffffff, 0.95);
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.707, 0.707], [-0.707, -0.707], [0.707, -0.707], [-0.707, 0.707]];
      for (const [dx, dy] of dirs) {
        g.lineBetween(x, y, x + dx * 12, y + dy * 12);
      }
      // Concentric web rings
      g.lineStyle(1, C('c'), 0.85);
      g.strokeCircle(x, y, 5);
      g.lineStyle(1, C('l'), 0.75);
      g.strokeCircle(x, y, 9);
      g.lineStyle(1, C('b'), 0.65);
      g.strokeCircle(x, y, 12);

      if (steps > 24) {
        g.setAlpha(Math.max(0, (totalSteps - steps) / 6));
      }
      return steps >= totalSteps;
    },
    destroy: () => {
      g.destroy();
    },
  });
}

/** Cyan muzzle flash at the palm for 12 steps. */
export function muzzleFlash(b: BattleState, x: number, y: number): void {
  const g = b.scene.add.graphics().setDepth(12);
  let steps = 0;

  b.actors.push({
    pos: () => ({ x, y }),
    update: () => {
      steps++;
      g.clear();
      // 12px starburst
      g.fillStyle(C('b'), 0.9).fillCircle(x, y, Math.max(2, 7 - steps * 0.4));
      g.fillStyle(0xffffff, 1).fillCircle(x, y, Math.max(1, 4 - steps * 0.3));
      g.lineStyle(1, C('c'), 1);
      g.lineBetween(x - 9, y, x + 9, y);
      g.lineBetween(x, y - 9, x, y + 9);
      return steps >= 12;
    },
    destroy: () => {
      g.destroy();
    },
  });
}

export function shake(b: BattleState, intensity: number): void {
  b.scene.cameras.main.shake(100, intensity);
}

/** A comic-book word that pops up and fades. Throttled so a pile-up doesn't spam the screen. */
export function popWord(b: BattleState, x: number, y: number, word: string): void {
  const now = b.scene.time.now;
  if (now - b.lastPop < 260) return;
  b.lastPop = now;
  const t = text(b.scene, x, y, word, C('4'), 1, C('q')).setDepth(13).setAngle(Phaser.Math.Between(-8, 8));
  b.scene.tweens.add({ targets: t, y: y - 14, scale: 1.4, alpha: 0, duration: 520, ease: 'Cubic.out', onComplete: () => t.destroy() });
}

/** One solid sky column, preceded by a ground warning and ending in an impact flare. */
export function beam(b: BattleState, seg: () => { x0: number; y0: number; x1: number; y1: number } | null, steps: number, width = 32, chargeSteps = 0): void {
  const g = b.scene.add.graphics().setDepth(14).setData('fx', 'sky-beam').setData('width', width);
  const dim = b.scene.add.rectangle(b.worldW / 2, 135, b.worldW + 200, 400, 0x0b0b1a, 0).setDepth(13);
  let t = 0;
  b.actors.push({
    update: () => {
      t++;
      const s = seg();
      g.clear();
      const active = t - chargeSteps;
      const fade = Math.max(0, Math.min(1, active / 6, (steps - t) / 12));
      dim.setAlpha(0.15 * fade);
      if (!s || t >= steps) {
        return true;
      }
      g.setData('segment', { ...s });
      if (active <= 0) {
        g.setData('phase', 'charge');
        const warning = chargeSteps > 0 ? t / chargeSteps : 1;
        g.lineStyle(2, C('4'), 0.55 + warning * 0.4).strokeEllipse(s.x1, s.y1, width * (1.6 - warning * 0.3), width * 0.45);
        g.fillStyle(C('t'), 0.15 + warning * 0.15).fillEllipse(s.x1, s.y1, width, width * 0.2);
        return false;
      }
      const descent = Math.min(1, active / 6);
      const headX = s.x0 + (s.x1 - s.x0) * descent;
      const headY = s.y0 + (s.y1 - s.y0) * descent;
      g.setData('phase', descent < 1 ? 'descent' : 'active');
      g.setData('head', { x: headX, y: headY });
      g.lineStyle(width + 14, C('4'), 0.2 * fade).lineBetween(s.x0, s.y0, headX, headY);
      g.lineStyle(width, C('t'), 0.95 * fade).lineBetween(s.x0, s.y0, headX, headY);
      g.lineStyle(width * 0.78, C('c'), fade).lineBetween(s.x0, s.y0, headX, headY);
      if (descent === 1) {
        const pulse = 1 + Math.sin(active / 3) * 0.08;
        g.fillStyle(C('4'), 0.45 * fade).fillEllipse(s.x1, s.y1, width * 2.1 * pulse, width * 0.7);
        g.fillStyle(C('c'), fade).fillEllipse(s.x1, s.y1, width * 1.3, width * 0.3);
      }
      return false;
    },
    destroy: () => {
      if (g.active) g.destroy();
      if (dim.active) dim.destroy();
    },
  });
}

/** Large generated art with a hand-drawn fallback so a missing asset never becomes a Phaser placeholder. */
export function legendArt(b: BattleState, key: string, x: number, y: number, width: number, height: number): LegendVisual {
  const scene = b.scene;
  let object: any;
  if (scene.textures.exists(key)) {
    object = scene.add.image(x, y, key).setDisplaySize(width, height).setDepth(30);
  } else {
    const g = scene.add.graphics().setPosition(x, y).setDepth(30);
    drawLegendStandIn(g, key, width, height);
    object = g;
  }

  const visual: LegendVisual = {
    setPosition(px, py) { object.setPosition(px, py); return visual; },
    setScale(sx, sy = sx) { object.setScale(sx, sy); return visual; },
    setAlpha(alpha) { object.setAlpha(alpha); return visual; },
    setRotation(rotation) { object.setRotation(rotation); return visual; },
    setVisible(visible) { object.setVisible(visible); return visual; },
    setDepth(depth) { object.setDepth(depth); return visual; },
    destroy() { if (object.active !== false) object.destroy(); },
  };
  return visual;
}

function drawLegendStandIn(g: Phaser.GameObjects.Graphics, key: string, width: number, height: number): void {
  const x = width / 2;
  const y = height / 2;
  if (key === 'legend_comet') {
    g.lineStyle(Math.max(2, width * 0.06), 0xff6b35, 0.95).lineBetween(-x * 0.9, y * 0.4, x * 0.4, -y * 0.2);
    g.lineStyle(Math.max(1, width * 0.035), 0xffd36e, 1).lineBetween(-x * 0.7, y * 0.6, x * 0.2, -y * 0.1);
    g.fillTriangle(-x * 0.45, y * 0.4, x * 0.2, -y * 0.25, x * 0.42, y * 0.05);
    g.fillStyle(0xffdf9b, 1).fillCircle(x * 0.2, -y * 0.05, Math.min(x, y) * 0.27);
    g.fillStyle(0xff6b35, 1).fillCircle(x * 0.2, -y * 0.05, Math.min(x, y) * 0.18);
    g.fillStyle(0xffffff, 1).fillCircle(x * 0.27, -y * 0.1, Math.min(x, y) * 0.09);
  } else if (key === 'legend_rock_spike') {
    g.fillStyle(0x594536, 1).fillTriangle(0, -y * 0.9, -x * 0.72, y * 0.9, x * 0.72, y * 0.9);
    g.fillStyle(0x987151, 1).fillTriangle(-x * 0.04, -y * 0.72, -x * 0.48, y * 0.62, -x * 0.03, y * 0.45);
    g.lineStyle(Math.max(1, width * 0.035), 0xc4a078, 0.9).lineBetween(x * 0.05, -y * 0.58, x * 0.33, y * 0.48);
  } else if (key === 'legend_shield_dome') {
    g.fillStyle(0x55c9ff, 0.22).fillEllipse(0, y * 0.2, width * 0.9, height * 0.72);
    g.lineStyle(Math.max(2, width * 0.035), 0xa7efff, 0.95).beginPath().arc(0, y * 0.28, x * 0.85, Math.PI, Math.PI * 2).strokePath();
    g.lineStyle(Math.max(1, width * 0.02), 0xffdf72, 0.9).strokeEllipse(0, y * 0.2, width * 0.68, height * 0.48);
    g.lineStyle(Math.max(1, width * 0.015), 0xe9fbff, 0.75).lineBetween(-x * 0.75, y * 0.28, x * 0.75, y * 0.28);
  } else if (key === 'legend_storm_cloud') {
    g.fillStyle(0x252b48, 1).fillEllipse(0, y * 0.15, width * 0.9, height * 0.48);
    g.fillStyle(0x394366, 1).fillCircle(-x * 0.35, 0, Math.min(x, y) * 0.3).fillCircle(0, -y * 0.08, Math.min(x, y) * 0.38).fillCircle(x * 0.34, y * 0.02, Math.min(x, y) * 0.3);
    g.lineStyle(Math.max(1, width * 0.025), 0xb9eaff, 0.9).lineBetween(-x * 0.2, y * 0.35, -x * 0.34, y * 0.78);
    g.lineStyle(Math.max(1, width * 0.02), 0x7ee6ff, 0.9).lineBetween(x * 0.25, y * 0.36, x * 0.12, y * 0.72);
  } else if (key === 'legend_storm_hammer') {
    g.fillStyle(0x8b5a34, 1).fillRoundedRect(-x * 0.11, -y * 0.02, width * 0.22, height * 0.86, Math.min(width, height) * 0.04);
    g.fillStyle(0x34435f, 1).fillRoundedRect(-x * 0.62, -y * 0.6, width * 1.24, height * 0.4, Math.min(width, height) * 0.08);
    g.fillStyle(0x8ee7ff, 0.95).fillRect(-x * 0.52, -y * 0.52, width * 0.18, height * 0.13);
    g.lineStyle(Math.max(2, width * 0.03), 0xf2fcff, 0.9).strokeRoundedRect(-x * 0.62, -y * 0.6, width * 1.24, height * 0.4, Math.min(width, height) * 0.08);
  } else if (key === 'legend_sun_eye') {
    g.lineStyle(Math.max(2, width * 0.035), 0xffdf72, 0.95).strokeEllipse(0, 0, width * 0.9, height * 0.62);
    g.fillStyle(0xffd36e, 0.2).fillCircle(0, 0, Math.min(x, y) * 0.58);
    g.fillStyle(0xffeab0, 1).fillCircle(0, 0, Math.min(x, y) * 0.28);
    g.fillStyle(0xb46f3e, 1).fillCircle(0, 0, Math.min(x, y) * 0.13);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.lineStyle(Math.max(1, width * 0.018), 0xffdc68, 0.9).lineBetween(Math.cos(a) * x * 0.48, Math.sin(a) * y * 0.48, Math.cos(a) * x * 0.75, Math.sin(a) * y * 0.75);
    }
  } else if (key === 'legend_alien_foot') {
    g.fillStyle(0x1b4c44, 1).fillRoundedRect(-x * 0.34, -y * 0.72, width * 0.68, height * 0.72, Math.min(width, height) * 0.2);
    g.fillStyle(0x4de0a4, 1).fillEllipse(0, y * 0.48, width * 0.92, height * 0.32);
    for (let i = 0; i < 4; i++) g.fillStyle(0x7fffc0, 1).fillCircle(-x * 0.56 + i * x * 0.37, y * 0.43, Math.min(x, y) * 0.14);
    g.lineStyle(Math.max(2, width * 0.025), 0x9bffd1, 0.9).strokeEllipse(0, y * 0.48, width * 0.9, height * 0.32);
  } else if (key === 'legend_black_hole') {
    g.fillStyle(0x100c20, 1).fillCircle(0, 0, Math.min(x, y) * 0.48);
    g.lineStyle(Math.max(2, width * 0.035), 0x8e53ac, 0.95).strokeEllipse(0, 0, width * 0.92, height * 0.48);
    g.lineStyle(Math.max(1, width * 0.025), 0x6a8dff, 0.9).beginPath().arc(0, 0, Math.min(x, y) * 0.36, -Math.PI * 0.15, Math.PI * 1.55).strokePath();
    g.lineStyle(Math.max(1, width * 0.02), 0xcf8cff, 0.9).beginPath().arc(0, 0, Math.min(x, y) * 0.25, Math.PI * 0.4, Math.PI * 2.1).strokePath();
    g.fillStyle(0x05040a, 1).fillCircle(0, 0, Math.min(x, y) * 0.18);
  } else {
    g.fillStyle(0xb78cff, 1).fillCircle(0, 0, Math.min(x, y) * 0.38);
    g.lineStyle(Math.max(2, width * 0.03), 0xffffff, 0.9).strokeCircle(0, 0, Math.min(x, y) * 0.48);
  }
}

/** Full-world tint or flash, updated on the battle's fixed step. */
export function legendOverlay(b: BattleState, color: number, alpha: number, steps: number, style: 'dim' | 'flash' | 'vignette' | 'hourglass' = 'dim'): void {
  const g = b.scene.add.graphics().setDepth(style === 'flash' || style === 'hourglass' ? 38 : 10);
  let t = 0;
  b.actors.push({
    update: () => {
      t++;
      g.clear();
      const fadeIn = style === 'flash' ? 1 : Math.min(1, t / Math.min(4, steps));
      const fadeOut = style === 'flash' ? Math.max(0, 1 - t / steps) : Math.min(1, Math.max(0, (steps - t) / Math.min(8, steps)));
      const a = alpha * fadeIn * fadeOut;
      const left = -100;
      const top = -240;
      const width = b.worldW + 200;
      const height = b.groundY + 480;
      g.fillStyle(color, a).fillRect(left, top, width, height);
      if (style === 'vignette') {
        g.fillStyle(0x05030d, a * 0.7).fillRect(left, top, width * 0.16, height).fillRect(left + width * 0.84, top, width * 0.16, height);
        g.fillStyle(0x05030d, a * 0.5).fillRect(left, top, width, height * 0.16).fillRect(left, top + height * 0.84, width, height * 0.16);
      } else if (style === 'hourglass') {
        const cx = b.worldW / 2;
        g.lineStyle(4, 0xc8ff8c, a).lineBetween(left, top, cx, b.groundY / 2).lineBetween(left + width, top, cx, b.groundY / 2)
          .lineBetween(left, top + height, cx, b.groundY / 2).lineBetween(left + width, top + height, cx, b.groundY / 2);
      }
      return t >= steps;
    },
    destroy: () => { if (g.active) g.destroy(); },
  });
}

/** Expanding ring for full-width shockwaves and nova pulses. */
export function legendWave(b: BattleState, x: number, y: number, radiusX: number, radiusY: number, steps: number, color: number, width: number): void {
  const g = b.scene.add.graphics().setDepth(27);
  let t = 0;
  b.actors.push({
    pos: () => ({ x, y }),
    update: () => {
      t++;
      const p = Math.min(1, t / steps);
      const ease = 1 - (1 - p) * (1 - p);
      g.clear();
      g.lineStyle(width, color, Math.max(0, 1 - p * 0.75)).strokeEllipse(x, y, Math.max(1, radiusX * 2 * ease), Math.max(1, radiusY * 2 * ease));
      return t >= steps;
    },
    destroy: () => { if (g.active) g.destroy(); },
  });
}

/** Molten floor glow or a growing stomp shadow. */
export function legendGroundGlow(b: BattleState, x: number, y: number, radiusX: number, radiusY: number, color: number, alpha: number, steps: number): void {
  const g = b.scene.add.graphics().setDepth(12);
  let t = 0;
  b.actors.push({
    pos: () => ({ x, y }),
    update: () => {
      t++;
      const grow = Math.min(1, t / Math.min(8, steps));
      const fade = Math.max(0, 1 - t / steps);
      g.clear();
      g.fillStyle(color, alpha * grow * fade).fillEllipse(x, y, radiusX * 2 * grow, radiusY * 2 * grow);
      return t >= steps;
    },
    destroy: () => { if (g.active) g.destroy(); },
  });
}

/** Rotating rune orbit and a line that draws toward the selected target. */
export function legendRuneLink(b: BattleState, x0: number, y0: number, x1: number, y1: number, radius: number, steps: number, marks: number, width: number): void {
  const g = b.scene.add.graphics().setDepth(29);
  let t = 0;
  b.actors.push({
    pos: () => ({ x: x0, y: y0 }),
    update: () => {
      t++;
      const progress = Math.min(1, t / steps);
      g.clear();
      g.lineStyle(width, 0xffd66e, 1 - progress * 0.65).strokeCircle(x0, y0, radius).strokeCircle(x0, y0, radius * 0.72);
      for (let i = 0; i < marks; i++) {
        const a = t * 0.12 + i * Math.PI * 2 / marks;
        const inner = radius * 0.78;
        const outer = radius * (i % 2 ? 0.96 : 1.12);
        g.lineStyle(width, 0xffedaa, 1 - progress * 0.55).lineBetween(x0 + Math.cos(a) * inner, y0 + Math.sin(a) * inner, x0 + Math.cos(a) * outer, y0 + Math.sin(a) * outer);
      }
      const lineProgress = Math.min(1, progress * 2);
      g.lineStyle(width, 0xffd66e, 0.9 * (1 - progress * 0.5)).lineBetween(x0, y0, x0 + (x1 - x0) * lineProgress, y0 + (y1 - y0) * lineProgress);
      return t >= steps;
    },
    destroy: () => { if (g.active) g.destroy(); },
  });
}

/** Fast triangular fragments used for glass-like legendary bursts. */
export function legendShards(b: BattleState, x: number, y: number, count: number, spread: number, steps: number, color: number): void {
  const g = b.scene.add.graphics().setDepth(31);
  const angles = Array.from({ length: count }, (_v, i) => i * Math.PI * 2 / count);
  let t = 0;
  b.actors.push({
    pos: () => ({ x, y }),
    update: () => {
      t++;
      const p = Math.min(1, t / steps);
      g.clear();
      angles.forEach((angle, i) => {
        const a = angle + (i % 2 ? 0.2 : -0.2);
        const d = spread * p;
        const sx = x + Math.cos(a) * d;
        const sy = y + Math.sin(a) * d - p * p * spread * 0.18;
        const size = Math.max(2, spread * (0.035 + (i % 3) * 0.008)) * (1 - p * 0.25);
        g.fillStyle(i % 2 ? 0xffffff : color, 1 - p * 0.8).fillTriangle(sx, sy - size, sx - size * 0.65, sy + size, sx + size * 0.65, sy + size);
      });
      return t >= steps;
    },
    destroy: () => { if (g.active) g.destroy(); },
  });
}

/** Rays converge on an eye and sweep outward across the battlefield. */
export function legendRays(b: BattleState, x: number, y: number, count: number, length: number, steps: number, color: number, rotation = 0, convergeSteps = 0): void {
  const g = b.scene.add.graphics().setDepth(28);
  let t = 0;
  b.actors.push({
    pos: () => ({ x, y }),
    update: () => {
      t++;
      const converging = t <= convergeSteps;
      const convergeProgress = convergeSteps > 0 ? Math.min(1, t / convergeSteps) : 1;
      const sweepProgress = Math.max(0, (t - convergeSteps) / Math.max(1, steps - convergeSteps));
      const sweep = rotation + sweepProgress * Math.PI * 0.7;
      g.clear();
      for (let i = 0; i < count; i++) {
        const a = sweep + i * Math.PI * 2 / count;
        const p = converging ? convergeProgress : sweepProgress;
        const inner = converging ? length * (1 - p) * 0.45 : length * (0.08 + p * 0.04);
        const outer = converging ? length * (1 - p) : length * (0.45 + 0.55 * Math.abs(Math.sin(i * 1.7 + p * 4)));
        const alpha = converging ? 1 : 1 - p * 0.65;
        g.lineStyle(i % 3 === 0 ? 2 : 1, color, alpha * (i % 2 ? 0.8 : 1));
        g.lineBetween(x + Math.cos(a) * outer, y + Math.sin(a) * outer, x + Math.cos(a) * inner, y + Math.sin(a) * inner);
      }
      return t >= steps;
    },
    destroy: () => { if (g.active) g.destroy(); },
  });
}

/** Radial streaks spiral inward without touching bodies or changing their velocities. */
export function legendSpiral(b: BattleState, x: number, y: number, radius: number, count: number, steps: number, color: number): void {
  const g = b.scene.add.graphics().setDepth(26);
  const angles = Array.from({ length: count }, (_v, i) => i * Math.PI * 2 / count);
  let t = 0;
  b.actors.push({
    pos: () => ({ x, y }),
    update: () => {
      t++;
      const p = Math.min(1, t / steps);
      g.clear();
      angles.forEach((base, i) => {
        const a = base + p * Math.PI * 2.5;
        const r0 = radius * (0.35 + (i % 4) * 0.2) * (1 - p * 0.72);
        const r1 = Math.max(1, r0 - radius * 0.12);
        g.lineStyle(i % 3 === 0 ? 2 : 1, color, 1 - p * 0.75);
        g.lineBetween(x + Math.cos(a - 0.18) * r1, y + Math.sin(a - 0.18) * r1, x + Math.cos(a) * r0, y + Math.sin(a) * r0);
      });
      return t >= steps;
    },
    destroy: () => { if (g.active) g.destroy(); },
  });
}

/** Stretch nearby sprites toward a singularity while leaving every Matter body untouched. */
export function legendStretch(b: BattleState, x: number, y: number, radius: number, strength: number, steps: number): void {
  const affected = b.ents.filter((e) => !e.dead && e.kind !== 'chest' && Math.hypot(e.body.position.x - x, e.body.position.y - y) <= radius).map((e) => ({
    ent: e,
    visualX: e.visualScaleX ?? 1,
    visualY: e.visualScaleY ?? 1,
    spriteX: e.sprite.scaleX,
    spriteY: e.sprite.scaleY,
  }));
  let t = 0;
  const restore = (): void => {
    for (const item of affected) {
      item.ent.visualScaleX = item.visualX;
      item.ent.visualScaleY = item.visualY;
      if (item.ent.kind === 'block' && item.ent.sprite.active) item.ent.sprite.setScale(item.spriteX, item.spriteY);
    }
  };
  b.actors.push({
    pos: () => ({ x, y }),
    update: () => {
      t++;
      const pulse = Math.sin(Math.PI * Math.min(1, t / steps));
      for (const item of affected) {
        const e = item.ent;
        if (e.dead) continue;
        const influence = Math.max(0, 1 - Math.hypot(e.body.position.x - x, e.body.position.y - y) / radius) * pulse;
        const sx = 1 + strength * influence;
        const sy = Math.max(0.35, 1 - strength * influence * 0.35);
        if (e.kind === 'block') {
          if (e.sprite.active) e.sprite.setScale(item.spriteX * sx, item.spriteY * sy);
        } else {
          e.visualScaleX = item.visualX * sx;
          e.visualScaleY = item.visualY * sy;
        }
      }
      return t >= steps;
    },
    destroy: restore,
  });
}
