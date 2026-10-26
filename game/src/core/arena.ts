import { MONSTER_ART } from '../art/textures';
import { validateDraft } from '../builder/document';
import { ENGINE_VERSION } from '../arena/engineVersion.generated';
import type { ArenaAction, ArenaCommand, ArenaMessage, ArenaReplay, ArenaSetup, ArenaSnapshot } from '../arena/types';
import { ARENA_MAX_ACTIONS, ARENA_MAX_FRAMES } from '../arena/types';
import { data } from '../data/load';
import { platform } from '../platform';
import { joinArena, type ArenaRoomConnection } from '../platform/arena';

type Status = 'offline' | 'connecting' | 'online' | 'reconnecting';
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

class ArenaClient {
  snapshot: ArenaSnapshot | null = null;
  status: Status = 'offline';
  error = '';
  turnError?: { matchId: string; revision: number };
  private room?: ArenaRoomConnection;
  private connecting?: Promise<void>;
  private heartbeat?: ReturnType<typeof setInterval>;
  private listeners = new Set<() => void>();
  private setupListeners = new Set<(setup: ArenaSetup) => void>();
  private pendingStart?: { id: string; revision: number };
  private chunks?: { id: string; revision: number; parts: (string | undefined)[] };
  private consumed = new Set<string>();
  private pendingSubmit?: Extract<ArenaCommand, { type: 'arena:submit' }>;
  private receivedAt = 0;
  private currentEngine = ENGINE_VERSION;
  private snapshotChunks?: { id: string; parts: (string | undefined)[] };
  private fingerprint = '';

  subscribe(fn: () => void): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  onSetup(fn: (setup: ArenaSetup) => void): () => void { this.setupListeners.add(fn); return () => this.setupListeners.delete(fn); }
  private changed(): void { for (const fn of this.listeners) fn(); }
  now(): number { return this.snapshot ? this.snapshot.serverNow + Date.now() - this.receivedAt : Date.now(); }
  compatible(): boolean { return this.currentEngine === ENGINE_VERSION; }
  isStarting(): boolean { return this.pendingStart !== undefined; }

  async autoConnect(): Promise<void> {
    if (!platform.hosted || (await platform.profile()).anonymous) return;
    await this.connect();
  }

  connect(): Promise<void> {
    if (this.status === 'online' && this.room) return Promise.resolve();
    if (this.connecting) return this.connecting;
    this.status = 'connecting'; this.error = ''; this.changed();
    this.connecting = this.open().finally(() => { this.connecting = undefined; });
    return this.connecting;
  }

  /** The host sometimes needs more than one try (cold room, slow network), so a timed-out join is retried before giving up. */
  private async join(): Promise<ArenaRoomConnection> {
    for (let attempt = 1; ; attempt++) {
      try { return await joinArena(); } catch (error) {
        if (attempt >= 3 || !/timeout|timed out|network|socket|closed/i.test(error instanceof Error ? error.message : '')) throw error;
        this.error = `Connection is slow, retrying (${attempt}/2)...`; this.changed();
        await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
      }
    }
  }

  private async open(): Promise<void> {
    try {
      this.room?.leave();
      const room = this.room = await this.join();
      this.error = '';
      const message = (value: ArenaMessage): void => this.receive(value);
      room.on({
        onMessage: (value) => { if (this.room === room) message(value); },
        onPrivateMessage: (value) => { if (this.room === room) message(value); },
        onError: (error) => { if (this.room === room) { this.error = error; this.changed(); } },
        onDisconnect: () => { if (this.room === room) { this.status = 'offline'; this.changed(); } },
        onReconnecting: () => { if (this.room === room) { this.status = 'reconnecting'; this.changed(); } },
        onReconnected: () => { if (this.room === room) { this.status = 'online'; this.sync(); this.retryPending(); this.changed(); } },
      });
      this.status = 'online';
      this.sync(); this.retryPending();
      if (this.heartbeat) clearInterval(this.heartbeat);
      this.heartbeat = setInterval(() => { if (this.status === 'online') { this.sync(); this.retryPending(); } }, 20000);
      this.changed();
    } catch (error) {
      this.status = 'offline';
      const reason = error instanceof Error ? error.message : '';
      this.error = /timeout|timed out/i.test(reason) ? 'Arena server did not answer. Tap Connect to try again.' : reason || 'Could not connect to Arena. Sign in and try again.';
      this.changed();
    }
  }

