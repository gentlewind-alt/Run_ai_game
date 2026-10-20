import Phaser from 'phaser';
import type GameScene from './scenes/GameScene';
import { sfx } from './audio';
import { C } from './palette';
import { weaponTexture } from './art';

const MatterLib: any = (Phaser.Physics.Matter as any).Matter;

/** The shot in the air. `data` is scratch space for the weapon's own state. */
export interface Proj {
  body: any;
  sprite: Phaser.GameObjects.Image;
  wid: string;
  steps: number;
  slow: number;
  tapped: boolean;
  t: number;
  data: Record<string, any>;
}

/** Anything that lives for a while and updates each physics step (bolts, arrows, pellets). */
export interface Actor {
  update(): boolean; // return true when finished
  destroy(): void;
}

/**
 * One entry per weapon id in content.json. Damage and element come from the data; this holds the feel and the ability.
 * `ability`: 'button' (on-screen button while in flight), 'impact' (automatically on the first hit, ground included, once),
 * 'both' (button, or the first hit if the player never pressed it).
 */
export interface WeaponImpl {
  texture: string;
  radius: number;
  density: number;
  spin: number;
  gravity: number; // 1 = normal; <1 floaty; >1 drops fast; 0 = none
  align?: boolean; // rotate to face the direction of travel
  ability: 'button' | 'impact' | 'both';
  abilityLabel: string;
  onAbility(s: GameScene, p: Proj): void;
  onImpact?(s: GameScene, p: Proj): void;
  /** Called once on the first contact after the ability fired (for example the cleaver's shockwave). */
  onPostImpact?(s: GameScene, p: Proj): void;
  onUpdate?(s: GameScene, p: Proj): void;
  drawFx?(s: GameScene, p: Proj, g: Phaser.GameObjects.Graphics): void;
}

let boltsFired = 0; // "every 5th bolt you ever fire splits in two"

