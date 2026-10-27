// Code-drawn launch, flight, impact and ability animation for every weapon, styled by its `anim` row in content.json
// (flight style, trail, ability style and colours). Timings and sizes live in config.json display.weaponAnim. Visual
// only: nothing here touches bodies, so it never changes how a shot plays.
import Phaser from 'phaser';
import { C } from '../art/palette';
import type { Proj } from './BattleCtx';
import { ring } from './fx';
import type { BattleState } from './state';

interface AnimState { base: number; flashUntil: number; abilityAt: number; hitAt: number; lastTrail: number; aim: number | null; rot: number; flipAt: number; lastVy: number }

const cfg = (b: BattleState) => b.settings.display.weaponAnim;
const ART_TILT = Math.PI / 4; // generated weapon art points up-right; aimed weapons turn that corner toward the target

function state(p: Proj): AnimState {
  return (p.data.anim ??= { base: p.sprite.scaleX, flashUntil: -1, abilityAt: -1e9, hitAt: -1e9, lastTrail: -1, aim: null, rot: p.sprite.rotation, flipAt: -1e9, lastVy: p.body.velocity.y });
}

function spark(b: BattleState, x: number, y: number, color: string, vx: number, vy: number, life: number): void {
  if (b.parts.length >= b.settings.display.maxParticles) return;
  const s = b.scene.add.image(x, y, 'px').setTint(C(color)).setScale(1).setDepth(3);
  b.parts.push({ s, vx, vy, life });
}

/** Angle from (x, y) to the nearest living monster, or null when none is left. */
function aimAngle(b: BattleState, x: number, y: number): number | null {
  let best: { x: number; y: number } | null = null;
  let bd = Infinity;
  for (const e of b.ents) {
    if (e.dead || e.kind !== 'monster') continue;
    const d = Math.hypot(e.body.position.x - x, e.body.position.y - y);
    if (d < bd) { bd = d; best = e.body.position; }
  }
  return best ? Math.atan2(best.y - y, best.x - x) : null;
}

/** Launch: a puff from the pouch in the weapon's colours (the pop itself runs in animateProj). */
export function launchAnim(b: BattleState, p: Proj): void {
  const a = p.def.anim;
  if (!a) return;
  state(p);
  const { x, y } = p.body.position;
  const v = p.body.velocity;
  for (let i = 0; i < cfg(b).launchSparks; i++) {
    const ang = Math.atan2(v.y, v.x) + Math.PI + (Math.random() - 0.5) * 1.6;
    const sp = 0.6 + Math.random() * 1.4;
    spark(b, x, y, a.colors[i % a.colors.length], Math.cos(ang) * sp, Math.sin(ang) * sp - 0.4, 14 + Math.random() * 8);
  }
}

/** A short-lived graphics drawing redrawn each frame by `draw(t)` with t going 0 -> 1. */
function sweep(b: BattleState, ms: number, draw: (g: Phaser.GameObjects.Graphics, t: number) => void): void {
  const g = b.scene.add.graphics().setDepth(12);
  b.scene.tweens.addCounter({ from: 0, to: 1, duration: ms, onUpdate: (tw) => { g.clear(); draw(g, tw.getValue() ?? 1); }, onComplete: () => g.destroy() });
}

/**
 * Ability: the weapon flashes white and punches up in size with a ring in its colours, plus its own move:
 * slash (a crescent swipe), charge (sparks rush in), slam (a streak down and a dust kick), recoil (muzzle blast and kick back)
 * or burst (sparks fly out). Call before the ability runs; call the returned function after it, which leaves a recoiling
 * copy of the weapon behind if the ability ended the shot.
 */
