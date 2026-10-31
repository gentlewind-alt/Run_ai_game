// The fixed-step loop. Gameplay time is whole 60 Hz steps; tweens are for visuals only.
import { H } from '../config/constants';
import { tick as tickStatus } from './status';
import { step as stepCombo } from './combo';
import { syncBurning, updateParts } from './fx';
import Phaser from 'phaser';
import { MatterLib } from './matter';
import { applyCustomGravity, endProj } from './projectiles';
import { kindFor } from '../content/levelKinds';
import { finish, step as stepRules } from './rules';
import type { BattleState } from './state';
import { drawOverlay, updateAbilityBtn, updateQueue } from './sling';
import { updateCamera } from './camera';
import { beatBob } from '../audio/beat';
import { ARENA_MAX_FRAMES } from '../arena/types';
import { animateProj } from './weaponAnim';
import { applyStandResistance, propagateStandRelease } from '../builder/physics';
import { syncEnemyWand } from './enemyWands';

/** Called every frame by the scene. Runs 0..maxStepsPerFrame whole steps, then updates the visuals. */
export function update(b: BattleState, delta: number, nowMs: number): void {
  if (b.paused) return;
  b.acc += Math.min(delta, 50);
  let n = 0;
  while (b.acc >= b.stepMs && n < b.settings.physics.maxStepsPerFrame) {
    if (b.arena) {
      if (b.arena.frames >= ARENA_MAX_FRAMES) { finish(b, false); break; }
      b.arena.frames++;
    }
    b.acc -= b.stepMs;
    n++;
    updateParts(b);
    if (b.hitStop > 0) {
      b.hitStop--;
      if (b.arena?.frames === ARENA_MAX_FRAMES) { finish(b, false); break; }
      continue;
    }
    applyCustomGravity(b);
    // Keep the initial level settling unchanged; firm footing starts when play is ready.
    const standResistance = b.settings.features.standResistance && b.state !== 'intro' && (b.state !== 'loading' || b.shotIdx > 0);
    if (standResistance) {
      for (const e of b.ents) if (!e.dead && e.kind === 'block') applyStandResistance(e.body, b.tune.physics.stand);
    }
    b.scene.matter.world.step(b.stepMs);
    if (standResistance) propagateStandRelease(b.scene.matter.world.engine.pairs.list, b.tune.physics.stand);
    stepLogic(b);
    if (b.arena?.frames === ARENA_MAX_FRAMES) finish(b, false);
    if (b.arena && (b.state === 'won' || b.state === 'lost')) break;
  }
  updateCamera(b);
  updateQueue(b, nowMs);
  updateAbilityBtn(b, nowMs);
  syncSprites(b, nowMs);
  const boss = b.ents.find((e) => !e.dead && e.kind === 'monster' && e.def?.boss);
  if (boss) b.ui.setBossHp(boss.hp, boss.maxHp, boss.def?.name ?? boss.type);
  else if (b.level.kind === 'boss' || b.ents.some((e) => e.kind === 'monster' && e.def?.boss)) b.ui.setBossHp(0, 1);
  drawOverlay(b);
  b.connections?.draw(b.gfx);
}

function stepLogic(b: BattleState): void {
  b.steps++;
  stepCombo(b);
  kindFor(b.level.kind)?.onStep?.(b.ctx, b.level);
  for (const e of b.ents) {
    if (e.cool > 0) e.cool--;
    if (e.hurt > 0) e.hurt--;
    if (e.flash > 0) e.flash--;
  }
  for (const e of b.ents) {
    if (e.dead || e.kind !== 'monster') continue;
    tickStatus(b, e);
    if (!e.dead && e.status.stun <= 0 && e.status.chain <= 0) e.behavior?.onUpdate?.(b.ctx, e);
  }

  if (b.proj) {
    const F = b.tune.flow;
    const p = b.proj;
    p.steps++;
    const body = p.body;
    if (p.def.physics.align && !p.touchedGround) {
      const v = body.velocity;
      if (Math.hypot(v.x, v.y) > 0.2) MatterLib.Body.setAngle(body, Math.atan2(v.y, v.x) + Math.PI / 2);
      MatterLib.Body.setAngularVelocity(body, 0);
    }
    b.wpn.onUpdate?.(b.ctx, p);
    if (b.proj === p) {
      const speed = Math.hypot(body.velocity.x, body.velocity.y);
      p.slow = speed < 0.3 ? p.slow + 1 : 0;
      const out = body.position.x > b.worldW + 40 || body.position.x < -40 || body.position.y > Math.max(H, b.groundY) + 60;
      if (out || p.slow > F.projectileSlowSteps || p.steps > (p.data.maxFlightSteps ?? F.projectileMaxSteps)) endProj(b, p);
    }
  }
  const list = b.actors;
  b.actors = [];
  const keep = [];
  for (const a of list) {
    const done = a.update();
    if (done) a.destroy();
    else keep.push(a);
  }
  b.actors = [...keep, ...b.actors];
  const busy = !!b.proj || b.actors.some((a) => !!a.pos);
  if (b.state === 'flying' && !busy) {
    b.state = 'settling';
    b.settleSteps = 0;
  }
  stepRules(b);
}

