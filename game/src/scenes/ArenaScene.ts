import Phaser from 'phaser';
import { C } from '../art/palette';
import { fitText, text } from '../art/font5x7';
import { MONSTER_ART } from '../art/textures';
import { sfx } from '../audio/sfx';
import { toLevel } from '../builder/document';
import { ARENA_STAKES, type ArenaPlayer, type ArenaSetup } from '../arena/types';
import { H, W } from '../config/constants';
import { arena } from '../core/arena';
import { listChallenges, type Challenge } from '../core/challenges';
import { goTo, irisOpen } from '../core/flow';
import { data } from '../data/load';
import { helpButton, maybeTutorial } from '../ui/tutorial';
import { makeButton, panel, type Btn } from '../ui/widgets';

type Tab = 'online' | 'invites' | 'match';
const PAGE_SIZE = 4;

/** Real connected players, invitations, and server-verified head-to-head results. */
export default class ArenaScene extends Phaser.Scene {
  private tab: Tab = 'online';
  private page = 0;
  private objects: Phaser.GameObjects.GameObject[] = [];
  private picker?: { player: ArenaPlayer; challenges: Challenge[]; selected: number; page: number; wager: number; loading: boolean };
  private generation = 0;
  private navigating = false;

  constructor() { super('arena'); }

  init(options?: { tab?: Tab }): void {
    this.tab = options?.tab ?? 'online';
    this.page = 0; this.objects = []; this.picker = undefined; this.navigating = false;
  }

  create(): void {
    this.add.rectangle(W / 2, H / 2, W, H, C('f'));
    panel(this, 8, 7, W - 16, H - 14, '8', '9', 'f');
    const off = arena.subscribe(() => { if (this.scene.isActive() && !this.navigating) this.draw(); });
    const offSetup = arena.onSetup((setup) => this.play(setup));
    this.events.once('shutdown', () => { this.generation++; off(); offSetup(); });
    if (arena.status === 'online') arena.sync();
    this.draw();
    helpButton(this, W - 22, 22, ['arena', 'challenges'], 9);
    maybeTutorial(this, 'arena');
    irisOpen(this);
  }

  private label(x: number, y: number, value: string, color = C('c'), width?: number, origin = 0.5): void {
    this.objects.push(text(this, x, y, width ? fitText(value, width) : value, color, 1, C('0')).setOrigin(origin, 0.5).setDepth(4));
  }
  private button(x: number, y: number, w: number, label: string, action: () => void, go = false, enabled = true): Btn {
    const button = makeButton(this, x, y, w, 24, fitText(label, w - 8), go ? 'go' : 'plain', () => { sfx.unlock(); sfx.click(); action(); }, 5);
    button.setEnabled(enabled);
    this.objects.push(button.box);
    return button;
  }

  private draw(): void {
    this.objects.forEach((object) => object.destroy()); this.objects = [];
    this.label(240, 22, 'Global Arena', C('4'));
    const state = arena.snapshot;
    this.label(20, 42, `Arena coins ${state?.coins ?? '--'}`, C('4'), 210, 0);
    this.label(460, 42, state ? `W ${state.wins}  L ${state.losses}  D ${state.draws}` : 'Sign in to play', C('d'), 210, 1);
    const incoming = state?.invitations.filter((invite) => invite.to === state.me).length ?? 0;
    const tabs: [Tab, string][] = [['online', 'Online'], ['invites', incoming ? `Invites ${incoming}` : 'Invites'], ['match', 'Match']];
    tabs.forEach(([tab, label], i) => this.button(90 + i * 150, 67, 134, label, () => { this.tab = tab; this.page = 0; this.picker = undefined; this.draw(); }, this.tab === tab));
    this.button(58, 246, 84, 'Back', () => goTo(this, 'title'));
    this.button(424, 246, 84, arena.status === 'online' ? 'Refresh' : 'Connect', () => { if (arena.status === 'online') arena.sync(); else void arena.connect(); }, false, arena.status !== 'connecting');
    if (arena.status !== 'online') {
      this.label(240, 117, arena.status === 'connecting' ? 'Connecting to Arena...' : arena.status === 'reconnecting' ? 'Reconnecting...' : 'Connect to meet players in this game.', C('c'), 420);
      this.label(240, 146, 'A full attempt each. Clear first, then score.', C('d'), 420);
      this.label(240, 169, 'Wagers are optional. Arena starts with 100 coins.', C('d'), 420);
      this.label(240, 195, 'Campaign coins and progress stay separate.', C('d'), 420);
    } else if (state) {
      if (this.tab === 'online') this.drawOnline();
      else if (this.tab === 'invites') this.drawInvites();
      else this.drawMatch();
    } else this.label(240, 145, 'Loading players...', C('d'));
    this.label(16, 225, arena.error || (!arena.compatible() ? 'Update the game before joining a match.' : 'No wager is required. Three rejections block invites for 1 hour.'), arena.error ? C('4') : C('d'), 448, 0);
    if (this.picker) this.drawPicker();
  }

