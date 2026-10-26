import type Phaser from 'phaser';
import { C, css } from '../art/palette';
import { blockKey, makeBattleTextures } from '../art/textures';
import { MatterLib as M } from '../battle/matter';
import { data } from '../data/load';
import type { LevelBlock, LevelConnection } from '../data/types';
import { blockParts } from './geometry';

type Point = { x: number; y: number };
const rotate = (p: Point, angle: number): Point => ({
  x: p.x * Math.cos(angle) - p.y * Math.sin(angle),
  y: p.x * Math.sin(angle) + p.y * Math.cos(angle),
});

/** Shared construction geometry for editing, simulation and actual battles. */
export function createBlockBody(scene: Phaser.Scene, block: LevelBlock): any {
  const material = data.content.materials.find((m) => m.id === block.m)!;
  const options = {
    density: material.density ?? 0.001, friction: material.friction ?? 0.7,
    frictionStatic: 1, restitution: 0.05, isStatic: block.static ?? false, label: 'block',
  };
  let body: any;
  if (!block.variant && (!block.shape || block.shape === 'rectangle')) {
    body = M.Bodies.rectangle(block.x, block.y, block.w, block.h, options);
  } else {
    const partOptions = { ...options, isStatic: false };
    const parts = blockParts(block).map((part) => {
      if (part.kind === 'circle') return M.Bodies.circle(block.x + part.x, block.y + part.y, part.r, partOptions);
      const vertices = part.vertices.map((p) => ({ ...p }));
      const centre = M.Vertices.centre(vertices);
      return M.Bodies.fromVertices(block.x + centre.x, block.y + centre.y, [vertices], partOptions);
    });
    body = parts.length === 1 ? parts[0] : M.Body.create({ ...partOptions, parts });
    // Keep the authoring origin while leaving every collision vertex in place.
    M.Body.setCentre(body, { x: block.x, y: block.y });
    if (block.static) M.Body.setStatic(body, true);
  }
  body.builderShape = block.shape ?? 'rectangle';
  body.builderVariant = block.variant;
  M.Body.setAngle(body, (block.angle ?? 0) * Math.PI / 180);
  scene.matter.world.add(body);
  return body;
}

export function blockTextureKey(block: Pick<LevelBlock, 'm' | 'w' | 'h' | 'shape' | 'variant'>, cracked = false): string {
  const key = blockKey(block.m, block.w, block.h, cracked);
  const shaped = block.shape && block.shape !== 'rectangle' ? `${key}_${block.shape}` : key;
  return block.variant ? `${shaped}_${block.variant}` : shaped;
}

export function ensureBlockTextures(scene: Phaser.Scene, blocks: LevelBlock[]): void {
  makeBattleTextures(scene, blocks.filter((b) => !b.variant && (!b.shape || b.shape === 'rectangle')));
  const tones: Record<string, string[]> = { wood: ['i', 'g', 'h'], stone: ['l', 'k', 'm'], iron: ['c', 'e', 'f'], crystal: ['c', 'b', 'a'] };
  for (const block of blocks) {
    if (!block.variant && (!block.shape || block.shape === 'rectangle')) continue;
    for (const cracked of [false, true]) {
      const key = blockTextureKey(block, cracked);
      if (scene.textures.exists(key)) continue;
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(block.w);
      canvas.height = Math.ceil(block.h);
      const g = canvas.getContext('2d')!;
      const [light, fill, shade] = tones[block.m] ?? tones.wood;
      g.beginPath();
      if (block.variant) {
        for (const part of blockParts(block)) {
          if (part.kind === 'circle') {
            const x = part.x + block.w / 2, y = part.y + block.h / 2;
            g.moveTo(x + part.r, y);
            g.arc(x, y, part.r, 0, Math.PI * 2);
          } else {
            part.vertices.forEach((p, i) => {
              if (i === 0) g.moveTo(p.x + block.w / 2, p.y + block.h / 2);
              else g.lineTo(p.x + block.w / 2, p.y + block.h / 2);
            });
          }
          g.closePath();
        }
      } else if (block.shape === 'circle') g.arc(block.w / 2, block.h / 2, block.w / 2 - 0.5, 0, Math.PI * 2);
      else { g.moveTo(block.w / 2, 0.5); g.lineTo(block.w - 0.5, block.h - 0.5); g.lineTo(0.5, block.h - 0.5); g.closePath(); }
      g.fillStyle = css(C(fill));
      g.fill();
      g.strokeStyle = css(C('v'));
      g.lineWidth = 1;
      g.stroke();
      g.clip();
      g.fillStyle = css(C(light));
      g.fillRect(2, 3, block.w - 4, 2);
      g.fillStyle = css(C(shade));
      g.fillRect(2, block.h - 4, block.w - 4, 2);
      if (block.variant?.startsWith('wheel')) {
        const wheel = blockParts(block).find((part) => part.kind === 'circle');
        if (wheel?.kind === 'circle') {
          const x = wheel.x + block.w / 2, y = wheel.y + block.h / 2;
          g.strokeStyle = css(C(light));
          g.beginPath();
          for (let i = 0; i < 4; i++) {
            const angle = i * Math.PI / 4;
            const dx = Math.cos(angle) * (wheel.r - 2), dy = Math.sin(angle) * (wheel.r - 2);
            g.moveTo(x - dx, y - dy); g.lineTo(x + dx, y + dy);
          }
          g.stroke();
          g.beginPath(); g.arc(x, y, Math.max(2, wheel.r / 5), 0, Math.PI * 2);
          g.fillStyle = css(C(shade)); g.fill();
          g.strokeStyle = css(C('v')); g.stroke();
        }
      }
      if (cracked) {
        g.strokeStyle = css(C('v'));
        g.beginPath(); g.moveTo(block.w * 0.6, 0); g.lineTo(block.w * 0.4, block.h * 0.5); g.lineTo(block.w * 0.6, block.h); g.stroke();
      }
      scene.textures.addCanvas(key, canvas);
    }
  }
}