export function abilityAnim(b: BattleState, p: Proj): () => void {
  const a = p.def.anim;
  if (!a) return () => {};
  const s = state(p);
  const k = cfg(b);
  s.abilityAt = p.steps;
  s.flashUntil = p.steps + k.flashSteps;
  const { x, y } = p.body.position;
  const c0 = C(a.colors[0]);
  const c1 = C(a.colors[a.colors.length - 1]);
  const v = p.body.velocity;
  const dir = s.aim ?? aimAngle(b, x, y) ?? Math.atan2(v.y, v.x);
  ring(b, x, y, k.abilityRing, c0);
  const look = { key: p.sprite.texture.key, rot: p.sprite.rotation, scale: p.sprite.scaleX };
  switch (a.ability) {
    case 'slash': {
      const from = Math.atan2(v.y, v.x) - Math.PI * 0.9;
      sweep(b, k.slashMs, (g, t) => {
        const end = from + Math.PI * 1.8 * Phaser.Math.Easing.Cubic.Out(t);
        g.lineStyle(3, 0xffffff, 1 - t).beginPath().arc(x, y, k.abilityRing * 0.8, from + (end - from) * 0.45, end).strokePath();
        g.lineStyle(1, c0, 1 - t).beginPath().arc(x, y, k.abilityRing * 0.8 + 3, from, end).strokePath();
      });
      break;
    }
    case 'charge':
      for (let i = 0; i < k.abilitySparks; i++) {
        const ang = (i / k.abilitySparks) * Math.PI * 2;
        const r = k.abilityRing * 1.4;
        spark(b, x + Math.cos(ang) * r, y + Math.sin(ang) * r, a.colors[i % a.colors.length], -Math.cos(ang) * r / 12, -Math.sin(ang) * r / 12, 12);
      }
      sweep(b, k.slashMs, (g, t) => { g.fillStyle(c1, 0.5 * (1 - t)).fillCircle(x, y, k.abilityRing * (0.3 + t)); });
      break;
    case 'slam':
      sweep(b, k.slashMs, (g, t) => {
        g.fillStyle(c0, 0.8 * (1 - t)).fillRect(x - 2, y - k.abilityRing * 2 * (1 - t), 4, k.abilityRing * 2 * (1 - t));
        g.lineStyle(2, c1, 1 - t).strokeEllipse(x, y + 6, k.abilityRing * 2.4 * t, k.abilityRing * 0.6 * t);
      });
      for (let i = 0; i < k.abilitySparks; i++) spark(b, x, y + 4, i % 2 ? 'i' : a.colors[0], (i - k.abilitySparks / 2) * 0.35, -1 - Math.random(), 14);
      break;
    case 'recoil': {
      const mx = x + Math.cos(dir) * 9;
      const my = y + Math.sin(dir) * 9;
      sweep(b, k.slashMs * 0.6, (g, t) => {
        g.fillStyle(C('4'), 1 - t).fillCircle(mx, my, 6 * (1 - t) + 2);
        g.fillStyle(0xffffff, 1 - t).fillCircle(mx, my, 3 * (1 - t) + 1);
        g.lineStyle(2, C('3'), 1 - t).lineBetween(mx, my, mx + Math.cos(dir) * 14 * t + Math.cos(dir) * 4, my + Math.sin(dir) * 14 * t + Math.sin(dir) * 4);
      });
      for (let i = 0; i < k.abilitySparks; i++) {
        const ang = dir + (Math.random() - 0.5) * 0.9;
        spark(b, mx, my, a.colors[i % a.colors.length], Math.cos(ang) * 2.2, Math.sin(ang) * 2.2, 12);
      }
      break;
    }
    default:
      for (let i = 0; i < k.abilitySparks; i++) {
        const ang = (i / k.abilitySparks) * Math.PI * 2;
        spark(b, x, y, a.colors[i % a.colors.length], Math.cos(ang) * 1.8, Math.sin(ang) * 1.8 - 0.6, 16 + Math.random() * 6);
      }
  }
  return () => {
    if (!p.data.ended) return;
    // the shot is gone (a gun that fired, a bomb that burst): a copy kicks back away from the aim and fades
    const kick = a.ability === 'recoil' ? k.kick : k.kick * 0.3;
    const ghost = b.scene.add.image(x, y, look.key).setRotation(look.rot).setScale(look.scale * (1 + k.abilityPunch * 0.5)).setDepth(5).setTintFill(0xffffff);
    b.scene.time.delayedCall(60, () => ghost.clearTint());
    b.scene.tweens.add({ targets: ghost, x: x - Math.cos(dir) * kick, y: y - Math.sin(dir) * kick, rotation: look.rot - Math.sign(Math.cos(dir) || 1) * 0.5, duration: k.ghostMs * 1.5, ease: 'Quad.Out' });
    b.scene.tweens.add({ targets: ghost, alpha: 0, scale: look.scale, delay: k.ghostMs, duration: k.ghostMs * 1.5, onComplete: () => ghost.destroy() });
  };
}

/** Contact: the weapon squashes for a moment (only for real knocks, at most once per few steps). */
export function impactAnim(b: BattleState, p: Proj, rel: number): void {
  if (!p.def.anim || rel < cfg(b).impactMinSpeed) return;
  const s = state(p);
  if (p.steps - s.hitAt < cfg(b).impactSteps) return;
  s.hitAt = p.steps;
}

/**
 * Flight moves on top of the physics: flip (lazy spin, then a fast double flip at the top of the arc), frisbee (spins and
 * tips like a thrown disc), corkscrew (nose first, rolling round its own axis, faster after the ability), twirl (a baton
 * twirl that speeds up and slows down), windmill (spins as fast as it flies, so it hangs at the top of the arc).
 * Returns the y scale factor for the moves that fake a 3D roll.
 */
