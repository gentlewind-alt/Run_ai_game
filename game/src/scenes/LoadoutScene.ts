import Phaser from 'phaser';
import { C } from '../art/palette';
import { text, textBlock } from '../art/font5x7';
import { iconKey } from '../art/icons';
import { pixText } from '../art/pix';
import { weaponTexture } from '../art/textures';
import { sfx } from '../audio/sfx';
import { W, H } from '../config/constants';
import { goTo, irisOpen } from '../core/flow';
import { artifactSlots, consumableCount, loadoutSize, owns, profile, setArtifacts, setLoadout, upgradeMult } from '../core/profile';
import { data } from '../data/load';
import { levelDef, shortWeaponName } from '../data/lookup';
import { makeButton, panel } from '../ui/widgets';

/** Before each level: pick weapons in firing order, one artifact (two after level 8), and see your items. */
export default class LoadoutScene extends Phaser.Scene {
  private level = 1;
  private slots: (string | null)[] = [];
  private slotImgs: Phaser.GameObjects.Image[] = [];
  private artifactBoxes: { id: string; box: Phaser.GameObjects.Rectangle }[] = [];
  private equipped: string[] = [];
  private info: Phaser.GameObjects.Image[] = [];
  private goBtn?: ReturnType<typeof makeButton>;

  constructor() {
    super('loadout');
  }

  init(d: { level: number }): void {
    this.level = d.level ?? 1;
  }

  create(): void {
    this.slotImgs = [];
    this.artifactBoxes = [];
    this.info = [];
    const lvl = levelDef(this.level);
    this.add.rectangle(W / 2, H / 2, W, H, C('f'));
    text(this, W / 2, 12, `Level ${this.level}: ${lvl.name}`, C('4'), 1, C('0'));
    textBlock(this, W / 2, 26, lvl.hints?.[0] ?? '', C('d'), 200);

    // owned weapons, two columns
    const owned = data.content.weapons.filter((w) => owns('weapons', w.id));
    owned.forEach((w, i) => {
      const x = 6 + (i % 2) * 105;
      const y = 42 + Math.floor(i / 2) * 39;
      panel(this, x, y, 99, 36, '8', '9', 'f', 1);
      this.add.image(x + 18, y + 18, weaponTexture(w.id)).setScale(2).setDepth(2);
      text(this, x + 36, y + 10, shortWeaponName(w.id, w.name), C('c')).setOrigin(0, 0.5).setDepth(2);
      this.add.image(x + 40, y + 26, `el_${w.element}`).setDepth(2);
      pixText(this, x + 48, y + 26, String(Math.round(w.baseDamage * upgradeMult(w.id))), C('4')).setOrigin(0, 0.5).setDepth(2);
      text(this, x + 94, y + 26, w.ability?.label ?? '', C('b')).setOrigin(1, 0.5).setDepth(2);
      const hit = this.add.rectangle(x + 49, y + 18, 99, 36, 0xffffff, 0).setDepth(3).setInteractive();
      hit.on('pointerdown', () => { sfx.unlock(); this.addToSlot(w.id); this.describe(w.id); });
    });

    this.describe(null);

    // slots
    const n = loadoutSize();
    const gap = Math.min(42, (W - 12) / n);
    for (let i = 0; i < n; i++) {
      const sx = W / 2 + (i - (n - 1) / 2) * gap;
      const box = this.add.rectangle(sx, 252, 32, 32, C('0')).setStrokeStyle(1, C('d')).setInteractive();
      box.on('pointerdown', () => { sfx.click(); this.slots[i] = null; this.refresh(); });
      this.slotImgs.push(this.add.image(sx, 252, 'px').setVisible(false).setScale(2));
      pixText(this, sx - 12, 240, String(i + 1), C('4'));
    }

    // prefill from the last loadout, else the owned weapons in order
    const last = profile.equipped.loadout.filter((id) => owns('weapons', id));
    this.slots = Array.from({ length: n }, (_, i) => last[i] ?? owned[i % owned.length].id);

    this.artifactRow();
    this.itemRow();

    makeButton(this, 38, H - 16, 64, 24, 'Back', 'plain', () => { sfx.click(); goTo(this, 'map'); }, 6);
    this.goBtn = makeButton(this, W - 82, H - 16, 130, 26, 'Fling!', 'go', () => this.start(), 6);
    this.refresh();
    irisOpen(this);
  }

