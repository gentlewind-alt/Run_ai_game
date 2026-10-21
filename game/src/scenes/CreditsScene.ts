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
    panel(this, 16, 12, W - 32, H - 24, '8', '9', 'f', 1);

    text(this, W / 2, 28, 'MONSTER MASH', C('4'), 2, C('0')).setDepth(2);
    text(this, W / 2, 44, 'Slingshot Siege', C('c'), 1, C('0')).setDepth(2);

    const col1 = [
      {
        title: 'Built for RUN.world',
        names: ['Monster Mash Jam 2026'],
      },
      {
        title: 'Design & Code',
        names: ['agy (Google DeepMind Antigravity)', 'Claude (Anthropic) & Jam Owner'],
      },
    ];

    const col2 = [
      {
        title: 'Art & Audio',
        names: ['16-Bit Mash32 Palette', '120 BPM Chiptune Engine'],
      },
      {
        title: 'Powered by',
        names: ['Phaser 3 & RUN SDK 5.28.1'],
      },
    ];

    let y1 = 66;
    for (const sec of col1) {
      text(this, 130, y1, sec.title, C('4'), 1, C('0')).setDepth(2);
      y1 += 13;
      for (const name of sec.names) {
        text(this, 130, y1, name, C('c'), 1, C('0')).setDepth(2);
        y1 += 12;
      }
      y1 += 8;
    }

    let y2 = 66;
    for (const sec of col2) {
      text(this, 350, y2, sec.title, C('4'), 1, C('0')).setDepth(2);
      y2 += 13;
      for (const name of sec.names) {
        text(this, 350, y2, name, C('c'), 1, C('0')).setDepth(2);
        y2 += 12;
      }
      y2 += 8;
    }

    makeButton(this, W / 2, H - 26, 120, 22, 'Back to title', 'go', () => {
      sfx.click();
      goTo(this, 'title');
    }, 3);

    irisOpen(this);
  }
}
