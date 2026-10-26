import Phaser from 'phaser';
import { C } from '../art/palette';
import { setText, text } from '../art/font5x7';
import { sfx } from '../audio/sfx';
import { H, W } from '../config/constants';
import { feature } from '../config/settings';
import { goTo, irisOpen } from '../core/flow';
import { listChallenges, type Challenge, type ChallengeSort } from '../core/challenges';
import { makeButton, panel } from '../ui/widgets';

const TABS: { id: ChallengeSort; label: string }[] = [{ id: 'top', label: 'Top' }, { id: 'new', label: 'New' }, { id: 'mine', label: 'Mine' }];
const PER_PAGE = 5;
const ROW_H = 30;
let lastTab: ChallengeSort = 'top';

/** Browse the shared levels: ranked by number of challengers (Top), newest, or your own. */
export default class ChallengesScene extends Phaser.Scene {
  private tab: ChallengeSort = 'top';
  private page = 0;
  private items: Challenge[] = [];
  private rowObjs: Phaser.GameObjects.GameObject[] = [];
  private status?: Phaser.GameObjects.Image;
  private token = 0;

  constructor() {
    super('challenges');
  }

  init(d?: { tab?: ChallengeSort }): void {
    this.tab = d?.tab ?? lastTab;
    lastTab = this.tab;
    this.page = 0;
    this.items = [];
    this.rowObjs = [];
  }

  create(): void {
    this.add.rectangle(W / 2, H / 2, W, H, C('f'));
    panel(this, 16, 8, W - 32, H - 16, '8', '9', 'f', 1);
    text(this, W / 2, 20, 'Global Challenges', C('4'), 2, C('0')).setDepth(2);
    if (feature('arena')) makeButton(this, W - 53, 20, 70, 22, 'Arena', 'go', () => { sfx.click(); goTo(this, 'arena'); }, 3);
    TABS.forEach((t, i) => {
      makeButton(this, W / 2 + (i - 1) * 100, 42, 92, 20, t.label, t.id === this.tab ? 'go' : 'plain', () => {
        sfx.click();
        this.scene.restart({ tab: t.id });
      }, 3);
    });
    this.status = text(this, W / 2, 120, 'Loading challenges', C('d'), 1, C('0')).setDepth(3);
    makeButton(this, 70, H - 22, 90, 22, 'Back', 'plain', () => { sfx.click(); goTo(this, 'title'); }, 3);
    makeButton(this, W - 82, H - 22, 114, 22, 'Build a level', 'go', () => { sfx.click(); goTo(this, 'builder'); }, 3);
    const mine = ++this.token;
    void listChallenges(this.tab).then((list) => {
      if (mine !== this.token || !this.scene.isActive()) return;
      this.items = list;
      this.draw();
    }).catch(() => {
      if (mine === this.token && this.scene.isActive() && this.status) setText(this.status, this, 'Could not load challenges', C('d'), C('0'));
    });
    irisOpen(this);
  }

  private draw(): void {
    this.rowObjs.forEach((o) => o.destroy());
    this.rowObjs = [];
    const maxPage = Math.max(0, Math.ceil(this.items.length / PER_PAGE) - 1);
    this.page = Math.min(this.page, maxPage);
    if (this.status) setText(this.status, this, this.items.length ? ' ' : this.tab === 'mine' ? 'You have not shared a level yet.' : 'No challenges yet. Be the first!', C('d'), C('0'));
    const start = this.page * PER_PAGE;
    this.items.slice(start, start + PER_PAGE).forEach((c, i) => {
      const y = 62 + i * ROW_H;
      const rank = start + i + 1;
      const row = this.add.rectangle(W / 2, y + ROW_H / 2 - 2, W - 60, ROW_H - 4, C('9')).setStrokeStyle(1, C('a')).setDepth(3).setInteractive();
      row.on('pointerdown', () => { sfx.click(); goTo(this, 'challenge', { id: c.id }); });
      const rankCol = this.tab === 'top' && rank <= 3 ? C('4') : C('c');
      this.rowObjs.push(
        row,
        text(this, 38, y + 7, this.tab === 'top' ? `#${rank}` : '>', rankCol, 1, C('0')).setOrigin(0, 0.5).setDepth(4),
        text(this, 68, y + 7, c.title.slice(0, 26), C('c'), 1, C('0')).setOrigin(0, 0.5).setDepth(4),
        text(this, 68, y + 19, `by ${c.mine ? 'you' : c.authorName.slice(0, 16)}  ${c.shots} shots  ${c.allowed.length} weapon${c.allowed.length === 1 ? '' : 's'}`, C('d'), 1, C('0')).setOrigin(0, 0.5).setDepth(4),
        text(this, W - 38, y + 7, `${c.challengers}`, C('4'), 1, C('0')).setOrigin(1, 0.5).setDepth(4),
        text(this, W - 38, y + 19, 'challengers', C('d'), 1, C('0')).setOrigin(1, 0.5).setDepth(4),
      );
    });
    if (maxPage > 0) {
      const py = H - 22;
      if (this.page > 0) this.rowObjs.push(makeButton(this, 160, py, 36, 20, '<', 'plain', () => { sfx.click(); this.page--; this.draw(); }, 5).box);
      this.rowObjs.push(text(this, W / 2, py, `${this.page + 1}/${maxPage + 1}`, C('c'), 1, C('0')).setDepth(5));
      if (this.page < maxPage) this.rowObjs.push(makeButton(this, 320, py, 36, 20, '>', 'plain', () => { sfx.click(); this.page++; this.draw(); }, 5).box);
    }
  }
}
