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
  private fixed: string[] | null = null; // the level's own loadout (tutorials, mini-bosses): shown locked, never saved as the player's

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
    this.fixed = lvl.loadout?.length ? lvl.loadout.slice() : null;
    this.add.rectangle(W / 2, H / 2, W, H, C('f'));

    // Divider between grid and loadout panel
    this.add.rectangle(264, H / 2, 2, H - 20, C('0'), 0.4);

    // Right side: Header & level info
    text(this, 370, 10, `Level ${this.level}: ${lvl.name}`, C('4'), 1, C('0'));
    if (lvl.hints?.[0]) {
      textBlock(this, 370, 22, lvl.hints[0], C('d'), 196);
    }

    // Right side: Firing Slots (2 rows of 3, up to 7 with Gold Quiver)
    const n = this.fixed ? this.fixed.length : loadoutSize();
    const row0Count = Math.ceil(n / 2);
    const row1Count = Math.floor(n / 2);
    for (let i = 0; i < n; i++) {
      const isRow0 = i < row0Count;
      const colIdx = isRow0 ? i : i - row0Count;
      const countInRow = isRow0 ? row0Count : row1Count;
      const colGap = 42;
      const sx = 370 + (colIdx - (countInRow - 1) / 2) * colGap;
      const sy = isRow0 ? 44 : 74;
      const boxSize = 26; // touch target 26x26 >= 24px
      const box = this.add.rectangle(sx, sy, boxSize, boxSize, C('0')).setStrokeStyle(1, C('d')).setInteractive();
      box.on('pointerdown', () => { if (this.fixed) return; sfx.click(); this.slots[i] = null; this.refresh(); });
      this.slotImgs.push(this.add.image(sx, sy, 'px').setVisible(false).setScale(1.5));
      pixText(this, sx - 9, sy - 9, String(i + 1), C('4'));
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

    if (this.fixed) this.slots = this.fixed.slice();

    // Right side: Artifacts, Items, Buttons
    this.artifactRow();
    this.itemRow();
    this.slingRow();

    makeButton(this, 305, H - 18, 64, 24, 'Back', 'plain', () => { sfx.click(); goTo(this, 'map'); }, 6);
    this.goBtn = makeButton(this, 415, H - 18, 110, 26, 'Fling!', 'go', () => this.start(), 6);

    // Left side: Weapon Grid
    if (this.fixed) {
      textBlock(this, 132, 100, 'This level comes with its own set of weapons.', C('4'), 200, C('0'));
      textBlock(this, 132, 130, 'Check the slots on the right, then Fling!', C('d'), 200);
    } else {
      this.renderWeaponGrid();
      this.describe(null);
    }

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
      this.info.push(text(this, infoX, 102, 'Tap weapons to fill slots.', C('d'), 1, C('0')));
      return;
    }
    const w = data.content.weapons.find((x) => x.id === id)!;
    this.info.push(text(this, infoX, 94, w.name, C('4'), 1, C('0')));
    // Each block starts below the last one, however many lines the text wraps to.
    let y = 107;
    if (w.launch) {
      const lines = textBlock(this, infoX, y, w.launch, C('c'), 196);
      this.info.push(...lines);
      y += lines.length * 12 + 3;
    }
    if (w.tap) {
      this.info.push(...textBlock(this, infoX, y, w.tap, C('b'), 196));
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
          text(this, 370, 94, 'Max 1 Legendary!', C('4'), 1, C('0')),
          ...textBlock(this, 370, 108, 'You may only equip one Legendary weapon at a time.', C('c'), 196),
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
    text(this, 274, 158, 'Artifact', C('d')).setOrigin(0, 0.5);
    if (arts.length === 0) {
      text(this, 330, 158, 'None yet (from shop)', C('e')).setOrigin(0, 0.5);
      return;
    }
    this.equipped = profile.equipped.artifacts.filter((id) => owns('artifacts', id)).slice(0, slots);
    arts.forEach((a, i) => {
      const x = 336 + i * 26;
      const box = this.add.rectangle(x, 158, 22, 22, C('0')).setStrokeStyle(1, C('d')).setInteractive();
      this.add.image(x, 158, iconKey(a.id)).setDepth(2);
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
    this.info = [text(this, 370, 94, a.name, C('4'), 1, C('0')), ...textBlock(this, 370, 108, a.effect, C('c'), 196)];
  }

  private itemRow(): void {
    const items = data.content.consumables.filter((c) => consumableCount(c.id) > 0);
    text(this, 274, 184, 'Items', C('d')).setOrigin(0, 0.5);
    if (items.length === 0) {
      text(this, 330, 184, 'None yet (1 use each)', C('e')).setOrigin(0, 0.5);
      return;
    }
    items.forEach((c, i) => {
      const x = 336 + i * 34;
      this.add.image(x, 184, iconKey(c.id)).setDepth(2);
      text(this, x + 10, 184, `x${consumableCount(c.id)}`, C('b')).setOrigin(0, 0.5);
    });
  }

  private slingRow(): void {
    const skin = profile.equipped.slingSkin;
    const def = data.content.cosmetics?.find((c) => c.id === skin);
    const name = def?.name ?? 'Standard Sling';
    const icon = skin === 's_quicksilver' ? 'sling_quicksilver' : skin === 's_gemini' ? 'sling_gemini' : 'sling';
    text(this, 274, 210, 'Sling', C('d')).setOrigin(0, 0.5);
    this.add.image(320, 210, icon).setScale(0.5).setDepth(2);
    text(this, 336, 210, name, C('4'), 1, C('0')).setOrigin(0, 0.5);
  }

  private refresh(): void {
    this.slots.forEach((id, i) => {
      const img = this.slotImgs[i];
      if (id) {
        img.setTexture(weaponTexture(id)).setVisible(true);
        const tex = this.textures.get(weaponTexture(id));
        const w = tex?.getSourceImage()?.width ?? 16;
        img.setScale(w >= 32 ? 0.75 : 1.3);
      } else {
        img.setVisible(false);
      }
    });
    for (const a of this.artifactBoxes) a.box.setStrokeStyle(this.equipped.includes(a.id) ? 2 : 1, this.equipped.includes(a.id) ? C('4') : C('d'));
    this.goBtn?.setEnabled(this.slots.every((s) => s !== null));
  }

  private start(): void {
    if (!this.slots.every((s) => s !== null)) return;
    const loadout = this.slots as string[];
    if (!this.fixed) setLoadout(loadout);
    setArtifacts(this.equipped);
    sfx.click();
    goTo(this, 'game', { level: this.level, loadout });
  }
}
