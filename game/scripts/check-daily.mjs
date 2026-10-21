#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateDailyLevel } from '../src/content/levelKinds/dailyLogic.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const levelSchema = JSON.parse(readFileSync(join(root, 'schemas', 'level.schema.json'), 'utf8'));

const errors = [];
const err = (msg) => errors.push(msg);

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

function validate(s, v, path, rootSchema, label) {
  if (s === true || s === undefined) return;
  if (s.$ref) {
    const ref = s.$ref.replace(/^#\//, '').split('/').reduce((o, k) => o?.[k], rootSchema);
    if (!ref) return err(`${label}: ${path}: schema $ref ${s.$ref} not found`);
    return validate(ref, v, path, rootSchema, label);
  }
  if (s.enum && !s.enum.some((e) => e === v)) return err(`${label}: ${path}: ${JSON.stringify(v)} is not one of ${JSON.stringify(s.enum)}`);
  if (s.type && !typeMatches(s.type, v)) return err(`${label}: ${path}: expected ${[].concat(s.type).join('|')}, got ${typeOf(v)}`);
  if (typeof v === 'number') {
    if (s.minimum !== undefined && v < s.minimum) err(`${label}: ${path}: ${v} < minimum ${s.minimum}`);
    if (s.maximum !== undefined && v > s.maximum) err(`${label}: ${path}: ${v} > maximum ${s.maximum}`);
    if (s.exclusiveMinimum !== undefined && v <= s.exclusiveMinimum) err(`${label}: ${path}: ${v} must be > ${s.exclusiveMinimum}`);
  }
  if (typeof v === 'string') {
    if (s.minLength !== undefined && v.length < s.minLength) err(`${label}: ${path}: shorter than ${s.minLength}`);
    if (s.maxLength !== undefined && v.length > s.maxLength) err(`${label}: ${path}: longer than ${s.maxLength} chars`);
    if (s.pattern && !new RegExp(s.pattern).test(v)) err(`${label}: ${path}: "${v}" does not match ${s.pattern}`);
  }
  if (Array.isArray(v)) {
    if (s.minItems !== undefined && v.length < s.minItems) err(`${label}: ${path}: item count ${v.length} < minItems ${s.minItems}`);
    if (s.maxItems !== undefined && v.length > s.maxItems) err(`${label}: ${path}: item count ${v.length} > maxItems ${s.maxItems}`);
    if (s.items) v.forEach((item, i) => validate(s.items, item, `${path}[${i}]`, rootSchema, label));
  }
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    if (s.required) {
      for (const k of s.required) if (!(k in v)) err(`${label}: ${path}: missing required property "${k}"`);
    }
    const props = s.properties || {};
    const patProps = s.patternProperties || {};
    for (const [k, val] of Object.entries(v)) {
      let matched = false;
      if (props[k]) {
        matched = true;
        validate(props[k], val, `${path}.${k}`, rootSchema, label);
      }
      for (const [pat, ps] of Object.entries(patProps)) {
        if (new RegExp(pat).test(k)) {
          matched = true;
          validate(ps, val, `${path}.${k}`, rootSchema, label);
        }
      }
      if (!matched && s.additionalProperties === false) {
        err(`${label}: ${path}: unexpected property "${k}"`);
      }
    }
  }
}

console.log('Generating and validating 30 days of Daily Mash levels...');

// Start at 2026-10-01 12:00:00 UTC
const start = Date.UTC(2026, 9, 1, 12, 0, 0);
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const generated = [];
for (let i = 0; i < 30; i++) {
  const t = start + i * MS_PER_DAY;
  const levelA = generateDailyLevel(t);
  const levelB = generateDailyLevel(t);

  // Determinism check: two devices on the same day get the same fort
  if (JSON.stringify(levelA) !== JSON.stringify(levelB)) {
    err(`Day ${i} (${levelA.name}): nondeterministic output for same timestamp`);
  }

  // Schema check
  validate(levelSchema, levelA, '$', levelSchema, `Day ${i} (${levelA.name})`);

  // Daily variety check: assert no two consecutive days share the same fort archetype and monster mix
  if (i > 0) {
    const prevLevel = generated[i - 1];
    const prevArch = prevLevel._archetype;
    const currArch = levelA._archetype;
    if (prevArch && currArch && prevArch === currArch) {
      err(`Day ${i} (${levelA.name}): shares fort archetype "${currArch}" with Day ${i - 1} (${prevLevel.name})`);
    }
    const prevMix = prevLevel.monsters.map((m) => m.t).sort().join(',');
    const currMix = levelA.monsters.map((m) => m.t).sort().join(',');
    if (prevMix === currMix) {
      err(`Day ${i} (${levelA.name}): shares monster mix [${currMix}] with Day ${i - 1} (${prevLevel.name})`);
    }
  }
  generated.push(levelA);
}

if (errors.length > 0) {
  console.error(`check-daily: ${errors.length} error(s) found:`);
  for (const e of errors) console.error('  ERROR ' + e);
  process.exit(1);
} else {
  console.log('check-daily: 30 days generated and validated successfully (0 errors, 100% deterministic).');
}
