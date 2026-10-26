// Global Challenges: levels players build, publish to the shared community store, and everyone else can clear with the weapons the
// author allows. Each challenge has its own score board and a challenger count (used for the ranking). Never throws into the game.
import { MONSTER_ART } from '../art/textures';
import { toLevel, validateDraft, type BuilderDocument } from '../builder/document';
import { findDraftOverlaps } from '../builder/geometry';
import { data } from '../data/load';
import type { Level } from '../data/types';
import { platform } from '../platform';
import { admin } from './admin';
import type { Row, UgcRow } from '../platform/types';

export const CHALLENGE_TYPE = 'mm_challenge';
export const MAX_PER_AUTHOR = 10;
export const SHOTS_MIN = 3;
export const SHOTS_MAX = 8;
const JOINED_KEY = 'monster-mash.challenged.v1';
const monsterSize = (type: string) => ({ w: MONSTER_ART[type]?.w ?? 12, h: MONSTER_ART[type]?.h ?? 14 });

export interface Challenge {
  id: string;
  title: string;
  authorId: string;
  authorName: string;
  mine: boolean;
  allowed: string[]; // weapon ids a challenger may pick from their own arsenal
  shots: number;
  doc: BuilderDocument;
  challengers: number;
  createdAt: number;
}

export type ChallengeSort = 'top' | 'new' | 'mine';

let myIdCache: string | undefined;
async function myId(): Promise<string> {
  if (myIdCache === undefined) myIdCache = (await platform.profile()).id;
  return myIdCache;
}

const clampShots = (n: unknown): number => Math.max(SHOTS_MIN, Math.min(SHOTS_MAX, Math.round(typeof n === 'number' && Number.isFinite(n) ? n : 5)));

function parse(row: UgcRow, me: string): Challenge | null {
  try {
    const d = row.data;
    if (d.v !== 1) return null;
    const doc = validateDraft(d.doc, data.content.builder, monsterSize);
    if (!doc.monsters.length) return null;
    const known = new Set(data.content.weapons.map((w) => w.id));
    const allowed = Array.isArray(d.allowed) ? (d.allowed as unknown[]).filter((id): id is string => typeof id === 'string' && known.has(id)) : [];
    if (!allowed.length) return null;
    return { id: row.id, title: row.title || doc.name, authorId: row.authorId, authorName: row.authorName, mine: row.authorId === me, allowed, shots: clampShots(d.shots), doc, challengers: row.uses, createdAt: row.createdAt };
  } catch {
    return null;
  }
}

const payload = (doc: BuilderDocument, allowed: string[], shots: number): Record<string, unknown> => ({ v: 1, doc, allowed, shots: clampShots(shots) });

export async function listChallenges(sort: ChallengeSort, limit = 50): Promise<Challenge[]> {
  const me = await myId();
  const rows = sort === 'mine' ? await platform.ugc.mine(CHALLENGE_TYPE, limit) : await platform.ugc.browse(CHALLENGE_TYPE, sort === 'top' ? 'mostUsed' : 'recent', limit);
  const list = rows.map((r) => parse(r, me)).filter((c): c is Challenge => c !== null);
  if (sort === 'top') list.sort((a, b) => b.challengers - a.challengers || b.createdAt - a.createdAt);
  return list;
}

export async function getChallenge(id: string): Promise<Challenge | null> {
  const row = await platform.ugc.get(id);
  return row ? parse(row, await myId()) : null;
}

/** Publishes a level. Returns the new challenge, or the reason it could not be shared. */
export async function publishChallenge(doc: BuilderDocument, allowed: string[], shots: number): Promise<{ challenge?: Challenge; error?: string }> {
  try {
    if (!allowed.length) return { error: 'Allow at least one weapon.' };
    const safe = validateDraft(doc, data.content.builder, monsterSize);
    if (findDraftOverlaps(safe, monsterSize).length) return { error: 'Fix overlapping pieces before sharing. Test can still try the design.' };
    if (!safe.monsters.length) return { error: 'Add at least one target first.' };
    const mine = await platform.ugc.mine(CHALLENGE_TYPE, MAX_PER_AUTHOR + 1);
    if (!admin.is && mine.length >= MAX_PER_AUTHOR) return { error: `You can share up to ${MAX_PER_AUTHOR} challenges. Delete one first.` };
    const name = (await platform.profile()).name;
    const title = safe.name === 'My level' ? `${name}'s level ${mine.length + 1}` : safe.name;
    const row = await platform.ugc.create(CHALLENGE_TYPE, title.slice(0, 40), payload({ ...safe, name: title.slice(0, 40) }, allowed, shots));
    if (!row) return { error: 'Could not reach the challenge board. Try again in a moment.' };
    const challenge = parse(row, await myId());
    return challenge ? { challenge } : { error: 'The shared copy could not be read back.' };
  } catch {
    return { error: 'Could not share this level.' };
  }
}

