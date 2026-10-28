import { forgeEnabled, isForgeWeapon } from '../core/forge';
import Phaser from 'phaser';
import { C, rarityColor } from '../art/palette';
import { fitText, text, textBlock } from '../art/font5x7';
import { iconKey } from '../art/icons';
import { pixText } from '../art/pix';
import { slingTexture, weaponTexture } from '../art/textures';
import { sfx } from '../audio/sfx';
import { H, W } from '../config/constants';
import { adRules, adsEnabled, coinAdStatus, formatWait, watchForCoins } from '../core/ads';
import { goTo, irisOpen } from '../core/flow';
import { platform } from '../platform';
import {
  GOLD_QUIVER, buyArtifact, buyConsumable, buyWeapon, consumableCount, economy, equipSlingSkin, owns, profile, reachedLevel, upgradeCost, upgradeMult,
  upgradeWeapon, weaponLevel, weaponUnlockLevel,
} from '../core/profile';
import type { CosmeticDef } from '../data/types';
import { data } from '../data/load';
import { monsterDef, shortItemName, shortWeaponName } from '../data/lookup';
import { coinCounter } from '../ui/coins';
import { createItemCard } from '../ui/cards';
import { helpButton, maybeTutorial } from '../ui/tutorial';
import { menuBackdrop, uiIcon, makeButton, plainCard, type Btn } from '../ui/widgets';

type Tab = 'weapons' | 'relics' | 'artifacts' | 'items' | 'forge' | 'slingshots';
const TABS: { id: Tab; label: string; w: number }[] = [
  { id: 'weapons', label: 'Weapons', w: 56 },
  { id: 'relics', label: 'Relics', w: 46 },
  { id: 'artifacts', label: 'Artifacts', w: 60 },
  { id: 'items', label: 'Items', w: 46 },
  { id: 'forge', label: 'Forge', w: 60 },
  { id: 'slingshots', label: 'Slingshots', w: 68 },
];

interface Item {
  id: string;
  name: string;
  desc: string[];
  price: number;
  icon: string;
  scale: number;
  state: 'buy' | 'owned' | 'locked' | 'full';
  note: string;
  rarity?: string;
  source?: string;
  isSilhouette?: boolean;
}

/** Weapons, artifacts, items, forge, and skins in a landscape 4-per-row grid. */
export default class ShopScene extends Phaser.Scene {
  private tab: Tab = 'weapons';
  private selected: string | null = null;
  private body!: Phaser.GameObjects.Container;
  private tabBtns: Btn[] = [];
  private toastTxt?: Phaser.GameObjects.Image;
  private page = 0;
  private forgeScroll = 0;
  private forgeTop = 46;
  private forgeView = 176;
  private forgeMaxScroll = 0;
  private forgeList?: Phaser.GameObjects.Container;
  private forgeMask?: Phaser.GameObjects.Graphics;
  private forgeThumb?: Phaser.GameObjects.Rectangle;
  private forgeButtons: { button: Btn; canUpgrade: boolean }[] = [];
  private forgeDrag?: { y: number; scroll: number };
  private forgeDragMoved = false;

  constructor() {
    super('shop');
  }

  create(): void {
    this.tabBtns = [];
    this.page = 0;
    this.forgeScroll = 0;
    this.forgeDragMoved = false;
    menuBackdrop(this, true);
    coinCounter(this, 12, 13);
    text(this, W / 2 - 35, 13, 'Shop', C('4'), 2, C('0'));
    this.body = this.add.container(0, 0);
    makeButton(this, W / 2, H - 13, 110, 18, 'Back to map', 'plain', () => { if (this.forgeDragMoved) return; sfx.click(); goTo(this, 'map'); }, 6);
    this.render();
    this.adButton();
    helpButton(this, W - 16, 14, ['shop', 'damage', 'forge', 'flight', 'abilities'], 9);
    maybeTutorial(this, ['shop', 'damage']);
    irisOpen(this);
    this.input.on('wheel', this.onForgeWheel, this);
    this.input.on('pointerdown', this.onForgeDown, this);
    this.input.on('pointermove', this.onForgeMove, this);
    this.input.on('pointerup', this.onForgeUp, this);
    this.input.on('pointerupoutside', this.onForgeUp, this);
    this.events.once('shutdown', () => {
      this.input.off('wheel', this.onForgeWheel, this);
      this.input.off('pointerdown', this.onForgeDown, this);
      this.input.off('pointermove', this.onForgeMove, this);
      this.input.off('pointerup', this.onForgeUp, this);
      this.input.off('pointerupoutside', this.onForgeUp, this);
      this.clearForge();
    });
  }

