// The slingshot: weapon queue, aim input, pull, launch, ability trigger and the dotted preview.
import Phaser from 'phaser';
import { C } from '../art/palette';
import { weaponHeight, weaponScale } from '../art/weaponScale';
import { sfx } from '../audio/sfx';
import { beatBob, beatPulse } from '../audio/beat';
import { weaponImpl } from '../content/weapons';
import { battleWeapon } from './weapon';
import { clampCx, homeCx, homeZoom, pointerWorld, screenDist, setView, zoomBy } from './camera';
import { H } from '../config/constants';
import { MatterLib } from './matter';
import { setGravity } from './projectiles';
import { targetTap } from './consumables';
import { groundAt } from './terrain';
import type { Proj } from './BattleCtx';
import type { BattleState } from './state';
import { ARENA_MAX_ACTIONS } from '../arena/types';
import { abilityAnim, launchAnim } from './weaponAnim';

export function setWeapon(b: BattleState, id: string): void {
  b.wdef = battleWeapon(b, id);
  b.wpn = weaponImpl(b.wdef);
}

// ------------------------------------------------------------------ queue (weapons waiting to be fired)

const slotX = (b: BattleState, i: number): number => Math.max(b.tune.homeLeft ?? -40, b.slingX - 18 - i * 13);

export function weaponReadyRotation(weaponId?: string): number {
  switch (weaponId) {
    case "w_skyforge_maul":
    case "w_comet_fists":
    case "w_kinetic_palms":
    case "w_bulwark_disc":
      return 0; // natural upright pose (head up / fists upright)
    case "w_steersong_arrow":
    default:
      return Math.PI / 4; // pointing along aim
  }
}

/** Puts the waiting weapons beside the sling. */
export function buildQueue(b: BattleState): void {
  addToQueue(b, b.loadout);
}

