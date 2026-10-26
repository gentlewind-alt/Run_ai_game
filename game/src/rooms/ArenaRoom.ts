import { GameRoom, type GameMessage, type GameRoomProps, type Player } from '@series-inc/rundot-game-sdk/mp-server';
import { ArenaAuthority, type ArenaState } from '../arena/authority';
import type { ArenaMessage, ArenaSetup } from '../arena/types';
import { ENGINE_VERSION, prepareChallenge, verifyReplay } from '../../.arena/arena-runtime.mjs';

/** One authenticated, persistent game-wide authority; clients never supply balances or scores. */
export default class ArenaRoom extends GameRoom<ArenaMessage> {
  private authority: ArenaAuthority;
  private queue: Promise<void> = Promise.resolve();
  private lastRequest = new Map<string, { second: number; count: number }>();
  private pending = new Map<string, number>();
  private snapshotSequence = 0;

  constructor(props: GameRoomProps) { super(props); this.authority = this.makeAuthority(); }

  private makeAuthority(saved?: ArenaState): ArenaAuthority {
    return new ArenaAuthority({
      engineVersion: ENGINE_VERSION, now: () => Date.now(),
      online: () => [...this.players.values()].filter(p => p.connected).map(p => ({ id: p.id, name: p.username.slice(0, 24) })),
      loadChallenge: async id => {
        const row = await this.services.ugc.get(id);
        if (!row) throw new Error('This challenge is no longer available.');
        return { title: String(row.title ?? 'Challenge'), challenge: prepareChallenge(row) };
      },
      verify: verifyReplay,
    }, saved);
  }

  protected getPersistState(): Record<string, unknown> { return { arena: this.authority.state }; }
  protected onRestore(saved: Record<string, unknown>): void { this.authority = this.makeAuthority(saved.arena as ArenaState | undefined); }
  protected onMigrate(saved: Record<string, unknown>): void { this.onRestore(saved); this.save(); }

  protected onPlayerJoin(player: Player): void { this.authority.join(player.id); this.save(); this.push(); }
  protected onPlayerLeave(): void { this.push(); }
  protected onTick(): Promise<void> {
    return this.enqueue(async () => { if (this.authority.expire()) this.save(); this.push(); });
  }

  protected onGameMessage({ sender, payload }: GameMessage<ArenaMessage>): Promise<void> {
    if (!sender.connected || !payload || typeof payload !== 'object' || !('engineVersion' in payload)) return Promise.resolve();
    const currentSecond = Math.floor(Date.now() / 1000), rate = this.lastRequest.get(sender.id);
    const count = rate?.second === currentSecond ? rate.count + 1 : 1;
    this.lastRequest.set(sender.id, { second: currentSecond, count });
    const queued = this.pending.get(sender.id) ?? 0;
    if (count > 20 || queued >= 8) { this.sendTo(sender.id, { type: 'arena:error', message: 'Please slow down and wait a moment.' }); return Promise.resolve(); }
    this.pending.set(sender.id, queued + 1);
    return this.enqueue(async () => {
      try {
        if (payload.engineVersion !== ENGINE_VERSION) throw new Error('Reload the game to use the current Arena rules.');
        const commands = ['arena:sync', 'arena:invite', 'arena:respond', 'arena:cancel', 'arena:start', 'arena:input', 'arena:submit', 'arena:forfeit'];
        if (!commands.includes(payload.type)) return;
        const setup = await this.authority.act(sender.id, payload as Parameters<ArenaAuthority['act']>[1]);
        this.save();
        if (payload.type === 'arena:input') return;
        this.push();
        if (setup) this.setup(sender.id, setup);
      } catch (error) {
        this.save();
        this.sendTo(sender.id, { type: 'arena:error', message: error instanceof Error ? error.message : 'The Arena request could not be completed.' });
        this.sendSnapshot(sender.id);
      }
    }).finally(() => this.pending.set(sender.id, Math.max(0, (this.pending.get(sender.id) ?? 1) - 1)));
  }

  private enqueue(action: () => Promise<void>): Promise<void> {
    const pending = this.queue.then(action);
    this.queue = pending.catch(error => { this.log.error('Arena request failed', { error: String(error) }); });
    return pending;
  }

  private sendSnapshot(id: string): void {
    const snapshot: ArenaMessage = { type: 'arena:snapshot', data: this.authority.view(id), engineVersion: ENGINE_VERSION };
    const json = JSON.stringify(snapshot);
    if (new TextEncoder().encode(json).length <= 12000) { this.sendTo(id, snapshot); return; }
    const transferId = `${Date.now()}_${++this.snapshotSequence}`, total = Math.ceil(json.length / 3000);
    for (let index = 0; index < total; index++) this.sendTo(id, { type: 'arena:snapshot-chunk', id: transferId, index, total, json: json.slice(index * 3000, (index + 1) * 3000) });
  }
  private push(): void { for (const player of this.players.values()) if (player.connected) this.sendSnapshot(player.id); }
  private setup(id: string, setup: ArenaSetup): void {
    const json = JSON.stringify(setup), total = Math.ceil(json.length / 6000);
    for (let index = 0; index < total; index++) this.sendTo(id, {
      type: 'arena:chunk', matchId: setup.matchId, revision: setup.revision, index, total, json: json.slice(index * 6000, (index + 1) * 6000),
    });
  }
}