export const WEAPONS: Record<string, WeaponImpl> = {
  w_militia_blade: {
    texture: weaponTexture('w_militia_blade'),
    radius: 4, density: 0.03, spin: 0.28, gravity: 1,
    ability: 'button', abilityLabel: 'Saw',
    // Spin-saw: floats and hits everything it touches for 0.6 s.
    onAbility(s, p) {
      p.t = s.tune.sawSteps;
      s.setGravity(p.body, 0);
      MatterLib.Body.setAngularVelocity(p.body, 0.7);
      sfx.saw();
    },
    onUpdate(s, p) {
      if (p.t <= 0) return;
      p.t--;
      const b = p.body;
      const sp = Math.hypot(b.velocity.x, b.velocity.y);
      if (sp < 5.5 && sp > 0.01) MatterLib.Body.setVelocity(b, { x: (b.velocity.x / sp) * 5.5, y: (b.velocity.y / sp) * 5.5 });
      if (p.t % 6 === 0) s.damageAround(b.position.x, b.position.y, 11, 0.22, p.wid);
      if (p.t === 0) s.setGravity(b, 1);
    },
    drawFx(_s, p, g) {
      if (p.t <= 0) return;
      const b = p.body.position;
      g.lineStyle(1, C('c'), 1).strokeCircle(b.x, b.y, 10);
      g.lineStyle(1, C('4'), 1).strokeCircle(b.x, b.y, 7);
    },
  },

  w_iron_cleaver: {
    texture: weaponTexture('w_iron_cleaver'),
    radius: 5, density: 0.05, spin: 0.12, gravity: 1.35,
    ability: 'button', abilityLabel: 'Slam',
    // Dive-slam straight down; the first thing it hits sends out a shockwave.
    onAbility(_s, p) {
      MatterLib.Body.setVelocity(p.body, { x: 0, y: 9 });
      MatterLib.Body.setAngularVelocity(p.body, 0);
      MatterLib.Body.setAngle(p.body, Math.PI);
      p.data.slam = true;
      sfx.saw();
    },
    onPostImpact(s, p) {
      const b = p.body.position;
      s.ring(b.x, b.y, 30, C('c'));
      s.damageAround(b.x, b.y, 24, 0.8, p.wid);
      s.push(b.x, b.y, 38, 2.4);
      s.sparks(b.x, b.y, ['k', 'l', 'c'], 12);
      s.shake(0.01);
      sfx.crunch();
    },
    onUpdate(_s, p) {
      if (p.data.slam) {
        const v = p.body.velocity;
        if (v.y < 7 && !p.data.landed) MatterLib.Body.setVelocity(p.body, { x: v.x * 0.9, y: 9 });
      }
    },
  },

  w_ashwood_staff: {
    texture: weaponTexture('w_ashwood_staff'),
    radius: 4, density: 0.008, spin: 0.1, gravity: 0.55,
    ability: 'button', abilityLabel: 'Bolt',
    // Homing bolt at the nearest monster; every 5th bolt you ever fire splits in two.
    onAbility(s, p) {
      boltsFired++;
      const targets = s.nearestMonsters(p.body.position.x, p.body.position.y, boltsFired % 5 === 0 ? 2 : 1);
      if (targets.length === 0) return;
      for (const t of targets) s.addActor(makeBolt(s, p, t));
      sfx.launch();
    },
  },

  w_scrapheap_scattergun: {
    texture: weaponTexture('w_scrapheap_scattergun'),
    radius: 4, density: 0.02, spin: 0.2, gravity: 1,
    ability: 'button', abilityLabel: 'Blast',
    // Bursts into 5 pellets in a cone; each pellet rolls burn, slow or knockback.
    onAbility(s, p) {
      const b = p.body;
      const v = b.velocity;
      const sp = Math.max(4, Math.hypot(v.x, v.y));
      const base = Math.atan2(v.y, v.x);
      const kinds = ['burn', 'slow', 'knock'];
      for (let i = 0; i < 5; i++) {
        const a = base + (i - 2) * 0.16;
        s.launchExtra({
          x: b.position.x, y: b.position.y, vx: Math.cos(a) * sp * 1.15, vy: Math.sin(a) * sp * 1.15,
          radius: 2, density: 0.01, mul: 0.35, wid: p.wid, color: 'c', status: kinds[Phaser.Math.Between(0, 2)],
        });
      }
      s.ring(b.x ?? b.position.x, b.y ?? b.position.y, 14, C('4'));
      s.sparks(b.position.x, b.position.y, ['4', '3', 'c'], 10);
      sfx.crunch();
      s.endProj(p, true);
    },
  },

  w_hunters_pike: {
    texture: weaponTexture('w_hunters_pike'),
    radius: 3, density: 0.02, spin: 0, gravity: 0.8, align: true,
    ability: 'button', abilityLabel: 'Pierce',
    // Speeds up and pierces up to 3 wood blocks or monsters.
    onAbility(s, p) {
      const v = p.body.velocity;
      MatterLib.Body.setVelocity(p.body, { x: v.x * 1.6, y: v.y * 1.6 });
      p.body.isSensor = true;
      p.body.proj.pierce = 3;
      p.body.proj.hit = new Set<number>();
      sfx.saw();
      s.sparks(p.body.position.x, p.body.position.y, ['c', 'd'], 8);
    },
  },

  w_hunters_boomerang: {
    texture: weaponTexture('w_hunters_boomerang'),
    radius: 4, density: 0.02, spin: 0.5, gravity: 0.5,
    ability: 'button', abilityLabel: 'Recall',
    // Flies out, then curves back on its own; the return pass deals double damage.
    onAbility(_s, p) {
      p.data.returning = true;
    },
    onUpdate(s, p) {
      if (p.steps > 36) p.data.returning = true;
      if (!p.data.returning) return;
      p.body.proj.mul = 2;
      s.setGravity(p.body, 0);
      const b = p.body;
      const dx = s.slingX - b.position.x;
      const dy = s.slingY - b.position.y;
      const d = Math.hypot(dx, dy);
      if (d < 10) {
        s.endProj(p, true);
        return;
      }
      const want = 6;
      MatterLib.Body.setVelocity(b, {
        x: b.velocity.x + ((dx / d) * want - b.velocity.x) * 0.08,
        y: b.velocity.y + ((dy / d) * want - b.velocity.y) * 0.08,
      });
    },
    drawFx(_s, p, g) {
      if (!p.data.returning) return;
      const b = p.body.position;
      g.lineStyle(1, C('4'), 1).strokeCircle(b.x, b.y, 9);
    },
  },

  w_blast_tube: {
    texture: weaponTexture('w_blast_tube'),
    radius: 5, density: 0.04, spin: 0.05, gravity: 1,
    ability: 'both', abilityLabel: 'Boom',
    // Detonate in the air for a wide blast that falls off with distance; also goes off on the first hit.
    onAbility(s, p) {
      const b = p.body.position;
      s.blast(b.x, b.y, 36, 1, p.wid);
      s.endProj(p, true);
    },
    onImpact(s, p) {
      const b = p.body.position;
      s.blast(b.x, b.y, 36, 1, p.wid);
      s.endProj(p, true);
    },
  },

  w_horned_scepter: {
    texture: weaponTexture('w_horned_scepter'),
    radius: 4, density: 0.006, spin: 0.2, gravity: 0.6,
    ability: 'button', abilityLabel: 'Curse',
    // Curse burst: monsters in a small radius take +15% damage from everything for 4 s.
    onAbility(s, p) {
      const b = p.body.position;
      s.ring(b.x, b.y, 34, C('r'));
      s.sparks(b.x, b.y, ['r', '1', 'u'], 14);
      for (const e of s.monstersNear(b.x, b.y, 34)) s.inflictStatus(e, 'curse', 240);
      sfx.saw();
    },
    onUpdate(s, p) {
      if (p.steps % 3 === 0) s.sparks(p.body.position.x, p.body.position.y, ['3', '4', '2'], 1);
    },
  },
};

function makeBolt(s: GameScene, p: Proj, target: any): Actor {
  const start = p.body.position;
  const sprite = s.add.circle(start.x, start.y, 2, C('b')).setStrokeStyle(1, C('c')).setDepth(6);
  let x = start.x;
  let y = start.y;
  let vx = 0;
  let vy = -2;
  let steps = 0;
  return {
    update() {
      steps++;
      let tgt = target;
      if (tgt.dead) tgt = s.nearestMonsters(x, y, 1)[0];
      if (!tgt || steps > 240) return true;
      const tx = tgt.body.position.x;
      const ty = tgt.body.position.y;
      const d = Math.hypot(tx - x, ty - y);
      if (d < 8) {
        s.directHit(tgt, p.wid, 1.4, x, y);
        s.ring(x, y, 12, C('b'));
        return true;
      }
      vx += ((tx - x) / d * 5.5 - vx) * 0.18;
      vy += ((ty - y) / d * 5.5 - vy) * 0.18;
      x += vx;
      y += vy;
      sprite.setPosition(x, y);
      if (steps % 2 === 0) s.sparks(x, y, ['b', 'c'], 1);
      return false;
    },
    destroy() {
      sprite.destroy();
    },
  };
}