  /** "+300 coins (Ad) 3/3": a few free-coin ads per rolling window, counted on the server clock. */
  private adButton(): void {
    if (!adsEnabled()) return;
    const r = adRules();
    const btn = makeButton(this, W - 99, 13, 112, 20, `+${r.coinReward} coins (Ad)`, 'go', async () => {
      if (this.forgeDragMoved) return;
      sfx.click();
      btn.setEnabled(false);
      const got = await watchForCoins();
      if (got > 0) {
        sfx.coin();
        this.toast(`+${got} coins`, C('4'));
      }
      void refresh();
    }, 6);
    const refresh = async (): Promise<void> => {
      let t = Date.now();
      try { t = await platform.serverTime(); } catch { /* local clock */ }
      if (!this.scene.isActive()) return;
      const s = coinAdStatus(t);
      btn.setLabel(s.left > 0 ? `+${r.coinReward} coins ${s.left}/${r.perWindow}` : `Next ad ${formatWait(s.waitMs)}`);
      btn.setEnabled(s.left > 0);
    };
    void refresh();
  }

  private render(): void {
    this.clearForge();
    this.body.removeAll(true);
    this.toastTxt = undefined;
    this.tabBtns.forEach((b) => b.box.destroy());
    this.tabBtns = [];

    const showSlingshots = data.config.features?.slingshots !== false;
    const showRelics = data.config.features?.relics !== false;
    const tabs = TABS.filter((t) => (t.id !== 'slingshots' || showSlingshots) && (t.id !== 'relics' || showRelics));
    if (this.tab === 'slingshots' && !showSlingshots) this.tab = 'weapons';
    if (this.tab === 'relics' && !showRelics) this.tab = 'weapons';

    const totalTabW = tabs.reduce((acc, t) => acc + t.w, 0) + (tabs.length - 1) * 6;
    let x = (W - totalTabW) / 2;
    tabs.forEach((t) => {
      const b = makeButton(this, x + t.w / 2, 42, t.w, 20, t.label, t.id === this.tab ? 'go' : 'plain', () => {
        if (this.forgeDragMoved) return;
        sfx.click();
        this.tab = t.id;
        this.selected = null;
        this.page = 0;
        this.forgeScroll = 0;
        this.render();
        if (t.id === 'forge') maybeTutorial(this, 'forge', 150);
      }, 6);
      this.tabBtns.push(b);
      x += t.w + 6;
    });

    if (this.tab === 'forge') this.renderForge();
    else this.renderGrid();
  }

  // ------------------------------------------------------------------ grid tabs

