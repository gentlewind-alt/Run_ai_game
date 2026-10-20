import Phaser from 'phaser';
import type GameScene from './scenes/GameScene';
import { sfx } from './audio';
import { C } from './palette';

const MatterLib: any = (Phaser.Physics.Matter as any).Matter;

/** A projectile in flight. `t` is a general-purpose tap-move timer (steps left). */
export interface Proj {
  body: any;
  sprite: Phaser.GameObjects.Image;
  steps: number;
  slow: number;
  tapped: boolean;
  t: number;
}

/** One entry per weapon id in content.json. Stats (damage, element) come from the data; this holds the feel and the tap move. */
export interface WeaponImpl {
  texture: string;
  radius: number;
  density: number;
  spin: number;
  onTap(s: GameScene, p: Proj): void;
  onUpdate(s: GameScene, p: Proj): void;
  drawFx(s: GameScene, p: Proj, g: Phaser.GameObjects.Graphics): void;
}

export const WEAPONS: Record<string, WeaponImpl> = {
  w_militia_blade: {
    texture: 'blade',
    radius: 4,
    density: 0.03,
    spin: 0.28,
    // Spin-saw: ignores gravity, keeps moving, and hits everything it touches for ~0.6 s.
    onTap(s, p) {
      p.t = s.tune.sawSteps;
      p.body.gravityScale = { x: 0, y: 0 };
      MatterLib.Body.setAngularVelocity(p.body, 0.7);
      sfx.saw();
    },
    onUpdate(s, p) {
      if (p.t <= 0) return;
      p.t--;
      const b = p.body;
      const sp = Math.hypot(b.velocity.x, b.velocity.y);
      if (sp < 5.5 && sp > 0.01) MatterLib.Body.setVelocity(b, { x: (b.velocity.x / sp) * 5.5, y: (b.velocity.y / sp) * 5.5 });
      if (p.t % 6 === 0) s.damageAround(b.position.x, b.position.y, 11, 0.22);
      if (p.t === 0) b.gravityScale = { x: 1, y: 1 };
    },
    drawFx(_s, p, g) {
      if (p.t <= 0) return;
      const b = p.body.position;
      g.lineStyle(1, C('c'), 1);
      g.strokeCircle(b.x, b.y, 10);
      g.lineStyle(1, C('4'), 1);
      g.strokeCircle(b.x, b.y, 7);
    },
  },
};
