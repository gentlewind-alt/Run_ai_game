// Checks the online-play data and the challenge-code format (runs in `npm run check`).
import fs from 'node:fs';
import { makeCode, parseCode } from '../src/core/challengeCode.ts';

const config = JSON.parse(fs.readFileSync(new URL('../public/data/config.json', import.meta.url), 'utf8'));
const social = config.social;
const fail = (msg) => { console.error('check-social: ' + msg); process.exit(1); };
if (!social) fail('config.json has no social block');

for (const [key, words] of Object.entries(social.names)) {
  if (new Set(words).size !== words.length) fail(`duplicate words in names.${key}`);
  for (const w of words) if (!/^[A-Z][a-z]{1,11}$/.test(w)) fail(`bad word "${w}" in names.${key}`);
}
// the longest possible name must fit the limit the rules and the app share
const longest = Math.max(...social.names.adjectives.map((w) => w.length)) + Math.max(...social.names.animals.map((w) => w.length)) + 2 + String(social.numberMax).length;
if (longest > social.maxNameChars) fail(`a generated name can reach ${longest} characters, over maxNameChars ${social.maxNameChars}`);

const maxLevel = 35;
const maxScore = social.codeMaxScore;
let seed = 12345;
const rand = (n) => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return 1 + (seed >>> 8) % n; };
let typos = 0;
for (let i = 0; i < 200; i++) {
  const level = rand(maxLevel), score = rand(maxScore);
  const code = makeCode(level, score);
  const back = parseCode(code, maxLevel, maxScore);
  if (!back || back.level !== level || back.score !== score) fail(`round trip failed for ${code}`);
  if (parseCode(code.toLowerCase().replace(/-/g, ' - '), maxLevel, maxScore)) { /* spaces and case are forgiven */ } else fail(`spaces or case broke ${code}`);
  const wrong = code.replace(/-(\d+)$/, (_m, d) => `-${Number(d) + 1}`);
  if (parseCode(wrong, maxLevel, maxScore)) typos++;
}
if (typos > 2) fail(`${typos} of 200 mistyped scores were accepted`);
if (parseCode('MM-ABCD-12-4200', maxLevel, maxScore) !== null) fail('a made-up check was accepted');
console.log(`check-social: names ok (${social.names.adjectives.length} x ${social.names.animals.length}), 200 challenge codes round-trip, ${typos} of 200 typos slipped through`);