  send(command: ArenaCommand): boolean {
    if (!this.room || this.status !== 'online') { this.error = 'Reconnect to Arena first.'; this.changed(); return false; }
    if (command.type !== 'arena:sync') this.error = '';
    try { this.room.send({ ...command, engineVersion: ENGINE_VERSION }); return true; }
    catch { this.error = 'Could not send that action. Reconnect and try again.'; this.changed(); return false; }
  }
  sync(): void { this.send({ type: 'arena:sync' }); }

  startTurn(): boolean {
    const state = this.snapshot, match = state?.match;
    if (this.pendingStart || !state || !match || match.state !== 'ready' || match.players[match.turn] !== state.me || !this.compatible()) return false;
    this.pendingStart = { id: match.id, revision: match.revision };
    this.chunks = undefined; this.turnError = undefined; this.error = '';
    const sent = this.send({ type: 'arena:start', matchId: match.id, revision: match.revision });
    if (!sent) this.pendingStart = undefined;
    this.changed();
    return sent;
  }

  submit(setup: ArenaSetup, replay: ArenaReplay): boolean {
    if (replay.actions.length > ARENA_MAX_ACTIONS || replay.frames > ARENA_MAX_FRAMES) {
      this.error = 'The attempt exceeded the Arena limit.'; this.changed(); return false;
    }
    this.pendingSubmit = { type: 'arena:submit', matchId: setup.matchId, revision: setup.revision, replay: copy(replay) };
    return this.send(this.pendingSubmit);
  }

  sendInput(setup: ArenaSetup, action: ArenaAction): boolean {
    return this.send({ type: 'arena:input', matchId: setup.matchId, revision: setup.revision, action: copy(action) });
  }

  forfeit(): boolean {
    const match = this.snapshot?.match;
    if (!match || match.state === 'finished') return false;
    this.pendingStart = undefined; this.chunks = undefined; this.pendingSubmit = undefined;
    return this.send({ type: 'arena:forfeit', matchId: match.id, revision: match.revision });
  }

  private retryPending(): void {
    if (this.pendingSubmit) this.send(this.pendingSubmit);
    else if (this.pendingStart) {
      const match = this.snapshot?.match;
      if (match?.id === this.pendingStart.id && match.state === 'playing') this.send({ type: 'arena:start', matchId: match.id, revision: match.revision });
    }
  }

