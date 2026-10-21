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
import { makeButton } from '../ui/widgets';
import { createItemCard } from '../ui/cards';

const PAGE_SIZE = 10;

/** Before each level: pick weapons in firing order, artifacts, items, and fling into battle. */
export default class LoadoutScene extends Phaser.Scene {
  private level = 1;
  private slots: (string | null)[] = [];
  private slotImgs: Phaser.GameObjects.Image[] = [];
  private artifactBoxes: { id: string; box: Phaser.GameObjects.Rectangle }[] = [];
  private equipped: string[] = [];
  private info: Phaser.GameObjects.Image[] = [];
  private goBtn?: ReturnType<typeof makeButton>;
  private gridObjs: Phaser.GameObjects.GameObject[] = [];
  private page = 0;

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
    this.gridObjs = [];
    this.page = 0;

    const lvl = levelDef(this.level);
    this.add.rectangle(W / 2, H / 2, W, H, C('f'));

    // Divider between grid and loadout panel
    this.add.rectangle(264, H / 2, 2, H - 20, C('0'), 0.4);

    // Right side: Header & level info
    text(this, 370, 12, `Level ${this.level}: ${lvl.name}`, C('4'), 1, C('0'));
    if (lvl.hints?.[0]) {
      textBlock(this, 370, 26, lvl.hints[0], C('d'), 196);
    }

    // Right side: 4 Firing Slots
    const n = loadoutSize();
    const gap = 44;
    for (let i = 0; i < n; i++) {
      const sx = 370 + (i - (n - 1) / 2) * gap;
      const sy = 62;
      const box = this.add.rectangle(sx, sy, 34, 34, C('0')).setStrokeStyle(1, C('d')).setInteractive();
      box.on('pointerdown', () => { sfx.click(); this.slots[i] = null; this.refresh(); });
      this.slotImgs.push(this.add.image(sx, sy, 'px').setVisible(false).setScale(2));
      pixText(this, sx - 12, sy - 12, String(i + 1), C('4'));
    }

    // Prefill slots from last loadout or available owned weapons
    const owned = data.content.weapons.filter((w) => owns('weapons', w.id));
    const last = profile.equipped.loadout.filter((id) => owns('weapons', id));
    let hasLegendary = false;
    const sanitizedLast = last.filter((id) => {
      const w = data.content.weapons.find((x) => x.id === id);
      if (w?.rarity === 'legendary') {
        if (hasLegendary) return false;
        hasLegendary = true;
      }
      return true;
    });
    this.slots = Array.from({ length: n }, (_, i) => sanitizedLast[i] ?? null);
    for (let i = 0; i < n; i++) {
      if (this.slots[i] === null) {
        const fallback = owned.find((ow) => ow.rarity !== 'legendary' && !this.slots.includes(ow.id)) ??
                         owned.find((ow) => ow.rarity !== 'legendary') ?? owned[0];
        if (fallback) this.slots[i] = fallback.id;
      }
    }

    // Right side: Artifacts, Items, Buttons
    this.artifactRow();
    this.itemRow();

    makeButton(this, 305, H - 20, 64, 24, 'Back', 'plain', () => { sfx.click(); goTo(this, 'map'); }, 6);
    this.goBtn = makeButton(this, 415, H - 20, 110, 26, 'Fling!', 'go', () => this.start(), 6);

    // Left side: Weapon Grid
    this.renderWeaponGrid();
    this.describe(null);

