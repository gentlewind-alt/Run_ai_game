import { forgeEnabled, forgeLimit, isForgeWeapon } from '../core/forge';
import Phaser from 'phaser';
import { C } from '../art/palette';
import { fitText, text, textBlock } from '../art/font5x7';
import { iconKey } from '../art/icons';
import { pixText } from '../art/pix';
import { slingTexture, weaponTexture } from '../art/textures';
import { sfx } from '../audio/sfx';
import { H } from '../config/constants';
import { goTo, irisOpen } from '../core/flow';
import { artifactSlots, consumableCount, loadoutSize, owns, profile, setArtifacts, setLoadout, starsFor, upgradeMult } from '../core/profile';
import { slingLevel, slingLines } from '../core/slingshots';
import { data } from '../data/load';
import { levelDef, shortWeaponName } from '../data/lookup';
import { makeButton, menuBackdrop } from '../ui/widgets';
import { createItemCard } from '../ui/cards';
import { helpButton, maybeTutorial } from '../ui/tutorial';

const PAGE_SIZE = 10;

/** Before each level: pick weapons in firing order, artifacts, items, and fling into battle. */
export default class LoadoutScene extends Phaser.Scene {
  private level = 1;
  private slots: (string | null)[] = [];
  private slotImgs: Phaser.GameObjects.Image[] = [];
  private artifactBoxes: { id: string; box: Phaser.GameObjects.Rectangle }[] = [];
  private equipped: string[] = [];
  private info: Phaser.GameObjects.Image[] = [];
  private detailId: string | null = null;
  private goBtn?: ReturnType<typeof makeButton>;
  private gridObjs: Phaser.GameObjects.GameObject[] = [];
  private page = 0;
  private forgeCap = 99;
  private forgeNote?: Phaser.GameObjects.Image;
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
    this.detailId = null;
    this.gridObjs = [];
    this.page = 0;

    const lvl = levelDef(this.level);
    const cleared = starsFor(this.level) > 0;
    this.fixed = lvl.loadout?.length && !cleared ? lvl.loadout.slice() : null;
    this.forgeCap = forgeEnabled() ? forgeLimit(lvl) : 0;
    menuBackdrop(this, true);

    // Divider between grid and loadout panel
    this.add.rectangle(264, H / 2, 2, H - 20, C('0'), 0.4);

    // Right side: Header & level info
    text(this, 370, 10, fitText(`Level ${this.level}: ${lvl.name}`, 196), C('4'), 1, C('0'));
    if (lvl.loadout?.length && cleared) text(this, 370, 22, fitText('Cleared! Bring your own arsenal.', 196), C('5'), 1, C('0'));
    else if (lvl.hints?.[0]) {
      text(this, 370, 22, fitText(lvl.hints[0], 196), C('c'), 1, C('0'));
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
      this.add.rectangle(sx, sy, boxSize + 2, boxSize + 2, C('0'));
      const box = this.add.rectangle(sx, sy, boxSize, boxSize, C('8')).setStrokeStyle(1, C('9')).setInteractive();
      box.on('pointerdown', () => { if (this.fixed) return; sfx.click(); this.slots[i] = null; this.refresh(); });
      this.slotImgs.push(this.add.image(sx, sy, 'px').setVisible(false).setScale(1.5));
      pixText(this, sx - 9, sy - 9, String(i + 1), C('4'));
    }

