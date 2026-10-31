// Exercise the draft import boundary without starting Phaser or touching campaign saves.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const transpile = (name) => ts.transpileModule(readFileSync(new URL(`../src/builder/${name}.ts`, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const moduleUrl = (js) => `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`;
const geometryUrl = moduleUrl(transpile('geometry'));
const { blockBounds, findDraftOverlaps, localToWorld } = await import(geometryUrl);
const documentJs = transpile('document').replace(/from ['"]\.\/geometry['"]/g, `from '${geometryUrl}'`);
const documentUrl = moduleUrl(documentJs);
const { newDraft, validateDraft, toLevel, settle } = await import(documentUrl);
const surpriseJs = transpile('surprise')
  .replace(/from ['"]\.\/geometry['"]/g, `from '${geometryUrl}'`)
  .replace(/from ['"]\.\/document['"]/g, `from '${documentUrl}'`);
const { surpriseFort, checkSurpriseStable } = await import(moduleUrl(surpriseJs));
const content = JSON.parse(readFileSync(new URL('../public/data/content.json', import.meta.url), 'utf8'));
const config = content.builder;
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.001, `${actual} should equal ${expected}`);
const draft = newDraft();
draft.blocks = [
  { id: 'post', m: 'wood', x: 240, y: 288, w: 8, h: 64, static: true },
  { id: 'beam', m: 'wood', x: 276, y: 252, w: 64, h: 8, angle: 0 },
  { id: 'ball', m: 'stone', x: 400, y: 200, w: 24, h: 24, shape: 'circle' },
];
draft.monsters = [{ t: 'goblin_grunt', x: 276, y: 313 }];
draft.connections = [
  { id: 'lock', type: 'lock', a: 'post', b: 'beam', pointA: { x: 0, y: -32 }, pointB: { x: -32, y: 0 } },
  { id: 'rope', type: 'rope', a: null, b: 'ball', pointA: { x: 400, y: 96 }, pointB: { x: 0, y: -12 } },
];
const safe = validateDraft(draft, config);
assert.equal(safe.connections[1].length, 92);
assert.deepEqual(validateDraft(JSON.parse(JSON.stringify(safe)), config), safe);
assert.equal(safe.blocks[0].static, true);
assert.equal(safe.blocks[2].shape, 'circle');
assert.equal(safe.monsters[0].id, 'target_1');
assert.equal(validateDraft(draft, config).monsters[0].id, safe.monsters[0].id, 'legacy target IDs are deterministic');
const rejects = (change) => { const bad = structuredClone(draft); change(bad); assert.throws(() => validateDraft(bad, config)); };
rejects((d) => { d.version = 2; });
rejects((d) => { d.blocks[1].id = 'post'; });
rejects((d) => { d.blocks[0].x = NaN; });
rejects((d) => { d.blocks[0].m = 'unknown'; });
rejects((d) => { d.blocks[0].angle = Infinity; });
rejects((d) => { d.blocks[0].static = 'yes'; });
rejects((d) => { d.blocks[2].h = 16; });
rejects((d) => { d.blocks[0].x = 112; d.blocks[0].angle = 45; });
rejects((d) => { d.connections[0].b = 'missing'; });
rejects((d) => { d.connections[0].a = null; });
rejects((d) => { d.connections[0].pointA.x = 99; });
rejects((d) => { d.connections[1].length = 0; });
rejects((d) => { d.connections[1].id = 'lock'; });
rejects((d) => { d.monsters[0].t = 'unknown_target'; });
rejects((d) => { d.blocks = Array(config.maxBlocks + 1).fill(d.blocks[0]); });
rejects((d) => { d.blocks[2].variant = 'unknown_variant'; });
rejects((d) => { d.blocks[2].variant = 'hollow'; });
rejects((d) => { d.blocks[0].variant = 'wheel'; });
rejects((d) => { d.blocks[2].variant = 'wheel_plank'; });
rejects((d) => { d.monsters[0].id = 'post'; });
rejects((d) => { d.monsters.push({ ...d.monsters[0], id: 'duplicate' }); d.monsters[0].id = 'duplicate'; });

const idCollision = structuredClone(draft);
idCollision.blocks[0].id = 'target_1';
idCollision.connections[0].a = 'target_1';
idCollision.monsters.push({ id: 'target_1_m', t: 'goblin_grunt', x: 500, y: 200 });
const generated = validateDraft(idCollision, config);
assert.equal(generated.monsters[0].id, 'target_1_m_m', 'generated IDs skip both block IDs and explicit target IDs');
assert.deepEqual(validateDraft(JSON.parse(JSON.stringify(generated)), config), generated);
assert.deepEqual(validateDraft(idCollision, config).monsters, generated.monsters);

assert.equal(config.targets.length, 20, 'the builder offers the full target roster');
assert.deepEqual(new Set(config.targets), new Set(content.monsters.map((m) => m.id)));
for (const t of config.targets) {
  const rosterDraft = newDraft();
  rosterDraft.monsters = [{ t, x: 300, y: 200 }];
  assert.equal(validateDraft(rosterDraft, config).monsters[0].t, t);
}

const variants = [
  { shape: 'rectangle', w: 24, h: 24 },
  { shape: 'circle', w: 24, h: 24 },
  { shape: 'triangle', w: 32, h: 24 },
  { shape: 'rectangle', variant: 'hollow', w: 32, h: 32 },
  { shape: 'triangle', variant: 'hollow', w: 32, h: 24 },
  { shape: 'circle', variant: 'wheel', w: 24, h: 24 },
  { shape: 'circle', variant: 'wheel_plank', w: 48, h: 24 },
  { shape: 'circle', variant: 'wheel_wedge', w: 48, h: 24 },
];
const variantDraft = newDraft();
variantDraft.blocks = variants.map((variant, i) => ({ id: `variant_${i}`, m: 'wood', x: 160 + i * 64, y: 140, ...variant }));
const validatedVariants = validateDraft(variantDraft, config);
assert.deepEqual(validatedVariants.blocks.map((b) => b.variant), variants.map((b) => b.variant));
assert.deepEqual(validateDraft(JSON.parse(JSON.stringify(validatedVariants)), config), validatedVariants);
const badWheel = structuredClone(variantDraft);
badWheel.blocks[6].w = 24;
assert.throws(() => validateDraft(badWheel, config), /dimensions/);

const shapeEndpoint = (shape, variant, pointB) => {
  const value = newDraft();
  value.blocks = [{ id: 'shape', m: 'wood', x: 300, y: 200, w: variant === 'wheel_plank' || variant === 'wheel_wedge' ? 48 : 24, h: 24, shape, ...(variant ? { variant } : {}) }];
  value.connections = [{ id: 'edge', type: 'rope', a: null, b: 'shape', pointA: { x: 300, y: 80 }, pointB }];
  return value;
};
assert.throws(() => validateDraft(shapeEndpoint('rectangle', 'hollow', { x: 0, y: 0 }), config), /outside its piece/);
assert.doesNotThrow(() => validateDraft(shapeEndpoint('rectangle', 'hollow', { x: -9, y: 0 }), config));
assert.throws(() => validateDraft(shapeEndpoint('triangle', undefined, { x: -10, y: -10 }), config), /outside its piece/);
assert.throws(() => validateDraft(shapeEndpoint('triangle', 'hollow', { x: 0, y: 4 }), config), /outside its piece/);
assert.throws(() => validateDraft(shapeEndpoint('circle', undefined, { x: 10, y: 10 }), config), /outside its piece/);
assert.throws(() => validateDraft(shapeEndpoint('circle', 'wheel_plank', { x: -22, y: -10 }), config), /outside its piece/);
assert.doesNotThrow(() => validateDraft(shapeEndpoint('circle', 'wheel_wedge', { x: 24, y: 0 }), config));

const sizeOf = (type) => type === 'orc_brute' ? { w: 22, h: 28 } : { w: 12, h: 14 };
const legacyEdges = newDraft();
legacyEdges.monsters = [
  { t: 'orc_brute', x: config.minX, y: config.minY },
  { t: 'orc_brute', x: 300, y: config.groundY - 7 },
];
const migratedEdges = validateDraft(legacyEdges, config, sizeOf);
assert.deepEqual(migratedEdges.monsters, [
  { id: 'target_1', t: 'orc_brute', x: config.minX + 11, y: config.minY + 14 },
  { id: 'target_2', t: 'orc_brute', x: 300, y: config.groundY - 14 },
], 'old-valid target centres migrate inside the actual sprite bounds');
assert.deepEqual(validateDraft(JSON.parse(JSON.stringify(migratedEdges)), config, sizeOf), migratedEdges);
const explicitOldEdge = structuredClone(legacyEdges);
explicitOldEdge.monsters[0].id = 'explicit_orc';
assert.throws(() => validateDraft(explicitOldEdge, config, sizeOf), /outside the build area/, 'explicit new target IDs keep strict actual-size bounds');
for (const position of [{ x: config.minX - 1000, y: 200 }, { x: 300, y: config.groundY + 1000 }, { x: config.worldW - 15, y: 200 }]) {
  const invalidLegacy = newDraft();
  invalidLegacy.monsters = [{ t: 'orc_brute', ...position }];
  assert.throws(() => validateDraft(invalidLegacy, config, sizeOf), /outside the build area/, 'migration accepts only centres valid under the old v1 bounds');
}
const targetRope = newDraft();
targetRope.blocks = [{ id: 'support', m: 'wood', x: 300, y: 128, w: 24, h: 24, static: true }];
targetRope.monsters = [{ id: 'orc_target', t: 'orc_brute', x: 300, y: 240 }];
targetRope.connections = [{ id: 'target_rope', type: 'rope', a: 'support', b: 'orc_target', pointA: { x: 0, y: 12 }, pointB: { x: 0, y: -14 } }];
assert.throws(() => validateDraft(targetRope, config), /outside its piece/, 'target endpoints use the supplied target dimensions');
const safeRope = validateDraft(targetRope, config, sizeOf);
assert.equal(safeRope.connections[0].length, 86);
assert.deepEqual(validateDraft(JSON.parse(JSON.stringify(safeRope)), config, sizeOf), safeRope);
assert.deepEqual(settle(safeRope, config, sizeOf), safeRope, 'connected targets keep their authored position');
const ropeLevel = toLevel(targetRope, config, sizeOf);
assert.deepEqual(ropeLevel.connections, safeRope.connections);
assert.deepEqual(ropeLevel.monsters, safeRope.monsters);
const reversedRope = structuredClone(targetRope);
reversedRope.connections[0] = { ...targetRope.connections[0], a: 'orc_target', b: 'support', pointA: { x: 0, y: -14 }, pointB: { x: 0, y: 12 } };
assert.equal(validateDraft(reversedRope, config, sizeOf).connections[0].length, 86);
const worldTargetRope = structuredClone(targetRope);
worldTargetRope.connections[0].a = null;
worldTargetRope.connections[0].pointA = { x: 300, y: 100 };
assert.equal(validateDraft(worldTargetRope, config, sizeOf).connections[0].length, 126);
const invalidTargetEdge = structuredClone(targetRope);
invalidTargetEdge.connections[0].pointB.y = -14.01;
assert.throws(() => validateDraft(invalidTargetEdge, config, sizeOf), /outside its piece/);
const targetAtBoundary = structuredClone(targetRope);
targetAtBoundary.monsters[0].x = config.minX + 11;
targetAtBoundary.monsters[0].y = config.groundY - 14;
assert.doesNotThrow(() => validateDraft(targetAtBoundary, config, sizeOf));
targetAtBoundary.monsters[0].x -= 0.01;
assert.throws(() => validateDraft(targetAtBoundary, config, sizeOf), /outside the build area/);

const pins = structuredClone(draft);
pins.connections.push({ id: 'world_pin', type: 'pin', a: null, b: 'ball', pointA: { x: 400, y: 200 }, pointB: { x: 0, y: 0 } });
pins.connections.push({ id: 'block_pin', type: 'pin', a: 'post', b: 'beam', pointA: { x: 0, y: -32 }, pointB: { x: -32, y: 0 } });
assert.deepEqual(validateDraft(pins, config).connections.slice(-2).map((c) => c.type), ['pin', 'pin']);
for (const type of ['pin', 'lock']) {
  const wrongDestination = structuredClone(targetRope);
  wrongDestination.connections[0].type = type;
  assert.throws(() => validateDraft(wrongDestination, config, sizeOf));
  const wrongSource = structuredClone(reversedRope);
  wrongSource.connections[0].type = type;
  assert.throws(() => validateDraft(wrongSource, config, sizeOf));
}

const touching = newDraft();
const first = { id: 'rotated_a', m: 'wood', x: 240, y: 160, w: 40, h: 8, angle: 37 };
touching.blocks = [first, { ...first, id: 'rotated_b', ...localToWorld(first, { x: 0, y: 8 }) }];
assert.deepEqual(findDraftOverlaps(validateDraft(touching, config)), [], 'touching rotated edges remain valid');
const overlapping = structuredClone(touching);
Object.assign(overlapping.blocks[1], localToWorld(first, { x: 0, y: 7.99 }));
const safeOverlap = validateDraft(overlapping, config);
assert.deepEqual(findDraftOverlaps(safeOverlap), [{ a: 'rotated_a', b: 'rotated_b' }]);
assert.deepEqual(settle(safeOverlap, config), safeOverlap, 'an overlap stays editable at its authored coordinates');
assert.deepEqual(toLevel(safeOverlap, config).blocks, safeOverlap.blocks, 'Test can start an overlapping draft');

const targetSupport = newDraft();
targetSupport.blocks = [{ id: 'falling_block', m: 'wood', x: 300, y: 200, w: 8, h: 8 }];
targetSupport.monsters = [{ id: 'falling_target', t: 'orc_brute', x: 300, y: 260 }];
const targetSettled = settle(validateDraft(targetSupport, config, sizeOf), config, sizeOf);
close(targetSettled.monsters[0].y, config.groundY - 14);
close(targetSettled.blocks[0].y, config.groundY - 32);
const frameDrop = newDraft();
frameDrop.blocks = [{ id: 'frame', m: 'wood', x: 320, y: 220, w: 64, h: 64, variant: 'hollow', static: true }];
frameDrop.monsters = [{ id: 'inside_frame', t: 'goblin_grunt', x: 320, y: 210 }];
const frameSettled = settle(validateDraft(frameDrop, config), config);
close(frameSettled.monsters[0].y, 237);
assert.deepEqual(findDraftOverlaps(frameSettled), [], 'settling respects the frame interior');

const injected = structuredClone(draft);
Object.assign(injected, { overrides: { features: { iap: true } }, chests: [{ reward: 'w_blast_tube' }], loadout: ['w_fake'], realm: 'untrusted', worldW: 99999 });
Object.assign(injected.blocks[0], { density: 1000, collisionFilter: { mask: 0 }, parts: [{ circleRadius: 500 }] });
Object.assign(injected.monsters[0], { hp: 9999, behavior: 'injected', size: 999 });
Object.assign(injected.connections[1], { stiffness: 0, damping: 999 });
const safeInjected = validateDraft(injected, config);
assert.equal(safeInjected.blocks[0].density, undefined);
assert.equal(safeInjected.blocks[0].collisionFilter, undefined);
assert.equal(safeInjected.blocks[0].parts, undefined);
assert.equal(safeInjected.monsters[0].hp, undefined);
assert.equal(safeInjected.monsters[0].behavior, undefined);
assert.equal(safeInjected.connections[1].stiffness, undefined);
const level = toLevel(validateDraft(injected, config), config);
assert.equal(level.id, 1000);
assert.equal(level.chests, undefined);
assert.equal(level.overrides.features.iap, undefined);
assert.equal(level.overrides.features.consumables, false);
assert.equal(level.overrides.features.tutorial, false);
assert.deepEqual(level.loadout, config.loadout);
assert.equal(level.worldW, config.worldW);
assert.equal(level.realm, 'goblin_hills');
level.blocks[0].x = 500;
assert.equal(draft.blocks[0].x, 240);
assert.deepEqual(validateDraft(newDraft(), config).blocks, []);
// an axle: a pin from a frame block to a wheel's hub, which may sit just outside the frame
{
  const cart = newDraft();
  cart.blocks = [{ id: 'frame', m: 'wood', x: 200, y: 250, w: 96, h: 8 }, { id: 'wheel', m: 'wood', x: 170, y: 270, w: 32, h: 32, shape: 'circle', variant: 'wheel' }];
  cart.connections = [{ id: 'axle', type: 'pin', a: 'frame', b: 'wheel', pointA: { x: -30, y: 20 }, pointB: { x: 0, y: 0 } }];
  assert.equal(validateDraft(cart, config).connections[0].type, 'pin', 'axle accepted');
  const far = structuredClone(cart); far.connections[0].pointA = { x: 400, y: 0 };
  assert.throws(() => validateDraft(far, config), /too far/, 'an axle far from its frame is refused');
}
// Read literal body dimensions without importing textures.ts and starting Phaser.
const monsterArtSource = readFileSync(new URL('../src/art/textures.ts', import.meta.url), 'utf8');
const monsterArt = monsterArtSource.match(/export const MONSTER_ART: Record<string, MonsterArt> = \{([\s\S]*?)\n\};/);
assert.ok(monsterArt, 'monster body dimension registry is present');
const monsterSizes = new Map([...monsterArt[1].matchAll(/([a-z_]+): \{ w: (\d+), h: (\d+), size: \d+ \}/g)]
  .map(([, id, w, h]) => [id, { w: Number(w), h: Number(h) }]));
const surpriseSizeOf = (type) => {
  assert.ok(monsterSizes.has(type), `${type} needs actual body dimensions`);
  return monsterSizes.get(type);
};
const assertSupported = (piece, blocks, groundY, label) => {
  const bounds = blockBounds(piece);
  if (Math.abs(bounds.b - groundY) < 0.001) return;
  const contacts = blocks.filter((other) => {
    if (other === piece) return false;
    const below = blockBounds(other);
    return Math.abs(bounds.b - below.t) < 0.001 && Math.min(bounds.r, below.r) - Math.max(bounds.l, below.l) > 0.001;
  }).map((other) => blockBounds(other));
  assert.ok(contacts.length, `${label}: ${piece.id} needs ground or block support`);
  assert.ok(piece.x >= Math.min(...contacts.map((b) => Math.max(bounds.l, b.l))) - 0.001
    && piece.x <= Math.max(...contacts.map((b) => Math.min(bounds.r, b.r))) + 0.001,
  `${label}: ${piece.id} centre must lie between its contacts`);
};
const assertSurprise = (fort, generationContent, realm, label) => {
  const builder = generationContent.builder;
  assert.deepEqual(validateDraft(fort, builder, surpriseSizeOf), fort, `${label}: canonical valid draft`);
  assert.deepEqual(findDraftOverlaps(fort, surpriseSizeOf), [], `${label}: no overlapping pieces`);
  assert.equal(checkSurpriseStable(fort, generationContent, surpriseSizeOf), true, `${label}: static stability`);
  assert.ok(fort.blocks.length <= builder.maxBlocks, `${label}: block cap`);
  assert.ok(fort.monsters.length >= 2 && fort.monsters.length <= builder.maxMonsters, `${label}: target caps`);
  assert.ok(fort.connections.length <= builder.maxConnections, `${label}: connection cap`);
  const roster = generationContent.realms.find((row) => row.id === realm).monsters;
  for (const block of fort.blocks) {
    assert.ok(builder.surprise.realmMaterials[realm].includes(block.m), `${label}: material belongs to the realm`);
    assert.ok(block.angle === 0 || block.angle === 90, `${label}: axis-aligned blocks`);
    assert.ok(builder.presets.some((preset) => preset.w === block.w && preset.h === block.h
      && preset.shape === block.shape && preset.variant === block.variant), `${label}: ${block.id} uses a builder preset`);
    assertSupported(block, fort.blocks, builder.groundY, label);
  }
  for (const monster of fort.monsters) {
    assert.ok(roster.includes(monster.t), `${label}: target belongs to the realm`);
    assert.ok(!generationContent.monsters.find((row) => row.id === monster.t)?.boss, `${label}: bosses excluded`);
    assertSupported({ ...monster, ...surpriseSizeOf(monster.t), m: '', shape: 'rectangle' }, fort.blocks, builder.groundY, label);
  }
};
const styles = ['random', 'towers', 'bunker', 'bridge', 'castle', 'stacks'];
const sizes = ['small', 'medium', 'large'];
const seeds = [4821, 7290, 20261031];
const contentBeforeSurprises = JSON.stringify(content);
let surpriseCases = 0;
const generateAndAssert = (seed, style, size, realm) => {
  const options = { content, sizeOf: surpriseSizeOf, style, size, realm };
  const fort = surpriseFort(seed, options);
  const label = `${style}/${size}/${realm}/${seed}`;
  assertSurprise(fort, content, realm, label);
  assert.equal(fort.monsters.length, config.surprise.sizes[size].monsters, `${label}: size target count`);
  assert.equal(JSON.stringify(surpriseFort(seed, options)), JSON.stringify(fort), `${label}: byte-identical seeded output`);
  surpriseCases++;
};
for (const style of styles) for (const size of sizes) for (const seed of seeds) {
  generateAndAssert(seed, style, size, content.realms[surpriseCases % content.realms.length].id);
}
for (let index = 0; index < styles.length; index++) {
  generateAndAssert(seeds[index % seeds.length] + index, styles[index], sizes[index % sizes.length],
    content.realms[(content.realms.length - styles.length + index) % content.realms.length].id);
}
assert.equal(surpriseCases, 60, 'all fixed surprise generation cases ran');
assert.equal(JSON.stringify(content), contentBeforeSurprises, 'generation leaves its input content unchanged');
const fallbackContent = structuredClone(content);
fallbackContent.builder.surprise.retryLimit = 0;
const fallbackRealm = content.realms[0].id;
const fallbackOptions = { content: fallbackContent, sizeOf: surpriseSizeOf, style: 'castle', size: 'large', realm: fallbackRealm };
const fallbackFort = surpriseFort(seeds[0], fallbackOptions);
assertSurprise(fallbackFort, fallbackContent, fallbackRealm, 'retry-exhausted bunker fallback');
assert.equal(JSON.stringify(surpriseFort(seeds[0], fallbackOptions)), JSON.stringify(fallbackFort), 'bunker fallback is deterministic');
console.log('check-builder: v1 IDs, variants, filled geometry, full targets, ropes/pins, overlap editing, settling, trusted level conversion and 60 seeded surprise forts passed');
