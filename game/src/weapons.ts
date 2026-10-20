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

/**
 * One entry per weapon id in content.json. Stats (damage, element) come from the data; this holds the feel and the ability.
 * `ability` says how it fires: 'button' (on-screen button while in flight), 'impact' (automatically on the first hit,
 * ground included, once) or 'both' (button, or the first hit if the player never pressed it).
 */
export interface WeaponImpl {
  texture: string;
  radius: number;
  density: number;
  spin: number;
  ability: 'button' | 'impact' | 'both';
  abilityLabel: string;
  onAbility(s: GameScene, p: Proj): void;
  onImpact?(s: GameScene, p: Proj): void;
  onUpdate(s: GameScene, p: Proj): void;
  drawFx(s: GameScene, p: Proj, g: Phaser.GameObjects.Graphics): void;
}

export const WEAPONS: Record<string, WeaponImpl> = {
  w_militia_blade: {
    texture: 'blade',
    radius: 4,
    density: 0.03,
    spin: 0.28,
    ability: 'button',
    abilityLabel: 'SAW',
    // Spin-saw: ignores gravity, keeps moving, and hits everything it touches for ~0.6 s.
    onAbility(s, p) {
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
