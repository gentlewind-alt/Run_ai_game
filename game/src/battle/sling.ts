// The slingshot: weapon queue, aim input, pull, launch, ability trigger and the dotted preview.
import Phaser from 'phaser';
import { C } from '../art/palette';
import { sfx } from '../audio/sfx';
import { beatBob, beatPulse } from '../audio/beat';
import { weaponImpl } from '../content/weapons';
import { weaponDef } from '../data/lookup';
import { clampCx, homeCx, homeZoom, pointerWorld, screenDist, setView, zoomBy } from './camera';
import { MatterLib } from './matter';
import { setGravity } from './projectiles';
import { targetTap } from './consumables';
import { groundAt } from './terrain';
import type { BattleState } from './state';

export function setWeapon(b: BattleState, id: string): void {
  b.wdef = weaponDef(id);
  b.wpn = weaponImpl(b.wdef);
}

// ------------------------------------------------------------------ queue (weapons waiting to be fired)

const slotX = (b: BattleState, i: number): number => Math.max(4, b.slingX - 22 - i * 12);

/** Puts the waiting weapons beside the sling. */
export function buildQueue(b: BattleState): void {
  b.loadout.forEach((id, i) => {
    const q = b.scene.add.image(slotX(b, i), groundAt(b, slotX(b, i)) - 7, weaponImpl(weaponDef(id)).texture).setDepth(3).setScale(0.85);
    q.setData('phase', i * 1.3);
    b.queue.push(q);
  });
}

function hop(b: BattleState, img: Phaser.GameObjects.Image, tx: number, ty: number, dur: number, arc: number, done?: () => void): void {
  const sx = img.x;
  const sy = img.y;
  b.scene.tweens.addCounter({
    from: 0, to: 1, duration: dur, ease: 'Sine.inOut',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      img.setPosition(sx + (tx - sx) * t, sy + (ty - sy) * t - Math.sin(Math.PI * t) * arc);
    },
    onComplete: () => {
      img.setPosition(tx, ty);
      done?.();
    },
  });
}

/** The next weapon in line hops onto the sling; the rest shuffle up. */
export function loadNext(b: BattleState): void {
  if (b.shotIdx >= b.loadout.length || b.queue.length === 0) {
    b.state = 'ready';
    return;
  }
  b.state = 'loading';
  setWeapon(b, b.loadout[b.shotIdx]);
  b.ui.setAbilityLabel(b.wdef.ability.label);
  const first = b.queue.shift()!;
  first.setDepth(7).setScale(0.85);
  b.queue.forEach((q, i) => hop(b, q, slotX(b, i), groundAt(b, slotX(b, i)) - 7, 260, 5));
  sfx.click();
  hop(b, first, b.slingX, b.slingY, 420, 26, () => {
    first.destroy();
    b.readySprite.setTexture(b.wpn.texture).setVisible(true).setRotation(Math.PI / 4).setScale(1);
    b.pouch.set(b.slingX, b.slingY);
    b.scene.tweens.add({ targets: b.readySprite, scaleY: 0.8, scaleX: 1.15, duration: 70, yoyo: true });
    b.state = 'ready';
  });
  b.scene.tweens.add({ targets: first, rotation: Math.PI * 2 + Math.PI / 4, scale: 1, duration: 420, ease: 'Sine.inOut' });
}

/** Test hook: finish the intro/hop instantly (tweens run on wall-clock time, scripted tests don't). */
export function skipToReady(b: BattleState): void {
  b.scene.tweens.killAll();
  b.scene.children.list.filter((o: any) => o.depth === 100000).forEach((o) => o.destroy()); // the iris cover (see core/flow.ts)
  setView(b, homeZoom(b), homeCx(b));
  b.queue.forEach((q) => q.destroy());
  b.queue = [];
  if (b.shotIdx >= b.loadout.length) return;
  setWeapon(b, b.loadout[b.shotIdx]);
  b.ui.setAbilityLabel(b.wdef.ability.label);
  b.readySprite.setTexture(b.wpn.texture).setVisible(true).setRotation(Math.PI / 4).setScale(1);
  b.pouch.set(b.slingX, b.slingY);
  b.state = 'ready';
}

export function updateQueue(b: BattleState, time: number): void {
  b.queue.forEach((q) => {
    if (b.scene.tweens.isTweening(q)) return;
    const ph = q.getData('phase') as number;
    const beat = beatBob(time, ph);
    q.setScale(0.85 + 0.03 * beat, 0.85 - 0.04 * beat);
    q.setRotation(0.12 * Math.sin(time / 320 + ph));
  });
}

