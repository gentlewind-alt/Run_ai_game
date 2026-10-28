import Phaser from 'phaser';
import { C } from '../art/palette';
import { fitText, text } from '../art/font5x7';
import { sfx } from '../audio/sfx';
import { H, W } from '../config/constants';
import { clearMatch, currentMatch, matchOutcome, practiceCoins, practiceConfig, practiceRecord, recordTurn, settle, startMatch, turnFor, type PracticeResult } from '../core/practice';
import { goTo, irisOpen } from '../core/flow';
import { data } from '../data/load';
import { menuBackdrop, uiIcon, makeButton, panel } from '../ui/widgets';

/** Offline practice match: the Arena rules with a Rival Bot or a friend on the same device, so the whole flow can be tried alone. */
export default class PracticeScene extends Phaser.Scene {
  private incoming?: { result?: PracticeResult; leave?: boolean };
  private objects: Phaser.GameObjects.GameObject[] = [];
  private levelIdx = 0;
  private vsBot = true;
  private stake = 0;

  constructor() { super('practice'); }

  init(d?: { result?: PracticeResult; leave?: boolean }): void { this.incoming = d; this.objects = []; }

  create(): void {
    const d = this.incoming;
    if (d?.leave) clearMatch();
    if (d?.result) {
      const finished = recordTurn(d.result);
      if (finished) settle(finished);
    }
    menuBackdrop(this);
    panel(this, 8, 7, W - 16, H - 14, '8', '9', 'f');
    this.draw();
    irisOpen(this);
  }

  private label(x: number, y: number, value: string, color = C('c'), width = 440, origin = 0.5): void {
    this.objects.push(text(this, x, y, fitText(value, width), color, 1, C('0')).setOrigin(origin, 0.5).setDepth(4));
  }

  private button(x: number, y: number, w: number, label: string, action: () => void, go = false, enabled = true): void {
    const b = makeButton(this, x, y, w, 24, fitText(label, w - 8), go ? 'go' : 'plain', () => { sfx.unlock(); sfx.click(); action(); }, 5);
    b.setEnabled(enabled);
    this.objects.push(b.box);
  }

  private draw(): void {
    this.objects.forEach((o) => o.destroy());
    this.objects = [];
    const cfg = practiceConfig();
    const rec = practiceRecord();
    this.objects.push(text(this, 240, 22, 'Practice Match', C('4'), 2, C('0')).setDepth(4));
    this.label(240, 38, 'Offline: no other player needed. Same rules as the Global Arena.', C('d'));
    this.objects.push(uiIcon(this, 24, 54, 'coin', 'icon_coin', 12).setDepth(4));
    this.label(36, 54, `Practice coins ${practiceCoins()}`, C('4'), 194, 0);
    this.label(460, 54, `W ${rec.wins}  L ${rec.losses}  D ${rec.draws}`, C('d'), 210, 1);
    const m = currentMatch();
    if (!m) this.drawSetup(cfg);
    else if (m.results[0] && m.results[1]) this.drawDone();
    else this.drawTurn();
    this.button(58, 246, 84, 'Back', () => goTo(this, 'arena'));
  }

  private drawSetup(cfg: ReturnType<typeof practiceConfig>): void {
    this.label(20, 76, 'Level (same for both)', C('c'), 220, 0);
    cfg.levels.forEach((id, i) => {
      const name = data.levels[id]?.name ?? `Level ${id}`;
      this.button(64 + i * 117, 96, 110, name, () => { this.levelIdx = i; this.draw(); }, i === this.levelIdx);
    });
    this.label(20, 124, 'Opponent', C('c'), 220, 0);
    this.button(86, 144, 140, 'Rival Bot', () => { this.vsBot = true; this.draw(); }, this.vsBot);
    this.button(238, 144, 140, 'Pass and play', () => { this.vsBot = false; this.stake = 0; this.draw(); }, !this.vsBot);
    this.label(20, 172, this.vsBot ? 'Stake (practice coins)' : 'Friendly match: two players share this device', C('c'), 330, 0);
    if (this.vsBot) cfg.stakes.forEach((s, i) => this.button(64 + i * 117, 192, 110, s ? `${s} coins` : 'No wager', () => { this.stake = s; this.draw(); }, this.stake === s, practiceCoins() >= s));
    this.button(396, 246, 150, 'Start match', () => { startMatch(cfg.levels[this.levelIdx], this.vsBot, this.stake); this.draw(); }, true);
  }

  private names(): [string, string] {
    return currentMatch()?.bot ? ['You', 'Rival Bot'] : ['Player 1', 'Player 2'];
  }

  private rows(): void {
    const m = currentMatch()!;
    this.label(240, 80, data.levels[m.levelId]?.name ?? `Level ${m.levelId}`, C('4'), 420);
    this.names().forEach((name, i) => {
      const r = m.results[i];
      this.label(32, 104 + i * 24, name, C('c'), 200, 0);
      this.label(448, 104 + i * 24, r ? `${r.cleared ? 'Cleared' : 'Not cleared'}  ${r.score}` : 'Awaiting turn', C('d'), 220, 1);
    });
  }

  private drawTurn(): void {
    const m = currentMatch()!;
    this.rows();
    const names = this.names();
    const botTurn = m.bot && m.turn === 1;
    this.label(240, 164, botTurn ? 'Rival Bot takes its turn. Watch how it aims.' : m.bot ? 'Your turn: one full attempt.' : `${names[m.turn]}: one full attempt, then pass the device.`, C('c'), 430);
    this.label(240, 184, m.stake ? `Stake ${m.stake} coins each` : 'Friendly match: no coins at stake', C('d'), 430);
    this.button(240, 214, 170, botTurn ? 'Watch Rival Bot' : 'Start turn', () => goTo(this, 'game', { level: 1000, loadout: practiceConfig().loadout, practice: turnFor(m) }), true);
    this.button(396, 246, 150, 'Leave match', () => { clearMatch(); this.draw(); });
  }

  private drawDone(): void {
    const m = currentMatch()!;
    this.rows();
    const out = matchOutcome();
    const names = this.names();
    const headline = out === 'draw' ? 'Draw: the stakes are returned.' : out === 'win' ? `${names[0]} win${m.bot ? '' : 's'}!` : `${names[1]} wins!`;
    this.label(240, 164, headline, C('4'), 430);
    this.label(240, 184, m.stake ? (out === 'win' ? `You win ${m.stake * 2} coins` : out === 'draw' ? 'Nobody wins or loses coins' : `You lose ${m.stake} coins`) : 'Friendly match: no coins at stake', C('d'), 430);
    this.button(160, 214, 130, 'Play again', () => { startMatch(m.levelId, m.bot, m.stake); this.draw(); }, true, !m.bot || practiceCoins() >= m.stake);
    this.button(320, 214, 130, 'New match', () => { clearMatch(); this.draw(); });
  }
}
