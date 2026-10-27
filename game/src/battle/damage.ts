// The damage pipeline: collisions in, HP and kills out. This is the only place that computes damage.
import Phaser from 'phaser';
import { C } from '../art/palette';
import { pixText } from '../art/pix';
import { sfx } from '../audio/sfx';
import { profile, upgradeMult } from '../core/profile';
import { materialDef } from '../data/lookup';
import { battleWeapon } from './weapon';
import { forgeHit } from './forgeHits';
import { carveSand, sandCfg } from './sand';
import { weaponImpl } from '../content/weapons';
import { blockTextureKey } from '../builder/physics';
import { artifactMult } from './artifacts';
import { announce, comboMult, registerKill } from './combo';
import { burst, popWord, ring } from './fx';
import { MatterLib } from './matter';
import { addCoins, addScore } from './score';
import { inflict } from './status';
import type { DamageOpts, DamageTag, Ent } from './BattleCtx';
import type { BattleState } from './state';

function elementMult(b: BattleState, t: Ent, element: string): number {
  const d = b.rules;
  return t.weak === element ? d.elementWeak : t.resist === element ? d.elementResist : 1;
}

/** damage = baseDamage x forge upgrade x impact x element x combo x global scale x the shot's own multiplier. */
function weaponDamage(b: BattleState, t: Ent, wid: string, impactFactor: number, mul: number): { dmg: number; tag: DamageTag } {
  const w = battleWeapon(b, wid);
  const el = elementMult(b, t, w.element);
  const dmg = w.baseDamage * (b.arena ? 1 : upgradeMult(wid)) * impactFactor * el * comboMult(b) * b.rules.globalScale * mul * b.mods.damageMult * artifactMult(b, { weaponId: wid, target: t });
  return { dmg, tag: el > 1 ? 'weak' : el < 1 ? 'resist' : 'norm' };
}

// ------------------------------------------------------------------ collisions

/** Collision pairs from the physics step: projectile hits and debris/fall impacts. */
export function onCollide(b: BattleState, ev: any): void {
  const seen = new Set<string>();
  for (const pr of ev.pairs) {
    const A = pr.bodyA.parent ?? pr.bodyA;
    const B = pr.bodyB.parent ?? pr.bodyB;
    const pair = A.id < B.id ? `${A.id}:${B.id}` : `${B.id}:${A.id}`;
    if (seen.has(pair)) continue;
    seen.add(pair);
    if (A.label === 'enemyAttack' || B.label === 'enemyAttack') {
      (A.label === 'enemyAttack' ? A : B).enemySpent = true;
      continue;
    }
    const aProj = A.label === 'proj';
    const bProj = B.label === 'proj';
    if (aProj && bProj) continue;
    const rel = Math.hypot(A.velocity.x - B.velocity.x, A.velocity.y - B.velocity.y);
    const sup = pr.collision?.supports?.[0];
    const cx = sup ? sup.x : (A.position.x + B.position.x) / 2;
    const cy = sup ? sup.y : (A.position.y + B.position.y) / 2;
    if (aProj || bProj) {
      projContact(b, aProj ? A : B, aProj ? B : A, rel, cx, cy);
      continue;
    }
    if (rel < b.tune.debrisMinSpeed) continue;
    impact(b, A.ent, B.ent, B, rel, cx, cy);
    impact(b, B.ent, A.ent, A, rel, cx, cy);
  }
}