  private items(): Item[] {
    const c = data.content;
    if (this.tab === 'weapons') {
      return c.weapons.filter((w) => w.enabled !== false && !isForgeWeapon(w.id)).map((w) => {
        const owned = owns('weapons', w.id);
        const rarity = w.rarity ?? 'common';
        const pityLosses = economy().relicPityLosses ?? 3;
        const pityPrice = economy().relicMarketPrice?.[rarity] ?? economy().relicMarketPrice?.legendary ?? 1500;
        if (typeof w.unlock === 'object') {
          if (w.unlock.boss) {
            const bDef = monsterDef(w.unlock.boss);
            const bName = bDef?.name ?? 'Boss';
            const bLvl = w.unlock.level ?? (w.unlock.boss === 'goblin_chief' ? 4 : w.unlock.boss === 'dark_elf_matron' ? 8 : 12);
            const losses = profile.stats?.bossLosses?.[String(bLvl)] ?? 0;
            return {
              id: w.id, name: shortWeaponName(w.id, w.name), price: pityPrice, icon: weaponTexture(w.id), scale: 2,
              source: `Boss relic (${bName}) - Pity at ${pityLosses} losses (${losses}/${pityLosses})`,
              desc: [`Launch: ${w.launch ?? ''}`, `Tap: ${w.tap ?? ''}`],
              state: owned ? 'owned' : losses >= pityLosses ? 'buy' : 'locked',
              note: owned ? 'Owned' : losses >= pityLosses ? `${pityPrice}c` : `${bName}`,
              rarity, isSilhouette: !owned && losses < pityLosses,
            };
          }
          if (w.unlock.chest) {
            const chestLvl = w.unlock.level ?? (w.unlock.chest === 'c_l3' ? 3 : w.unlock.chest === 'c_l5' ? 5 : 7);
            return {
              id: w.id, name: shortWeaponName(w.id, w.name), price: w.price ?? 600, icon: weaponTexture(w.id), scale: 2,
              source: `Found in Level ${chestLvl} hidden chest`,
              desc: [`Launch: ${w.launch ?? ''}`, `Tap: ${w.tap ?? ''}`],
              state: owned ? 'owned' : 'locked',
              note: owned ? 'Owned' : `Level ${chestLvl} Chest`,
              rarity, isSilhouette: !owned,
            };
          }
        }
        const reqLvl = weaponUnlockLevel(w.unlock);
        const unlocked = reachedLevel() >= reqLvl;
        return {
          id: w.id, name: shortWeaponName(w.id, w.name), price: w.price ?? 0, icon: weaponTexture(w.id), scale: 2,
          source: reqLvl <= 1 ? 'Starting weapon' : `Unlocked at Level ${reqLvl}`,
          desc: [`Launch: ${w.launch ?? ''}`, `Tap: ${w.tap ?? ''}`],
          state: owned ? 'owned' : unlocked ? 'buy' : 'locked',
          note: unlocked ? '' : `Level ${reqLvl}`,
          rarity,
        };
      });
    }
    if (this.tab === 'relics') {
      const pityLosses = economy().relicPityLosses ?? 3;
      return c.weapons.filter((w) => w.enabled !== false && typeof w.unlock === 'object').map((w) => {
        const owned = owns('weapons', w.id);
        const rarity = w.rarity ?? 'rare';
        const pityPrice = economy().relicMarketPrice?.[rarity] ?? economy().relicMarketPrice?.legendary ?? 1500;
        if (typeof w.unlock === 'object' && w.unlock.boss) {
          const bDef = monsterDef(w.unlock.boss);
          const bName = bDef?.name ?? 'Boss';
          const bLvl = w.unlock.level ?? (w.unlock.boss === 'goblin_chief' ? 4 : w.unlock.boss === 'dark_elf_matron' ? 8 : 12);
          const losses = profile.stats?.bossLosses?.[String(bLvl)] ?? 0;
          const unlocked = losses >= pityLosses;
          return {
            id: w.id, name: shortWeaponName(w.id, w.name), price: pityPrice, icon: weaponTexture(w.id), scale: 2,
            source: `Boss relic (${bName}) - Pity at ${pityLosses} losses (${losses}/${pityLosses})`,
            desc: [`Launch: ${w.launch ?? ''}`, `Tap: ${w.tap ?? ''}`],
            state: owned ? 'owned' : unlocked ? 'buy' : 'locked',
            note: owned ? 'Owned' : unlocked ? `${pityPrice}c` : `${losses}/${pityLosses} losses`,
            rarity, isSilhouette: !owned && !unlocked,
          };
        }
        const chestLvl = typeof w.unlock === 'object' ? (w.unlock.level ?? (w.unlock.chest === 'c_l3' ? 3 : w.unlock.chest === 'c_l5' ? 5 : 7)) : 3;
        return {
          id: w.id, name: shortWeaponName(w.id, w.name), price: w.price ?? 600, icon: weaponTexture(w.id), scale: 2,
          source: `Found in Level ${chestLvl} hidden chest`,
          desc: [`Launch: ${w.launch ?? ''}`, `Tap: ${w.tap ?? ''}`],
          state: owned ? 'owned' : 'locked',
          note: owned ? 'Owned' : `Chest L${chestLvl}`,
          rarity, isSilhouette: !owned,
        };
      });
    }
    if (this.tab === 'artifacts') {
      return c.artifacts.map((a) => ({
        id: a.id, name: shortItemName(a.id, a.name), price: a.price, icon: iconKey(a.id), scale: 2,
        source: `${(a.rarity ?? 'rare').toUpperCase()} Artifact`,
        desc: [a.effect],
        state: owns('artifacts', a.id) ? 'owned' : 'buy', note: '', rarity: a.rarity,
      }));
    }
    const cap = economy().maxConsumableStack;
    if (this.tab === 'items') {
      const consumableItems: Item[] = c.consumables.map((k) => ({
        id: k.id, name: shortItemName(k.id, k.name), price: k.price, icon: iconKey(k.id), scale: 2,
        source: `Consumable - Stock: ${consumableCount(k.id)}/${cap}`,
        desc: [k.effect],
        state: consumableCount(k.id) >= cap ? 'full' : 'buy', note: '',
      }));
      const gq = (c.cosmetics ?? []).find((sk) => sk.slot || sk.id === 's_gold_quiver' || sk.id === GOLD_QUIVER);
      if (gq) {
        const owned = owns('cosmetics', gq.id) || owns('cosmetics', GOLD_QUIVER);
        consumableItems.push({
          id: gq.id, name: gq.name, price: gq.priceCoins ?? 500, icon: 'icon_coin', scale: 2,
          source: 'Permanent Upgrade',
          desc: ['Carry a 5th weapon into battle.'],
          state: owned ? 'owned' : 'buy', note: owned ? '5 Slots' : '',
        });
      }
      return consumableItems;
    }
    if (this.tab === 'slingshots') {
      const cosmetics: CosmeticDef[] = c.cosmetics ?? [];
      const slingshots = cosmetics.filter((sk) => sk.kind === 'sling_skin');
      return slingshots.map((sk: CosmeticDef) => {
        const owned = owns('cosmetics', sk.id);
        const isEquipped = profile.equipped.slingSkin === sk.id;
        const icon = slingTexture(sk.id);
        const price = sk.priceCoins ?? 0;
        const desc = [
          sk.desc ?? (sk.id === 's_quicksilver' ? '+25% launch speed with speed lines.' : 'Launches queued twin 12 steps behind at 45% damage.'),
        ];
        const note = isEquipped ? 'Equipped' : owned ? 'Equip' : `${price}c`;
        return {
          id: sk.id, name: sk.name, price, icon, scale: 1,
          source: 'Slingshot Frame',
          desc,
          state: isEquipped ? 'owned' : 'buy', note,
        };
      });
    }
    return [];
  }