function flightMove(b: BattleState, p: Proj, s: AnimState, flight: string): number {
  const k = cfg(b);
  const t = p.steps;
  const v = p.body.velocity;
  if (flight === 'flip') {
    if (s.lastVy < 0 && v.y >= 0) s.flipAt = t; // the top of the arc
    const f = Phaser.Math.Clamp((t - s.flipAt) / k.flipSteps, 0, 1);
    s.rot += k.flipLazy;
    p.sprite.setRotation(s.rot + Math.PI * 2 * k.flipTurns * Phaser.Math.Easing.Cubic.InOut(f));
  } else if (flight === 'frisbee') {
    p.sprite.setRotation(p.body.angle);
    return Math.max(0.3, Math.abs(Math.cos(t * k.frisbeeSpeed)));
  } else if (flight === 'corkscrew') {
    if (Math.hypot(v.x, v.y) > 0.3) p.sprite.setRotation(Math.atan2(v.y, v.x) + ART_TILT);
    const fast = s.abilityAt >= 0 && t >= s.abilityAt ? 3 : 1;
    return 0.55 + 0.45 * Math.abs(Math.cos(t * k.corkSpeed * fast));
  } else if (flight === 'twirl') {
    s.rot += k.twirlSpeed * (1 + 0.7 * Math.sin(t * 0.12));
    p.sprite.setRotation(s.rot);
  } else if (flight === 'windmill') {
    s.rot += Math.hypot(v.x, v.y) * k.windmill * Math.sign(v.x || 1);
    p.sprite.setRotation(s.rot);
  }
  s.lastVy = v.y;
  return 1;
}

/** Every frame while the shot flies: flight style, launch pop, impact squash, ability punch and the trail. */
export function animateProj(b: BattleState, p: Proj): void {
  const a = p.def.anim;
  if (!a) return;
  const s = state(p);
  const k = cfg(b);
  const t = p.steps;
  const { x, y } = p.body.position;
  if (a.flight === 'tumble') p.sprite.setRotation(p.body.angle * k.tumble);
  else if (a.flight === 'rock') p.sprite.setRotation(Math.sin(t * k.rockSpeed) * k.rock);
  else if (a.flight === 'aim') {
    const want = aimAngle(b, x, y);
    if (want !== null) s.aim = s.aim === null ? want : Phaser.Math.Angle.RotateTo(s.aim, want, k.aimTurn);
    p.sprite.setRotation((s.aim ?? Math.atan2(p.body.velocity.y, p.body.velocity.x)) + ART_TILT);
  }
  let sx = 1;
  let sy = flightMove(b, p, s, a.flight);
  if (t < k.launchSteps) { const f = k.launchPop * (1 - t / k.launchSteps); sx += f; sy += f; }
  const since = t - s.abilityAt;
  if (since >= 0 && since < k.abilitySteps) { const f = k.abilityPunch * (1 - since / k.abilitySteps); sx += f; sy += f; }
  const hit = t - s.hitAt;
  if (hit >= 0 && hit < k.impactSteps) { const f = k.impactSquash * Math.sin((hit / k.impactSteps) * Math.PI); sx += f; sy -= f; }
  if (a.flight === 'pulse') { const f = Math.sin(t * k.pulseSpeed) * k.pulse; sx += f; sy += f; }
  p.sprite.setScale(s.base * sx, s.base * sy);
  if (t < s.flashUntil) p.sprite.setTintFill(0xffffff);
  else if (s.flashUntil >= 0) { p.sprite.clearTint(); s.flashUntil = -1; }

  if (a.trail === 'none' || !p.sprite.visible || t === s.lastTrail || t % k.trailEvery !== 0) return;
  s.lastTrail = t;
  const color = a.colors[(t / k.trailEvery) % a.colors.length | 0];
  if (a.trail === 'sparks') {
    spark(b, x + (Math.random() - 0.5) * 4, y + (Math.random() - 0.5) * 4, color, (Math.random() - 0.5) * 0.4, -0.2 - Math.random() * 0.3, 10 + Math.random() * 6);
    return;
  }
  // ghost: a fading silhouette of the weapon left behind, filled with its colour
  const g = b.scene.add.image(x, y, p.sprite.texture.key).setRotation(p.sprite.rotation).setScale(p.sprite.scaleX, p.sprite.scaleY)
    .setTintFill(C(color)).setAlpha(k.ghostAlpha).setDepth(3);
  b.scene.tweens.add({ targets: g, alpha: 0, scale: p.sprite.scaleX * 0.8, duration: k.ghostMs, ease: Phaser.Math.Easing.Quadratic.Out, onComplete: () => g.destroy() });
}
