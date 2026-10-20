#!/usr/bin/env node
// Validates public/data against schemas/ and checks cross-references between files.
// No dependencies. Supports the JSON Schema subset the schemas use: type, enum, required,
// properties, patternProperties, additionalProperties, items, minItems, minimum, maximum,
// exclusiveMinimum, minLength, maxLength, pattern, local $ref ("#/$defs/x").
// Usage: node scripts/check-data.mjs   (exit code 1 on any error)
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'public', 'data');
const errors = [];
const warnings = [];
const err = (f, m) => errors.push(`${f}: ${m}`);
const warn = (f, m) => warnings.push(`${f}: ${m}`);

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    err(relative(root, path), `cannot parse JSON (${e.message})`);
    return undefined;
  }
}
const schema = (name) => readJson(join(root, 'schemas', name));

// ---------------------------------------------------------------- schema subset

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
}
function typeMatches(want, v) {
  const t = typeOf(v);
  return [].concat(want).some((w) => w === t || (w === 'number' && t === 'integer'));
}

function validate(s, v, path, rootSchema, file) {
  if (s === true || s === undefined) return;
  if (s.$ref) {
    const ref = s.$ref.replace(/^#\//, '').split('/').reduce((o, k) => o?.[k], rootSchema);
    if (!ref) return err(file, `${path}: schema $ref ${s.$ref} not found`);
    return validate(ref, v, path, rootSchema, file);
  }
  if (s.enum && !s.enum.some((e) => e === v)) return err(file, `${path}: ${JSON.stringify(v)} is not one of ${JSON.stringify(s.enum)}`);
  if (s.type && !typeMatches(s.type, v)) return err(file, `${path}: expected ${[].concat(s.type).join('|')}, got ${typeOf(v)}`);
  if (typeof v === 'number') {
    if (s.minimum !== undefined && v < s.minimum) err(file, `${path}: ${v} < minimum ${s.minimum}`);
    if (s.maximum !== undefined && v > s.maximum) err(file, `${path}: ${v} > maximum ${s.maximum}`);
    if (s.exclusiveMinimum !== undefined && v <= s.exclusiveMinimum) err(file, `${path}: ${v} must be > ${s.exclusiveMinimum}`);
  }
  if (typeof v === 'string') {
    if (s.minLength !== undefined && v.length < s.minLength) err(file, `${path}: shorter than ${s.minLength}`);
    if (s.maxLength !== undefined && v.length > s.maxLength) err(file, `${path}: longer than ${s.maxLength} chars`);
    if (s.pattern && !new RegExp(s.pattern).test(v)) err(file, `${path}: "${v}" does not match ${s.pattern}`);
  }
  if (Array.isArray(v)) {
    if (s.minItems !== undefined && v.length < s.minItems) err(file, `${path}: needs at least ${s.minItems} items`);
    if (s.items) v.forEach((x, i) => validate(s.items, x, `${path}[${i}]`, rootSchema, file));
  }
  if (typeOf(v) === 'object') {
    for (const k of s.required ?? []) if (!(k in v)) err(file, `${path}: missing required "${k}"`);
    for (const [k, x] of Object.entries(v)) {
      if (s.properties && k in s.properties) {
        validate(s.properties[k], x, `${path}.${k}`, rootSchema, file);
        continue;
      }
      const pat = Object.entries(s.patternProperties ?? {}).find(([p]) => new RegExp(p).test(k));
      if (pat) {
        validate(pat[1], x, `${path}.${k}`, rootSchema, file);
        continue;
      }
      if (s.additionalProperties === false) err(file, `${path}: unknown field "${k}" (typo? or add it to the schema first)`);
      else if (typeof s.additionalProperties === 'object') validate(s.additionalProperties, x, `${path}.${k}`, rootSchema, file);
    }
  }
}

// ---------------------------------------------------------------- files

const contentSchema = schema('content.schema.json');
const levelSchema = schema('level.schema.json');
const configSchema = schema('config.schema.json');

const content = readJson(join(dataDir, 'content.json'));
if (content && contentSchema) validate(contentSchema, content, '$', contentSchema, 'content.json');

const configPath = join(dataDir, 'config.json');
if (existsSync(configPath)) {
  const config = readJson(configPath);
  if (config && configSchema) validate(configSchema, config, '$', configSchema, 'config.json');
} else {
  warn('config.json', 'not present yet (created in card S2-02)');
}

const levelFiles = [];
for (const dir of [dataDir, join(dataDir, 'levels')]) {
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir)) if (/^level_\d+\.json$/.test(f)) levelFiles.push(join(dir, f));
}
if (!levelFiles.length) err('levels', 'no level_NN.json files found');

