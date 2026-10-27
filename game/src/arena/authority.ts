import {
  ARENA_BLOCK_MS, ARENA_INVITE_MS, ARENA_MAX_ACTIONS, ARENA_MAX_FRAMES, ARENA_READY_MS,
  ARENA_REJECT_LIMIT, ARENA_TURN_MS,
  type ArenaAction, type ArenaChallenge, type ArenaCommand, type ArenaInvitation, type ArenaMatch,
  type ArenaCatalog, type ArenaEquipmentSnapshot, type ArenaMods, type ArenaPlayer, type ArenaReplay,
  type ArenaResult, type ArenaSetup, type ArenaSnapshot,
} from './types';

interface Wallet { coins: number; wins: number; losses: number; draws: number; slings?: string[]; sling?: string; boosts?: Record<string, number> }
interface Pair { rejects: number; blockedUntil: number }
interface Invitation extends ArenaInvitation { challenge: ArenaChallenge }
interface Match extends ArenaMatch { challenge: ArenaChallenge | null; actions: ArenaAction[]; startedAt: number }
export interface ArenaState {
  v: 1; engineVersion: string; seq: number;
  wallets: Record<string, Wallet>; pairs: Record<string, Pair>; invitations: Record<string, Invitation>;
  matches: Record<string, Match>; lastMatch: Record<string, string>;
}
export interface ArenaDependencies {
  catalog: ArenaCatalog;
  engineVersion: string;
  now(): number;
  online(): { id: string; name: string }[];
  loadChallenge(id: string): Promise<{ title: string; challenge: ArenaChallenge }>;
  verify(challenge: ArenaChallenge, replay: ArenaReplay, mods: ArenaMods): ArenaResult;
}
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const emptyResult = (): ArenaResult => ({ cleared: false, score: 0, shotsUsed: 0, steps: 0, forfeit: true });
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const pairKey = (from: string, to: string): string => JSON.stringify([from, to]);
const requireThat = (ok: unknown, message: string): void => { if (!ok) throw new Error(message); };

/** All balances, invitations and turn transitions are owned by one persistent room. */
export class ArenaAuthority {
  readonly state: ArenaState;

  constructor(private readonly deps: ArenaDependencies, saved?: ArenaState) {
    if (saved && saved.v !== 1) throw new Error('Unsupported Arena state; balances have been preserved.');
    this.state = saved ? clone(saved) : { v: 1, engineVersion: deps.engineVersion, seq: 0, wallets: {}, pairs: {}, invitations: {}, matches: {}, lastMatch: {} };
    if (this.state.engineVersion !== deps.engineVersion) {
      for (const match of Object.values(this.state.matches)) if (match.state !== 'finished') this.cancelMatch(match);
      this.state.invitations = {};
      this.state.engineVersion = deps.engineVersion;
    }
    this.expire();
  }

  join(id: string): void {
    if (this.state.wallets[id]) { this.normalizeWallet(this.state.wallets[id]); return; }
    requireThat(Object.keys(this.state.wallets).length < 2000, 'The Arena is full. Please try again later.');
    this.state.wallets[id] = { coins: this.deps.catalog.startCoins, wins: 0, losses: 0, draws: 0 };
    this.normalizeWallet(this.state.wallets[id]);
  }

  private active(id: string): Match | undefined {
    const match = this.state.matches[this.state.lastMatch[id]];
    return match && match.state !== 'finished' ? match : undefined;
  }

  private names(id: string): string { return this.deps.online().find(p => p.id === id)?.name ?? 'Player'; }
  private wallet(id: string): Wallet { this.join(id); return this.state.wallets[id]; }

