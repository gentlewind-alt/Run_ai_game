// Verify cell occupancy and pointer placement independently of the Phaser editor.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/builder/grid.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { cellAt, quarterTurn, gridBlock, gridTarget } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const config = { grid: 8, minX: 112, minY: 64, worldW: 640, groundY: 320 };
const plank = { id: 'plank', m: 'wood', x: 0, y: 0, w: 64, h: 8, angle: 0 };
const copy = structuredClone(plank);

assert.deepEqual(cellAt({ x: 112, y: 64 }, config), { x: 112, y: 64, w: 8, h: 8 });
assert.deepEqual(cellAt({ x: 119.999, y: 71.999 }, config), { x: 112, y: 64, w: 8, h: 8 });
assert.deepEqual(cellAt({ x: 120, y: 72 }, config), { x: 120, y: 72, w: 8, h: 8 });
assert.deepEqual(cellAt({ x: 639.99, y: 319.99 }, config), { x: 632, y: 312, w: 8, h: 8 });
for (const point of [{ x: 111.99, y: 64 }, { x: 112, y: 63.99 }, { x: 640, y: 64 }, { x: 112, y: 320 }]) assert.equal(cellAt(point, config), undefined);

const horizontal = gridBlock(plank, { x: 144, y: 316 }, config);
const beside = gridBlock(plank, { x: 208, y: 316 }, config);
assert.deepEqual({ x: horizontal.x, y: horizontal.y, angle: horizontal.angle }, { x: 144, y: 316, angle: 0 });
assert.equal(horizontal.x + 32, beside.x - 32);
assert.equal(horizontal.y + 4, config.groundY);
const stacked = gridBlock(plank, { x: 144, y: 308 }, config);
assert.equal(stacked.y + 4, horizontal.y - 4);

const vertical = gridBlock({ ...plank, angle: quarterTurn(0) }, { x: 116, y: 288 }, config);
const nextPost = gridBlock({ ...plank, angle: 90 }, { x: 124, y: 288 }, config);
assert.deepEqual({ x: vertical.x, y: vertical.y, angle: vertical.angle }, { x: 116, y: 288, angle: 90 });
assert.equal(vertical.x + 4, nextPost.x - 4);
assert.equal(vertical.y + 32, config.groundY);
let turned = horizontal;
for (let i = 0; i < 4; i++) turned = gridBlock({ ...turned, angle: quarterTurn(turned.angle) }, { x: 144, y: 316 }, config);
assert.deepEqual(turned, horizontal);
assert.equal(quarterTurn(0, -1), 270);
assert.equal(quarterTurn(270), 0);
assert.equal(quarterTurn(15), 90);
assert.equal(quarterTurn(350), 90);

const fractional = gridBlock(plank, { x: 145.2, y: 314.7 }, config);
assert.deepEqual(fractional, horizontal);
assert.deepEqual(plank, copy);
assert.deepEqual(gridBlock(plank, { x: 145.2, y: 314.7 }, config), fractional);
const outside = gridBlock(plank, { x: 110, y: 62 }, config);
assert.ok(outside.x - 32 < config.minX && outside.y - 4 < config.minY, 'placement must not clamp a rejected pointer position');

for (const shape of ['rectangle', 'circle', 'triangle']) {
  const block = { ...plank, shape, w: shape === 'circle' ? 24 : 32, h: 24, angle: 92 };
  const placed = gridBlock(block, { x: 304.6, y: 201.8 }, config);
  assert.equal(placed.angle, 90);
  assert.equal((placed.x - block.h / 2 - config.minX) % config.grid, 0);
  assert.equal((placed.y - block.w / 2 - config.minY) % config.grid, 0);
}

const target = { t: 'goblin_grunt', x: 0, y: 0, dir: -1, delay: 2 };
const targetBefore = structuredClone(target);
assert.deepEqual(gridTarget(target, { x: 144, y: 313 }, { w: 12, h: 14 }, config), { ...target, x: 148, y: 313 });
const boss = gridTarget({ t: 'frost_giant', x: 0, y: 0 }, { x: 300.25, y: 297 }, { w: 36, h: 46 }, config);
assert.equal(boss.x, 300);
assert.equal(boss.y + 23, config.groundY);
const oddHeight = gridTarget(target, { x: 199.5, y: 178.1 }, { w: 18, h: 21 }, config);
assert.equal((oddHeight.y + 10.5 - config.minY) % config.grid, 0);
assert.deepEqual(target, targetBefore);
console.log('check-builder-grid: boxed cells, adjacent footprints, quarter-turn rotation, pointer snapping and target feet passed');