  private describe(id: string | null): void {
    this.info.forEach((i) => i.destroy());
    this.info = [];
    if (!id) {
      this.info.push(text(this, W / 2, 204, 'Tap weapons to fill the slots below.', C('d'), 1, C('0')));
      return;
    }
    const w = data.content.weapons.find((x) => x.id === id)!;
    this.info.push(text(this, W / 2, 198, w.name, C('4'), 1, C('0')));
    this.info.push(...textBlock(this, W / 2, 210, w.launch ?? '', C('c'), 200));
    this.info.push(...textBlock(this, W / 2, 226, w.tap ?? '', C('b'), 200));
  }

  private addToSlot(id: string): void {
    const i = this.slots.findIndex((s) => s === null);
    if (i < 0) return;
    sfx.click();
    this.slots[i] = id;
    this.refresh();
  }

  private artifactRow(): void {
    const arts = data.content.artifacts.filter((a) => owns('artifacts', a.id));
    const slots = artifactSlots();
    text(this, 6, 287, 'Artifact', C('d')).setOrigin(0, 0.5);
    if (arts.length === 0) {
      text(this, 62, 287, 'None yet. The shop sells them.', C('e')).setOrigin(0, 0.5);
      return;
    }
    this.equipped = profile.equipped.artifacts.filter((id) => owns('artifacts', id)).slice(0, slots);
    arts.forEach((a, i) => {
      const x = 76 + i * 23;
      const box = this.add.rectangle(x, 287, 22, 22, C('0')).setStrokeStyle(1, C('d')).setInteractive();
      this.add.image(x, 287, iconKey(a.id)).setDepth(2);
      box.on('pointerdown', () => {
        sfx.click();
        this.equipped = this.equipped.includes(a.id) ? this.equipped.filter((x2) => x2 !== a.id) : [...this.equipped, a.id].slice(-slots);
        this.refresh();
        this.describeArtifact(a.id);
      });
      this.artifactBoxes.push({ id: a.id, box });
    });
  }

  private describeArtifact(id: string): void {
    const a = data.content.artifacts.find((x) => x.id === id)!;
    this.info.forEach((i) => i.destroy());
    this.info = [text(this, W / 2, 198, a.name, C('4'), 1, C('0')), ...textBlock(this, W / 2, 212, a.effect, C('c'), 200)];
  }

  private itemRow(): void {
    const items = data.content.consumables.filter((c) => consumableCount(c.id) > 0);
    text(this, 6, 318, 'Items', C('d')).setOrigin(0, 0.5);
    if (items.length === 0) {
      text(this, 72, 318, 'None yet. One use each per level.', C('e')).setOrigin(0, 0.5);
      return;
    }
    items.forEach((c, i) => {
      const x = 76 + i * 32;
      this.add.image(x, 318, iconKey(c.id)).setDepth(2);
      text(this, x + 9, 318, `x${consumableCount(c.id)}`, C('b')).setOrigin(0, 0.5);
    });
  }

  private refresh(): void {
    this.slots.forEach((id, i) => {
      const img = this.slotImgs[i];
      if (id) img.setTexture(weaponTexture(id)).setVisible(true);
      else img.setVisible(false);
    });
    for (const a of this.artifactBoxes) a.box.setStrokeStyle(this.equipped.includes(a.id) ? 2 : 1, this.equipped.includes(a.id) ? C('4') : C('d'));
    this.goBtn?.setEnabled(this.slots.every((s) => s !== null));
  }

  private start(): void {
    if (!this.slots.every((s) => s !== null)) return;
    const loadout = this.slots as string[];
    setLoadout(loadout);
    setArtifacts(this.equipped);
    sfx.click();
    goTo(this, 'game', { level: this.level, loadout });
  }
}