  private normalizeWallet(wallet: Wallet): void {
    const starter = this.deps.catalog.slings.find((sling) => sling.price === 0) ?? this.deps.catalog.slings[0];
    const known = new Set(this.deps.catalog.slings.map((sling) => sling.id));
    const owned = Array.isArray(wallet.slings) ? [...new Set(wallet.slings.filter((id) => known.has(id)))] : [];
    if (!owned.includes(starter.id)) owned.unshift(starter.id);
    wallet.slings = owned;
    if (!wallet.sling || !owned.includes(wallet.sling)) wallet.sling = starter.id;
    const oldBoosts = wallet.boosts ?? {};
    wallet.boosts = Object.fromEntries(this.deps.catalog.boosts.map((boost) => {
      const level = oldBoosts[boost.id];
      return [boost.id, Number.isInteger(level) ? Math.max(0, Math.min(boost.prices.length, level)) : 0];
    }));
  }

  private equipment(id: string): ArenaEquipmentSnapshot {
    const wallet = this.wallet(id);
    const sling = this.deps.catalog.slings.find((row) => row.id === wallet.sling)!;
    const boosts = { ...wallet.boosts! };
    const mods: ArenaMods = {
      ...sling.mods,
      damageMult: sling.mods.damageMult ?? 1,
      launchSpeedMult: sling.mods.launchSpeedMult ?? 1,
      previewMult: sling.mods.previewMult ?? 1,
    };
    for (const boost of this.deps.catalog.boosts) {
      mods[boost.mod] = (mods[boost.mod] ?? 1) + boost.perLevel * boosts[boost.id];
    }
    return { slingId: sling.id, skin: sling.skin, boosts, mods };
  }

  private requireCanManage(id: string): void {
    const match = this.active(id);
    requireThat(!match || match.state !== 'playing' || match.players[match.turn] !== id, 'Finish your playing turn before changing slingshots.');
  }

  view(id: string): ArenaSnapshot {
    const wallet = this.wallet(id), now = this.deps.now();
    const players: ArenaPlayer[] = this.deps.online().filter(p => p.id !== id).map(p => {
      const w = this.wallet(p.id);
      return { ...p, busy: !!this.active(p.id), wins: w.wins, losses: w.losses, draws: w.draws };
    });
    const invitations = Object.values(this.state.invitations).filter(i => i.from === id || i.to === id).map(({ challenge: _challenge, ...i }) => i);
    const cooldowns: Record<string, number> = {};
    for (const p of players) {
      const pair = this.state.pairs[pairKey(id, p.id)];
      if (pair && pair.blockedUntil > now) cooldowns[p.id] = pair.blockedUntil;
    }
    const match = this.state.matches[this.state.lastMatch[id]];
    const publicMatch = match ? (({ challenge: _challenge, actions: _actions, startedAt: _startedAt, ...m }) => m)(match) : null;
    if (match && publicMatch) {
      publicMatch.equipment = [match.equipment?.[0] ?? this.equipment(match.players[0]), match.equipment?.[1] ?? this.equipment(match.players[1])];
    }
    return clone({
      me: id, coins: wallet.coins, wins: wallet.wins, losses: wallet.losses, draws: wallet.draws,
      players, invitations, match: publicMatch, cooldowns, serverNow: now,
      stakes: this.deps.catalog.stakes, slingCatalog: this.deps.catalog.slings, boostCatalog: this.deps.catalog.boosts,
      ownedSlings: wallet.slings!, equippedSling: wallet.sling!, boostLevels: wallet.boosts!,
    });
  }

  expire(): boolean {
    const now = this.deps.now();
    let changed = false;
    for (const [id, invite] of Object.entries(this.state.invitations)) if (invite.expiresAt <= now) { delete this.state.invitations[id]; changed = true; }
    for (const match of Object.values(this.state.matches)) {
      if (match.state !== 'finished' && match.deadline <= now) { this.completeTurn(match, emptyResult()); changed = true; }
    }
    for (const [key, pair] of Object.entries(this.state.pairs)) {
      if (pair.blockedUntil > 0 && pair.blockedUntil <= now) { delete this.state.pairs[key]; changed = true; }
    }
    return changed;
  }