function projContact(b: BattleState, pb: any, ob: any, rel: number, x: number, y: number): void {
  const info = pb.proj;
  if (b.sand && ob.label === 'ground' && !info.dug) { // a shot digs once, where it first lands hard
    const k = sandCfg();
    if (rel > k.digSpeed) { info.dug = true; carveSand(b, x, y, Math.min(k.hitCraterMax, k.hitCrater + (rel - k.digSpeed) * 0.5)); }
  }
  const t: Ent | undefined = ob.ent;
  const p = b.proj && b.proj.body === pb ? b.proj : info.forgeProj ?? null;
  if (p) {
    if (p.data.ended) return;
    const impl = p === b.proj ? b.wpn : weaponImpl(p.def);
    const hit = { target: t, rel, x, y };
    if (!p.tapped && p.def.ability.mode !== 'button' && impl.onImpact) {
      p.tapped = true;
      impl.onImpact(b.ctx, p, hit);
      return;
    } else if (impl.onImpact) {
      impl.onImpact(b.ctx, p, hit);
    }
    if (p.data.ended) return;
    if (p.tapped && impl.onPostImpact && !p.data.postDone) {
      p.data.postDone = true;
      impl.onPostImpact(b.ctx, p);
    }
  }
  // piercing: solid things stop it
  if (info.pierce > 0) {
    const soft = t && (t.kind === 'monster' || t.type === 'wood');
    if (!soft) {
      pb.isSensor = false;
      info.pierce = 0;
    } else if (!info.hit.has(ob.id)) {
      info.hit.add(ob.id);
      info.pierce--;
      if (info.pierce <= 0) pb.isSensor = false;
    } else {
      return;
    }
  }
  if (!t || t.dead) return;
  if (rel < b.tune.projMinSpeed && !info.status) return;
  if (t.def?.boss) {
    const last = (info.lastHit ??= {});
    if (b.steps - (last[ob.id] ?? -1e9) < b.tune.bossRehitSteps) return;
    last[ob.id] = b.steps;
  }
  const R = b.rules;
  const { dmg, tag } = weaponDamage(b, t, info.wid, Phaser.Math.Clamp(b.tune.impactBase + rel / b.maxSpeed, R.impactFactorMin, R.impactFactorMax), info.mul);
  if (info.status && t.kind === 'monster') {
    const P = battleWeapon(b, info.wid).params;
    if (info.status === 'knock') MatterLib.Body.setVelocity(t.body, { x: pb.velocity.x * P.knockMult, y: pb.velocity.y * P.knockMult - P.knockLift });
    else inflict(b, t, info.status, P.statusSteps);
  }
  if (dmg >= 1) forgeHit(b, t, info.wid, dmg, x, y, { strong: info.owner === 'main', tag });
}

/** Impacts between non-projectile bodies: falling bodies and debris hurt, and monsters feel every landing. */
function impact(b: BattleState, target: Ent | undefined, other: Ent | undefined, ob: any, rel: number, x: number, y: number): void {
  if (!target || target.dead || target.cool > 0) return;
  const T = b.tune;
  let dmg = 0;
  if (other) {
    const mass = other.body.isStatic
      ? (materialDef(other.type)?.density ?? other.body._original.density) * other.body.area
      : other.body.mass;
    dmg = (rel - T.debrisMinSpeed) * Math.sqrt(mass) * T.debrisK * (target.kind === 'monster' ? 1 : T.blockDebrisFactor);
    if (target.kind === 'monster' && other.kind === 'block') dmg = Math.max(dmg, (rel - T.fallThreshold) * T.fallK);
  } else if (ob.label === 'ground' && target.kind === 'monster') {
    dmg = (rel - T.fallThreshold) * T.fallK;
  } else {
    return;
  }
  if (dmg >= T.minImpactDamage) damage(b, target, dmg, x, y, { strong: false, tag: 'norm', fall: !other || other.kind === 'block' });
}

// ------------------------------------------------------------------ applying damage

