import Phaser from 'phaser';
import { C } from '../palette';
import { text, setText, textBlock } from '../font5x7';
import { pixText } from '../pix';
import { makeButton } from '../ui';
import { weaponTexture } from '../art';
import { WEAPONS } from '../weapons';
import { LOADOUT_SIZE, isUnlocked, progress } from '../progress';
import { W, H } from './GameScene';
import { sfx } from '../audio';

const SHORT: Record<string, string> = {
  w_militia_blade: 'Blade', w_iron_cleaver: 'Cleaver', w_ashwood_staff: 'Staff', w_scrapheap_scattergun: 'Scatter',
  w_hunters_pike: 'Pike', w_hunters_boomerang: 'Boomerang', w_blast_tube: 'Blast tube', w_horned_scepter: 'Scepter',
};

/** Pick 4 weapons, in order, before each level. Tap a card to add it to the next free slot; tap a slot to clear it. */
export default class LoadoutScene extends Phaser.Scene {
  private level = 1;
  private slots: (string | null)[] = [];
  private slotImgs: Phaser.GameObjects.Image[] = [];
  private slotBoxes: Phaser.GameObjects.Rectangle[] = [];
  private go?: ReturnType<typeof makeButton>;
  private status!: Phaser.GameObjects.Image;

  constructor() {
    super('loadout');
  }

  init(data: { level: number }): void {
    this.level = data.level ?? progress.level;
    progress.level = this.level;
    progress.reached = Math.max(progress.reached, this.level);
  }

  create(): void {
    const content = this.cache.json.get('content');
    const lvl = this.cache.json.get(`level${this.level}`);
    this.cameras.main.setBackgroundColor(C('f'));
    this.add.rectangle(W / 2, H / 2, W, H, C('f'));

    text(this, W / 2, 16, `Level ${this.level}: ${lvl.name}`, C('4'), 1, C('0'));
    this.status = text(this, W / 2, 30, 'Pick 4 weapons. Order matters.', C('c'));

    // weapon cards, two columns
    const owned: any[] = content.weapons.filter((w: any) => isUnlocked(w.unlock));
    content.weapons.forEach((w: any, i: number) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 6 + col * 105;
      const y = 44 + row * 46;
      const ok = isUnlocked(w.unlock);
      const card = this.add.rectangle(x + 49, y + 20, 98, 42, ok ? C('8') : C('0')).setStrokeStyle(1, ok ? C('e') : C('f'));
      this.add.image(x + 18, y + 20, weaponTexture(w.id)).setScale(2).setAlpha(ok ? 1 : 0.35);
      text(this, x + 58, y + 9, SHORT[w.id] ?? w.name, ok ? C('c') : C('e'));
      if (ok) {
        this.add.image(x + 37, y + 31, `el_${w.element}`);
        pixText(this, x + 45, y + 31, String(Math.round(w.baseDamage)), C('4')).setOrigin(0, 0.5);
        text(this, x + 93, y + 31, WEAPONS[w.id]?.abilityLabel ?? '', C('b')).setOrigin(1, 0.5);
        card.setInteractive();
        card.on('pointerdown', () => {
          sfx.unlock();
          this.add_(w.id);
        });
      } else {
        text(this, x + 58, y + 30, w.unlock.replace('level', 'Level'), C('e'));
      }
    });

    // slots
    for (let i = 0; i < LOADOUT_SIZE; i++) {
      const sx = 30 + i * 52;
      const box = this.add.rectangle(sx, 254, 40, 40, C('0')).setStrokeStyle(1, C('d'));
      box.setInteractive();
      box.on('pointerdown', () => {
        sfx.click();
        this.slots[i] = null;
        this.refresh();
      });
      this.slotBoxes.push(box);
      this.slotImgs.push(this.add.image(sx, 254, 'px').setVisible(false).setScale(2));
      pixText(this, sx - 15, 238, String(i + 1), C('4'));
    }
    text(this, W / 2, 284, 'Tap a slot to clear it', C('d'));

    // prefill from the last loadout, else the best owned weapons in order
    const last = progress.loadout.filter((id) => owned.some((w) => w.id === id));
    this.slots = Array.from({ length: LOADOUT_SIZE }, (_, i) => last[i] ?? owned[i % owned.length].id);

    this.go = makeButton(this, W / 2, 330, 120, 30, 'Fling!', 'go', () => this.start(), 5);
    textBlock(this, W / 2, 352, lvl.hints?.[0] ?? '', C('d'), 200);
    this.refresh();
  }

  private add_(id: string): void {
    const i = this.slots.findIndex((s) => s === null);
    if (i < 0) return;
    sfx.click();
    this.slots[i] = id;
    this.refresh();
  }

  private refresh(): void {
    this.slots.forEach((id, i) => {
      const img = this.slotImgs[i];
      if (id) img.setTexture(weaponTexture(id)).setVisible(true);
      else img.setVisible(false);
    });
    const full = this.slots.every((s) => s !== null);
    this.go?.setEnabled(full);
    setText(this.status, this, full ? 'Ready. Tap Fling!' : 'Pick 4 weapons. Order matters.', C('c'));
  }

  private start(): void {
    if (!this.slots.every((s) => s !== null)) return;
    progress.loadout = this.slots as string[];
    sfx.click();
    this.scene.start('game', { level: this.level, loadout: progress.loadout });
  }
}