function syncSprites(b: BattleState, time: number): void {
  for (const e of b.ents) {
    if (e.dead) continue;
    const bp = e.body.position;
    if (e.kind === 'block' || e.kind === 'chest') {
      e.sprite.setPosition(bp.x, bp.y).setRotation(e.body.angle);
      syncBurning(b, e);
      continue;
    }
    const beat = beatBob(time, e.phase);
    const running = e.def?.behavior === 'runner';
    const openKey = e.params.visorOpen === 1 ? `${e.type}_open` : e.type;
    // Generated-art monsters (realms 4-6) have no hurt frame: they keep their sprite and get a red tint instead.
    const hurtFrame = e.hurt > 0 && b.scene.textures.exists(`${e.type}_hurt`);
    const tex = hurtFrame ? `${e.type}_hurt` : (b.scene.textures.exists(openKey) ? openKey : e.type);
    const wolfRun = e.type === 'frost_wolf' && e.runFrom !== undefined && b.steps >= e.runFrom
      && Math.abs(e.body.velocity.x) >= e.params.runMinSpeed && e.status.stun <= 0 && e.status.chain <= 0
      && !!b.scene.anims?.exists('frost_wolf_run');
    const anim = (e.sprite as Phaser.GameObjects.Sprite).anims ? e.sprite as Phaser.GameObjects.Sprite : null;
    if (wolfRun && anim) {
      if (anim.anims.currentAnim?.key !== 'frost_wolf_run' || !anim.anims.isPlaying) anim.play('frost_wolf_run');
    } else {
      if (anim?.anims.isPlaying) anim.stop();
      e.sprite.setTexture(tex);
    }
    e.sprite.setPosition(bp.x, bp.y + e.h / 2 - e.size / 2 + 1 + (running ? -Math.abs(Math.sin(b.steps / 4)) * 2 : 0));
    e.sprite.setRotation(e.body.angle);
    const amp = e.size >= 24 ? 0.03 : 0.05;
    const frameScale = wolfRun ? e.size / e.sprite.frame.realWidth : 1;
    e.sprite.setScale(frameScale * (running ? 1 : 1 + amp * beat) * (e.visualScaleX ?? 1), frameScale * (running ? 1 : 1 - amp * 1.4 * beat) * (e.visualScaleY ?? 1));
    if (e.flash > 0) e.sprite.setTintFill(0xffffff);
    else if (e.hurt > 0 && !hurtFrame) e.sprite.setTint(0xff8a8a);
    else if (e.status.chain > 0) e.sprite.setTint(0xb8c0c8);
    else if (e.status.stun > 0) e.sprite.setTint(0x9fb8ff);
    else if (e.status.poison > 0) e.sprite.setTint(0xa7f070);
    else if (e.status.curse > 0) e.sprite.setTint(0xd7a0ff);
    else if (e.status.slow > 0) e.sprite.setTint(0x8af0f8);
    else e.sprite.clearTint();
    e.sprite.setFlipX(running && e.dir < 0);
    e.shieldSprite?.setPosition(bp.x, bp.y).setAlpha(0.55 + 0.2 * beat);
    e.icon?.setPosition(bp.x, bp.y - e.h / 2 - 9);
    syncEnemyWand(e);
    syncBurning(b, e);
  }
  if (b.proj) {
    b.proj.sprite.setPosition(b.proj.body.position.x, b.proj.body.position.y);
    b.proj.sprite.setRotation(b.proj.body.angle + (b.proj.groundRotationOffset ?? 0));
    animateProj(b, b.proj);
  }
}
