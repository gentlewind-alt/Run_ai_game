import Phaser from 'phaser';
import { C } from '../art/palette';
import { text, textBlock, textWidth } from '../art/font5x7';
import { buildBackground } from '../art/backgrounds';
import { MONSTER_ART } from '../art/textures';
import { beatBob, beatPhase } from '../audio/beat';
import { music } from '../audio/music';
import { sfx } from '../audio/sfx';
import { H, W } from '../config/constants';
import { feature } from '../config/settings';
import { platform } from '../platform';
import { admin, adminReady, lock, unlock } from '../core/admin';
import { askAdminCode } from '../ui/adminPrompt';
import { helpButton } from '../ui/tutorial';
import { monsterDef } from '../data/lookup';
import { goTo, irisOpen } from '../core/flow';
import { profile, setMusicOn } from '../core/profile';
import { makeButton } from '../ui/widgets';

const CONGA = ['goblin_grunt', 'goblin_bomber', 'dark_elf_archer', 'dark_elf_hexer', 'skeleton_runner', 'imp', 'orc_brute', 'troll'];
const SPACING = 36;

/** The front door: the title bounces letter by letter on the beat while a conga line of monsters dances past. */
export default class TitleScene extends Phaser.Scene {
  private letters: { img: Phaser.GameObjects.Image; y: number; phase: number }[] = [];
  private line: { img: Phaser.GameObjects.Image; id: string; i: number }[] = [];
  private ground = Math.round(H * 0.874);

  constructor() {
    super('title');
  }

  create(): void {
    this.letters = [];
    this.line = [];
    this.ground = Math.round(H * 0.874);
    buildBackground(this, W, this.ground, 'hills');

    const word = (str: string, centerX: number, y: number, scale: number, color: number, shade: number): void => {
      const widths = [...str].map((ch) => textWidth(ch) * scale + scale);
      let x = centerX - widths.reduce((a, b) => a + b, 0) / 2;
      [...str].forEach((ch, i) => {
        const img = text(this, x + widths[i] / 2, y, ch, color, scale, shade).setDepth(5);
        this.letters.push({ img, y, phase: this.letters.length * 0.55 });
        x += widths[i];
      });
    };
    const logoX = Math.round(W * 0.34);
    word('MONSTER', logoX, 48, 3, C('c'), C('0'));
    word('MASH', logoX, 94, 6, C('4'), C('q'));
    text(this, logoX, 138, 'Slingshot Siege', C('c'), 1, C('0')).setDepth(5);
    text(this, logoX, 162, 'Fling real weapons. Mash the monsters.', C('d'), 1, C('0')).setDepth(6);

    CONGA.forEach((id, i) => {
      const img = this.add.image(0, 0, id).setDepth(4);
      this.line.push({ img, id, i });
    });

    const btnX = Math.round(W * 0.76);
    makeButton(this, btnX, 54, 130, 30, 'Play', 'go', () => { sfx.unlock(); sfx.click(); goTo(this, 'map'); }, 6);
    if (feature('challenges')) makeButton(this, btnX, 118, 130, 26, 'Challenges', 'plain', () => { sfx.unlock(); sfx.click(); goTo(this, 'challenges'); }, 6);
    if (feature('builder')) makeButton(this, btnX, 87, 130, 26, 'Create level', 'plain', () => { sfx.unlock(); sfx.click(); goTo(this, 'builder'); }, 6);
    if (feature('arena')) makeButton(this, btnX, 149, 130, 24, 'Global Arena', 'go', () => { sfx.unlock(); sfx.click(); goTo(this, 'arena'); }, 6);
    makeButton(this, btnX, 178, 110, 22, 'Credits', 'plain', () => { sfx.unlock(); sfx.click(); goTo(this, 'credits'); }, 6);

    const musicLabel = (): string => (profile.settings.musicOn === false ? 'Music: off' : 'Music: on');
    const musicBtn = makeButton(this, btnX, 205, 110, 22, musicLabel(), 'plain', () => {
      sfx.unlock();
      setMusicOn(profile.settings.musicOn === false);
      music.updateVolume();
      sfx.click();
      musicBtn.setLabel(musicLabel());
    }, 6);

    this.input.once('pointerdown', () => {
      sfx.unlock();
      music.updateVolume();
    });
    if (platform.fullscreen.available()) {
      const label = (): string => (platform.fullscreen.active() ? 'Exit full screen' : 'Full screen');
      let note: Phaser.GameObjects.Image[] = [];
      const fsBtn = makeButton(this, btnX, 232, 110, 22, label(), 'plain', () => {
        sfx.unlock();
        void platform.fullscreen.toggle().then(() => {
          if (!this.scene.isActive()) return;
          fsBtn.setLabel(label());
          sfx.click();
          note.forEach((n) => n.destroy());
          const why = platform.fullscreen.note();
          if (why) {
            note = textBlock(this, 14, H - 44, why, C('c'), W - 28, C('0'));
            note.forEach((n) => n.setDepth(20));
            this.time.delayedCall(4500, () => note.forEach((n) => n.destroy()));
          }
        });
      }, 6);
    }
    const adminTag = (): void => {
      const tag = text(this, W - 6, H - 8, 'Admin: ` for tools. Tap to lock', C('4'), 1, C('0')).setOrigin(1, 0.5).setDepth(6).setInteractive();
      tag.on('pointerdown', () => { void lock().then(() => this.scene.restart()); });
    };
    if (admin.is) adminTag();
    else void adminReady.then((is) => { if (is && this.scene.isActive()) adminTag(); });
    // hidden door: tap the top-left corner five times quickly to enter the admin code
    let taps: number[] = [];
    this.add.rectangle(14, 14, 28, 28, 0xffffff, 0).setDepth(7).setInteractive().on('pointerdown', () => {
      const now = this.time.now;
      taps = [...taps.filter((t) => now - t < 4000), now];
      if (taps.length < 5) return;
      taps = [];
      void askAdminCode().then(async (code) => {
        if (code === null) return;
        if ((await unlock(code)) && this.scene.isActive()) this.scene.restart();
      });
    });
    music.play({ theme: 'title' });
    helpButton(this, W - 16, 14, undefined, 8);
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
      const fly = monsterDef(m.id)?.flying ? 26 : 0;
      m.img.setPosition(x < 0 ? x + span - 20 : x - 20, this.ground - size / 2 + 1 - hop * 5 - fly);
      m.img.setScale(1 + (1 - hop) * 0.05, 1 - (1 - hop) * 0.07);
    }
  }
}


