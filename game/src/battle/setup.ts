// Creates the battle state for a level and wires the world, the physics listener and the input.
import Phaser from 'phaser';
import { BASE_W, W } from '../config/constants';
import { levelSettings } from '../config/settings';
import { events } from '../core/events';
import { profile } from '../core/profile';
import { slingMods } from '../core/slingshots';
import { forgeLimit, forgeSnapshot, isForgeWeapon } from '../core/forge';
import { createRng } from '../core/rng';
import { data } from '../data/load';
import { levelDef } from '../data/lookup';
import { homeCx, homeZoom, introPan, setupCameras, setView, zoomBy } from './camera';
import { kindFor } from '../content/levelKinds';
import { installArtifacts } from './artifacts';
import { buildConsumables } from './consumables';
import { makeCtx } from './ctxImpl';
import { groundAtPoints, normalizeTerrain } from './terrain';
import { onCollide } from './damage';
import { onDown, onMove, onUp, activateAbility, buildQueue, loadNext, setWeapon } from './sling';
import { buildWorld, populate } from './world';
import type { Level } from '../data/types';
import type { ArenaMods } from '../arena/types';
import type { BattleState, BattleUi } from './state';

const noUi: BattleUi = { setAbilityLabel() {}, showAbility() {}, setEscaped() {}, setTargeting() {}, consumableUsed() {}, setBossHp() {} };

/** The state for one battle. Scene objects (graphics, sprites, cameras) are filled in by `buildBattle`. */
export function createBattle(scene: Phaser.Scene, levelId: number, loadout: string[], customLevel?: Level, competitive = false, arenaMods?: ArenaMods, arenaSkin?: string | null): BattleState {
  const level = customLevel ? JSON.parse(JSON.stringify(customLevel)) as Level : levelDef(levelId);
  const settings = levelSettings(level, !competitive);
  const slingSkin = competitive ? arenaSkin ?? undefined : profile.equipped?.slingSkin;
  const slingCosmetic = competitive ? undefined : data.content.cosmetics?.find((c) => c.id === slingSkin);
  const campaignMods = slingMods(competitive ? undefined : slingCosmetic);
  const launchSpeedMult = competitive ? arenaMods?.launchSpeedMult ?? 1 : campaignMods.launchSpeedMult ?? 1;
  const twinFraction = competitive ? arenaMods?.twinFraction : campaignMods.twinFraction;
  const twinDelaySteps = competitive ? arenaMods?.twinDelaySteps ?? 12 : campaignMods.twinDelaySteps ?? 12;
  const slingDamageMult = campaignMods.damageMult ?? 1;
  // a level with a preset set of weapons is yours to replay with your own arsenal once you have cleared it
  const replayOwn = !!level.loadout && !customLevel && !competitive && (profile.stars?.[String(levelId)] ?? 0) > 0;
  let kept = 0;
  const cap = forgeLimit(level);
  const rawLoadout = (replayOwn ? loadout : level.loadout ?? loadout).filter((id) => data.content.weapons.some((w) => w.id === id) && (!isForgeWeapon(id) || settings.features.weaponForge));
  for (let i = 0; i < rawLoadout.length; i++) if (isForgeWeapon(rawLoadout[i]) && ++kept > cap) rawLoadout[i] = 'w_militia_blade'; // over the level's forged-weapon limit
  if (!rawLoadout.length) rawLoadout.push('w_militia_blade');
  const maxShots = level.shots ?? rawLoadout.length;
  const effectiveLoadout = rawLoadout.slice(0, Math.min(rawLoadout.length, maxShots));
  const b = {
    scene, ui: noUi, events, rng: createRng(competitive ? 1000 : level.id), content: data.content, level, levelId, custom: !!customLevel,
    arena: competitive ? { frames: 0, actions: [] } : undefined,
    loadout: effectiveLoadout, forgeWeapons: settings.features.weaponForge && !competitive ? forgeSnapshot() : {}, settings, tune: settings.tune, rules: settings.rules, stepMs: settings.stepMs,
    groundY: settings.world.groundY, slingX: settings.world.slingX, slingY: settings.world.slingY,
<<<<<<< HEAD
    worldW: level.worldW ?? BASE_W, maxSpeed: settings.tune.maxPull * settings.tune.launchK, terrain: [],
    mods: { damageMult: 1, serumShots: 0, serumMult: 1.2, coinMult: 1, previewMult: competitive ? arenaMods?.previewMult ?? 1 : 1, launchSpeedMult, twinFraction, twinDelaySteps },
=======
    worldW: level.worldW ?? W, maxSpeed: settings.tune.maxPull * settings.tune.launchK, terrain: [],
    mods: { damageMult: slingDamageMult, slingDamageMult, serumShots: 0, serumMult: 1.2, coinMult: 1,
      previewMult: competitive ? arenaMods?.previewMult ?? 1 : campaignMods.previewMult ?? 1,
      explosionRadiusMult: campaignMods.explosionRadiusMult ?? 1, poisonChance: campaignMods.poisonChance ?? 0, curseChance: campaignMods.curseChance ?? 0,
      launchSpeedMult, twinFraction, twinDelaySteps },
>>>>>>> claude/new-session-c737a3
    slingSkin, arenaDamageMult: competitive ? arenaMods?.damageMult ?? 1 : 1, artifacts: [], consumables: [], targeting: null, paused: false,
    ents: [], actors: [], proj: null, state: 'intro', shotIdx: 0, coins: 0, score: 0, chain: 0, chainT: 999, escaped: 0,
    steps: 0, acc: 0, hitStop: 0, settleSteps: 0, endTimer: 0, lastPop: 0, lastStretch: 0,
    pouch: new Phaser.Math.Vector2(settings.world.slingX, settings.world.slingY), queue: [], parts: [],
    view: { z: 1, cx: W / 2, free: false, pinchPrev: 0, panLast: null }, uiMode: false,
    inUi<T>(fn: () => T): T {
      b.uiMode = true;
      try {
        return fn();
      } finally {
        b.uiMode = false;
      }
    },
  } as unknown as BattleState;
  b.terrain = normalizeTerrain(level, b.worldW, b.groundY);
  // the sling stands on the ground wherever the level puts it (level.sling overrides)
  if (level.sling?.x !== undefined) b.slingX = level.sling.x;
  b.slingY = level.sling?.y ?? groundAtPoints(b.terrain, b.slingX) - (settings.world.groundY - settings.world.slingY);
  b.ctx = makeCtx(b);
  setWeapon(b, b.loadout[0]);
  b.view.z = homeZoom(b);
  b.view.cx = homeCx(b);
  if (!b.custom) buildConsumables(b);
  return b;
}