    // Prefill slots from last loadout or available owned weapons
    const owned = data.content.weapons.filter((w) => owns('weapons', w.id) && (!isForgeWeapon(w.id) || forgeEnabled()));
    const last = profile.equipped.loadout.filter((id) => owns('weapons', id) && data.content.weapons.some((w) => w.id === id) && (!isForgeWeapon(id) || forgeEnabled()));
    let hasLegendary = false;
    const sanitizedLast = last.filter((id) => {
      const w = data.content.weapons.find((x) => x.id === id);
      if (w?.rarity === 'legendary') {
        if (hasLegendary) return false;
        hasLegendary = true;
      }
      return true;
    });
    let forged = 0;
    const within = sanitizedLast.filter((id) => !isForgeWeapon(id) || ++forged <= this.forgeCap);
    this.slots = Array.from({ length: n }, (_, i) => within[i] ?? null);
    for (let i = 0; i < n; i++) {
      if (this.slots[i] === null) {
        const available = owned.filter((ow) => !isForgeWeapon(ow.id) || this.forgedCount() < this.forgeCap);
        const fallback = available.find((ow) => ow.rarity !== 'legendary' && !this.slots.includes(ow.id)) ??
                         available.find((ow) => ow.rarity !== 'legendary');
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

    if (!this.fixed && forgeEnabled()) makeButton(this, 132, 13, 90, 24, 'Forge weapon', 'go', () => { setLoadout(this.slots.filter((id): id is string => id !== null)); setArtifacts(this.equipped); goTo(this, 'forge', { returnTo: 'loadout', level: this.level }); }, 6);

    // Left side: Weapon Grid
    if (this.fixed) {
      textBlock(this, 132, 100, 'This level comes with its own set of weapons.', C('4'), 200, C('0'));
      textBlock(this, 132, 130, 'Check the slots on the right, then Fling!', C('d'), 200);
    } else {
      this.renderWeaponGrid();
      this.describe(null);
    }

    this.refresh();
    helpButton(this, 252, H - 18, ['loadout', 'battle', 'abilities', 'flight', 'reach', 'damage'], 9);
    maybeTutorial(this, ['loadout', 'battle', 'abilities', ...(this.level >= 3 ? ['flight'] : []), ...(this.level >= 5 ? ['damage'] : []), ...(this.level === 5 ? ['reach'] : [])]);
    irisOpen(this);
  }

  private renderWeaponGrid(): void {
    this.gridObjs.forEach((o) => o.destroy());
    this.gridObjs = [];

    const owned = data.content.weapons.filter((w) => owns('weapons', w.id) && (!isForgeWeapon(w.id) || forgeEnabled()));
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
        rarity: w.rarity, onClick: () => { sfx.unlock(); this.addToSlot(w.id); },
      });

      const elIcon = this.add.image(x + 35, y + 26, `el_${w.element}`).setDepth(2);
      const dmgTxt = pixText(this, x + 42, y + 26, String(Math.round(w.baseDamage * upgradeMult(w.id))), C('4')).setOrigin(0, 0.5).setDepth(2);
      const abTxt = text(this, x + cardW - 6, y + 26, fitText(w.ability?.label ?? '', 48), C('b'), 1, C('0')).setOrigin(1, 0.5).setDepth(2);

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

  private describe(id: string | null, message = ''): void {
    this.detailId = id;
    this.info.forEach((i) => i.destroy());
    this.info = [];
    const infoX = 370;
    if (!id) {
      this.info.push(text(this, infoX, 102, fitText(message || (this.slots.some((s) => s === null) ? 'Tap weapons to fill slots.' : 'Ready: tap Fling!'), 196), message ? C('4') : C('c'), 1, C('0')));
      return;
    }
    const w = data.content.weapons.find((x) => x.id === id)!;
    this.info.push(text(this, infoX, 96, fitText(w.name, 196), C('4'), 1, C('0')));
    this.info.push(...textBlock(this, infoX, 110, [w.launch, w.tap].filter(Boolean).join(' '), C('c'), 196, C('0'), 2));
    if (message) this.info.push(text(this, infoX, 138, fitText(message, 196), C('4'), 1, C('0')));
  }

  private forgedCount(): number { return this.slots.filter((s) => s && isForgeWeapon(s)).length; }

