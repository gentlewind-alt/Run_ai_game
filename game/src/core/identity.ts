// Who the player is on the score boards. A signed-in RUN account always shows its account name. A guest (no account) picks a name that
// is saved on this device and travels with each score; until they pick one they appear as Guest-xxxx.
import { platform } from '../platform';

const KEY = 'monster-mash.nickname.v1';
const MAX = 14;
let cache: { isGuest: boolean; id: string; account: string; nickname: string } | undefined;

async function load(): Promise<NonNullable<typeof cache>> {
  if (cache) return cache;
  const p = await platform.profile();
  let nickname = '';
  try { nickname = (await platform.storage.get(KEY)) ?? ''; } catch { /* no saved name */ }
  cache = { isGuest: p.anonymous === true, id: p.id, account: p.name, nickname };
  return cache;
}

export const cleanName = (raw: string): string => raw.replace(/[^\w .'-]/g, '').trim().slice(0, MAX);

export async function whoAmI(): Promise<{ isGuest: boolean; shown: string }> {
  const me = await load();
  const guestName = me.nickname || `Guest-${me.id.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase() || 'Player'}`;
  return { isGuest: me.isGuest, shown: me.isGuest ? guestName : me.account };
}

/** The name to send with a score: only guests send one (an account's name comes from the account itself). */
export async function scoreName(): Promise<string | undefined> {
  const me = await whoAmI();
  return me.isGuest ? me.shown : undefined;
}

export async function setNickname(raw: string): Promise<string> {
  const me = await load();
  me.nickname = cleanName(raw);
  try { await platform.storage.set(KEY, me.nickname); } catch { /* kept for this session */ }
  return (await whoAmI()).shown;
}