  private pages(length: number): number {
    const count = Math.max(1, Math.ceil(length / PAGE_SIZE));
    this.page = Math.min(this.page, count - 1);
    if (count > 1) {
      this.button(170, 246, 32, '<', () => { this.page--; this.draw(); }, false, this.page > 0);
      this.label(240, 246, `${this.page + 1}/${count}`, C('c'));
      this.button(310, 246, 32, '>', () => { this.page++; this.draw(); }, false, this.page < count - 1);
    }
    return this.page * PAGE_SIZE;
  }

  private drawOnline(): void {
    const state = arena.snapshot!;
    const players = state.players.filter((player) => player.id !== state.me);
    const start = this.pages(players.length);
    if (!players.length) { this.label(240, 129, 'No other players are online.', C('c')); this.label(240, 156, 'Leave the game open or check back shortly.', C('d'), 420); return; }
    players.slice(start, start + PAGE_SIZE).forEach((player, i) => {
      const y = 100 + i * 30;
      this.objects.push(this.add.rectangle(240, y + 7, 428, 28, C('9')).setStrokeStyle(1, C('a')).setDepth(2));
      this.label(34, y + 1, player.name, C('c'), 184, 0);
      this.label(34, y + 13, `${player.busy ? 'In a match' : 'Available'}  W ${player.wins} / L ${player.losses}`, C('d'), 260, 0);
      const blocked = Math.max(0, (state.cooldowns[player.id] ?? 0) - arena.now());
      const pending = state.invitations.some((invite) => invite.from === state.me && invite.to === player.id);
      const busy = !!state.match && state.match.state !== 'finished';
      const label = blocked ? `${Math.ceil(blocked / 60000)}m wait` : pending ? 'Invited' : player.busy ? 'Busy' : 'Invite';
      this.button(409, y + 7, 76, label, () => this.openPicker(player), true, !blocked && !pending && !player.busy && !busy && arena.compatible());
    });
  }

  private drawInvites(): void {
    const state = arena.snapshot!;
    const invitations = state.invitations.filter((invite) => invite.expiresAt > arena.now());
    const start = this.pages(invitations.length);
    if (!invitations.length) { this.label(240, 137, 'No pending invitations.', C('c')); return; }
    invitations.slice(start, start + PAGE_SIZE).forEach((invite, i) => {
      const y = 100 + i * 30, incoming = invite.to === state.me;
      this.objects.push(this.add.rectangle(240, y + 7, 428, 28, C('9')).setStrokeStyle(1, C('a')).setDepth(2));
      this.label(32, y, `${incoming ? 'From' : 'To'} ${incoming ? invite.fromName : invite.toName}`, C('c'), 175, 0);
      this.label(32, y + 13, `${invite.title} / ${invite.wager ? `${invite.wager} coins` : 'Friendly'}`, C('d'), 175, 0);
      if (incoming) {
        if (invite.wager > 0) this.button(252, y + 7, 76, `${invite.wager} coins`, () => { arena.send({ type: 'arena:respond', inviteId: invite.id, accept: true, wager: invite.wager }); this.tab = 'match'; }, true, state.coins >= invite.wager && arena.compatible());
        this.button(326, y + 7, 58, 'Free', () => { arena.send({ type: 'arena:respond', inviteId: invite.id, accept: true, wager: 0 }); this.tab = 'match'; }, true, arena.compatible());
        this.button(413, y + 7, 66, 'Reject', () => { arena.send({ type: 'arena:respond', inviteId: invite.id, accept: false, wager: 0 }); });
      } else this.button(410, y + 7, 72, 'Cancel', () => { arena.send({ type: 'arena:cancel', inviteId: invite.id }); });
    });
  }

