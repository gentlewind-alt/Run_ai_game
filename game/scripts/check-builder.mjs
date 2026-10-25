// Exercise the draft import boundary without starting Phaser or touching campaign saves.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/builder/document.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { newDraft, validateDraft, toLevel } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const { builder: config } = JSON.parse(readFileSync(new URL('../public/data/content.json', import.meta.url), 'utf8'));
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
rejects((d) => { d.monsters[0].t = 'iron_warlord'; });
rejects((d) => { d.blocks = Array(config.maxBlocks + 1).fill(d.blocks[0]); });
const injected = { ...draft, overrides: { features: { iap: true } }, chests: [{ reward: 'w_blast_tube' }] };
const level = toLevel(validateDraft(injected, config), config);
assert.equal(level.id, 1000);
assert.equal(level.chests, undefined);
assert.equal(level.overrides.features.iap, undefined);
assert.equal(level.overrides.features.consumables, false);
assert.equal(level.overrides.features.tutorial, false);
assert.deepEqual(level.loadout, config.loadout);
level.blocks[0].x = 500;
assert.equal(draft.blocks[0].x, 240);
assert.deepEqual(validateDraft(newDraft(), config).blocks, []);
console.log('check-builder: draft round-trip, references, limits, finite geometry and isolated level conversion passed');