  async act(id: string, command: ArenaCommand): Promise<ArenaSetup | undefined> {
    this.wallet(id);
    this.expire();
    const now = this.deps.now();
    switch (command.type) {
      case 'arena:sync': return;
      case 'arena:invite': {
        const to = command.targetId;
        requireThat(typeof to === 'string' && to !== id && this.deps.online().some(p => p.id === to), 'That player is no longer online.');
        requireThat(!this.active(id) && !this.active(to), 'Finish the current match first.');
        requireThat(this.deps.catalog.stakes.includes(command.wager), 'Choose one of the listed coin stakes.');
        requireThat(this.wallet(id).coins >= command.wager && this.wallet(to).coins >= command.wager, 'There are not enough Arena coins for that wager. Choose a free match.');
        const key = pairKey(id, to), pair = this.state.pairs[key];
        requireThat(!pair || pair.blockedUntil <= now, 'Three invitations were rejected. Try this player again after the one-hour cooldown.');
        if (pair?.blockedUntil && pair.blockedUntil <= now) this.state.pairs[key] = { rejects: 0, blockedUntil: 0 };
        requireThat(!Object.values(this.state.invitations).some(i => i.from === id && i.to === to), 'You already sent this player an invitation.');
        requireThat(Object.values(this.state.invitations).filter(i => i.from === id).length < 5, 'Wait for your pending invitations before sending more.');
        requireThat(Object.keys(this.state.invitations).length < 20, 'The Arena has many pending invitations. Please wait a moment.');
        requireThat(typeof command.challengeId === 'string' && command.challengeId.length <= 128, 'Choose an available challenge.');
        const loaded = await this.deps.loadChallenge(command.challengeId);
        requireThat(this.deps.online().some(p => p.id === to) && !this.active(id) && !this.active(to), 'This player is no longer available.');
        const inviteId = `invite_${++this.state.seq}`;
        this.state.invitations[inviteId] = {
          id: inviteId, from: id, fromName: this.names(id), to, toName: this.names(to), challengeId: command.challengeId,
          title: loaded.title.slice(0, 40), wager: command.wager, expiresAt: now + ARENA_INVITE_MS, challenge: clone(loaded.challenge),
        };
        if (JSON.stringify(this.state).length > 750000) { delete this.state.invitations[inviteId]; throw new Error('The Arena is busy. Please try again after another match finishes.'); }
        return;
      }
      case 'arena:respond': {
        const invite = this.state.invitations[command.inviteId];
        requireThat(invite && invite.to === id, 'That invitation has expired or was already answered.');
        requireThat(typeof command.accept === 'boolean', 'Choose accept or reject.');
        if (!command.accept) {
          delete this.state.invitations[invite.id];
          const key = pairKey(invite.from, id), pair = this.state.pairs[key] ?? { rejects: 0, blockedUntil: 0 };
          pair.rejects++;
          if (pair.rejects >= ARENA_REJECT_LIMIT) pair.blockedUntil = now + ARENA_BLOCK_MS;
          this.state.pairs[key] = pair;
          return;
        }
        requireThat(command.wager === 0 || command.wager === invite.wager, 'You can accept the offered stake or play free.');
        requireThat(!this.active(id) && !this.active(invite.from), 'One of these players already has a match.');
        requireThat(this.deps.online().some(p => p.id === invite.from), 'The inviting player is no longer online.');
        const a = this.wallet(invite.from), b = this.wallet(id), stake = command.wager;
        requireThat(a.coins >= stake && b.coins >= stake, 'Not enough Arena coins. Accept a free match instead.');
        a.coins -= stake; b.coins -= stake;
        const matchId = `match_${++this.state.seq}`;
        const match: Match = {
          id: matchId, players: [invite.from, id], names: [invite.fromName, invite.toName], challengeId: invite.challengeId,
          title: invite.title, wager: stake, turn: 0, state: 'ready', revision: 1, deadline: now + ARENA_READY_MS,
          results: [null, null], winnerId: null, resolution: null, equipment: [null, null], challenge: clone(invite.challenge), actions: [], startedAt: 0,
        };
        this.state.matches[matchId] = match;
        this.state.lastMatch[invite.from] = matchId; this.state.lastMatch[id] = matchId;
        delete this.state.pairs[pairKey(invite.from, id)];
        for (const [key, pending] of Object.entries(this.state.invitations)) {
          if ([pending.from, pending.to].some(p => match.players.includes(p))) delete this.state.invitations[key];
        }
        return;
      }
      case 'arena:cancel': {
        const invite = this.state.invitations[command.inviteId];
        requireThat(invite && invite.from === id, 'Only the sender can cancel a pending invitation.');
        delete this.state.invitations[invite.id]; return;
      }
      case 'arena:buy-sling': {
        this.requireCanManage(id);
        const wallet = this.wallet(id), sling = this.deps.catalog.slings.find((row) => row.id === command.slingId);
        requireThat(sling, 'Choose a known Arena slingshot.');
        const selected = sling!;
        requireThat(!wallet.slings!.includes(selected.id), 'You already own that slingshot.');
        requireThat(wallet.coins >= selected.price, 'Not enough Arena coins for that slingshot.');
        wallet.coins -= selected.price;
        wallet.slings!.push(selected.id);
        return;
      }
      case 'arena:equip-sling': {
        this.requireCanManage(id);
        const wallet = this.wallet(id), sling = this.deps.catalog.slings.find((row) => row.id === command.slingId);
        requireThat(sling, 'Choose a known Arena slingshot.');
        const selected = sling!;
        requireThat(wallet.slings!.includes(selected.id), 'Buy that slingshot before equipping it.');
        wallet.sling = selected.id;
        return;
      }
      case 'arena:boost': {
        this.requireCanManage(id);
        const wallet = this.wallet(id), boost = this.deps.catalog.boosts.find((row) => row.id === command.boostId);
        requireThat(boost, 'Choose a known Arena boost.');
        const selected = boost!;
        const level = wallet.boosts![selected.id], price = selected.prices[level];
        requireThat(price !== undefined, 'That boost is already at max level.');
        requireThat(wallet.coins >= price, 'Not enough Arena coins for that boost.');
        wallet.coins -= price;
        wallet.boosts![selected.id] = level + 1;
        return;
      }
      case 'arena:start': {
        const match = this.current(id, command.matchId, command.revision);
        if (match.state === 'ready') { match.state = 'playing'; match.revision++; match.startedAt = now; match.deadline = now + ARENA_TURN_MS; }
        requireThat(match.actions.length === 0, 'This attempt has already started. Continue it or forfeit.');
        match.equipment ??= [null, null];
        match.equipment[match.turn] ??= this.equipment(id);
        const equipment = match.equipment[match.turn]!;
        return clone({ matchId: match.id, revision: match.revision, ...match.challenge!, ...equipment, engineVersion: this.deps.engineVersion });
      }
      case 'arena:input': {
        const match = this.current(id, command.matchId, command.revision);
        requireThat(match.state === 'playing', 'Start your turn before firing.');
        requireThat(match.actions.length < ARENA_MAX_ACTIONS, 'This attempt has too many actions.');
        const action = command.action;
        requireThat(action && (action.type === 'fire' || action.type === 'ability') && Number.isInteger(action.frame) && action.frame >= 0 && action.frame < ARENA_MAX_FRAMES, 'Invalid turn input.');
        requireThat(action.frame <= Math.floor((now - match.startedAt) * 60 / 1000) + 180, 'Turn inputs advanced faster than the match clock.');
        requireThat(!match.actions.length || action.frame >= match.actions[match.actions.length - 1].frame, 'Inputs must stay in their original order.');
        if (action.type === 'fire') requireThat(finite(action.angle) && Math.abs(action.angle) <= 180 && finite(action.power) && action.power > 0 && action.power <= 1 + 1e-9, 'Invalid shot.');
        match.actions.push(clone(action)); return;
      }
      case 'arena:submit': {
        const match = this.current(id, command.matchId, command.revision);
        requireThat(match.state === 'playing', 'That turn is not accepting results.');
        requireThat(command.replay && JSON.stringify(command.replay.actions) === JSON.stringify(match.actions), 'The turn inputs changed. Results were not accepted.');
        requireThat(Number.isInteger(command.replay.frames) && command.replay.frames > 0 && command.replay.frames <= ARENA_MAX_FRAMES, 'Invalid attempt duration.');
        requireThat(command.replay.frames <= Math.floor((now - match.startedAt) * 60 / 1000) + 180, 'The replay advanced faster than the match clock.');
        let result: ArenaResult;
        try {
          const mods = match.equipment?.[match.turn]?.mods;
          if (!mods) throw new Error('This turn has no equipment snapshot.');
          result = this.deps.verify(match.challenge!, { frames: command.replay.frames, actions: clone(match.actions) }, clone(mods));
        }
        catch { this.completeTurn(match, emptyResult()); throw new Error('The attempt could not be verified and this turn was forfeited.'); }
        this.completeTurn(match, result); return;
      }
      case 'arena:forfeit': {
        const match = this.state.matches[command.matchId];
        requireThat(match && match.players.includes(id), 'You are not in this match.');
        if (match.state === 'finished') return;
        requireThat(match.revision === command.revision, 'The match changed. Refresh its current turn.');
        if (match.state === 'ready' && match.turn === 0 && !match.results[0]) { this.cancelMatch(match); return; }
        if (match.players[match.turn] !== id) {
          // A waiting player concedes the match; do not let an opponent retain a locked stake.
          match.results[match.players[0] === id ? 0 : 1] = emptyResult();
          const opponent = match.players[0] === id ? 1 : 0;
          match.results[opponent] ??= { cleared: false, score: 0, shotsUsed: 0, steps: 0, forfeit: false };
          this.settle(match); return;
        }
        this.completeTurn(match, emptyResult()); return;
      }
    }
  }