// ------------------------------------------------------------------ ability

export function activateAbility(b: BattleState): void {
  const mode = b.wdef.ability.mode;
  if (b.state !== 'flying' || !b.proj || b.proj.tapped || mode === 'impact' || mode === 'none') return;
  const p = b.proj;
  p.tapped = true;
  const { x, y } = p.body.position;
  b.wpn.onAbility?.(b.ctx, p);
  b.events.emit('shot:ability', { weaponId: p.wid, x, y });
}

export function updateAbilityBtn(b: BattleState, time: number): void {
  const inAir = b.state === 'flying' && !!b.proj && b.wdef.ability.mode !== 'impact' && b.wdef.ability.mode !== 'none';
  const ready = inAir && !b.proj!.tapped;
  b.ui.showAbility(inAir, ready, ready ? 1 + 0.07 * beatPulse(time) : 1);
}

// ------------------------------------------------------------------ input

export function onDown(b: BattleState, p: Phaser.Input.Pointer, over: unknown[]): void {
  sfx.unlock();
  if (over.length || b.paused) return;
  if (b.targeting !== null) {
    const w = pointerWorld(b, p);
    if (targetTap(b, w.x, w.y)) return;
  }
  const v = b.view;
  const zoomOn = b.settings.features.zoom;
  const two = b.scene.input.pointer1.isDown && b.scene.input.pointer2.isDown;
  if (two && b.state !== 'aiming') {
    if (!zoomOn) return;
    v.pinchPrev = Phaser.Math.Distance.Between(b.scene.input.pointer1.x, b.scene.input.pointer1.y, b.scene.input.pointer2.x, b.scene.input.pointer2.y);
    v.panLast = null;
    return;
  }
  if (b.state === 'ready' && screenDist(b, p, b.slingX, b.slingY) < b.tune.aimGrabRadius) {
    b.state = 'aiming';
    v.free = false;
    onMove(b, p);
  } else if (b.state !== 'aiming' && b.state !== 'won' && b.state !== 'lost' && zoomOn) {
    v.panLast = p.x;
  }
}

export function onMove(b: BattleState, p: Phaser.Input.Pointer): void {
  if (b.state === 'aiming') {
    const w = pointerWorld(b, p);
    const vec = new Phaser.Math.Vector2(w.x - b.slingX, w.y - b.slingY);
    if (vec.length() > b.tune.maxPull) vec.setLength(b.tune.maxPull);
    b.pouch.set(b.slingX + vec.x, Math.min(b.slingY + vec.y, groundAt(b, b.slingX + vec.x) - 6));
    const now = b.scene.time.now;
    if (now - b.lastStretch > b.tune.stretchSoundMs) {
      b.lastStretch = now;
      sfx.stretch();
    }
    return;
  }
  if (!b.settings.features.zoom) return;
  const v = b.view;
  const p1 = b.scene.input.pointer1;
  const p2 = b.scene.input.pointer2;
  if (p1.isDown && p2.isDown && v.pinchPrev > 0) {
    const d = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
    zoomBy(b, d / v.pinchPrev, (p1.x + p2.x) / 2);
    v.pinchPrev = d;
  } else if (v.panLast !== null && p.isDown) {
    b.scene.tweens.killTweensOf(v);
    v.cx = clampCx(b, v.cx - (p.x - v.panLast) / v.z, v.z);
    v.panLast = p.x;
    v.free = true;
  }
}

export function onUp(b: BattleState): void {
  b.view.pinchPrev = 0;
  b.view.panLast = null;
  if (b.state !== 'aiming') return;
  const pull = new Phaser.Math.Vector2(b.slingX - b.pouch.x, b.slingY - b.pouch.y);
  if (pull.length() < b.tune.minPull) {
    b.pouch.set(b.slingX, b.slingY);
    b.state = 'ready';
    return;
  }
  launch(b, pull.scale(b.tune.launchK));
}

/** Fires without touch input: angle in degrees above horizontal toward the right, power 0..1 of a full pull. */
export function launchFrom(b: BattleState, angleDeg: number, power: number): void {
  const a = Phaser.Math.DegToRad(angleDeg);
  const pull = Phaser.Math.Clamp(power, 0, 1) * b.tune.maxPull;
  b.pouch.set(b.slingX - Math.cos(a) * pull, b.slingY + Math.sin(a) * pull);
  launch(b, new Phaser.Math.Vector2(Math.cos(a) * pull * b.tune.launchK, -Math.sin(a) * pull * b.tune.launchK));
}

