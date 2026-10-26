// Visual effects: particles, rings, floating words, lightning, shockwaves.
import Phaser from 'phaser';
import { C } from '../art/palette';
import { text } from '../art/font5x7';
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