export function damage(b: BattleState, t: Ent, dmgIn: number, x: number, y: number, o: DamageOpts): void {
  if (t.dead) return;
  let dmg = dmgIn * (t.status.curse > 0 ? b.tune.status.curseMult : 1);
  if (t.shield > 0) {
    const ab = Math.min(t.shield, dmg);
    t.shield -= ab;
    dmg -= ab;
    burst(b, x, y, ['b', 'c'], 3);
    if (t.shield <= 0) {
      t.shieldSprite?.destroy();
      t.shieldSprite = undefined;
    }
    if (dmg <= 0) return;
  }
  if (!o.ignoreArmour) dmg = t.behavior?.onDamaged?.(b.ctx, t, dmg) ?? dmg;
  t.hp -= dmg;
  t.cool = b.tune.hitCooldownSteps;
  t.hurt = 14;
  t.flash = 3;
  b.events.emit('hit', { target: t, amount: dmg, x, y, quiet: o.quiet, fall: o.fall });
  if (t.kind === 'monster' && !t.icon && t.weak) t.icon = b.scene.add.image(x, y, `el_${t.weak}`).setDepth(8);
  if (!o.quiet) {
    const shown = Math.max(1, Math.round(dmg));
    const color = o.tag === 'weak' ? C('4') : o.tag === 'resist' ? C('e') : C('c');
    const scale = o.tag === 'weak' ? 2 : 1;
    const ft = pixText(b.scene, x, y - 6, String(shown), color, scale).setDepth(12);
    b.scene.tweens.add({ targets: ft, y: y - 22, alpha: 0, duration: 650, onComplete: () => ft.destroy() });
    if (dmg >= 22 || o.fall) {
      popWord(
        b, x, y - 14,
        t.kind === 'monster'
          ? (o.fall ? 'thud!' : 'bonk!')
          : t.type === 'wood'
            ? 'crack!'
            : t.type === 'iron'
              ? 'clank!'
              : t.type === 'crystal'
                ? 'shatter!'
                : 'clonk!',
      );
    }
    if (dmg >= 12) ring(b, x, y, 6 + Math.min(14, dmg / 3), C('c'));
  }
  const colors = t.kind === 'monster'
    ? ['5', '6', '2']
    : t.type === 'wood'
      ? ['g', 'i', 'h']
      : t.type === 'iron'
        ? ['c', 'd', 'e', 'f']
        : t.type === 'crystal'
          ? ['b', 'c', '4', 'a']
          : ['k', 'l', 'm'];
  burst(b, x, y, colors, Math.min(10, 3 + Math.round(dmg / 6)));
  if (!o.silent) sfx.hit(Math.min(1, dmg / 40));
  if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) b.scene.cameras.main.shake(90, Phaser.Math.Clamp((dmg / 40) * 0.012, 0.002, 0.014));
  if (o.strong) b.hitStop = Math.max(b.hitStop, b.tune.hitStopFrames);

  if (t.hp <= 0) kill(b, t, o.silent, o.weaponId);
  else if (t.kind === 'block' && t.hp < t.maxHp * 0.5) {
    t.sprite.setTexture(blockTextureKey({ m: t.type, w: t.w, h: t.h, shape: t.body.builderShape, variant: t.body.builderVariant }, true));
  }
}

/** Removes a dead entity's body and sprites. */
export function discard(b: BattleState, t: Ent): void {
  t.dead = true;
  b.connections?.removeBody(t.body);
  b.scene.matter.world.remove(t.body);
  t.sprite.destroy();
  t.shieldSprite?.destroy();
  t.icon?.destroy();
}

function kill(b: BattleState, t: Ent, silent = false, weaponId?: string): void {
  const px = t.body.position.x;
  const py = t.body.position.y;
  discard(b, t);
  const colors = t.kind === 'monster'
    ? ['5', '6', '4', '2']
    : t.kind === 'chest'
      ? ['g', 'h', 'i', '4', 'c']
      : t.type === 'wood'
        ? ['g', 'i', 'h']
        : t.type === 'iron'
          ? ['c', 'd', 'e', 'f']
          : t.type === 'crystal'
            ? ['b', 'c', '4', 'a']
            : ['k', 'l', 'm'];
  burst(b, px, py, colors, 14);
  if (!silent) sfx.crunch();
  b.hitStop = Math.max(b.hitStop, b.tune.hitStopFrames);
  const coins = b.tune.coins;

  if (t.kind === 'chest') {
    sfx.unlock();
    const rewardId = t.reward || String(t.params?.reward ?? '');
    if (rewardId && !b.custom) {
      if (!profile.owned.weapons.includes(rewardId)) {
        profile.owned.weapons.push(rewardId);
        b.relicUnlocked = rewardId;
        popWord(b, px, py - 14, 'Relic found!');
      } else {
        const fallbackCoins = b.tune.coins.chestFallback ?? 150;
        addCoins(b, fallbackCoins);
        popWord(b, px, py - 14, `+${fallbackCoins} coins!`);
      }
    }
  } else {
    const reward = t.kind === 'monster' ? coins[t.type] ?? coins.monster : coins[t.type] ?? coins.stone;
    const coinMult = weaponId ? battleWeapon(b, weaponId)?.params.coinMult ?? 1 : 1;
    addCoins(b, Math.round(reward * coinMult));
    if (!silent) sfx.coin();
  }
  b.events.emit('kill', { target: t, x: px, y: py });

  if (t.kind === 'monster') {
    if (t.def?.boss && !b.custom) {
      const bossRelic = b.content.weapons.find(
        (w) => typeof w.unlock === 'object' && w.unlock.boss === t.type
      );
      if (bossRelic && !profile.owned.weapons.includes(bossRelic.id)) {
        profile.owned.weapons.push(bossRelic.id);
        b.relicUnlocked = bossRelic.id;
        popWord(b, px, py - 20, 'RELIC FOUND!');
        sfx.unlock();
      }
    }
    popWord(b, px, py - 12, 'splat!');
    registerKill(b);
    addScore(b, Math.round((b.tune.points[t.type] ?? 100) * comboMult(b)), px, py);
    announce(b);
    t.behavior?.onDeath?.(b.ctx, t);
  } else if (t.kind !== 'chest') {
    addScore(b, b.tune.points[t.type] ?? 10, px, py - 6, true);
  }
  // Sleeping bodies don't wake when a support is removed.
  for (const e of b.ents) if (!e.dead) MatterLib.Sleeping.set(e.body, false);
}