/** Builds the world and the sling. Call once from the scene's create(). */
export function buildBattle(b: BattleState): void {
  const s = b.scene;
  setupCameras(b);
  buildWorld(b);
  setView(b, b.view.z, b.view.cx);
  populate(b);
  b.gfx = s.add.graphics().setDepth(5);
  b.readySprite = s.add.image(b.slingX, b.slingY, b.wpn.texture).setDepth(6).setVisible(false);
  b.readySprite.setRotation(Math.PI / 4);
  buildQueue(b);
}

/** Hooks up physics collisions and input, then starts the intro. Call after the HUD exists. */
export function startBattle(b: BattleState): void {
  const s = b.scene;
  s.matter.world.on('collisionstart', (ev: unknown) => onCollide(b, ev));
  s.input.on('pointerdown', (p: Phaser.Input.Pointer, over: unknown[]) => onDown(b, p, over));
  s.input.on('pointermove', (p: Phaser.Input.Pointer) => onMove(b, p));
  s.input.on('pointerup', () => onUp(b));
  s.input.on('pointerupoutside', () => onUp(b));
  s.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
    if (b.paused || !b.settings.features.zoom) return;
    const factor = dy > 0 ? 0.88 : 1.14;
    zoomBy(b, factor, p.x);
  });
  s.input.addPointer(1);
  s.input.keyboard?.on('keydown-SPACE', (e: KeyboardEvent) => {
    e?.preventDefault?.();
    if (!b.paused) activateAbility(b);
  });
  if (!b.custom) installArtifacts(b);
  kindFor(b.level.kind)?.onStart?.(b.ctx, b.level);
  b.events.emit('level:start', { levelId: b.levelId, kind: b.level.kind ?? 'siege' });
  introPan(b, () => loadNext(b));
}