  private renderGrid(): void {
    const list = this.items();
    const cardW = 110;
    const maxItems = 8;
    const maxPage = Math.max(0, Math.ceil(list.length / maxItems) - 1);
    this.page = Math.min(this.page, maxPage);
    const startIdx = this.page * maxItems;
    const pageItems = list.slice(startIdx, startIdx + maxItems);

    pageItems.forEach((it, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = 10 + col * (W - 132) / 3;
      const y = 58 + row * 40;
      const sel = it.id === this.selected;
      const card = createItemCard({
        scene: this, x, y, w: cardW, icon: it.icon, iconScale: it.scale === 2 ? 1.2 : it.scale,
        name: it.name, rarity: it.rarity, selected: sel, locked: it.state === 'locked',
        isSilhouette: it.isSilhouette, onClick: () => { sfx.click(); this.selected = it.id; this.render(); },
      });
      const extra: Phaser.GameObjects.GameObject[] = [];

      if (this.tab === 'slingshots') {
        extra.push(text(this, x + 31, y + 26, fitText(it.note, cardW - 37), it.note === 'Equipped' ? C('4') : C('c'), 1, C('0')).setOrigin(0, 0.5).setDepth(2));
      } else if (it.state === 'owned') {
        extra.push(text(this, x + 31, y + 26, 'Owned', C('5'), 1, C('0')).setOrigin(0, 0.5).setDepth(2));
      } else if (it.state === 'locked') {
        extra.push(uiIcon(this, x + 35, y + 26, 'lock', 'icon_lock', 10).setDepth(2), text(this, x + 43, y + 26, fitText(it.note.replace('Reach level', 'Level'), cardW - 49), C('d'), 1, C('0')).setOrigin(0, 0.5).setDepth(2));
        if (!it.isSilhouette) card.icon.setAlpha(0.4);
      } else {
        extra.push(uiIcon(this, x + 35, y + 26, 'coin', 'icon_coin', 10).setDepth(2), pixText(this, x + 43, y + 26, String(it.price), profile.coins >= it.price ? C('4') : C('3')).setOrigin(0, 0.5).setDepth(2));
        if (this.tab === 'items') extra.push(text(this, x + cardW - 5, y + 26, `x${consumableCount(it.id)}`, C('b')).setOrigin(1, 0.5).setDepth(2));
      }

      this.body.add([...card.objects, ...extra]);
    });

    if (list.length > maxItems) {
      if (this.page > 0) {
        const prev = makeButton(this, W / 2 - 50, 150, 36, 18, '<', 'plain', () => { sfx.click(); this.page--; this.render(); }, 5);
        this.body.add(prev.box);
      }
      this.body.add(text(this, W / 2, 150, `${this.page + 1}/${maxPage + 1}`, C('c'), 1, C('0')).setOrigin(0.5, 0.5).setDepth(5));
      if (this.page < maxPage) {
        const next = makeButton(this, W / 2 + 50, 150, 36, 18, '>', 'plain', () => { sfx.click(); this.page++; this.render(); }, 5);
        this.body.add(next.box);
      }
    }

    const it = list.find((x) => x.id === this.selected);
    const y0 = list.length > maxItems ? 167 : 144;
    if (!it) {
      this.body.add(text(this, W / 2, y0 + 16, 'Tap something to see what it does.', C('d'), 1, C('0')));
      return;
    }
    // 1. Title
    const titleCol = it.rarity ? rarityColor(it.rarity) : C('4');
    this.body.add(text(this, W / 2, y0 + 4, fitText(it.name, W - 40), titleCol, 1, C('0')));

    // 2. Rarity and source line
    const metaParts: string[] = [];
    if (it.rarity) metaParts.push(it.rarity.toUpperCase());
    if (it.source) metaParts.push(it.source);
    const metaStr = metaParts.join(' - ');
    const metaY = y0 + 15;
    this.body.add(text(this, W / 2, metaY, fitText(metaStr, W - 40), C('d'), 1, C('0')));

    // 3. Description stays inside the detail area above the purchase button.
    const descStartY = metaY + 11;
    const maxWidth = W - 60;
    const maxLines = list.length > maxItems ? 2 : 3;
    const lines = textBlock(this, W / 2, 0, it.desc.join(' '), C('c'), maxWidth, C('0'), maxLines);
    const lineSpacing = 12;
    lines.forEach((l, i) => { l.setY(descStartY + i * lineSpacing); });
    this.body.add(lines);

    // 4. Button anchored below with fixed gap
    const descBottom = lines.length > 0 ? descStartY + (lines.length - 1) * lineSpacing + 5 : metaY + 5;
    const gap = 6;
    const btnH = 18;
    const btnY = Math.min(H - 47, Math.round(descBottom + gap + btnH / 2));

    const isSlingEquip = this.tab === 'slingshots' && owns('cosmetics', it.id);
    const label = isSlingEquip ? (profile.equipped.slingSkin === it.id ? 'Equipped' : 'Equip') :
                  it.state === 'owned' ? 'Owned' : it.state === 'locked' ? it.note : it.state === 'full' ? 'Stock full' : `Buy for ${it.price}`;
    const btnEnabled = this.tab === 'slingshots' ? profile.equipped.slingSkin !== it.id : it.state === 'buy';
    const buy = makeButton(this, W / 2, btnY, 150, btnH, fitText(label, 140), 'go', () => this.buy(it), 6);
    buy.setEnabled(btnEnabled);
    this.body.add(buy.box);
  }