/** Adds weapons to the end of the waiting line (`ids` are already, or about to be, in `b.loadout`). */
export function addToQueue(b: BattleState, ids: string[]): void {
  const first = b.queue.length;
  ids.forEach((id, k) => {
    const i = first + k;
    const wpn = weaponImpl(battleWeapon(b, id));
    const baseScale = weaponScale(b.scene, wpn.texture, 'queue', battleWeapon(b, id));
    const yOff = Math.round(weaponHeight(b.scene, wpn.texture, baseScale) / 3);
    const q = b.scene.add.image(slotX(b, i), groundAt(b, slotX(b, i)) - yOff, wpn.texture).setDepth(3).setScale(baseScale);
    q.setData('phase', i * 1.3);
    q.setData('baseScale', baseScale);
    q.setData('yOff', yOff);
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
  const readyScale = weaponScale(b.scene, b.wpn.texture, 'sling', b.wdef);
  const readyRot = weaponReadyRotation(b.wdef.id);
  if (b.arena) {
    first.destroy();
    b.queue.forEach((q, i) => q.setPosition(slotX(b, i), groundAt(b, slotX(b, i)) - ((q.getData('yOff') as number) || 8)));
    b.readySprite.setTexture(b.wpn.texture).setVisible(true).setRotation(readyRot).setScale(readyScale);
    b.pouch.set(b.slingX, b.slingY);
    b.state = 'ready';
    return;
  }
  first.setDepth(7).setScale((first.getData('baseScale') as number) || 1.5);
  b.queue.forEach((q, i) => {
    const yOff = (q.getData('yOff') as number) || 8;
    hop(b, q, slotX(b, i), groundAt(b, slotX(b, i)) - yOff, 260, 5);
  });
  sfx.click();
  hop(b, first, b.slingX, b.slingY, 420, 26, () => {
    first.destroy();
    b.readySprite.setTexture(b.wpn.texture).setVisible(true).setRotation(readyRot).setScale(readyScale);
    b.pouch.set(b.slingX, b.slingY);
    b.scene.tweens.add({ targets: b.readySprite, scaleY: readyScale * 0.8, scaleX: readyScale * 1.15, duration: 70, yoyo: true });
    b.state = 'ready';
  });
  b.scene.tweens.add({ targets: first, rotation: Math.PI * 2 + readyRot, scale: readyScale, duration: 420, ease: 'Sine.inOut' });
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
  const readyScale = weaponScale(b.scene, b.wpn.texture, 'sling', b.wdef);
  const readyRot = weaponReadyRotation(b.wdef.id);
  b.readySprite.setTexture(b.wpn.texture).setVisible(true).setRotation(readyRot).setScale(readyScale);
  b.pouch.set(b.slingX, b.slingY);
  b.state = 'ready';
}

export function updateQueue(b: BattleState, time: number): void {
  b.queue.forEach((q) => {
    if (b.scene.tweens.isTweening(q)) return;
    const ph = q.getData('phase') as number;
    const base = (q.getData('baseScale') as number) || 0.85;
    const beat = beatBob(time, ph);
    q.setScale(base + 0.03 * beat, base - 0.04 * beat);
    q.setRotation(0.12 * Math.sin(time / 320 + ph));
  });
}

// ------------------------------------------------------------------ ability

export function activateAbility(b: BattleState): void {
  if (b.arena && b.arena.actions.length >= ARENA_MAX_ACTIONS) return;
  const mode = b.wdef.ability.mode;
  if (b.state !== 'flying' || !b.proj || mode === 'impact' || mode === 'none') return;
  const p = b.proj;
  if (p.tapped && !p.data.allowSecondTap) return;

  if (b.wdef.ability.charges !== undefined) {
    b.abilityCharges = b.abilityCharges ?? {};
    if (!p.tapped) {
      const cur = b.abilityCharges[b.wdef.id] ?? b.wdef.ability.charges;
      if (cur <= 0) return;
      b.abilityCharges[b.wdef.id] = cur - 1;
    }
  }
  if (b.arena) b.arena.actions.push({ type: 'ability', frame: b.arena.frames });
  p.tapped = true;
  const { x, y } = p.body.position;
  const animDone = abilityAnim(b, p);
  b.wpn.onAbility?.(b.ctx, p);
  animDone();
  b.events.emit('shot:ability', { weaponId: p.wid, x, y });
}

export function updateAbilityBtn(b: BattleState, time: number): void {
  const inAir = b.state === 'flying' && !!b.proj && b.wdef.ability.mode !== 'impact' && b.wdef.ability.mode !== 'none';
  const p = b.proj;
  const canTap = inAir && (!p!.tapped || !!p!.data.allowSecondTap);
  if (p && p.data.secondTapLabel && p.data.allowSecondTap) {
    b.ui.setAbilityLabel(p.data.secondTapLabel);
  } else if (b.wdef) {
    b.ui.setAbilityLabel(b.wdef.ability.label);
  }
  if (b.wdef.ability.charges !== undefined) {
    b.abilityCharges = b.abilityCharges ?? {};
    const left = b.abilityCharges[b.wdef.id] ?? b.wdef.ability.charges;
    const ready = canTap && (!!p!.data.allowSecondTap || left > 0);
    b.ui.showAbility(inAir, ready, ready ? 1 + 0.07 * beatPulse(time) : 1, { left, max: b.wdef.ability.charges });
  } else {
    const ready = canTap;
    b.ui.showAbility(inAir, ready, ready ? 1 + 0.07 * beatPulse(time) : 1);
  }
}

// ------------------------------------------------------------------ input

export function onDown(b: BattleState, p: Phaser.Input.Pointer, over: unknown[]): void {
  sfx.unlock();
  if (over.length || b.paused) return;
  // Right or middle click drag initiates pan
  if (p.button === 1 || p.button === 2) {
    if (b.settings.features.zoom) {
      b.view.panLast = p.x;
      b.view.free = true;
    }
    return;
  }
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
  } else if (v.panLast !== null && (p.isDown || b.scene.input.activePointer.isDown)) {
    if (b.introSkip) b.introSkip();
    else b.scene.tweens.killTweensOf(v);
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
    b.readySprite.setRotation(weaponReadyRotation(b.wdef?.id));
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
  if (b.arena) {
    if (b.arena.actions.length >= ARENA_MAX_ACTIONS) return;
    const angle = Math.round(Math.atan2(-vel.y, vel.x) * 180 / Math.PI * 1e6) / 1e6;
    const power = Math.round(Math.min(1, Math.max(0, vel.length() / b.maxSpeed)) * 1e6) / 1e6;
    const radians = angle * Math.PI / 180;
    const pull = power * b.tune.maxPull;
    b.pouch.set(b.slingX - Math.cos(radians) * pull, b.slingY + Math.sin(radians) * pull);
    vel.set(Math.cos(radians) * pull * b.tune.launchK, -Math.sin(radians) * pull * b.tune.launchK);
    b.arena.actions.push({ type: 'fire', frame: b.arena.frames, angle, power });
  }
  const id = b.loadout[b.shotIdx];
  setWeapon(b, id);
  const phys = b.wdef.physics;
  const speedMult = b.mods.launchSpeedMult ?? 1;
  const tempo = phys.tempo ?? 1;
  const actualVel = vel.clone().scale(speedMult * tempo);
  const body: any = b.scene.matter.add.circle(b.pouch.x, b.pouch.y, phys.radius, {
    density: phys.density / tempo, friction: phys.friction ?? 0.3, frictionAir: (phys.frictionAir ?? 0) * tempo, restitution: phys.restitution ?? 0.2, label: 'proj',
  });
  body.proj = { wid: id, mul: 1, owner: 'main' };
  setGravity(body, (phys.gravity ?? 1) * tempo * tempo);
  MatterLib.Body.setVelocity(body, { x: actualVel.x, y: actualVel.y });
  MatterLib.Body.setAngularVelocity(body, phys.spin);
  const flightScale = weaponScale(b.scene, b.wpn.texture, 'flight', b.wdef);
  const sprite = b.scene.add.image(b.pouch.x, b.pouch.y, b.wpn.texture).setDepth(4).setScale(flightScale);
  const pData: Record<string, any> = {};
  if (speedMult > 1) pData.speedLines = true;
  b.proj = { body, sprite, wid: id, def: b.wdef, steps: 0, slow: 0, tapped: false, t: 0, data: pData };
  if (b.wdef.forge) body.proj.forgeProj = b.proj;
  launchAnim(b, b.proj);
  // Prime Serum: this shot is buffed if any charges are left
  const buffed = b.mods.serumShots > 0;
  if (buffed) b.mods.serumShots--;
  b.mods.damageMult = b.arenaDamageMult * (b.mods.slingDamageMult ?? 1) * (buffed ? b.mods.serumMult : 1);
  if (b.adBonusFrom !== undefined && b.shotIdx >= b.adBonusFrom && b.adBonus) b.mods.damageMult *= 1 + b.adBonus;
  b.readySprite.setVisible(false);
  b.pouch.set(b.slingX, b.slingY);
  b.shotIdx++;

  // Gemini Strand twin launch (launches 12 steps behind at 45% damage along same aim)
  const twinFrac = b.mods.twinFraction;
  const twinDelay = b.mods.twinDelaySteps ?? 12;
  if (twinFrac !== undefined && b.shotIdx < b.loadout.length) {
    const twinId = b.loadout[b.shotIdx];
    const twinWdef = battleWeapon(b, twinId);
    const twinWpn = weaponImpl(twinWdef);
    b.shotIdx++;
    const twinQ = b.queue.shift();
    twinQ?.destroy();
    let delay = twinDelay;
    const launchPos = { x: b.slingX, y: b.slingY };
    const twinTempo = twinWdef.physics.tempo ?? 1;
    const twinVel = vel.clone().scale(speedMult * twinTempo);
    b.actors.push({
      update() {
        delay--;
        if (delay === 0) {
          const tPhys = twinWdef.physics;
          const tBody: any = b.scene.matter.add.circle(launchPos.x, launchPos.y, tPhys.radius, {
            density: tPhys.density / twinTempo, friction: tPhys.friction ?? 0.3, frictionAir: (tPhys.frictionAir ?? 0) * twinTempo,
            restitution: tPhys.restitution ?? 0.2, label: 'proj',
          });
          tBody.proj = { wid: twinId, mul: twinFrac, owner: 'extra' };
          setGravity(tBody, (tPhys.gravity ?? 1) * twinTempo * twinTempo);
          MatterLib.Body.setVelocity(tBody, { x: twinVel.x, y: twinVel.y });
          MatterLib.Body.setAngularVelocity(tBody, tPhys.spin);
          const tFlightScale = weaponScale(b.scene, twinWpn.texture, 'flight', twinWdef);
          const tSprite = b.scene.add.image(launchPos.x, launchPos.y, twinWpn.texture).setDepth(4).setScale(tFlightScale);
          const tProj: Proj = { body: tBody, sprite: tSprite, wid: twinId, def: twinWdef, steps: 0, slow: 0, tapped: false, t: 0, data: { forgeMult: twinFrac } };
          if (twinWdef.forge) tBody.proj.forgeProj = tProj;
          sfx.launch();
          twinWpn.onLaunch?.(b.ctx, tProj);
          let tSlow = 0;
          let tSteps = 0;
          b.actors.push({
            body: tBody,
            pos: () => tBody.position,
            update() {
              if (tProj.data.ended) return true;
              tSteps++;
              tSprite.setPosition(tBody.position.x, tBody.position.y);
              tSprite.setRotation(tBody.angle);
              twinWpn.onUpdate?.(b.ctx, tProj);
              const sp = Math.hypot(tBody.velocity.x, tBody.velocity.y);
              tSlow = sp < 0.3 ? tSlow + 1 : 0;
              const F = b.tune.flow;
              const out = tBody.position.x > b.worldW + 40 || tBody.position.x < -40 || tBody.position.y > Math.max(H, b.groundY) + 60;
              return out || tSlow > F.projectileSlowSteps || tSteps > F.projectileMaxSteps;
            },
            destroy() {
              if (!b.closing) b.scene.matter.world.remove(tBody);
              tSprite.destroy();
            },
          });
          return true;
        }
        return false;
      },
      destroy() {},
    });
  }

  b.view.free = false;
  b.state = 'flying';
  b.scene.cameras.main.shake(70, 0.004);
  sfx.launch();
  b.wpn.onLaunch?.(b.ctx, b.proj);
  b.events.emit('shot:launched', {
    weaponId: id, index: b.shotIdx - 1, x: body.position.x, y: body.position.y, vx: actualVel.x, vy: actualVel.y, radius: phys.radius,
    density: phys.density / tempo, gravity: (phys.gravity ?? 1) * tempo * tempo,
  });
}

// ------------------------------------------------------------------ overlay (sling bands and aim preview)

export function drawOverlay(b: BattleState): void {
  const g = b.gfx;
  g.clear();
  const aiming = b.state === 'aiming';
  const pos = aiming ? b.pouch : new Phaser.Math.Vector2(b.slingX, b.slingY);

  const skin = b.slingSkin;
  const bandColor = skin === 's_quicksilver' ? C('b') : skin === 's_gemini' ? C('4') : C('2');

  if (b.readySprite.visible || aiming) {
    g.lineStyle(3, C('0'), 1);
    g.lineBetween(b.slingX - 7, b.slingY + 6, pos.x, pos.y);
    g.lineBetween(b.slingX + 6, b.slingY + 6, pos.x, pos.y);
    g.lineStyle(1, bandColor, 1);
    g.lineBetween(b.slingX - 7, b.slingY + 6, pos.x, pos.y);
    g.lineBetween(b.slingX + 6, b.slingY + 6, pos.x, pos.y);
  }
  if (b.state === 'ready' || aiming) {
    b.readySprite.setPosition(pos.x, pos.y);
    if (b.mods.twinFraction && b.shotIdx < b.loadout.length) {
      g.fillStyle(C('4'), 1).fillRect(pos.x - 8, pos.y - 6, 4, 4);
    }
    if (aiming) {
      const speedMult = b.mods.launchSpeedMult ?? 1;
      const tempo = b.wdef.physics.tempo ?? 1;
      const v = new Phaser.Math.Vector2(b.slingX - pos.x, b.slingY - pos.y).scale(b.tune.launchK * speedMult * tempo);
      b.readySprite.setRotation(Math.atan2(v.y, v.x) + Math.PI / 2);
      let x = pos.x;
      let y = pos.y;
      let vy = v.y;
      g.fillStyle(C('c'), 1);
      const gravityStep = 0.001 * b.stepMs * b.stepMs; // matter gravity per step, px/step^2
      const gr = gravityStep * (b.wdef.physics.gravity ?? 1) * tempo * tempo;
      const steps = Math.round((30 * b.mods.previewMult) / tempo); // same stretch of path whatever the weapon's tempo
      for (let i = 1; i <= steps; i++) {
        x += v.x;
        vy += gr;
        y += vy;
        if (y > groundAt(b, x) - 2) break;
        if (i % 3 === 0 && i <= steps - 6) g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
      }
    }
  }
  if (b.proj) {
    b.wpn.drawFx?.(b.ctx, b.proj, g);
    if (b.proj.data?.speedLines) {
      const v = b.proj.body.velocity;
      const bp = b.proj.body.position;
      const sp = Math.hypot(v.x, v.y);
      if (sp > 1) {
        const nx = v.x / sp;
        const ny = v.y / sp;
        g.lineStyle(1, C('c'), 0.8).lineBetween(bp.x - nx * 14, bp.y - ny * 14, bp.x - nx * 4, bp.y - ny * 4);
        g.lineStyle(1, C('b'), 0.6).lineBetween(bp.x - nx * 20 - ny * 3, bp.y - ny * 20 + nx * 3, bp.x - nx * 8 - ny * 3, bp.y - ny * 8 + nx * 3);
        g.lineStyle(1, C('b'), 0.6).lineBetween(bp.x - nx * 20 + ny * 3, bp.y - ny * 20 - nx * 3, bp.x - nx * 8 + ny * 3, bp.y - ny * 8 - nx * 3);
      }
    }
  }
  for (const e of b.ents) {
    if (!e.revealed || e.dead || e.kind !== 'monster') continue;
    const x = e.body.position.x - 7;
    const y = e.body.position.y - e.h / 2 - 14;
    g.fillStyle(C('0'), 1).fillRect(x - 1, y - 1, 16, 4);
    g.fillStyle(C('f'), 1).fillRect(x, y, 14, 2);
    g.fillStyle(C(e.hp / e.maxHp > 0.5 ? '5' : e.hp / e.maxHp > 0.25 ? '4' : '2'), 1).fillRect(x, y, Math.max(1, Math.round((14 * e.hp) / e.maxHp)), 2);
  }
}

export function updateCursor(b: BattleState): void {
  if (b.paused) {
    b.scene.input.setDefaultCursor('default');
    return;
  }
  if (b.state === 'aiming') {
    b.scene.input.setDefaultCursor('grabbing');
  } else if (b.state === 'ready' && screenDist(b, b.scene.input.activePointer, b.slingX, b.slingY) < b.tune.aimGrabRadius) {
    b.scene.input.setDefaultCursor('grab');
  } else {
    b.scene.input.setDefaultCursor('default');
  }
}
