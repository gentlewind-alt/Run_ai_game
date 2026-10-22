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
        title: 'Boss (cracked the whip)',
        names: ['YuYungfu', 'Ideas, playtests, deadlines'],
      },
      {
        title: 'Code (share of lines)',
        names: ['agy (Antigravity)  62%', 'Claude (Anthropic) 38%'],
      },
      {
        title: 'Art and Audio',
        names: ['RUN AI sprites, concepts', 'Mash32 pixel kit, chiptunes'],
      },
    ];

    const col2 = [
      {
        title: 'Built on RUN.world',
        names: ['RUN SDK 5.28.1, RUN CLI', 'Monster Mash Jam 2026'],
      },
      {
        title: 'Engine',
        names: ['Phaser 3, Matter.js', 'Vite, TypeScript'],
      },
      {
        title: 'Nods to',
        names: ['Angry Birds, Pocket Tanks', 'Ben 10, Marvel, Brahmastra'],
      },
    ];

    let y1 = 60;
    for (const sec of col1) {
      text(this, 130, y1, sec.title, C('4'), 1, C('0')).setDepth(2);
      y1 += 13;
      for (const name of sec.names) {
        text(this, 130, y1, name, C('c'), 1, C('0')).setDepth(2);
        y1 += 12;
      }
      y1 += 8;
    }

    let y2 = 60;
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
