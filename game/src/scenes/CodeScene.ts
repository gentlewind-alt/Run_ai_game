import Phaser from 'phaser';
import { C } from '../art/palette';
import { fitText, setText, text } from '../art/font5x7';
import { sfx } from '../audio/sfx';
import { H, W } from '../config/constants';
import { parseCode } from '../core/challengeCode';
import { goTo, irisOpen } from '../core/flow';
import { levelUnlocked } from '../core/profile';
import { data } from '../data/load';
import { makeButton, menuBackdrop, panel } from '../ui/widgets';

const KEYS = ['0123456789', 'ABCDEFGHIJ', 'KLMNOPQRST', 'UVWXYZ-'];
const MAX_LEN = 24;

/** Enter a friend's challenge code on a keypad (no system keyboard) and play that level to beat their score. */
export default class CodeScene extends Phaser.Scene {
  private typed = '';
  private codeText!: Phaser.GameObjects.Image;
  private note!: Phaser.GameObjects.Image;

  constructor() {
    super('code');
  }

  create(): void {
    this.typed = 'MM-';
    menuBackdrop(this);
    panel(this, 16, 12, W - 32, H - 24, '8', '9', 'f', 1);
    text(this, W / 2, 26, 'Enter a challenge code', C('4'), 1, C('0')).setDepth(2);
    this.codeText = text(this, W / 2, 48, this.typed, C('c'), 2, C('0')).setDepth(3);
    this.note = text(this, W / 2, 68, 'Type the code your friend sent.', C('d'), 1, C('0')).setDepth(3);

    const keyW = 36, keyH = 22, gap = 3;
    KEYS.forEach((row, r) => {
      const rowW = row.length * keyW + (row.length - 1) * gap;
      [...row].forEach((ch, i) => {
        const x = W / 2 - rowW / 2 + keyW / 2 + i * (keyW + gap);
        makeButton(this, x, 92 + r * (keyH + gap), keyW, keyH, ch, 'plain', () => this.press(ch), 3);
      });
    });
    makeButton(this, W / 2 - 112, 208, 96, 24, 'Back space', 'plain', () => { sfx.click(); this.typed = this.typed.slice(0, -1); this.show(); }, 3);
    makeButton(this, W / 2, 208, 96, 24, 'Go', 'go', () => this.go(), 3);
    makeButton(this, W / 2 + 112, 208, 96, 24, 'Back', 'plain', () => { sfx.click(); goTo(this, 'title'); }, 3);
    irisOpen(this);
  }

  private press(ch: string): void {
    if (this.typed.length >= MAX_LEN) return;
    sfx.click();
    this.typed += ch;
    this.show();
  }

  private say(message: string): void {
    setText(this.note, this, fitText(message, W - 60), C('d'), C('0'));
  }

  private show(): void {
    setText(this.codeText, this, this.typed || ' ', C('c'), C('0'));
    this.say('Type the code your friend sent.');
  }

  private go(): void {
    const found = parseCode(this.typed, Math.max(...Object.keys(data.levels).map(Number)), data.config.social?.codeMaxScore ?? 999999);
    if (!found) { sfx.click(); this.say('That code does not look right. Check each letter.'); return; }
    if (!levelUnlocked(found.level)) { sfx.click(); this.say(`Reach level ${found.level} first, then try again.`); return; }
    sfx.click();
    goTo(this, 'loadout', { level: found.level, beat: found.score });
  }
}