  private receive(message: ArenaMessage): void {
    if (message.type === 'arena:snapshot-chunk') {
      if (typeof message.id !== 'string' || message.id.length > 128 || !Number.isInteger(message.total) || message.total < 1 || message.total > 24 || !Number.isInteger(message.index) || message.index < 0 || message.index >= message.total || typeof message.json !== 'string' || message.json.length > 3000) return;
      if (!this.snapshotChunks || this.snapshotChunks.id !== message.id) this.snapshotChunks = { id: message.id, parts: Array(message.total).fill(undefined) };
      if (this.snapshotChunks.parts.length !== message.total) return;
      this.snapshotChunks.parts[message.index] = message.json;
      if (this.snapshotChunks.parts.some(part => part === undefined)) return;
      const json = this.snapshotChunks.parts.join(''); this.snapshotChunks = undefined;
      try {
        if (json.length > 100000) throw new Error();
        const snapshot = JSON.parse(json) as ArenaMessage;
        if (snapshot.type === 'arena:snapshot') this.receive(snapshot);
      } catch { this.error = 'Could not read the Arena update. Reconnect and try again.'; this.changed(); }
      return;
    }
    if (message.type === 'arena:error') {
      const context = message as { requestType?: string; matchId?: string; revision?: number };
      this.error = message.message;
      if (context.requestType === 'arena:start' && context.matchId === this.pendingStart?.id) { this.pendingStart = undefined; this.chunks = undefined; }
      if (context.requestType === 'arena:submit' && context.matchId === this.pendingSubmit?.matchId) this.pendingSubmit = undefined;
      if (context.requestType === 'arena:input' && typeof context.matchId === 'string' && typeof context.revision === 'number') this.turnError = { matchId: context.matchId, revision: context.revision };
      this.changed(); return;
    }
    if (message.type === 'arena:snapshot') {
      const clock = message.data.match && message.data.match.state !== 'finished' ? Math.floor(message.data.serverNow / 1000) : Object.keys(message.data.cooldowns).length ? Math.floor(message.data.serverNow / 60000) : 0;
      const fingerprint = JSON.stringify([message.engineVersion, { ...message.data, serverNow: clock }]);
      const changed = fingerprint !== this.fingerprint; this.fingerprint = fingerprint;
      this.snapshot = message.data; this.receivedAt = Date.now(); this.currentEngine = message.engineVersion;
      const match = message.data.match;
      if (this.pendingStart && (!match || match.id !== this.pendingStart.id || match.state === 'finished' || match.players[match.turn] !== message.data.me)) { this.pendingStart = undefined; this.chunks = undefined; }
      if (this.pendingSubmit && (!match || match.id !== this.pendingSubmit.matchId || match.revision !== this.pendingSubmit.revision || match.state !== 'playing')) this.pendingSubmit = undefined;
      if (!this.compatible()) this.error = 'Update the game to use the current Arena rules.';
      if (changed) this.changed();
      return;
    }
    if (message.type !== 'arena:chunk') return;
    const pending = this.pendingStart;
    if (!pending || pending.id !== message.matchId || message.revision < pending.revision || this.consumed.has(`${message.matchId}:${message.revision}`)) return;
    if (!Number.isInteger(message.total) || message.total < 1 || message.total > 24 || !Number.isInteger(message.index) || message.index < 0 || message.index >= message.total || typeof message.json !== 'string' || message.json.length > 6000) return;
    if (!this.chunks || this.chunks.id !== message.matchId || this.chunks.revision !== message.revision) this.chunks = { id: message.matchId, revision: message.revision, parts: Array(message.total).fill(undefined) };
    if (this.chunks.parts.length !== message.total) return;
    this.chunks.parts[message.index] = message.json;
    if (this.chunks.parts.some((part) => part === undefined)) return;
    try {
      const json = this.chunks.parts.join('');
      if (json.length > 100000) throw new Error('Arena level is too large.');
      const setup = JSON.parse(json) as ArenaSetup;
      if (setup.matchId !== message.matchId || setup.revision !== message.revision || setup.engineVersion !== ENGINE_VERSION || !Array.isArray(setup.loadout) || setup.loadout.length < 3 || setup.loadout.length > 8 || setup.loadout.some((id) => !data.content.weapons.some((weapon) => weapon.id === id))) throw new Error('Arena setup could not be read.');
      setup.doc = validateDraft(setup.doc, data.content.builder, (type) => ({ w: MONSTER_ART[type]?.w ?? 12, h: MONSTER_ART[type]?.h ?? 14 }));
      this.consumed.add(`${setup.matchId}:${setup.revision}`);
      this.pendingStart = undefined; this.chunks = undefined; this.error = ''; this.turnError = undefined;
      for (const fn of this.setupListeners) fn(setup);
    } catch (error) { this.error = error instanceof Error ? error.message : 'Arena setup could not be read.'; this.changed(); }
  }
}

export const arena = new ArenaClient();
