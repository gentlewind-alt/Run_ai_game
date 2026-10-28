import Phaser from 'phaser';
import { C } from '../art/palette';
import { setText, text } from '../art/font5x7';
import { sfx } from '../audio/sfx';
import { H, W } from '../config/constants';
import { goTo } from '../core/flow';
import { platform } from '../platform';
import { targetAgeGate } from '@target-platform';
import { makeButton, panel } from '../ui/widgets';

/**
 * Android app only, first launch: a neutral age screen (Google Families policy for a mixed audience). No year is
 * filled in and nothing hints at a "right" answer. Under 13 gets child-safe ads; the answer is kept on the phone.
 */
export default class AgeScene extends Phaser.Scene {
  private year: number | null = null;

  constructor() {
    super('age');
  }

  create(): void {
    const now = new Date().getFullYear();
    this.add.rectangle(W / 2, H / 2, W, H, C('f'));
    panel(this, 60, 40, W - 120, H - 80, '8', '9', 'f', 1);
    text(this, W / 2, 62, 'What year were you born?', C('4'), 1, C('0')).setDepth(2);
    const shown = text(this, W / 2, 104, '- - - -', C('c'), 3, C('0')).setDepth(2);
    let go: ReturnType<typeof makeButton> | undefined;
    const nudge = (d: number): void => {
      sfx.click();
      this.year = Phaser.Math.Clamp((this.year ?? now) + d, now - 100, now);
      setText(shown, this, String(this.year), C('c'), C('0'));
      go?.setEnabled(true);
    };
    makeButton(this, W / 2 - 120, 104, 40, 24, '-10', 'plain', () => nudge(-10), 3);
    makeButton(this, W / 2 - 74, 104, 40, 24, '-1', 'plain', () => nudge(-1), 3);
    makeButton(this, W / 2 + 74, 104, 40, 24, '+1', 'plain', () => nudge(1), 3);
    makeButton(this, W / 2 + 120, 104, 40, 24, '+10', 'plain', () => nudge(10), 3);
    text(this, W / 2, 142, 'This sets which ads you see. It stays on this phone.', C('d'), 1, C('0')).setDepth(2);
    go = makeButton(this, W / 2, 180, 120, 26, 'Continue', 'go', async () => {
      if (this.year === null || !targetAgeGate) return;
      sfx.click();
      const band = now - this.year < 13 ? 'child' : 'teen'; // born this year or later than 13 years ago = under 13
      await platform.storage.set(targetAgeGate.key, band);
      void targetAgeGate.startAds();
      goTo(this, 'title');
    }, 3);
    go.setEnabled(false);
  }
}