  private buy(it: Item): void {
    if (this.tab === 'slingshots') {
      if (owns('cosmetics', it.id)) {
        equipSlingSkin(it.id);
        sfx.click();
        this.toast(`Equipped ${it.name}!`, C('5'));
        this.render();
        return;
      }
      if (profile.coins < it.price) {
        sfx.lose();
        this.toast(`Need ${it.price - profile.coins} more coins.`, C('3'));
        return;
      }
      profile.coins -= it.price;
      profile.owned.cosmetics.push(it.id);
      equipSlingSkin(it.id);
      sfx.unlock();
      this.toast(`Bought & equipped ${it.name}!`, C('5'));
      this.render();
      return;
    }
    if (it.state !== 'buy') return;
    if (it.id === 's_gold_quiver' || it.id === GOLD_QUIVER) {
      if (profile.coins < it.price) {
        sfx.lose();
        this.toast(`Need ${it.price - profile.coins} more coins.`, C('3'));
        return;
      }
      profile.coins -= it.price;
      profile.owned.cosmetics.push(it.id);
      profile.owned.cosmetics.push(GOLD_QUIVER);
      sfx.unlock();
      this.toast(`Bought ${it.name}! 5 slots unlocked.`, C('5'));
      this.render();
      return;
    }
    let r: 'ok' | 'coins' | 'owned' | 'full' | 'locked' = 'coins';
    if (this.tab === 'weapons' || this.tab === 'relics') r = buyWeapon(it.id);
    else if (this.tab === 'artifacts') r = buyArtifact(it.id);
    else if (this.tab === 'items') r = buyConsumable(it.id);

    if (r === 'ok') {
      sfx.unlock();
      this.selected = it.id;
      this.toast(`Bought ${it.name}!`, C('5'));
      this.render();
    } else if (r === 'coins') {
      sfx.lose();
      this.toast(`Need ${it.price - profile.coins} more coins.`, C('3'));
    }
  }