function launch(b: BattleState, vel: Phaser.Math.Vector2): void {
  const id = b.loadout[b.shotIdx];
  setWeapon(b, id);
  const phys = b.wdef.physics;
  const body: any = b.scene.matter.add.circle(b.pouch.x, b.pouch.y, phys.radius, {
    density: phys.density, friction: phys.friction ?? 0.3, frictionAir: phys.frictionAir ?? 0, restitution: phys.restitution ?? 0.2, label: 'proj',
  });
  body.proj = { wid: id, mul: 1, owner: 'main' };
  setGravity(body, phys.gravity ?? 1);
  MatterLib.Body.setVelocity(body, { x: vel.x, y: vel.y });
  MatterLib.Body.setAngularVelocity(body, phys.spin);
  const sprite = b.scene.add.image(b.pouch.x, b.pouch.y, b.wpn.texture).setDepth(4);
  b.proj = { body, sprite, wid: id, def: b.wdef, steps: 0, slow: 0, tapped: false, t: 0, data: {} };
  // Prime Serum: this shot is buffed if any charges are left
  const buffed = b.mods.serumShots > 0;
  if (buffed) b.mods.serumShots--;
  b.mods.damageMult = buffed ? b.mods.serumMult : 1;
  b.readySprite.setVisible(false);
  b.pouch.set(b.slingX, b.slingY);
  b.shotIdx++;
  b.view.free = false;
  b.state = 'flying';
  b.scene.cameras.main.shake(70, 0.004);
  sfx.launch();
  b.wpn.onLaunch?.(b.ctx, b.proj);
  b.events.emit('shot:launched', {
    weaponId: id, index: b.shotIdx - 1, x: body.position.x, y: body.position.y, vx: vel.x, vy: vel.y, radius: phys.radius,
    density: phys.density, gravity: phys.gravity ?? 1,
  });
}

// ------------------------------------------------------------------ overlay (sling bands and aim preview)

export function drawOverlay(b: BattleState): void {
  const g = b.gfx;
  g.clear();
  const aiming = b.state === 'aiming';
  const pos = aiming ? b.pouch : new Phaser.Math.Vector2(b.slingX, b.slingY);

  if (b.readySprite.visible || aiming) {
    g.lineStyle(3, C('0'), 1);
    g.lineBetween(b.slingX - 7, b.slingY + 6, pos.x, pos.y);
    g.lineBetween(b.slingX + 6, b.slingY + 6, pos.x, pos.y);
    g.lineStyle(1, C('2'), 1);
    g.lineBetween(b.slingX - 7, b.slingY + 6, pos.x, pos.y);
    g.lineBetween(b.slingX + 6, b.slingY + 6, pos.x, pos.y);
  }
  if (b.state === 'ready' || aiming) {
    b.readySprite.setPosition(pos.x, pos.y);
    if (aiming) {
      const v = new Phaser.Math.Vector2(b.slingX - pos.x, b.slingY - pos.y).scale(b.tune.launchK);
      b.readySprite.setRotation(Math.atan2(v.y, v.x) + Math.PI / 2);
      let x = pos.x;
      let y = pos.y;
      let vy = v.y;
      g.fillStyle(C('c'), 1);
      const gravityStep = 0.001 * b.stepMs * b.stepMs; // matter gravity per step, px/step^2
      const gr = gravityStep * (b.wdef.physics.gravity ?? 1);
      const steps = Math.round(30 * b.mods.previewMult);
      for (let i = 1; i <= steps; i++) {
        x += v.x;
        vy += gr;
        y += vy;
        if (y > groundAt(b, x) - 2) break;
        if (i % 3 === 0 && i <= steps - 6) g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
      }
    }
  }
  if (b.proj) b.wpn.drawFx?.(b.ctx, b.proj, g);
  for (const e of b.ents) {
    if (!e.revealed || e.dead || e.kind !== 'monster') continue;
    const x = e.body.position.x - 7;
    const y = e.body.position.y - e.h / 2 - 14;
    g.fillStyle(C('0'), 1).fillRect(x - 1, y - 1, 16, 4);
    g.fillStyle(C('f'), 1).fillRect(x, y, 14, 2);
    g.fillStyle(C(e.hp / e.maxHp > 0.5 ? '5' : e.hp / e.maxHp > 0.25 ? '4' : '2'), 1).fillRect(x, y, Math.max(1, Math.round((14 * e.hp) / e.maxHp)), 2);
  }
}
