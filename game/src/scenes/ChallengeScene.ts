import Phaser from 'phaser';
import { C } from '../art/palette';
import { setText, text } from '../art/font5x7';
import { weaponTexture } from '../art/textures';
import { sfx } from '../audio/sfx';
import { H, W } from '../config/constants';
import { admin } from '../core/admin';
import { challengeBoard, getChallenge, removeChallenge, resetBoard, type Board, type Challenge } from '../core/challenges';
import { goTo, irisOpen } from '../core/flow';
import { makeButton, panel } from '../ui/widgets';

const ROWS = 7;
const ROW_H = 12;

/** One challenge: its rules (shots and allowed weapons), its own score board, and Play. Only the author sees Edit rules and Delete. */
export default class ChallengeScene extends Phaser.Scene {
  private id = '';
  private challenge?: Challenge;
  private token = 0;
  private objs: Phaser.GameObjects.GameObject[] = [];
  private status?: Phaser.GameObjects.Image;

  constructor() {
    super('challenge');
  }

  init(d: { id: string; challenge?: Challenge }): void {
    this.id = d.id;
    this.challenge = d.challenge;
    this.objs = [];
  }

  create(): void {
    this.add.rectangle(W / 2, H / 2, W, H, C('f'));
    panel(this, 16, 8, W - 32, H - 16, '8', '9', 'f', 1);
    this.status = text(this, W / 2, 120, 'Loading challenge', C('d'), 1, C('0')).setDepth(3);
    makeButton(this, 70, H - 22, 90, 22, 'Back', 'plain', () => { sfx.click(); goTo(this, 'challenges'); }, 3);
    const mine = ++this.token;
    void (this.challenge ? Promise.resolve(this.challenge) : getChallenge(this.id)).then(async (c) => {
      if (mine !== this.token || !this.scene.isActive()) return;
      if (!c) { if (this.status) setText(this.status, this, 'This challenge is gone.', C('d'), C('0')); return; }
      this.challenge = c;
      this.drawInfo(c);
      const board = await challengeBoard(c, ROWS);
      if (mine === this.token && this.scene.isActive()) this.drawBoard(board);
    }).catch(() => { if (this.status && this.scene.isActive()) setText(this.status, this, 'Could not load this challenge', C('d'), C('0')); });
    irisOpen(this);
  }

  private drawInfo(c: Challenge): void {
    if (this.status) setText(this.status, this, ' ', C('d'), C('0'));
    text(this, W / 2, 22, c.title.slice(0, 30), C('4'), 2, C('0')).setDepth(3);
    text(this, W / 2, 40, `by ${c.mine ? 'you' : c.authorName}   ${c.challengers} challengers   ${c.shots} shots`, C('c'), 1, C('0')).setDepth(3);
    text(this, 30, 56, 'Allowed weapons', C('d'), 1, C('0')).setOrigin(0, 0.5).setDepth(3);
    c.allowed.slice(0, 18).forEach((id, i) => {
      const x = 36 + (i % 9) * 24;
      const y = 72 + Math.floor(i / 9) * 22;
      this.add.rectangle(x, y, 20, 20, C('0')).setStrokeStyle(1, C('a')).setDepth(3);
      const tex = weaponTexture(id);
      const w = this.textures.get(tex)?.getSourceImage()?.width ?? 16;
      this.add.image(x, y, tex).setScale(w >= 32 ? 0.5 : 0.9).setDepth(4);
    });
    if (c.allowed.length > 18) text(this, 36 + 9 * 24 - 4, 56, `+${c.allowed.length - 18} more`, C('d'), 1, C('0')).setOrigin(1, 0.5).setDepth(3);
    const canDelete = c.mine || admin.is;
    const specs: { label: string; w: number; kind: 'go' | 'plain' | 'danger'; run: () => void }[] = [
      { label: 'Play', w: 90, kind: 'go', run: () => goTo(this, 'challengeWeapons', { mode: 'play', challenge: c }) },
    ];
    if (c.mine || admin.is) specs.push({ label: 'Edit rules', w: 84, kind: 'plain', run: () => goTo(this, 'challengeWeapons', { mode: 'edit', challenge: c }) });
    if (admin.is) specs.push({ label: 'Reset board', w: 90, kind: 'plain', run: () => { void resetBoard(c).then(() => { if (this.scene.isActive()) this.scene.restart({ id: c.id }); }); } });
    let x = 120;
    for (const spec of specs) {
      const half = spec.w / 2;
      makeButton(this, x + half, H - 22, spec.w, 22, spec.label, spec.kind, () => { sfx.click(); spec.run(); }, 3);
      x += spec.w + 8;
    }
    if (admin.is) text(this, W - 40, 22, 'ADMIN', C('4'), 1, C('0')).setOrigin(1, 0.5).setDepth(3);
    if (canDelete) {
      let armed = false;
      const del = makeButton(this, W - 66, H - 22, 70, 22, 'Delete', 'danger', () => {
        if (!armed) {
          armed = true;
          del.setLabel('Sure?');
          this.time.delayedCall(2500, () => { armed = false; if (this.scene.isActive()) del.setLabel('Delete'); });
          return;
        }
        void removeChallenge(c).then((ok) => {
          if (ok) goTo(this, 'challenges', { tab: c.mine ? 'mine' : 'new' });
          else if (this.status) setText(this.status, this, 'Could not delete. Try again.', C('d'), C('0'));
        });
      }, 3);
    }
  }

  private drawBoard(board: Board): void {
    this.objs.forEach((o) => o.destroy());
    this.objs = [];
    const top = 122;
    this.objs.push(text(this, 30, top - 8, 'Leaderboard', C('d'), 1, C('0')).setOrigin(0, 0.5).setDepth(3));
    if (!board.rows.length) {
      this.objs.push(text(this, W / 2, top + 30, 'No scores yet. Be the first to clear it!', C('d'), 1, C('0')).setDepth(3));
      return;
    }
    let youShown = false;
    board.rows.forEach((r, i) => {
      const y = top + 5 + i * ROW_H;
      const isMe = board.me?.rank === r.rank;
      youShown = youShown || isMe;
      const col = isMe ? C('4') : C('c');
      this.objs.push(
        text(this, 40, y, `#${r.rank}`, col, 1, C('0')).setOrigin(0, 0.5).setDepth(3),
        text(this, 74, y, r.name.slice(0, 20), col, 1, C('0')).setOrigin(0, 0.5).setDepth(3),
        text(this, W - 40, y, String(r.score), col, 1, C('0')).setOrigin(1, 0.5).setDepth(3),
      );
    });
    if (board.me && !youShown) {
      const y = top + 5 + ROWS * ROW_H;
      this.objs.push(
        text(this, 40, y, `You #${board.me.rank}`, C('4'), 1, C('0')).setOrigin(0, 0.5).setDepth(3),
        text(this, W - 40, y, String(board.me.score), C('4'), 1, C('0')).setOrigin(1, 0.5).setDepth(3),
      );
    }
  }
}
