// Visual effects: particles, rings, floating words. Cosmetic randomness uses Math.random on purpose.
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

/** A white lightning bolt zig-zagging down from above onto (x, y), then fading. */
export function bolt(b: BattleState, x: number, y: number): void {
  const g = b.scene.add.graphics().setDepth(14);
  g.lineStyle(3, C('0'), 1);
  const pts: [number, number][] = [];
  const top = y - 150;
  for (let i = 0; i <= 7; i++) pts.push([x + (i === 7 ? 0 : Phaser.Math.Between(-10, 10)), top + ((y - top) * i) / 7]);
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (const [px, py] of pts) g.lineTo(px, py);
  g.strokePath();
  g.lineStyle(1, C('4'), 1);
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (const [px, py] of pts) g.lineTo(px, py);
  g.strokePath();
  b.scene.cameras.main.flash(80, 255, 255, 200);
  b.scene.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() });
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
