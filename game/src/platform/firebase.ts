// The online side of the Android app (Firebase): anonymous sign-in, score boards and the shared level store.
// It uses the native Capacitor plugins, which read google-services.json; a WebView JS SDK would be refused by the app's API key.
// Every call catches its own errors and falls back to what the offline platform returns, so the game plays on without a network.
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { FirebaseFirestore } from '@capacitor-firebase/firestore';
import { data } from '../data/load';
import type { Platform, Row, UgcRow } from './types';

const social = () => data.config.social!;
const enabled = (): boolean => data.config.features.social === true && !!data.config.social;

/** Runs the server work, giving up (and returning the fallback) when the network is off, slow or the call fails. */
function guard<T>(work: () => Promise<T>, fallback: T): Promise<T> {
  if (!enabled()) return Promise.resolve(fallback);
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), social().timeoutMs);
    work().then((value) => { clearTimeout(timer); resolve(value); }, () => { clearTimeout(timer); resolve(fallback); });
  });
}

// ---- who the player is: an anonymous Firebase account and a generated name (never typed)

let signIn: Promise<string | null> | undefined;
/** The Firebase user id, signing in anonymously the first time. A failed attempt is retried on the next call. */
function uid(): Promise<string | null> {
  signIn ??= (async () => {
    const user = (await FirebaseAuthentication.getCurrentUser()).user ?? (await FirebaseAuthentication.signInAnonymously()).user;
    return user?.uid ?? null;
  })().then((id) => { if (!id) signIn = undefined; return id; }, () => { signIn = undefined; return null; });
  return signIn;
}

const NAME_KEY = 'social.name.v1';
const NAME_SHAPE = /^[A-Za-z]+ [A-Za-z]+ [0-9]{1,3}$/;
const pick = (list: string[]): string => list[Math.floor(Math.random() * list.length)];
const newName = (): string => `${pick(social().names.adjectives)} ${pick(social().names.animals)} ${1 + Math.floor(Math.random() * social().numberMax)}`;

// ---- Firestore layout (see docs/android/FIREBASE.md and firestore.rules)
//   boards/<board>/entries/<uid>        one best score per player per board
//   ugc/<type>/items/<docId>            shared levels and challenge scores; the game's id for an entry is "<type>:<docId>"
//   ugc/<type>/items/<docId>/reports/<uid>   one report per player

const safe = (s: string, max = 60): string => s.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, max);
const today = (): string => new Date().toISOString().slice(0, 10);
/** The Daily Mash board is a new board every UTC day. */
const boardPath = (board: string): string => `boards/${board === 'daily' ? `daily_${today()}` : safe(board)}/entries`;
const itemsPath = (type: string): string => `ugc/${safe(type, 50)}/items`;
const splitId = (id: string): { type: string; doc: string } | null => {
  const i = id.indexOf(':');
  return i > 0 && i < id.length - 1 ? { type: id.slice(0, i), doc: id.slice(i + 1) } : null;
};

interface Entry { name?: string; score?: number }
interface Item { authorId: string; authorName: string; title: string; json: string; uses: number; reports: number; createdAt: number; updatedAt: number }

function toRow(type: string, doc: string, d: Item): UgcRow {
  let payload: Record<string, unknown> = {};
  try { payload = JSON.parse(d.json) as Record<string, unknown>; } catch { /* a broken entry shows up empty and the game skips it */ }
  return { id: `${type}:${doc}`, authorId: d.authorId, authorName: d.authorName, title: d.title, data: payload, uses: d.uses ?? 0, createdAt: d.createdAt, updatedAt: d.updatedAt };
}

export interface FirebaseSocial {
  uid(): Promise<string | null>;
  name(): Promise<string>;
  /** Gives the player a fresh generated name and returns it. */
  rerollName(): Promise<string>;
  leaderboard: Platform['leaderboard'];
  ugc: Platform['ugc'];
}