  private toast(msg: string, color: number): void {
    this.toastTxt?.destroy();
    const t = text(this, W / 2, H - 30, fitText(msg, W - 24), color, 1, C('0')).setDepth(20);
    this.toastTxt = t;
    this.tweens.add({ targets: t, alpha: 0, delay: 1400, duration: 400, onComplete: () => t.destroy() });
  }

  // ------------------------------------------------------------------ forge

  private renderForge(): void {
    const R = data.content.damageRules;
    const owned = data.content.weapons.filter((w) => owns('weapons', w.id));
    const cardW = 226;
    const cardH = 36;
    const top = forgeEnabled() ? 90 : 58;
    const viewportHeight = 222 - top;
    this.forgeTop = top; this.forgeView = viewportHeight;
    this.forgeMaxScroll = Math.max(0, Math.ceil(owned.length / 2) * 40 - 4 - viewportHeight);
    this.forgeScroll = Phaser.Math.Clamp(this.forgeScroll, 0, this.forgeMaxScroll);
    if (forgeEnabled()) this.body.add(makeButton(this, W / 2, 71, 200, 24, 'Create a weapon', 'go', () => goTo(this, 'forge')).box);
    const list = this.add.container(0, top - this.forgeScroll);
    this.forgeList = list;
    this.body.add(list);
    const mask = this.make.graphics({ x: 0, y: 0 }, false);
    mask.fillRect(8, top, W - 16, viewportHeight);
    list.setMask(mask.createGeometryMask());
    this.forgeMask = mask;

    owned.forEach((w, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = col === 0 ? 10 : W - 10 - cardW;
      const y = row * 40;
      const lv = weaponLevel(w.id);
      const g = plainCard(this, x, y, cardW, cardH, '8', '9', 1);
      const icon = this.add.image(x + 16, y + 18, weaponTexture(w.id)).setDepth(2);
      icon.setScale(Math.min(1, 24 / icon.width, 28 / icon.height));
      const textX = x + 34;
      const priceX = x + cardW - 32;
      const priceW = 50;
      const coinX = x + cardW - 65;
      const nameWidth = Math.min(priceX - priceW / 2, coinX - 5) - textX - data.config.display.ui.buttonPadding;
      const nameTxt = text(this, textX, y + 10, fitText(shortWeaponName(w.id, w.name), nameWidth), C('c'), 1, C('0')).setOrigin(0, 0.5).setDepth(2);

      const now = Math.round(w.baseDamage * upgradeMult(w.id));
      const cost = upgradeCost(w.id);
      const after = Math.round(w.baseDamage * (1 + R.upgradeDamagePerStep * (lv + 1)));
      const label = w.forge ? 'Base' : 'Dmg';
      const dmgStr = cost === null ? `${label} ${now} (Max)` : `${label} ${now} -> ${after}`;
      const dmgTxt = text(this, textX, y + 26, fitText(dmgStr, 94), C('c'), 1, C('0')).setOrigin(0, 0.5).setDepth(2);

      const parts: Phaser.GameObjects.GameObject[] = [g, icon, nameTxt, dmgTxt];
      for (let p = 0; p < R.maxUpgradeLevel; p++) {
        parts.push(this.add.rectangle(x + 134 + p * 6, y + 26, 4, 6, p < lv ? C('4') : C('f')).setStrokeStyle(1, C('0')).setDepth(2));
      }

      const btn = makeButton(this, priceX, y + 18, priceW, 20, cost === null ? 'Max' : String(cost), 'go', () => this.upgrade(w.id), 6);
      this.forgeButtons.push({ button: btn, canUpgrade: cost !== null });
      parts.push(btn.box);
      if (cost !== null) parts.push(uiIcon(this, coinX, y + 18, 'coin', 'icon_coin', 10).setDepth(8));
      list.add(parts);
    });

    if (owned.length === 0) {
      this.body.add(text(this, W / 2, 80, 'Buy a weapon first.', C('d'), 1, C('0')));
    }
    if (this.forgeMaxScroll > 0) {
      this.body.add(this.add.rectangle(W - 4, top + viewportHeight / 2, 2, viewportHeight, C('0')));
      const thumbHeight = Math.max(16, viewportHeight * viewportHeight / (viewportHeight + this.forgeMaxScroll));
      this.forgeThumb = this.add.rectangle(W - 4, top + thumbHeight / 2, 3, thumbHeight, C('d'));
      this.body.add(this.forgeThumb);
    }
    this.scrollForge(this.forgeScroll);
  }

