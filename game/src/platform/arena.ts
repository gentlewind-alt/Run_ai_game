import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import type { ServerRoom } from '@series-inc/rundot-game-sdk/mp-client';
import { ARENA_KEY, ARENA_ROOM, type ArenaMessage } from '../arena/types';
import { platform } from './index';

export type ArenaRoomConnection = ServerRoom<ArenaMessage>;

/** The hosted path always uses RUN's verified multiplayer identity. */
export async function joinArena(): Promise<ArenaRoomConnection> {
  const local = typeof location !== 'undefined' && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if ((import.meta as any).env?.DEV && !platform.hosted && local) {
    const { WsMultiplayerApi } = await import('@series-inc/rundot-game-sdk/mp-client');
    const host = location.hostname;
    const url = new URL(location.href);
    const id = url.searchParams.get('arenaDevId') || crypto.randomUUID();
    if (!url.searchParams.has('arenaDevId')) { url.searchParams.set('arenaDevId', id); history.replaceState(null, '', url); }
    const username = (url.searchParams.get('arenaName') || `Local-${id.slice(0, 4)}`).slice(0, 18);
    const api = new WsMultiplayerApi({
      serverUrl: `ws://${host}:9001`,
      getJoinTicket: async (request) => {
        const response = await fetch(`http://${host}:9001/tickets`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...request, profileId: `local-${id}`, username }),
        });
        if (!response.ok) throw new Error('The local Arena server is unavailable.');
        const ticket = await response.json() as { ticketId?: string };
        if (!ticket.ticketId) throw new Error('Could not join the local Arena.');
        return ticket.ticketId;
      },
    });
    return api.joinOrCreateRoom<ArenaMessage>(ARENA_ROOM, { persistentKey: ARENA_KEY });
  }
  if (!platform.hosted) throw new Error('Open the hosted game to connect to global players.');
  return RundotGameAPI.realtime.joinOrCreateRoom<ArenaMessage>(ARENA_ROOM, { persistentKey: ARENA_KEY });
}
