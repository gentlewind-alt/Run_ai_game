import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/builder/geometry.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { blockParts, blockBounds, pointInBlock, closestBlockPoint, localToWorld, worldToLocal, blocksOverlap, snapBlock, findDraftOverlaps, dropDistance, closestPair, touchOffset } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const block = (overrides = {}) => ({ m: 'wood', x: 0, y: 0, w: 24, h: 24, shape: 'rectangle', ...overrides });
const close = (actual, expected, tolerance = 1e-5) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should equal ${expected}`);
const closePoint = (actual, expected, tolerance) => { close(actual.x, expected.x, tolerance); close(actual.y, expected.y, tolerance); };

const rotated = block({ w: 40, h: 8, angle: 37 });
const adjacent = block({ ...localToWorld(rotated, { x: 0, y: 8 }), w: 40, h: 8, angle: 37 });
assert.equal(blocksOverlap(rotated, adjacent), false, 'rotated sides may touch');
assert.equal(blocksOverlap(rotated, { ...adjacent, ...localToWorld(rotated, { x: 0, y: 7.99 }) }), true, 'positive penetration is an overlap');
assert.equal(blocksOverlap(block(), block({ x: 24, y: 24 })), false, 'corners may touch');
const circle = block({ shape: 'circle' });
assert.equal(blocksOverlap(circle, block({ shape: 'circle', x: 24 })), false);
assert.equal(blocksOverlap(circle, block({ shape: 'circle', x: 23.99 })), true);
assert.equal(blocksOverlap(circle, block({ x: 14, y: 14, w: 4, h: 4 })), false, 'circle bounding-box corners are empty');
assert.equal(blocksOverlap(circle, block({ x: 13, y: 0, w: 4, h: 4 })), true);
assert.equal(blocksOverlap(circle, block({ x: 14, y: 0, w: 4, h: 4 })), false, 'circle and polygon may touch');
const tangentCorner = 12 / Math.sqrt(2) + 2;
assert.equal(blocksOverlap(circle, block({ x: tangentCorner, y: tangentCorner, w: 4, h: 4 })), false, 'circle and polygon corner may touch');
assert.equal(blocksOverlap(circle, block({ x: tangentCorner - 0.01, y: tangentCorner - 0.01, w: 4, h: 4 })), true);
const triangle = block({ shape: 'triangle' });
assert.equal(pointInBlock(triangle, { x: -10, y: -10 }), false);
assert.equal(blocksOverlap(triangle, block({ x: -9, y: -9, w: 4, h: 4 })), false, 'triangle empty bounding-box corner stays empty');
assert.equal(blocksOverlap(triangle, block({ x: 0, y: 8, w: 4, h: 4 })), true);
const frame = block({ variant: 'hollow', w: 32, h: 32 });
assert.equal(blockParts(frame).length, 4);
assert.equal(pointInBlock(frame, { x: 0, y: 0 }), false);
assert.equal(pointInBlock(frame, { x: 14, y: 0 }), true);
assert.equal(blocksOverlap(frame, block({ w: 24, h: 24 })), false, 'piece may touch all inner walls');
assert.equal(blocksOverlap(frame, block({ w: 24.01, h: 24 })), true);
assert.equal(blocksOverlap(frame, block({ w: 4, h: 4 })), false);
const triangleFrame = block({ shape: 'triangle', variant: 'hollow', w: 48, h: 48 });
assert.equal(blockParts(triangleFrame).length, 3);
assert.equal(pointInBlock(triangleFrame, { x: 0, y: 8 }), false);
assert.equal(blocksOverlap(triangleFrame, block({ x: 0, y: 8, w: 4, h: 4 })), false);
assert.equal(pointInBlock(triangleFrame, { x: 0, y: 23 }), true);
for (const variant of ['wheel_plank', 'wheel_wedge']) {
  const compound = block({ shape: 'circle', variant, w: 48, h: 24 });
  assert.equal(blockParts(compound).length, 2);
  assert.equal(pointInBlock(compound, { x: -12, y: 0 }), true);
  assert.equal(pointInBlock(compound, { x: -23, y: -11 }), false);
  assert.equal(blocksOverlap(compound, block({ x: -22, y: -10, w: 2, h: 2 })), false, 'compound empty corner stays empty');
  assert.equal(blocksOverlap(compound, block({ x: 23, y: 0, w: 2, h: 2 })), true);
}
const samples = [circle, triangle, frame, triangleFrame, block({ shape: 'circle', variant: 'wheel_plank', w: 48 }), rotated];
for (const a of samples) for (const b of samples) for (const x of [0, 12, 24, 36]) {
  const shifted = { ...b, x, y: x / 3 };
  assert.equal(blocksOverlap(a, shifted), blocksOverlap(shifted, a), 'overlap is symmetric');
}
const movedCircle = block({ shape: 'circle', x: 17, y: 29, angle: 45 });
assert.deepEqual(blockBounds(movedCircle), { l: 5, r: 29, t: 17, b: 41 });
assert.deepEqual(snapBlock(movedCircle, 17, 29, 8), { x: 20, y: 28 });
assert.deepEqual(snapBlock({ ...movedCircle, angle: 0 }, 17, 29, 8), snapBlock(movedCircle, 17, 29, 8));
const rotatedTriangle = block({ shape: 'triangle', w: 32, h: 24, angle: 45 });
const triangleBounds = blockBounds(rotatedTriangle);
close(triangleBounds.r, 12 / Math.sqrt(2));
close(triangleBounds.l, -28 / Math.sqrt(2));
const snapped = snapBlock(rotatedTriangle, 31, 45, 8), snappedBounds = blockBounds({ ...rotatedTriangle, ...snapped });
close(snappedBounds.l / 8, Math.round(snappedBounds.l / 8));
close(snappedBounds.t / 8, Math.round(snappedBounds.t / 8));
closePoint(worldToLocal(rotated, localToWorld(rotated, { x: 9, y: -2 })), { x: 9, y: -2 });
closePoint(closestBlockPoint(circle, { x: 0, y: 0 }), { x: 0, y: -12 });
closePoint(closestBlockPoint(frame, { x: 0, y: 0 }), { x: 0, y: -12 });
const seamBoundary = closestBlockPoint(frame, { x: -14, y: -12 });
assert.ok(Math.hypot(seamBoundary.x + 14, seamBoundary.y + 12) > 1.9, 'shared bar seams are inside the union');
closePoint(closestBlockPoint(rotated, localToWorld(rotated, { x: 0, y: -30 })), { x: 0, y: -4 });
const wheelPlank = block({ shape: 'circle', variant: 'wheel_plank', w: 48, h: 24 });
const armEdge = closestBlockPoint(wheelPlank, { x: 0, y: 0 });
close(Math.abs(armEdge.y), 3);
assert.ok(armEdge.x > -1, 'attachment skips the wheel/plank interior seam');
closePoint(closestBlockPoint(wheelPlank, { x: 23, y: 10 }), { x: 23, y: 3 });
const falling = block({ w: 4, h: 4 });
close(dropDistance(falling, [frame], 100), 10, 0.001);
close(dropDistance(block({ x: -10, y: -10, w: 2, h: 2 }), [triangle], 30), 15, 0.001);
assert.equal(dropDistance(falling, [], 12), 12);
assert.equal(dropDistance(falling, [block()], 12), 0);
assert.deepEqual(findDraftOverlaps({ blocks: [block({ id: 'square' })], monsters: [{ t: 'goblin', x: 0, y: 0 }, { t: 'goblin', x: 100, y: 100 }] }), [{ a: 'square', b: 'target_1' }]);
assert.deepEqual(findDraftOverlaps({ blocks: [frame], monsters: [{ t: 'goblin', x: 0, y: 0 }] }), []);
assert.deepEqual(findDraftOverlaps({ blocks: [frame], monsters: [{ t: 'goblin', x: 0, y: 0 }] }, () => ({ w: 26, h: 4 })), [{ a: 'block_1', b: 'target_1' }]);
assert.deepEqual(findDraftOverlaps({ blocks: [], monsters: [{ t: 'goblin', x: 0, y: 0 }, { t: 'goblin', x: 11, y: 0 }] }), [{ a: 'target_1', b: 'target_2' }]);
// Glue slides a rotated plank flush against another: the "^" of two planks 45 degrees either way, with a gap
{
  const left = block({ x: 0, y: 0, w: 40, h: 8, angle: 45 }), right = block({ x: 34, y: 0, w: 40, h: 8, angle: -45 });
  assert.equal(blocksOverlap(left, right), false, 'the planks start with a gap');
  const d = touchOffset(right, left);
  assert.ok(d, 'a nearby rotated plank can be slid flush');
  const moved = { ...right, x: right.x + d.x, y: right.y + d.y };
  assert.equal(blocksOverlap(left, moved), false, 'flush planks do not overlap');
  assert.ok(closestPair(left, moved).gap < 0.05, 'flush planks touch');
  assert.equal(right.angle, -45, 'angles are never changed');
  assert.equal(touchOffset(right, block({ x: 500, y: 0 })), null, 'blocks too far apart are not joined');
  // an overlapping pair is pushed apart until it just touches
  const over = block({ x: 10, y: 3, w: 40, h: 8, angle: -45 });
  assert.equal(blocksOverlap(left, over), true);
  const push = touchOffset(over, left);
  assert.equal(blocksOverlap(left, { ...over, x: over.x + push.x, y: over.y + push.y }), false, 'overlap is pushed clear');
}
console.log('check-builder-geometry: touching, convex/circle intersections, compound holes, attachments, transformed bounds, snapping, drops and flush gluing passed');
