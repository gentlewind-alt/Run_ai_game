// Admin mode: extra tools for the person who runs the game, unlocked by a secret code. Players never see it.
// Only a salted PBKDF2 hash of the code is in the game; change the code with `node tools/admin_code.mjs <new code>`.
// This gates the tools in the interface. Removing other people's challenges is also refused by the RUN host unless the signed-in
// account owns the game, so the code alone cannot delete anything.
import { platform } from '../platform';

const SALT = 'mm-admin-v1:189e0552585ecb05';
const ITERATIONS = 100000;
const ADMIN_HASH = 'e918343ecc5d47cd2b7995ece6772b2ed227e4727c45931ed19878718d8b401c';
const KEY = 'monster-mash.admin.v1';

export const admin = { is: false };
const listeners: (() => void)[] = [];
let failures = 0;
let lockedUntil = 0;

/** Runs `f` now if admin is already on, and whenever it is switched on. */
export function onAdmin(f: () => void): void {
  listeners.push(f);
  if (admin.is) f();
}

async function derive(code: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(code), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(SALT), iterations: ITERATIONS }, key, 256);
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** True when the code is right; admin then stays on in this browser until `lock()`. */
export async function unlock(code: string): Promise<boolean> {
  if (Date.now() < lockedUntil) return false;
  try {
    const ok = !!code && (await derive(code.trim())) === ADMIN_HASH;
    if (!ok) {
      if (++failures >= 5) { lockedUntil = Date.now() + 60000; failures = 0; }
      return false;
    }
    failures = 0;
    admin.is = true;
    await platform.storage.set(KEY, ADMIN_HASH);
    listeners.forEach((f) => f());
    return true;
  } catch {
    return false;
  }
}

export async function lock(): Promise<void> {
  admin.is = false;
  await platform.storage.set(KEY, '');
}

/** Resolves once the saved unlock (if any) has been read. */
export const adminReady: Promise<boolean> = platform.storage.get(KEY).then((saved) => {
  if (saved === ADMIN_HASH) { admin.is = true; listeners.forEach((f) => f()); }
  return admin.is;
}).catch(() => false);