export function firebaseSocial(storage: Platform['storage']): FirebaseSocial {
  const name = async (): Promise<string> => {
    const saved = (await storage.get(NAME_KEY)) ?? '';
    if (saved.length <= social().maxNameChars && NAME_SHAPE.test(saved)) return saved;
    const fresh = newName();
    await storage.set(NAME_KEY, fresh);
    return fresh;
  };
  const rerollName = async (): Promise<string> => {
    const fresh = newName();
    await storage.set(NAME_KEY, fresh);
    return fresh;
  };

  const top = (board: string, n: number): Promise<Row[]> => guard(async () => {
    const me = await uid();
    const { snapshots } = await FirebaseFirestore.getCollection<Entry>({
      reference: boardPath(board),
      queryConstraints: [{ type: 'orderBy', fieldPath: 'score', directionStr: 'desc' }, { type: 'limit', limit: n }],
    });
    return snapshots.map((s, i) => ({ rank: i + 1, name: s.data?.name ?? 'Player', score: s.data?.score ?? 0, mine: s.id === me }));
  }, [] as Row[]);

  const leaderboard: Platform['leaderboard'] = {
    async submit(board, score) {
      await guard(async () => {
        const me = await uid();
        const best = Math.round(score);
        if (!me || best <= 0) return;
        const reference = `${boardPath(board)}/${me}`;
        const old = (await FirebaseFirestore.getDocument<Entry>({ reference })).snapshot.data;
        if (old && (old.score ?? 0) >= best) return;
        await FirebaseFirestore.setDocument({ reference, data: { name: await name(), score: best, updatedAt: Date.now() } });
      }, undefined);
    },
    top,
    // Firestore cannot count "scores above mine", so the rank is found in the top rows; players below them get no rank line.
    async myRank(board) {
      const rows = await top(board, social().rankScan);
      return rows.find((r) => r.mine) ?? null;
    },
  };

  const read = async (type: string, doc: string): Promise<UgcRow | null> => {
    const d = (await FirebaseFirestore.getDocument<Item>({ reference: `${itemsPath(type)}/${doc}` })).snapshot.data;
    return d ? toRow(type, doc, d) : null;
  };
  const list = (type: string, constraints: Parameters<typeof FirebaseFirestore.getCollection>[0]): Promise<UgcRow[]> => guard(async () => {
    const { snapshots } = await FirebaseFirestore.getCollection<Item>(constraints);
    return snapshots
      .filter((s) => s.data && (s.data.reports ?? 0) < social().hideAfterReports)
      .map((s) => toRow(type, s.id, s.data as Item));
  }, [] as UgcRow[]);

  const ugc: Platform['ugc'] = {
    create: (type, title, payload) => guard(async () => {
      const me = await uid();
      const json = JSON.stringify(payload);
      if (!me || json.length > social().maxDataChars) return null;
      const now = Date.now();
      const body: Item = { authorId: me, authorName: await name(), title: title.slice(0, 40), json, uses: 0, reports: 0, createdAt: now, updatedAt: now };
      const { reference } = await FirebaseFirestore.addDocument({ reference: itemsPath(type), data: body });
      return toRow(type, reference.id, body);
    }, null as UgcRow | null),
    update: (id, patch) => guard(async () => {
      const at = splitId(id);
      if (!at) return null;
      const changes: Record<string, unknown> = { updatedAt: Date.now() };
      if (patch.title !== undefined) changes.title = patch.title.slice(0, 40);
      if (patch.data !== undefined) {
        const json = JSON.stringify(patch.data);
        if (json.length > social().maxDataChars) return null;
        changes.json = json;
      }
      await FirebaseFirestore.updateDocument({ reference: `${itemsPath(at.type)}/${at.doc}`, data: changes });
      return read(at.type, at.doc);
    }, null as UgcRow | null),
    remove: (id) => guard(async () => {
      const at = splitId(id);
      if (!at) return false;
      await FirebaseFirestore.deleteDocument({ reference: `${itemsPath(at.type)}/${at.doc}` });
      return true;
    }, false),
    get: (id) => guard(async () => {
      const at = splitId(id);
      return at ? read(at.type, at.doc) : null;
    }, null as UgcRow | null),
    browse: (type, sort, limit) => list(type, {
      reference: itemsPath(type),
      queryConstraints: [{ type: 'orderBy', fieldPath: sort === 'mostUsed' ? 'uses' : 'updatedAt', directionStr: 'desc' }, { type: 'limit', limit }],
    }),
    mine: async (type, limit) => {
      const me = await uid();
      if (!me) return [];
      return list(type, {
        reference: itemsPath(type),
        compositeFilter: { type: 'and', queryConstraints: [{ type: 'where', fieldPath: 'authorId', opStr: '==', value: me }] },
        queryConstraints: [{ type: 'limit', limit }],
      });
    },
    // Firestore has no counter in this plugin: read, then write one more. A rare lost count is fine.
    recordUse: (id) => guard(async () => {
      const at = splitId(id);
      if (!at) return null;
      const reference = `${itemsPath(at.type)}/${at.doc}`;
      const d = (await FirebaseFirestore.getDocument<Item>({ reference })).snapshot.data;
      if (!d) return null;
      await FirebaseFirestore.updateDocument({ reference, data: { uses: (d.uses ?? 0) + 1 } });
      return (d.uses ?? 0) + 1;
    }, null as number | null),
    // Moderation by the owner happens in the Firebase console.
    adminRemove: async () => false,
    adminBrowse: async () => [],
    report: (id) => guard(async () => {
      const at = splitId(id);
      const me = await uid();
      if (!at || !me) return false;
      const reference = `${itemsPath(at.type)}/${at.doc}`;
      const d = (await FirebaseFirestore.getDocument<Item>({ reference })).snapshot.data;
      if (!d) return false;
      // one batch: the player's report note and the count go up together, or neither does
      await FirebaseFirestore.writeBatch({ operations: [
        { type: 'set', reference: `${reference}/reports/${me}`, data: { at: Date.now() } },
        { type: 'update', reference, data: { reports: (d.reports ?? 0) + 1 } },
      ] });
      return true;
    }, false),
  };

  return { uid, name, rerollName, leaderboard, ugc };
}