/**
 * The author changes the rules in place. Admin can also change someone else's challenge: the host lets only an author edit, so the
 * admin's copy replaces it (same level and title, new rules, under the admin's name; the old scores are lost). Returns the challenge now live.
 */
export async function updateRules(c: Challenge, allowed: string[], shots: number): Promise<Challenge | null> {
  if (!allowed.length) return null;
  if (findDraftOverlaps(c.doc, monsterSize).length) return null;
  if (c.mine) return (await platform.ugc.update(c.id, { data: payload(c.doc, allowed, shots) })) ? { ...c, allowed, shots: clampShots(shots) } : null;
  if (!admin.is) return null;
  const row = await platform.ugc.create(CHALLENGE_TYPE, c.title, payload(c.doc, allowed, shots));
  if (!row) return null;
  await platform.ugc.adminRemove(c.id);
  return parse(row, await myId());
}

export async function removeChallenge(c: Challenge): Promise<boolean> {
  if (c.mine) return platform.ugc.remove(c.id);
  return admin.is ? platform.ugc.adminRemove(c.id) : false;
}

/** Owner only: clears every score on a challenge's board. Returns how many entries were removed. */
export async function resetBoard(c: Challenge): Promise<number> {
  if (!admin.is) return 0;
  const rows = await platform.ugc.adminBrowse(scoreType(c.id), 100);
  let removed = 0;
  for (const r of rows) if (await platform.ugc.adminRemove(r.id)) removed++;
  return removed;
}

/** Counts the player once as a challenger (the author does not count). */
export async function joinOnce(c: Challenge): Promise<void> {
  if (c.mine) return;
  try {
    const raw = await platform.storage.get(JOINED_KEY);
    const joined: string[] = raw ? JSON.parse(raw) : [];
    if (joined.includes(c.id)) return;
    await platform.ugc.recordUse(c.id);
    joined.push(c.id);
    await platform.storage.set(JOINED_KEY, JSON.stringify(joined.slice(-500)));
  } catch { /* counting is a bonus */ }
}

// ---- scores: one entry per player per challenge in a type of its own, so every challenge has its own board

const scoreType = (id: string): string => `mm_s_${id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 40)}`;

/** Keeps the player's best score for this challenge. Returns the best score now on the board. */
export async function submitScore(c: Challenge, score: number): Promise<number> {
  try {
    const type = scoreType(c.id);
    const existing = (await platform.ugc.mine(type, 1))[0];
    const old = existing && typeof existing.data.score === 'number' ? existing.data.score : 0;
    if (existing && old >= score) return old;
    const body = { score: Math.round(score), shots: c.shots };
    if (existing) await platform.ugc.update(existing.id, { data: body });
    else await platform.ugc.create(type, c.title.slice(0, 40), body);
    return Math.round(score);
  } catch {
    return score;
  }
}

export interface Board { rows: Row[]; me: Row | null }

export async function challengeBoard(c: Challenge, n = 8): Promise<Board> {
  try {
    const me = await myId();
    const entries = await platform.ugc.browse(scoreType(c.id), 'recent', 100);
    const sorted = entries
      .map((e) => ({ authorId: e.authorId, name: e.authorName || 'Player', score: typeof e.data.score === 'number' ? e.data.score : 0 }))
      .filter((e) => e.score > 0)
      .sort((a, b) => b.score - a.score);
    const rows = sorted.map((e, i) => ({ rank: i + 1, name: e.name, score: e.score, mine: e.authorId === me }));
    const mine = rows.find((r) => r.mine);
    return { rows: rows.slice(0, n).map(({ rank, name, score }) => ({ rank, name, score })), me: mine ? { rank: mine.rank, name: mine.name, score: mine.score } : null };
  } catch {
    return { rows: [], me: null };
  }
}

/** The battle level for a challenge with the loadout the challenger chose. */
export function challengeLevel(c: Challenge, loadout: string[]): Level {
  return { ...toLevel(c.doc, data.content.builder, (t) => ({ w: MONSTER_ART[t]?.w ?? 12, h: MONSTER_ART[t]?.h ?? 14 })), name: c.title, shots: loadout.length, loadout: loadout.slice() };
}