// ---------------------------------------------------------------- cross-references

if (content) {
  const ids = (list) => (content[list] ?? []).map((x) => x.id);
  const all = ['weapons', 'stretchWeapons', 'artifacts', 'stretchArtifacts', 'consumables', 'monsters', 'materials', 'realms', 'cosmetics'].flatMap(ids);
  const seen = new Set();
  for (const id of all) {
    if (seen.has(id)) err('content.json', `duplicate id "${id}"`);
    seen.add(id);
  }
  const weaponIds = new Set(ids('weapons'));
  const monsterIds = new Set(ids('monsters'));
  const materialIds = new Set(ids('materials'));

  for (const r of content.realms ?? []) {
    for (const m of r.monsters ?? []) if (!monsterIds.has(m)) err('content.json', `realm ${r.id} lists unknown monster "${m}"`);
  }
  const realmLevels = (content.realms ?? []).flatMap((r) => r.levels);
  if (new Set(realmLevels).size !== realmLevels.length) err('content.json', 'a level number appears in two realms');

  for (const w of content.weapons ?? []) {
    const m = /^level (\d+)$/.exec(w.unlock ?? '');
    if (m && !realmLevels.includes(Number(m[1]))) warn('content.json', `${w.id} unlocks at level ${m[1]}, which no realm contains`);
  }
  const cm = content.damageRules?.comboMultipliers;
  if (cm && cm.some((x, i) => i > 0 && x < cm[i - 1])) warn('content.json', 'comboMultipliers should not decrease');

  const levelIds = new Map();
  for (const path of levelFiles) {
    const file = relative(root, path).split('\\').join('/');
    const lv = readJson(path);
    if (!lv || !levelSchema) continue;
    validate(levelSchema, lv, '$', levelSchema, file);
    if (levelIds.has(lv.id)) err(file, `level id ${lv.id} also used by ${levelIds.get(lv.id)}`);
    levelIds.set(lv.id, file);
    const num = Number(/level_(\d+)/.exec(path)[1]);
    if (lv.id !== num) err(file, `id ${lv.id} does not match file number ${num}`);
    if (lv.id > 0 && !realmLevels.includes(lv.id)) warn(file, `level ${lv.id} is not listed in any realm`);
    if (lv.weapon !== undefined) warn(file, '"weapon" is deprecated, use "loadout": ["w_..."]');
    for (const wid of [lv.weapon, ...(lv.loadout ?? [])].filter(Boolean)) {
      if (!weaponIds.has(wid)) err(file, `unknown weapon "${wid}"`);
    }
    if (!lv.loadout && !lv.weapon && !lv.shots) err(file, 'needs "loadout" or "shots"');
    (lv.blocks ?? []).forEach((b, i) => {
      if (!materialIds.has(b.m)) err(file, `blocks[${i}]: unknown material "${b.m}"`);
      if (b.x - b.w / 2 < 0 || b.x + b.w / 2 > lv.worldW) err(file, `blocks[${i}] is outside worldW ${lv.worldW}`);
    });
    (lv.monsters ?? []).forEach((m, i) => {
      if (!monsterIds.has(m.t)) err(file, `monsters[${i}]: unknown monster "${m.t}"`);
      if (m.x < 0 || m.x > lv.worldW) err(file, `monsters[${i}] is outside worldW ${lv.worldW}`);
    });
    const runners = (lv.monsters ?? []).filter((m) => m.t === 'skeleton_runner').length;
    if (runners && !lv.exit) err(file, 'has skeleton_runner monsters but no "exit"');
    if (lv.escapeLimit !== undefined && lv.escapeLimit >= runners && runners) warn(file, 'escapeLimit >= number of runners, so runners can never lose the level');
  }
  for (const n of realmLevels) {
    if (!levelIds.has(n)) warn('content.json', `realm level ${n} has no level_${String(n).padStart(2, '0')}.json yet`);
  }
}

// ---------------------------------------------------------------- report

for (const w of warnings) console.log(`warn  ${w}`);
for (const e of errors) console.log(`ERROR ${e}`);
console.log(`check-data: ${errors.length} error(s), ${warnings.length} warning(s), ${levelFiles.length} level file(s)`);
process.exit(errors.length ? 1 : 0);