interface ConnectionRecord { def: LevelConnection; bodyA: any; bodyB: any; constraints: any[] }

/** Rigid two-pin locks, rotating pins and strings that exert tension only. */
export function installConnections(scene: Phaser.Scene, byId: Map<string, any>, connections: LevelConnection[]) {
  const world = scene.matter.world.engine.world;
  const engine = scene.matter.world.engine;
  const config = data.content.builder.physics;
  let records: ConnectionRecord[] = [];
  let destroyed = false;
  const endpoint = (body: any, point: Point): Point => {
    if (!body) return { ...point };
    const offset = rotate(point, body.angle);
    return { x: body.position.x + offset.x, y: body.position.y + offset.y };
  };
  for (const def of connections) {
    const bodyA = def.a === null ? null : byId.get(def.a);
    const bodyB = byId.get(def.b);
    if (!bodyB || (def.a !== null && !bodyA) || bodyA === bodyB) continue;
    const a = endpoint(bodyA, def.pointA);
    const b = endpoint(bodyB, def.pointB);
    const constraints: any[] = [];
    if (def.type === 'lock') {
      if (!bodyA) continue;
      for (const sign of [-1, 1]) {
        const at = { x: (a.x + b.x) / 2 + sign * config.lockSpan / 2, y: (a.y + b.y) / 2 };
        constraints.push(M.Constraint.create({
          bodyA, bodyB,
          pointA: { x: at.x - bodyA.position.x, y: at.y - bodyA.position.y },
          pointB: { x: at.x - bodyB.position.x, y: at.y - bodyB.position.y },
          length: 0, stiffness: config.lockStiffness,
        }));
      }
    } else {
      constraints.push(M.Constraint.create({
        bodyA, bodyB,
        pointA: bodyA ? { x: a.x - bodyA.position.x, y: a.y - bodyA.position.y } : a,
        pointB: { x: b.x - bodyB.position.x, y: b.y - bodyB.position.y },
        length: def.type === 'pin' ? 0 : def.length ?? Math.hypot(b.x - a.x, b.y - a.y),
        stiffness: def.type === 'pin' ? 1 : config.ropeStiffness,
        damping: def.type === 'pin' ? 0 : config.ropeDamping,
      }));
    }
    M.Composite.add(world, constraints);
    records.push({ def, bodyA, bodyB, constraints });
  }
  const beforeUpdate = (): void => {
    for (const r of records) {
      if (r.def.type !== 'rope') continue;
      const c = r.constraints[0];
      const a = endpoint(r.bodyA, r.def.pointA);
      const b = endpoint(r.bodyB, r.def.pointB);
      c.stiffness = Math.hypot(b.x - a.x, b.y - a.y) >= c.length ? config.ropeStiffness : 0;
      c.damping = c.stiffness > 0 ? config.ropeDamping : 0;
    }
  };
  M.Events.on(engine, 'beforeUpdate', beforeUpdate);
  const remove = (record: ConnectionRecord): void => {
    for (const c of record.constraints) M.Composite.remove(world, c);
    for (const body of [record.bodyA, record.bodyB]) if (body && !body.isStatic) M.Sleeping.set(body, false);
  };
  const api = {
    draw(g: Phaser.GameObjects.Graphics): void {
      for (const r of records) {
        const a = endpoint(r.bodyA, r.def.pointA);
        const b = endpoint(r.bodyB, r.def.pointB);
        g.lineStyle(2, C(r.def.type === 'rope' ? 'i' : '4'), 1);
        if (r.def.type === 'rope') {
          const span = Math.hypot(b.x - a.x, b.y - a.y);
          const sag = Math.sqrt(Math.max(0, r.constraints[0].length ** 2 - span ** 2)) / 2;
          g.beginPath(); g.moveTo(a.x, a.y);
          for (let i = 1; i <= 12; i++) {
            const t = i / 12;
            g.lineTo(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t + sag * 4 * t * (1 - t));
          }
          g.strokePath();
          if (!r.bodyA) g.fillStyle(C('c')).fillCircle(a.x, a.y, 3);
        } else if (r.def.type === 'pin') {
          g.lineBetween(a.x, a.y, b.x, b.y);
          g.strokeCircle(a.x, a.y, 4);
          g.fillStyle(C('c')).fillCircle(a.x, a.y, 1.5);
        } else {
          g.lineBetween(a.x, a.y, b.x, b.y);
          g.fillStyle(C('4')).fillCircle((a.x + b.x) / 2, (a.y + b.y) / 2, 3);
        }
      }
    },
    removeBody(body: any): void {
      body = body.parent ?? body;
      records = records.filter((record) => {
        if (record.bodyA !== body && record.bodyB !== body) return true;
        remove(record);
        return false;
      });
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      M.Events.off(engine, 'beforeUpdate', beforeUpdate);
      for (const record of records) remove(record);
      records = [];
      scene.events.off('shutdown', api.destroy);
    },
  };
  scene.events.once('shutdown', api.destroy);
  return api;
}