    this.refresh();
    irisOpen(this);
  }

  private renderWeaponGrid(): void {
    this.gridObjs.forEach((o) => o.destroy());
    this.gridObjs = [];

    const owned = data.content.weapons.filter((w) => owns('weapons', w.id));
    const maxPage = Math.max(0, Math.ceil(owned.length / PAGE_SIZE) - 1);
    this.page = Math.min(this.page, maxPage);
    const startIdx = this.page * PAGE_SIZE;
    const pageItems = owned.slice(startIdx, startIdx + PAGE_SIZE);

    const cardW = 122;

    pageItems.forEach((w, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = 8 + col * 128;
      const y = 30 + row * 42;
      const card = createItemCard({
        scene: this, x, y, w: cardW, icon: weaponTexture(w.id), name: shortWeaponName(w.id, w.name),
        rarity: w.rarity, onClick: () => { sfx.unlock(); this.addToSlot(w.id); this.describe(w.id); },
      });

      const elIcon = this.add.image(x + 35, y + 26, `el_${w.element}`).setDepth(2);
      const dmgTxt = pixText(this, x + 42, y + 26, String(Math.round(w.baseDamage * upgradeMult(w.id))), C('4')).setOrigin(0, 0.5).setDepth(2);
      const abTxt = text(this, x + cardW - 6, y + 26, w.ability?.label ?? '', C('b')).setOrigin(1, 0.5).setDepth(2);

      this.gridObjs.push(...card.objects, elIcon, dmgTxt, abTxt);
    });

    // Pagination controls if owned > 10
    if (owned.length > PAGE_SIZE) {
      const py = 246;
      if (this.page > 0) {
        const prev = makeButton(this, 50, py, 40, 20, '<', 'plain', () => {
          sfx.click();
          this.page--;
          this.renderWeaponGrid();
        }, 5);
        this.gridObjs.push(prev.box);
      }
      const pageTxt = text(this, 132, py, `${this.page + 1}/${maxPage + 1}`, C('c'), 1, C('0')).setOrigin(0.5, 0.5).setDepth(5);
      this.gridObjs.push(pageTxt);
      if (this.page < maxPage) {
        const next = makeButton(this, 214, py, 40, 20, '>', 'plain', () => {
          sfx.click();
          this.page++;
          this.renderWeaponGrid();
        }, 5);
        this.gridObjs.push(next.box);
      }
    }
  }

  private describe(id: string | null): void {
    this.info.forEach((i) => i.destroy());
    this.info = [];
    const infoX = 370;
    if (!id) {
      this.info.push(text(this, infoX, 106, 'Tap weapons to fill slots.', C('d'), 1, C('0')));
      return;
    }
    const w = data.content.weapons.find((x) => x.id === id)!;
    this.info.push(text(this, infoX, 98, w.name, C('4'), 1, C('0')));
    if (w.launch) {
      this.info.push(...textBlock(this, infoX, 112, w.launch, C('c'), 196));
    }
    if (w.tap) {
      this.info.push(...textBlock(this, infoX, 130, w.tap, C('b'), 196));
    }
  }

  private addToSlot(id: string): void {
    const w = data.content.weapons.find((x) => x.id === id);
    if (w?.rarity === 'legendary') {
      const alreadyHasLegendary = this.slots.some((s) => {
        if (!s) return false;
        return data.content.weapons.find((x) => x.id === s)?.rarity === 'legendary';
      });
      if (alreadyHasLegendary) {
        sfx.hit(0.5);
        this.info.forEach((i) => i.destroy());
        this.info = [
          text(this, 370, 98, 'Max 1 Legendary!', C('4'), 1, C('0')),
          ...textBlock(this, 370, 114, 'You may only equip one Legendary weapon at a time.', C('c'), 196),
        ];
        return;
      }
    }
    const i = this.slots.findIndex((s) => s === null);
    if (i < 0) return;
    sfx.click();
    this.slots[i] = id;
    this.refresh();
  }

  private artifactRow(): void {
    const arts = data.content.artifacts.filter((a) => owns('artifacts', a.id));
    const slots = artifactSlots();
    text(this, 274, 168, 'Artifact', C('d')).setOrigin(0, 0.5);
    if (arts.length === 0) {
      text(this, 330, 168, 'None yet (from shop)', C('e')).setOrigin(0, 0.5);
      return;
    }
    this.equipped = profile.equipped.artifacts.filter((id) => owns('artifacts', id)).slice(0, slots);
    arts.forEach((a, i) => {
      const x = 336 + i * 26;
      const box = this.add.rectangle(x, 168, 22, 22, C('0')).setStrokeStyle(1, C('d')).setInteractive();
      this.add.image(x, 168, iconKey(a.id)).setDepth(2);
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
    this.info = [text(this, 370, 98, a.name, C('4'), 1, C('0')), ...textBlock(this, 370, 114, a.effect, C('c'), 196)];
  }

  private itemRow(): void {
    const items = data.content.consumables.filter((c) => consumableCount(c.id) > 0);
    text(this, 274, 198, 'Items', C('d')).setOrigin(0, 0.5);
    if (items.length === 0) {
      text(this, 330, 198, 'None yet (1 use each)', C('e')).setOrigin(0, 0.5);
      return;
    }
    items.forEach((c, i) => {
      const x = 336 + i * 34;
      this.add.image(x, 198, iconKey(c.id)).setDepth(2);
      text(this, x + 10, 198, `x${consumableCount(c.id)}`, C('b')).setOrigin(0, 0.5);
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