  private drawMatch(): void {
    const state = arena.snapshot!, match = state.match;
    if (!match) { this.label(240, 128, 'No match yet. Invite an online player.', C('c'), 420); return; }
    this.label(240, 96, match.title, C('4'), 420);
    match.names.forEach((name, i) => {
      const result = match.results[i];
      this.label(32, 121 + i * 28, `${name}${match.players[i] === state.me ? ' (you)' : ''}`, C('c'), 220, 0);
      this.label(448, 121 + i * 28, result ? result.forfeit ? 'Forfeit' : `${result.cleared ? 'Clear' : 'Not cleared'}  ${result.score}` : 'Awaiting turn', C('d'), 205, 1);
    });
    if (match.state === 'finished') {
      const result = match.resolution === 'cancelled' ? 'Match cancelled - coins returned' : match.resolution === 'draw' ? 'Draw - both stakes returned' : match.winnerId === state.me ? 'You win!' : `${match.names[match.players.indexOf(match.winnerId!)] || 'Opponent'} wins`;
      this.label(240, 183, result, C('4'), 430);
      this.label(240, 205, match.wager ? `Wager ${match.wager} each / pot ${match.wager * 2}` : 'Friendly match - no coins wagered', C('d'), 430);
      return;
    }
    const mine = match.players[match.turn] === state.me;
    const seconds = Math.max(0, Math.ceil((match.deadline - arena.now()) / 1000));
    this.label(240, 177, `${mine ? 'Your turn' : `${match.names[match.turn]}'s turn`} / ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`, C('c'), 430);
    if (mine && match.state === 'ready') this.button(240, 204, 130, arena.isStarting() ? 'Starting...' : 'Play turn', () => { arena.startTurn(); }, true, arena.compatible() && !arena.isStarting());
    else this.label(240, 204, mine ? arena.isStarting() ? 'Preparing your attempt...' : 'Attempt interrupted. Forfeit to finish this turn.' : 'Your opponent gets one full attempt.', C('d'), 430);
    this.button(318, 246, 92, match.state === 'ready' && match.turn === 0 ? 'Cancel match' : 'Forfeit', () => { arena.forfeit(); });
  }

  private openPicker(player: ArenaPlayer): void {
    const generation = ++this.generation;
    this.picker = { player, challenges: [], selected: 0, page: 0, wager: 0, loading: true };
    this.draw();
    void listChallenges('new').then((challenges) => {
      if (!this.scene.isActive() || generation !== this.generation || !this.picker) return;
      this.picker.challenges = challenges; this.picker.loading = false; this.draw();
    }).catch(() => { if (generation === this.generation && this.picker) { this.picker.loading = false; this.draw(); } });
  }

  private drawPicker(): void {
    const picker = this.picker!;
    const overlay = this.add.rectangle(240, 135, W, H, C('0'), 0.86).setDepth(20).setInteractive();
    this.objects.push(overlay, panel(this, 32, 48, 416, 211, '8', '9', 'f', 21));
    const first = this.objects.length;
    this.label(240, 64, `Invite ${picker.player.name}`, C('4'), 385);
    if (picker.loading || !picker.challenges.length) this.label(240, 128, picker.loading ? 'Loading shared challenges...' : 'Publish a challenge before inviting a player.', C('d'), 385);
    const pages = Math.max(1, Math.ceil(picker.challenges.length / 3));
    picker.challenges.slice(picker.page * 3, picker.page * 3 + 3).forEach((challenge, row) => {
      const index = picker.page * 3 + row;
      this.button(240, 95 + row * 30, 380, `${index + 1}. ${challenge.title} / ${challenge.shots} shots`, () => { picker.selected = index; this.draw(); }, index === picker.selected);
    });
    this.label(240, 181, 'Optional stake - opponent can choose friendly', C('d'), 390);
    ARENA_STAKES.forEach((stake, i) => this.button(114 + i * 84, 204, 76, stake ? `${stake} coins` : 'No wager', () => { picker.wager = stake; this.draw(); }, picker.wager === stake, (arena.snapshot?.coins ?? 0) >= stake));
    this.button(104, 238, 106, 'Cancel', () => { this.picker = undefined; this.generation++; this.draw(); });
    this.button(195, 238, 30, '<', () => { picker.page--; this.draw(); }, false, picker.page > 0);
    this.button(236, 238, 30, '>', () => { picker.page++; this.draw(); }, false, picker.page < pages - 1);
    this.button(354, 238, 120, 'Send invite', () => {
      const challenge = picker.challenges[picker.selected];
      if (challenge && arena.send({ type: 'arena:invite', targetId: picker.player.id, challengeId: challenge.id, wager: picker.wager })) { this.picker = undefined; this.tab = 'invites'; this.page = 0; this.draw(); }
    }, true, !picker.loading && !!picker.challenges[picker.selected] && arena.compatible());
    for (let i = first; i < this.objects.length; i++) (this.objects[i] as Phaser.GameObjects.GameObject & { setDepth(depth: number): unknown }).setDepth(22 + (this.objects[i] instanceof Phaser.GameObjects.Container ? 1 : 0));
  }

  private play(setup: ArenaSetup): void {
    if (!this.scene.isActive() || this.navigating) return;
    this.navigating = true;
    const level = toLevel(setup.doc, data.content.builder, (type) => ({ w: MONSTER_ART[type]?.w ?? 12, h: MONSTER_ART[type]?.h ?? 14 }));
    level.loadout = setup.loadout.slice(); level.shots = setup.loadout.length;
    goTo(this, 'game', { level: 1000, loadout: setup.loadout, customLevel: level, arena: setup });
  }
}