  private clearForge(): void {
    this.forgeList?.clearMask(true);
    this.forgeMask?.destroy();
    this.forgeList = undefined;
    this.forgeMask = undefined;
    this.forgeThumb = undefined;
    this.forgeButtons = [];
    this.forgeDrag = undefined;
  }

  private scrollForge(value: number): void {
    this.forgeScroll = Phaser.Math.Clamp(value, 0, this.forgeMaxScroll);
    if (!this.forgeList) return;
    this.forgeList.y = this.forgeTop - this.forgeScroll;
    for (const { button, canUpgrade } of this.forgeButtons) {
      const y = this.forgeList.y + button.box.y;
      const enabled = canUpgrade && y - 13 >= this.forgeTop && y + 13 <= 222;
      button.setEnabled(enabled);
      if (button.box.input) button.box.input.enabled = enabled;
    }
    if (this.forgeThumb) {
      const h = this.forgeThumb.height;
      this.forgeThumb.y = this.forgeTop + h / 2 + this.forgeScroll / this.forgeMaxScroll * (this.forgeView - h);
    }
  }

  private inForge(pointer: Phaser.Input.Pointer): boolean {
    return this.tab === 'forge' && pointer.x >= 8 && pointer.x <= W - 8 && pointer.y >= this.forgeTop && pointer.y <= 222;
  }

  private onForgeWheel(pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number): void {
    if (this.inForge(pointer)) this.scrollForge(this.forgeScroll + dy * 0.35);
  }

  private onForgeDown(pointer: Phaser.Input.Pointer): void {
    this.forgeDragMoved = false;
    this.forgeDrag = this.inForge(pointer) ? { y: pointer.y, scroll: this.forgeScroll } : undefined;
  }

  private onForgeMove(pointer: Phaser.Input.Pointer): void {
    const drag = this.forgeDrag;
    if (!drag || !pointer.isDown) return;
    if (Math.abs(pointer.y - drag.y) > 3) this.forgeDragMoved = true;
    if (this.forgeDragMoved) this.scrollForge(drag.scroll + drag.y - pointer.y);
  }

  private onForgeUp(): void {
    this.forgeDrag = undefined;
  }

  private upgrade(id: string): void {
    if (this.forgeDragMoved) return;
    const r = upgradeWeapon(id);
    if (r === 'ok') {
      sfx.coin();
      this.render();
    } else if (r === 'coins') {
      sfx.lose();
      const cost = upgradeCost(id) ?? 0;
      this.toast(`Need ${cost - profile.coins} more coins.`, C('3'));
    }
  }

}