  private current(id: string, matchId: string, revision: number): Match {
    const match = this.state.matches[matchId];
    requireThat(match && match.state !== 'finished' && match.players[match.turn] === id, 'Wait for your turn.');
    requireThat(match.revision === revision, 'The match changed. Refresh its current turn.');
    return match;
  }

  private completeTurn(match: Match, result: ArenaResult): void {
    match.results[match.turn] = clone(result);
    if (match.turn === 0 && !match.results[1]) {
      match.turn = 1; match.state = 'ready'; match.revision++; match.actions = [];
      match.deadline = this.deps.now() + ARENA_READY_MS;
    } else this.settle(match);
  }

  private settle(match: Match): void {
    if (match.state === 'finished') return;
    const [a, b] = match.results as [ArenaResult, ArenaResult];
    const compare = Number(!a.forfeit) - Number(!b.forfeit) || Number(a.cleared) - Number(b.cleared) || a.score - b.score;
    match.state = 'finished'; match.revision++; match.deadline = 0;
    if (compare === 0) {
      match.resolution = 'draw'; match.winnerId = null;
      for (const id of match.players) { this.wallet(id).coins += match.wager; this.wallet(id).draws++; }
    } else {
      const winner = match.players[compare > 0 ? 0 : 1], loser = match.players[compare > 0 ? 1 : 0];
      match.resolution = 'win'; match.winnerId = winner;
      this.wallet(winner).coins += match.wager * 2;
      this.wallet(winner).wins++; this.wallet(loser).losses++;
    }
    match.actions = [];
    match.challenge = null;
    this.pruneFinished();
  }

  private cancelMatch(match: Match): void {
    if (match.state === 'finished') return;
    for (const id of match.players) this.wallet(id).coins += match.wager;
    match.state = 'finished'; match.resolution = 'cancelled'; match.winnerId = null; match.deadline = 0; match.revision++; match.actions = [];
    match.challenge = null;
    this.pruneFinished();
  }

  private pruneFinished(): void {
    const finished = Object.values(this.state.matches).filter(m => m.state === 'finished');
    for (const match of finished.slice(0, Math.max(0, finished.length - 100))) delete this.state.matches[match.id];
  }
}
