import Phaser from 'phaser';
import { C, rarityColor } from '../art/palette';
import { setText, text } from '../art/font5x7';
import { weaponTexture } from '../art/textures';
import { sfx } from '../audio/sfx';
import { H, W } from '../config/constants';
import { watchForShots } from '../core/ads';
import { data } from '../data/load';
import { shortWeaponName } from '../data/lookup';
import { makeButton, panel } from '../ui/widgets';

export interface ExtraShotsData {
  count: number;
  owned: string[];
  onGrant: (ids: string[]) => void;
  onDecline: () => void;
}

/** Shown over a battle that just ran out of shots: watch one ad, then choose the extra shots from your own arsenal. */
export default class ExtraShotsScene extends Phaser.Scene {
  constructor() {
    super('extrashots');
  }

  create(d: ExtraShotsData): void {
    this.add.rectangle(W / 2, H / 2, W, H, C('0'), 0.72).setDepth(20).setInteractive();
    const pw = 340;
    const ph = 200;
    const px = (W - pw) / 2;
    const py = (H - ph) / 2;
    panel(this, px, py, pw, ph, '8', '9', 'f', 21);
    text(this, W / 2, py + 18, 'Out of shots!', C('4'), 2, C('0')).setDepth(22);
    const info = text(this, W / 2, py + 40, `Watch one ad for ${d.count} more shots`, C('c'), 1, C('0')).setDepth(22);

    const choose = (): void => {
      const picks: string[] = [];
      setText(info, this, `Pick shot 1 of ${d.count}`, C('c'), C('0'));
      const slots = text(this, W / 2, py + 54, ' ', C('4'), 1, C('0')).setDepth(22);
      const cols = 8;
      const cell = 38;
      const gx = W / 2 - (cols * cell) / 2 + cell / 2;
      d.owned.forEach((id, i) => {
        const def = data.content.weapons.find((w) => w.id === id);
        if (!def) return;
        const x = gx + (i % cols) * cell;
        const y = py + 86 + Math.floor(i / cols) * cell;
        this.add.rectangle(x, y, cell - 4, cell - 4, C('f')).setStrokeStyle(1, rarityColor(def.rarity)).setDepth(22);
        const img = this.add.image(x, y, weaponTexture(id)).setDepth(23);
        img.setScale(Math.min(26 / img.width, 26 / img.height));
        const hit = this.add.rectangle(x, y, cell - 4, cell - 4, 0xffffff, 0).setDepth(24).setInteractive();
        hit.on('pointerup', () => {
          if (picks.length >= d.count) return;
          sfx.click();
          picks.push(id);
          setText(slots, this, picks.map((p) => shortWeaponName(p, data.content.weapons.find((w) => w.id === p)?.name ?? p)).join(' + '), C('4'), C('0'));
          if (picks.length >= d.count) {
            sfx.unlock();
            this.time.delayedCall(250, () => {
              this.scene.stop();
              d.onGrant(picks);
            });
          } else {
            setText(info, this, `Pick shot ${picks.length + 1} of ${d.count}`, C('c'), C('0'));
          }
        });
      });
    };

    const watch = makeButton(this, W / 2 - 70, py + 100, 120, 26, 'Watch ad', 'go', async () => {
      sfx.click();
      watch.setEnabled(false);
      no.setEnabled(false);
      const ok = await watchForShots();
      if (!this.scene.isActive()) return;
      if (ok) {
        watch.box.destroy();
        no.box.destroy();
        choose();
      } else {
        setText(info, this, 'No ad right now', C('3'), C('0'));
        no.setEnabled(true);
      }
    }, 22);
    const no = makeButton(this, W / 2 + 70, py + 100, 120, 26, 'No thanks', 'plain', () => {
      sfx.click();
      this.scene.stop();
      d.onDecline();
    }, 22);
  }
}
