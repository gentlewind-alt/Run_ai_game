// "Challenge a friend" codes: MM-<4 check symbols>-<level>-<score>, e.g. MM-X7K2-12-4200. The check symbols catch typos when a
// friend types the code in. No server needs to know a code. This file has no imports so scripts/check-social.mjs can run it.
const SYMBOLS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // 32 symbols without 0, O, 1, I (easy to mix up)

function check(level: number, score: number): string {
  let h = 2166136261;
  for (const n of [level, score]) {
    h = Math.imul(h ^ n, 16777619) >>> 0;
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995) >>> 0;
  }
  let out = '';
  for (let i = 0; i < 4; i++) { out += SYMBOLS[h & 31]; h >>>= 5; }
  return out;
}

export const makeCode = (level: number, score: number): string => `MM-${check(level, Math.round(score))}-${level}-${Math.round(score)}`;

/** The level and score inside a code, or null when it is mistyped or out of range. */
export function parseCode(raw: string, maxLevel: number, maxScore: number): { level: number; score: number } | null {
  const m = /^MM-([A-Z0-9]{4})-(\d{1,3})-(\d{1,7})$/.exec(raw.replace(/\s+/g, '').toUpperCase());
  if (!m) return null;
  const level = Number(m[2]);
  const score = Number(m[3]);
  if (level < 1 || level > maxLevel || score < 1 || score > maxScore) return null;
  return check(level, score) === m[1] ? { level, score } : null;
}

/** What the share sheet sends. `beat` is the score the sender is answering, when this is a reply. */
export function challengeText(level: number, score: number, beat?: number): string {
  const lead = beat ? `I got ${score} on level ${level} against your ${beat}.` : `I scored ${score} on level ${level} in Monster Smash.`;
  return `${lead} Beat me! Challenge code: ${makeCode(level, score)}`;
}
