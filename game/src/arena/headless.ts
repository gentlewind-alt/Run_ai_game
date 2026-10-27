import type Phaser from 'phaser';
import { MONSTER_ART } from '../art/textures';
import { createBattle } from '../battle/setup';
import { populate } from '../battle/world';
import { buildTerrain } from '../battle/terrain';
import { onCollide } from '../battle/damage';
import { update } from '../battle/loop';
import { activateAbility, buildQueue, launchFrom, loadNext } from '../battle/sling';
import { MatterLib as M } from '../battle/matter';
import { toLevel, validateDraft } from '../builder/document';
import { findDraftOverlaps } from '../builder/geometry';
import { initSettings } from '../config/settings';
import { events } from '../core/events';
import { WEAPONS } from '../content/weapons';
import { data } from '../data/load';
import type { Level } from '../data/types';
import { ARENA_MAX_ACTIONS, ARENA_MAX_FRAMES, type ArenaAction, type ArenaChallenge, type ArenaMods, type ArenaReplay, type ArenaResult } from './types';
export { ENGINE_VERSION } from './engineVersion.generated';
export const ARENA_CATALOG = data.content.arena;

const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid arena document.');
  return value as Record<string, unknown>;
};
const sizeOf = (type: string): { w: number; h: number } => ({ w: MONSTER_ART[type]?.w ?? 12, h: MONSTER_ART[type]?.h ?? 14 });
const knownWeapon = (id: unknown): id is string => typeof id === 'string' && data.content.weapons.some(w => w.id === id && w.enabled !== false && !!WEAPONS[String(w.params?.behavior ?? w.id)]);

/** Freeze the published UGC rules before either participant starts. */
export function prepareChallenge(row: unknown): ArenaChallenge {
  const payload = object(object(row).data);
  if (payload.v !== 1 || !Number.isInteger(payload.shots) || (payload.shots as number) < 3 || (payload.shots as number) > 8) throw new Error('Unsupported challenge rules.');
  const allowed = payload.allowed;
  if (!Array.isArray(allowed) || !allowed.length || allowed.length > data.content.weapons.length || !allowed.every(knownWeapon) || new Set(allowed).size !== allowed.length) throw new Error('The challenge needs known weapons.');
  const doc = validateDraft(payload.doc, data.content.builder, sizeOf);
  if (!doc.monsters.length || findDraftOverlaps(doc, sizeOf).length) throw new Error('The challenge needs targets and no overlaps.');
  return { doc, loadout: Array.from({ length: payload.shots as number }, (_v, i) => allowed[i % allowed.length] as string) };
}

export function arenaLevel(challenge: ArenaChallenge): Level {
  const { loadout } = challenge;
  if (!Array.isArray(loadout) || loadout.length < 3 || loadout.length > 8 || !loadout.every(knownWeapon)) throw new Error('Invalid arena loadout.');
  const doc = validateDraft(challenge.doc, data.content.builder, sizeOf);
  if (!doc.monsters.length || findDraftOverlaps(doc, sizeOf).length) throw new Error('Invalid arena layout.');
  return { ...toLevel(doc, data.content.builder, sizeOf), shots: loadout.length, loadout: loadout.slice() };
}

function replayActions(replay: ArenaReplay): ArenaAction[] {
  const raw = object(replay);
  if (!Number.isInteger(raw.frames) || (raw.frames as number) < 1 || (raw.frames as number) > ARENA_MAX_FRAMES || !Array.isArray(raw.actions) || raw.actions.length > ARENA_MAX_ACTIONS) throw new Error('Invalid turn replay.');
  let previous = 0;
  return raw.actions.map((value): ArenaAction => {
    const a = object(value);
    if (!Number.isInteger(a.frame) || (a.frame as number) < previous || (a.frame as number) >= (raw.frames as number)) throw new Error('Invalid input frame.');
    previous = a.frame as number;
    if (a.type === 'ability') return { type: 'ability', frame: previous };
    const minPower = data.content.tuning.minPull / data.content.tuning.maxPull;
    if (a.type !== 'fire' || typeof a.angle !== 'number' || !Number.isFinite(a.angle) || a.angle < -180 || a.angle > 180 || typeof a.power !== 'number' || !Number.isFinite(a.power) || a.power < minPower - 1e-6 || a.power > 1) throw new Error('Invalid shot input.');
    return { type: 'fire', frame: previous, angle: a.angle, power: a.power };
  });
}

