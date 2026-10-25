// The owner build: the same game with extra powers for the person who owns it on RUN. The role comes from the host, so players
// cannot switch it on; owner-only calls (removing any challenge) are refused by the host for everyone else as well.
import { platform } from '../platform';

export const owner = { is: false };

/** Resolves true for the game's owner and editors. Never rejects. */
export const ownerReady: Promise<boolean> = platform.role().then((r) => {
  owner.is = r === 'owner' || r === 'editor';
  return owner.is;
}).catch(() => false);