// ------------------------------------------------------------------ area and direct damage (weapons call these)

/** Damage from a weapon that is not a physical collision (bolts, saw ticks, blasts). */
export function directHit(b: BattleState, t: Ent, wid: string, mul: number, x: number, y: number, strong = true): void {
  const { dmg, tag } = weaponDamage(b, t, wid, 1, mul);
  if (dmg >= 1) forgeHit(b, t, wid, dmg, x, y, { strong, tag });
}

export function damageAround(b: BattleState, x: number, y: number, r: number, factor: number, wid: string): void {
  const hits = MatterLib.Query.region(MatterLib.Composite.allBodies(b.scene.matter.world.engine.world), {
    min: { x: x - r, y: y - r }, max: { x: x + r, y: y + r },
  });
  const seen = new Set<Ent>();
  for (const o of hits) {
    const t: Ent | undefined = o.ent ?? o.parent?.ent;
    if (!t || t.dead || seen.has(t)) continue;
    seen.add(t);
    directHit(b, t, wid, factor, x, y, false);
  }
}

/** Radial damage that falls off with distance, with a push. wid null = non-weapon (bomber). */
export function explode(b: BattleState, x: number, y: number, r: number, base: number, exclude: Ent | null, wid: string | null): void {
  if (b.sand) carveSand(b, x, y + r * 0.2, r * 0.85);
  ring(b, x, y, r, C('4'));
  ring(b, x, y, r * 0.6, C('3'));
  burst(b, x, y, ['4', '3', '2', 'c'], 18);
  if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) b.scene.cameras.main.shake(180, 0.014);
  b.hitStop = Math.max(b.hitStop, b.tune.explosionHitStop);
  sfx.crunch();
  popWord(b, x, y - 10, 'boom!');
  for (const e of b.ents) {
    if (e.dead || e === exclude) continue;
    const bp = e.body.position;
    const d = Phaser.Math.Distance.Between(x, y, bp.x, bp.y) - Math.max(e.w, e.h) / 2;
    if (d > r) continue;
    const fall = 1 - (b.tune.explosionFalloff * Math.max(0, d)) / r;
    let dmg = base * fall;
    let tag: DamageTag = 'norm';
    if (wid) {
      const el = elementMult(b, e, battleWeapon(b, wid).element);
      dmg *= el * comboMult(b) * b.rules.globalScale;
      tag = el > 1 ? 'weak' : el < 1 ? 'resist' : 'norm';
    }
    if (wid && battleWeapon(b, wid).forge) {
      dmg *= b.mods.damageMult * artifactMult(b, { weaponId: wid, target: e });
      forgeHit(b, e, wid, dmg, bp.x, bp.y, { strong: false, tag });
    } else damage(b, e, dmg, bp.x, bp.y, { strong: false, tag });
  }
  push(b, x, y, r, b.tune.explosionPush);
}

export function blast(b: BattleState, x: number, y: number, r: number, mul: number, wid: string): void {
  explode(b, x, y, r, battleWeapon(b, wid).baseDamage * (b.arena ? 1 : upgradeMult(wid)) * mul, null, wid);
}

/** Push everything near (x, y) away: strength is the velocity change in px/step. */
export function push(b: BattleState, x: number, y: number, r: number, strength: number): void {
  for (const e of b.ents) {
    if (e.dead) continue;
    const bp = e.body.position;
    const d = Phaser.Math.Distance.Between(x, y, bp.x, bp.y);
    if (d > r || d < 0.01) continue;
    MatterLib.Sleeping.set(e.body, false);
    const k = (strength * (1 - d / r) * e.body.mass) / (b.stepMs * b.stepMs);
    MatterLib.Body.applyForce(e.body, bp, { x: ((bp.x - x) / d) * k, y: ((bp.y - y) / d) * k - 0.4 * k });
  }
}
