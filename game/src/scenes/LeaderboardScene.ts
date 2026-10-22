import Phaser from 'phaser';
import { C } from '../art/palette';
import { setText, text } from '../art/font5x7';
import { sfx } from '../audio/sfx';
import { H, W } from '../config/constants';
import { goTo, irisOpen } from '../core/flow';
import { clearedLevel, lastResult } from '../core/profile';
import { data } from '../data/load';
import { platform } from '../platform';
import { DAILY_BOARD, OVERALL_BOARD, levelBoard } from '../platform/boards';
import type { Row } from '../platform/types';
import { makeButton, panel } from '../ui/widgets';

type Tab = 'daily' | 'level' | 'overall';
const TABS: { id: Tab; label: string }[] = [{ id: 'daily', label: 'Daily' }, { id: 'level', label: 'This level' }, { id: 'overall', label: 'Overall' }];
const ROWS = 10;
const ROW_H = 14;
const REFRESH_COOLDOWN_MS = 4000;

/** Daily, per-level and overall score boards, with your own row highlighted. */
export default class LeaderboardScene extends Phaser.Scene {
  private tab: Tab = 'daily';
  private level = 1;
  private rowObjs: Phaser.GameObjects.GameObject[] = [];
  private titleTxt?: Phaser.GameObjects.Image;
  private statusTxt?: Phaser.GameObjects.Image;
  private myName = '';
  private lastRefresh = 0;
  private token = 0;

  constructor() {
    super('leaderboards');
  }

  init(d?: { tab?: Tab; level?: number }): void {
    const levels = Object.keys(data.levels).map(Number).filter((n) => n > 0 && n < 90);
    const last = lastResult?.levelId && lastResult.levelId > 0 ? lastResult.levelId : Math.max(1, clearedLevel());
    this.level = d?.level ?? Math.min(last, Math.max(...levels, 1));
    this.tab = d?.tab ?? 'daily';
    this.rowObjs = [];
    this.lastRefresh = 0;
  }

  create(): void {
    this.add.rectangle(W / 2, H / 2, W, H, C('f'));
    panel(this, 16, 8, W - 32, H - 16, '8', '9', 'f', 1);
    text(this, W / 2, 20, 'Leaderboards', C('4'), 2, C('0')).setDepth(2);

    TABS.forEach((t, i) => {
      makeButton(this, W / 2 + (i - 1) * 100, 44, 92, 20, t.label, t.id === this.tab ? 'go' : 'plain', () => {
        sfx.click();
        this.scene.restart({ tab: t.id, level: this.level });
      }, 3);
    });

    this.titleTxt = text(this, W / 2, 64, ' ', C('c'), 1, C('0')).setDepth(3);
    if (this.tab === 'level') {
      const levels = Object.keys(data.levels).map(Number).filter((n) => n > 0 && n < 90).sort((a, b) => a - b);
      const idx = levels.indexOf(this.level);
      makeButton(this, 112, 64, 28, 16, '<', 'plain', () => this.step(levels, idx, -1), 3);
      makeButton(this, W - 112, 64, 28, 16, '>', 'plain', () => this.step(levels, idx, 1), 3);
    }

    this.statusTxt = text(this, W / 2, 140, ' ', C('d'), 1, C('0')).setDepth(3);
    makeButton(this, 96, H - 24, 100, 22, 'Back to map', 'plain', () => { sfx.click(); goTo(this, 'map'); }, 3);
    makeButton(this, W - 96, H - 24, 100, 22, 'Refresh', 'go', () => this.refresh(true), 3);

    void platform.profile().then((p) => { this.myName = p.name; }).catch(() => { this.myName = ''; }).finally(() => this.refresh(false));
    irisOpen(this);
  }

  private step(levels: number[], idx: number, dir: number): void {
    sfx.click();
    const next = levels[(idx + dir + levels.length) % levels.length];
    this.scene.restart({ tab: 'level', level: next });
  }

  private boardId(): string {
    return this.tab === 'daily' ? DAILY_BOARD : this.tab === 'overall' ? OVERALL_BOARD : levelBoard(this.level);
  }

  private heading(): string {
    if (this.tab === 'daily') return 'Daily Mash - today';
    if (this.tab === 'overall') return 'Overall - total of your best scores';
    return `Level ${this.level}: ${data.levels[this.level]?.name ?? ''}`;
  }

  private refresh(manual: boolean): void {
    const now = this.time.now;
    if (manual && now - this.lastRefresh < REFRESH_COOLDOWN_MS) return;
    this.lastRefresh = now;
    if (this.titleTxt) setText(this.titleTxt, this, this.heading(), C('c'), C('0'));
    if (this.statusTxt) setText(this.statusTxt, this, 'Loading scores', C('d'), C('0'));
    const mine = ++this.token;
    const board = this.boardId();
    void (async () => {
      let rows: Row[] = [];
      let me: Row | null = null;
      try {
        rows = await platform.leaderboard.top(board, ROWS);
        me = await platform.leaderboard.myRank(board);
      } catch {
        rows = [];
      }
      if (mine !== this.token || !this.scene.isActive()) return;
      this.draw(rows, me);
    })();
  }

  private draw(rows: Row[], me: Row | null): void {
    this.rowObjs.forEach((o) => o.destroy());
    this.rowObjs = [];
    if (this.statusTxt) setText(this.statusTxt, this, rows.length ? ' ' : 'No scores yet. Be the first!', C('d'), C('0'));
    const x0 = 40;
    const x1 = W - 40;
    let youShown = false;
    rows.forEach((r, i) => {
      const y = 84 + i * ROW_H;
      const isMe = (!!this.myName && r.name === this.myName) || r.name === 'You';
      youShown = youShown || isMe;
      const col = isMe ? C('4') : C('c');
      this.rowObjs.push(text(this, x0, y, `#${r.rank}`, col, 1, C('0')).setOrigin(0, 0.5).setDepth(3));
      this.rowObjs.push(text(this, x0 + 34, y, r.name.slice(0, 18), col, 1, C('0')).setOrigin(0, 0.5).setDepth(3));
      this.rowObjs.push(text(this, x1, y, String(r.score), isMe ? C('4') : C('d'), 1, C('0')).setOrigin(1, 0.5).setDepth(3));
    });
    if (me && me.rank > 0 && !youShown) {
      const y = 84 + ROWS * ROW_H + 2;
      this.rowObjs.push(text(this, x0, y, `You #${me.rank}`, C('4'), 1, C('0')).setOrigin(0, 0.5).setDepth(3));
      this.rowObjs.push(text(this, x1, y, String(me.score), C('4'), 1, C('0')).setOrigin(1, 0.5).setDepth(3));
    }
  }
}