/** Rendering has no authority: the same actors and physics run against inert drawing objects. */
function drawing(scene: unknown, x = 0, y = 0): any {
  const values: Record<string, any> = { x, y, width: 16, height: 16, scaleX: 1, scaleY: 1, rotation: 0, alpha: 1, active: true, visible: true, scene };
  const metadata = new Map<string, unknown>();
  const image: any = new Proxy(values, {
    get(target, key: string) {
      if (key === 'setData') return (name: string, value: unknown) => { metadata.set(name, value); return image; };
      if (key === 'getData') return (name: string) => metadata.get(name);
      if (key === 'destroy') return () => { values.active = false; };
      if (key === 'setPosition') return (px: number, py: number) => { values.x = px; values.y = py; return image; };
      if (key === 'setVisible') return (visible: boolean) => { values.visible = visible; return image; };
      if (key === 'setScale') return (sx: number, sy = sx) => { values.scaleX = sx; values.scaleY = sy; return image; };
      if (key === 'setDisplaySize') return (width: number, height: number) => { values.width = width; values.height = height; return image; };
      if (key in target) return target[key];
      return () => image;
    },
  });
  return image;
}

function headlessScene(): Phaser.Scene {
  const physics = data.config.physics;
  const engine = M.Engine.create({ enableSleeping: physics.enableSleeping, gravity: { x: 0, y: physics.gravityY }, positionIterations: physics.positionIterations, velocityIterations: physics.velocityIterations });
  let scene: any;
  const world = {
    engine,
    add: (body: unknown) => M.Composite.add(engine.world, body),
    remove: (body: unknown) => M.Composite.remove(engine.world, body),
    step: (dt: number) => M.Engine.update(engine, dt),
  };
  const body = (kind: 'rectangle' | 'circle', args: unknown[]): any => {
    const result = M.Bodies[kind](...args);
    world.add(result);
    return result;
  };
  scene = {
    matter: { world, add: { rectangle: (...args: unknown[]) => body('rectangle', args), circle: (...args: unknown[]) => body('circle', args) } },
    add: { image: (x: number, y: number) => drawing(scene, x, y), circle: (x: number, y: number) => drawing(scene, x, y), rectangle: (x: number, y: number) => drawing(scene, x, y), graphics: () => drawing(scene) },
    cameras: { main: drawing(null), add: () => drawing(null) },
    textures: { exists: () => true, get: () => ({ getSourceImage: () => ({ width: 16, height: 16 }) }) },
    tweens: { add() {}, addCounter() {}, killAll() {}, killTweensOf() {}, isTweening: () => false },
    events: { on() {}, off() {}, once() {} },
    children: { list: [] }, time: { now: 0, delayedCall() {} }, input: { setDefaultCursor() {} },
  };
  return scene as Phaser.Scene;
}

/** Scores only simulated inputs. A claimed score, winner or coin amount is never accepted. */
export function verifyReplay(challenge: ArenaChallenge, replay: ArenaReplay, mods: ArenaMods): ArenaResult {
  const actions = replayActions(replay);
  const level = arenaLevel(challenge);
  initSettings(data.config, data.content);
  events.clearBattle();
  events.beginBattle();
  const scene = headlessScene();
  const engine = scene.matter.world.engine;
  let battle: ReturnType<typeof createBattle> | undefined;
  try {
    const b = (battle = createBattle(scene, 1000, challenge.loadout, level, true, mods));
    buildTerrain(b);
    populate(b);
    b.gfx = scene.add.graphics();
    b.readySprite = scene.add.image(b.slingX, b.slingY, b.wpn.texture);
    buildQueue(b);
    loadNext(b);
    M.Events.on(engine, 'collisionStart', (event: unknown) => onCollide(b, event));
    let next = 0;
    // The room replays until the level ends. The browser may report a few frames more (the end-of-level pause before it submits),
    // so anything from the end frame onward is accepted as long as every recorded input was used before the level ended.
    while (b.arena!.frames < replay.frames && b.state !== 'won' && b.state !== 'lost') {
      while (next < actions.length && actions[next].frame === b.arena!.frames) {
        const action = actions[next++];
        const before = b.arena!.actions.length;
        if (action.type === 'fire') {
          if ((b.state !== 'ready' && b.state !== 'aiming') || b.shotIdx >= b.loadout.length) throw new Error('A shot was fired out of turn.');
          launchFrom(b, action.angle, action.power);
        } else activateAbility(b);
        if (b.arena!.actions.length !== before + 1) throw new Error('An ability was used when unavailable.');
      }
      (scene.time as unknown as { now: number }).now = b.arena!.frames * b.stepMs;
      update(b, b.stepMs, b.arena!.frames * b.stepMs);
    }
    if (next !== actions.length && (b.state === 'won' || b.state === 'lost')) throw new Error('Inputs continue after the turn ended.');
    if (next !== actions.length || (b.state !== 'won' && b.state !== 'lost') || !Number.isSafeInteger(b.score) || b.score < 0) throw new Error('The turn replay is incomplete.');
    return { cleared: b.state === 'won', score: b.score, shotsUsed: b.shotIdx, steps: b.steps, forfeit: false };
  } finally {
    battle?.connections?.destroy();
    M.Events.off(engine);
    M.Composite.clear(engine.world, false);
    M.Engine.clear(engine);
    events.clearBattle();
  }
}
