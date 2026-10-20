import Phaser from 'phaser';
import { C } from '../art/palette';
import { text, textWidth } from '../art/font5x7';
import { buildBackground } from '../art/backgrounds';
import { MONSTER_ART } from '../art/textures';
import { beatBob, beatPhase } from '../audio/beat';
import { sfx } from '../audio/sfx';
import { W } from '../config/constants';
import { getSettings } from '../config/settings';
import { goTo, irisOpen } from '../core/flow';
import { makeButton } from '../ui/widgets';

const CONGA = ['goblin_grunt', 'goblin_bomber', 'dark_elf_archer', 'dark_elf_hexer', 'skeleton_runner', 'imp', 'orc_brute', 'troll'];
const SPACING = 36;

/** The front door: the title bounces letter by letter on the beat while a conga line of monsters dances past. */
export default class TitleScene extends Phaser.Scene {
  private letters: { img: Phaser.GameObjects.Image; y: number; phase: number }[] = [];
  private line: { img: Phaser.GameObjects.Image; id: string; i: number }[] = [];
  private ground = 320;

  constructor() {
    super('title');
  }

  create(): void {
    this.ground = getSettings().world.groundY;
    buildBackground(this, W, this.ground, 'hills');

    const word = (str: string, y: number, scale: number, color: number, shade: number): void => {
      const widths = [...str].map((ch) => textWidth(ch) * scale + scale);
      let x = (W - widths.reduce((a, b) => a + b, 0)) / 2;
      [...str].forEach((ch, i) => {
        const img = text(this, x + widths[i] / 2, y, ch, color, scale, shade).setDepth(5);
        this.letters.push({ img, y, phase: this.letters.length * 0.55 });
        x += widths[i];
      });
    };
    word('MONSTER', 58, 3, C('c'), C('0'));
    word('MASH', 98, 6, C('4'), C('q'));
    text(this, W / 2, 132, 'Slingshot Siege', C('c'), 1, C('0')).setDepth(5);

    CONGA.forEach((id, i) => {
      const img = this.add.image(0, 0, id).setDepth(4);
      this.line.push({ img, id, i });
    });

    makeButton(this, W / 2, 196, 120, 32, 'Play', 'go', () => { sfx.unlock(); sfx.click(); goTo(this, 'map'); }, 6);
    text(this, W / 2, 226, 'Fling real weapons. Mash the monsters.', C('d'), 1, C('0')).setDepth(6);
    this.input.once('pointerdown', () => sfx.unlock());
    irisOpen(this);
  }

  update(time: number): void {
    for (const l of this.letters) l.img.y = l.y - Math.max(0, beatBob(time, l.phase)) * 4;
    const span = CONGA.length * SPACING + W + 40;
    const phase = beatPhase(time);
    for (const m of this.line) {
      const art = MONSTER_ART[m.id];
      const size = art?.size ?? 16;
      const x = ((time / 1000) * 24 - m.i * SPACING) % span;
      const hop = Math.abs(Math.sin(Math.PI * phase + m.i * 0.7));
      const fly = m.id === 'imp' ? 26 : 0;
      m.img.setPosition(x < 0 ? x + span - 20 : x - 20, this.ground - size / 2 + 1 - hop * 5 - fly);
      m.img.setScale(1 + (1 - hop) * 0.05, 1 - (1 - hop) * 0.07);
    }
  }
}


