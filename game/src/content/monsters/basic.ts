import type { MonsterBehavior } from './types';

/** No special behaviour: stands, gets hit, dies. The fallback for any monster without its own behaviour. */
export const basic: MonsterBehavior = {};
