import Phaser from 'phaser';
import { C } from '../art/palette';
import { text } from '../art/font5x7';
import { sfx } from '../audio/sfx';
import { H, W } from '../config/constants';
import { goTo, irisOpen } from '../core/flow';
import { makeButton, panel } from '../ui/widgets';

export default class CreditsScene extends Phaser.Scene {
  constructor() {
    super('credits');
  }

  create(): void {
    this.add.rectangle(W / 2, H / 2, W, H, C('f'));
    panel(this, 12, 16, W - 24, H - 32, '8', '9', 'f', 1);

    text(this, W / 2, 34, 'MONSTER MASH', C('4'), 2, C('0')).setDepth(2);
    text(this, W / 2, 50, 'Slingshot Siege', C('c'), 1, C('0')).setDepth(2);

    const sections: { title: string; names: string[] }[] = [
      {
        title: 'Built for RUN.world',
        names: ['Monster Mash Jam 2026'],
      },
      {
        title: 'Design & Code',
        names: ['agy (Google DeepMind Antigravity)', 'Claude (Anthropic) & Jam Owner'],
      },
      {
        title: 'Art & Audio',
        names: ['16-Bit Mash32 Palette', '120 BPM Chiptune Engine'],
      },
      {
        title: 'Powered by',
        names: ['Phaser 3 & RUN SDK 5.28.1'],
      },
    ];

    let y = 68;
    for (const sec of sections) {
      text(this, W / 2, y, sec.title, C('4'), 1, C('0')).setDepth(2);
      y += 13;
      for (const name of sec.names) {
        text(this, W / 2, y, name, C('c'), 1, C('0')).setDepth(2);
        y += 12;
      }
      y += 6;
    }

    makeButton(this, W / 2, H - 36, 120, 24, 'Back to title', 'go', () => {
      sfx.click();
      goTo(this, 'title');
    }, 3);

    irisOpen(this);
  }
}