  private addToSlot(id: string): void {
    const w = data.content.weapons.find((x) => x.id === id);
    if (w?.rarity === 'legendary') {
      const alreadyHasLegendary = this.slots.some((s) => {
        if (!s) return false;
        return data.content.weapons.find((x) => x.id === s)?.rarity === 'legendary';
      });
      if (alreadyHasLegendary) {
        sfx.hit(0.5);
        this.describe(this.slots.find((s) => s && data.content.weapons.find((x) => x.id === s)?.rarity === 'legendary') ?? null, 'Only 1 Legendary in this level');
        return;
      }
    }
    if (isForgeWeapon(id) && this.forgedCount() >= this.forgeCap) {
      sfx.hit(0.5);
      this.describe(this.slots.find((s) => s && isForgeWeapon(s)) ?? this.slots.find((s) => s !== null) ?? null,
        `Only ${this.forgeCap} forged weapon${this.forgeCap === 1 ? '' : 's'} in this level`);
      return;
    }
    const i = this.slots.findIndex((s) => s === null);
    if (i < 0) { this.describe(id); return; }
    sfx.click();
    this.slots[i] = id;
    this.refresh();
    this.describe(id);
  }

  private artifactRow(): void {
    const arts = data.content.artifacts.filter((a) => owns('artifacts', a.id));
    const slots = artifactSlots();
    text(this, 274, 158, 'Artifact', C('d')).setOrigin(0, 0.5);
    if (arts.length === 0) {
      text(this, 330, 158, fitText('None yet (from shop)', 140), C('d')).setOrigin(0, 0.5);
      return;
    }
    this.equipped = profile.equipped.artifacts.filter((id) => owns('artifacts', id)).slice(0, slots);
    arts.forEach((a, i) => {
      const x = 336 + i * 26;
      this.add.rectangle(x, 158, 24, 24, C('0'));
      const box = this.add.rectangle(x, 158, 22, 22, C('8')).setStrokeStyle(1, C('9')).setInteractive();
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
    this.info = [text(this, 370, 96, fitText(a.name, 196), C('4'), 1, C('0')), ...textBlock(this, 370, 110, a.effect, C('c'), 196, C('0'), 2)];
  }

  private itemRow(): void {
    const items = data.content.consumables.filter((c) => consumableCount(c.id) > 0);
    text(this, 274, 184, 'Items', C('d')).setOrigin(0, 0.5);
    if (items.length === 0) {
      text(this, 330, 184, 'None yet (1 use each)', C('e')).setOrigin(0, 0.5);
      return;
    }
    items.forEach((c, i) => {
      const x = 326 + i * 36;
      this.add.image(x, 184, iconKey(c.id)).setDepth(2);
      text(this, x + 9, 184, fitText(`x${consumableCount(c.id)}`, 24), C('b')).setOrigin(0, 0.5);
    });
  }

  private slingRow(): void {
    const skin = profile.equipped.slingSkin;
    const def = data.content.cosmetics?.find((c) => c.id === skin);
    const name = def?.name ?? 'Standard Sling';
    const icon = slingTexture(skin);
    text(this, 274, 201, 'Sling', C('d')).setOrigin(0, 0.5);
    this.add.image(320, 201, icon).setScale(0.5).setDepth(2);
    text(this, 336, 201, fitText(`${name}${def ? ` Lv${slingLevel(def.id)}` : ''}`, 134), C('4'), 1, C('0')).setOrigin(0, 0.5);
    if (def) {
      const lines = slingLines(def);
      text(this, 274, 215, fitText(lines.pro, 196), C('5'), 1, C('0')).setOrigin(0, 0.5);
      text(this, 274, 226, fitText(lines.con, 196), C('3'), 1, C('0')).setOrigin(0, 0.5);
    }
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
    for (const a of this.artifactBoxes) a.box.setStrokeStyle(1, this.equipped.includes(a.id) ? C('4') : C('9'));
    this.goBtn?.setEnabled(this.slots.every((s) => s !== null));
    if (!this.fixed && this.detailId === null) this.describe(null);
    this.forgeNote?.destroy();
    if (!this.fixed && this.forgeCap > 0) this.forgeNote = text(this, 370, 236, `Forged ${this.forgedCount()}/${this.forgeCap}`, this.forgedCount() >= this.forgeCap ? C('4') : C('d'));
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
