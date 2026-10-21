import Phaser from 'phaser';
import { C, rarityColor, rarityStroke } from '../art/palette';
import { setText, text, textBlock } from '../art/font5x7';
import { iconKey } from '../art/icons';
import { pixText } from '../art/pix';
import { weaponTexture } from '../art/textures';
import { sfx } from '../audio/sfx';
import { H, W } from '../config/constants';
import { goTo, irisOpen } from '../core/flow';
import {
  GOLD_QUIVER, buyArtifact, buyConsumable, buyWeapon, consumableCount, economy, equipSlingSkin, owns, profile, reachedLevel, upgradeCost, upgradeMult,
  upgradeWeapon, weaponLevel, weaponUnlockLevel,
} from '../core/profile';
import type { CosmeticDef } from '../data/types';
import { data } from '../data/load';
import { shortItemName, shortWeaponName } from '../data/lookup';
import { coinCounter } from '../ui/coins';
import { makeButton, panel, type Btn } from '../ui/widgets';

type Tab = 'weapons' | 'relics' | 'artifacts' | 'items' | 'forge' | 'skins';
const TABS: { id: Tab; label: string; w: number }[] = [
  { id: 'weapons', label: 'Weapons', w: 60 },
  { id: 'relics', label: 'Relics', w: 50 },
  { id: 'artifacts', label: 'Artifacts', w: 60 },
  { id: 'items', label: 'Items', w: 50 },
  { id: 'forge', label: 'Forge', w: 50 },
  { id: 'skins', label: 'Skins', w: 50 },
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

  constructor() {
    super('shop');
  }

  create(): void {
    this.tabBtns = [];
    this.page = 0;
    this.add.rectangle(W / 2, H / 2, W, H, C('f'));
    coinCounter(this, 12, 13);
    text(this, W / 2, 13, 'Shop', C('c'), 1, C('0'));
    this.body = this.add.container(0, 0);
    makeButton(this, W / 2, H - 16, 110, 22, 'Back to map', 'plain', () => { sfx.click(); goTo(this, 'map'); }, 6);
    this.render();
    irisOpen(this);
  }

  private render(): void {
    this.body.removeAll(true);
    this.toastTxt = undefined;
    this.tabBtns.forEach((b) => b.box.destroy());
    this.tabBtns = [];

    const showSkins = data.config.features?.iap !== false && (data.config.features as Record<string, boolean>)?.skins !== false;
    const showRelics = data.config.features?.relics !== false;
    const tabs = TABS.filter((t) => (t.id !== 'skins' || showSkins) && (t.id !== 'relics' || showRelics));
    if (this.tab === 'skins' && !showSkins) this.tab = 'weapons';
    if (this.tab === 'relics' && !showRelics) this.tab = 'weapons';

    const totalTabW = tabs.reduce((acc, t) => acc + t.w, 0) + (tabs.length - 1) * 6;
    let x = (W - totalTabW) / 2;
    tabs.forEach((t) => {
      const b = makeButton(this, x + t.w / 2, 30, t.w, 20, t.label, t.id === this.tab ? 'go' : 'plain', () => {
        sfx.click();
        this.tab = t.id;
        this.selected = null;
        this.page = 0;
        this.render();
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
      return c.weapons.filter((w) => w.enabled !== false).map((w) => {
        const owned = owns('weapons', w.id);
        const rarity = w.rarity ?? 'common';
        if (typeof w.unlock === 'object') {
          if (w.unlock.boss) {
            const bName = w.unlock.boss === 'goblin_chief' ? 'Goblin Chief' : w.unlock.boss === 'dark_elf_matron' ? 'Dark Elf Matron' : 'Iron Warlord';
            const bLvl = w.unlock.boss === 'goblin_chief' ? 4 : w.unlock.boss === 'dark_elf_matron' ? 8 : 12;
            const losses = profile.stats?.bossLosses?.[String(bLvl)] ?? 0;
            const pityPrice = (economy().relicMarketPrice as Record<string, number> | undefined)?.[rarity] ?? 1500;
            return {
              id: w.id, name: shortWeaponName(w.id, w.name), price: pityPrice, icon: weaponTexture(w.id), scale: 2,
              desc: [w.name, `Unlocked by defeating ${bName}.`, `Pity unlock at 3 boss losses (losses: ${losses}/3).`, `Launch: ${w.launch ?? ''}`, `Tap: ${w.tap ?? ''}`],
              state: owned ? 'owned' : losses >= 3 ? 'buy' : 'locked',
              note: owned ? 'Owned' : losses >= 3 ? `${pityPrice}c` : `${bName}`,
              rarity, isSilhouette: !owned && losses < 3,
            };
          }
          if (w.unlock.chest) {
            const chestLvl = w.unlock.chest === 'c_l3' ? 3 : w.unlock.chest === 'c_l5' ? 5 : 7;
            return {
              id: w.id, name: shortWeaponName(w.id, w.name), price: w.price ?? 600, icon: weaponTexture(w.id), scale: 2,
              desc: [w.name, `Found in hidden treasure chest in Level ${chestLvl}.`, `Launch: ${w.launch ?? ''}`, `Tap: ${w.tap ?? ''}`],
              state: owned ? 'owned' : 'locked',
              note: owned ? 'Owned' : `Level ${chestLvl} Chest`,
              rarity, isSilhouette: !owned,
            };
          }
        }
        const reqLvl = weaponUnlockLevel(w.id);
        const unlocked = reachedLevel() >= reqLvl;
        return {
          id: w.id, name: shortWeaponName(w.id, w.name), price: w.price ?? 0, icon: weaponTexture(w.id), scale: 2,
          desc: [w.name, `Launch: ${w.launch ?? ''}`, `Tap: ${w.tap ?? ''}`],
          state: owned ? 'owned' : unlocked ? 'buy' : 'locked',
          note: unlocked ? '' : `Level ${reqLvl}`,
          rarity,
        };
      });
    }
    if (this.tab === 'relics') {
      return c.weapons.filter((w) => w.enabled !== false && typeof w.unlock === 'object').map((w) => {
        const owned = owns('weapons', w.id);
        const rarity = w.rarity ?? 'rare';
        if (typeof w.unlock === 'object' && w.unlock.boss) {
          const bName = w.unlock.boss === 'goblin_chief' ? 'Goblin Chief' : w.unlock.boss === 'dark_elf_matron' ? 'Dark Elf Matron' : 'Iron Warlord';
          const bLvl = w.unlock.boss === 'goblin_chief' ? 4 : w.unlock.boss === 'dark_elf_matron' ? 8 : 12;
          const losses = profile.stats?.bossLosses?.[String(bLvl)] ?? 0;
          const pityPrice = (economy().relicMarketPrice as Record<string, number> | undefined)?.[rarity] ?? 1500;
          const unlocked = losses >= 3;
          return {
            id: w.id, name: shortWeaponName(w.id, w.name), price: pityPrice, icon: weaponTexture(w.id), scale: 2,
            desc: [w.name, `Boss relic: defeated by ${bName}.`, `Pity unlock at 3 boss losses (${losses}/3).`, `Launch: ${w.launch ?? ''}`, `Tap: ${w.tap ?? ''}`],
            state: owned ? 'owned' : unlocked ? 'buy' : 'locked',
            note: owned ? 'Owned' : unlocked ? `${pityPrice}c` : `${losses}/3 losses`,
            rarity, isSilhouette: !owned && !unlocked,
          };
        }
        const chestLvl = (w.unlock as any)?.chest === 'c_l3' ? 3 : (w.unlock as any)?.chest === 'c_l5' ? 5 : 7;
        return {
          id: w.id, name: shortWeaponName(w.id, w.name), price: w.price ?? 600, icon: weaponTexture(w.id), scale: 2,
          desc: [w.name, `Found in hidden treasure chest in Level ${chestLvl}.`, `Launch: ${w.launch ?? ''}`, `Tap: ${w.tap ?? ''}`],
          state: owned ? 'owned' : 'locked',
          note: owned ? 'Owned' : `Chest L${chestLvl}`,
          rarity, isSilhouette: !owned,
        };
      });
    }
    if (this.tab === 'artifacts') {
      return c.artifacts.map((a) => ({
        id: a.id, name: shortItemName(a.id, a.name), price: a.price, icon: iconKey(a.id), scale: 2, desc: [a.name, a.effect],
        state: owns('artifacts', a.id) ? 'owned' : 'buy', note: '', rarity: a.rarity,
      }));
    }
    const cap = economy().maxConsumableStack;
    if (this.tab === 'items') {
      return c.consumables.map((k) => ({
        id: k.id, name: shortItemName(k.id, k.name), price: k.price, icon: iconKey(k.id), scale: 2, desc: [k.name, k.effect, `You have ${consumableCount(k.id)}, up to ${cap}.`],
        state: consumableCount(k.id) >= cap ? 'full' : 'buy', note: '',
      }));
    }
    const cosmetics: CosmeticDef[] = c.cosmetics ?? [
      { id: 's_gold_quiver', name: 'Gold Quiver', kind: 'sling_skin', priceBits: 0, priceCoins: 0 },
      { id: 's_skin_bone', name: 'Bone Sling', kind: 'sling_skin', priceBits: 0, priceCoins: 0 },
      { id: 's_skin_iron', name: 'Iron Ballista', kind: 'sling_skin', priceBits: 0, priceCoins: 0 },
    ];
    return cosmetics.map((sk: CosmeticDef) => {
      const isQuiver = sk.id === 's_gold_quiver' || sk.id === 'gold_quiver';
      const owned = isQuiver ? (owns('cosmetics', 's_gold_quiver') || owns('cosmetics', GOLD_QUIVER)) : owns('cosmetics', sk.id);
      const isEquipped = profile.equipped.slingSkin === sk.id;
      const icon = isQuiver ? 'icon_coin' : sk.id;
      const desc = isQuiver
        ? [sk.name, 'Carry a 5th weapon into battle.', 'Prices in RUN Bits (owner approval).']
        : [sk.name, 'Custom slingshot frame.', 'Changes sling silhouette in battle.'];
      const note = isQuiver ? (owned ? '5 Slots' : '0 Bits') : (isEquipped ? 'Equipped' : owned ? 'Equip' : '0 Bits');
      return {
        id: sk.id, name: sk.name, price: sk.priceBits ?? 0, icon, scale: isQuiver ? 2 : 1, desc,
        state: isQuiver ? (owned ? 'owned' : 'buy') : (owned ? 'owned' : 'buy'), note,
      };
    });
  }

  private renderGrid(): void {
    const list = this.items();
    const cardW = 110;
    const cardH = 38;
    const maxItems = 8;
    const maxPage = Math.max(0, Math.ceil(list.length / maxItems) - 1);
    this.page = Math.min(this.page, maxPage);
    const startIdx = this.page * maxItems;
    const pageItems = list.slice(startIdx, startIdx + maxItems);

    pageItems.forEach((it, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = 10 + col * 116;
      const y = 46 + row * 42;
      const sel = it.id === this.selected;
      const baseStroke = it.rarity ? rarityStroke(it.rarity) : '9';
      const stroke = sel ? 'a' : baseStroke;
      const g = panel(this, x, y, cardW, cardH, sel ? '9' : '8', stroke, 'f', 1);
      if (sel) g.lineStyle(1, C('4'), 1).strokeRect(x - 1, y - 1, cardW + 2, cardH + 2);

      const iconBox = this.add.rectangle(x + 15, y + 19, 24, 30, C('0')).setStrokeStyle(1, C(baseStroke)).setDepth(2);
      const icon = this.add.image(x + 15, y + 19, it.icon).setScale(it.scale === 2 ? 1.2 : it.scale).setDepth(2);
      if (it.state === 'locked' && (it.isSilhouette || it.id.startsWith('w_'))) {
        icon.setTint(0x1a1c2c).setAlpha(0.6);
      }
      const nameColor = it.state === 'locked' ? C('e') : it.rarity ? rarityColor(it.rarity) : C('c');
      const name = text(this, x + 31, y + 10, it.name, nameColor).setOrigin(0, 0.5).setDepth(2);
      const parts: Phaser.GameObjects.GameObject[] = [g, iconBox, icon, name];

      if (this.tab === 'skins') {
        parts.push(text(this, x + 31, y + 26, it.note, it.note === 'Equipped' ? C('4') : C('c'), 1, C('0')).setOrigin(0, 0.5).setDepth(2));
      } else if (it.state === 'owned') {
        parts.push(text(this, x + 31, y + 26, 'Owned', C('5'), 1, C('0')).setOrigin(0, 0.5).setDepth(2));
      } else if (it.state === 'locked') {
        parts.push(this.add.image(x + 35, y + 26, 'icon_lock').setDepth(2), text(this, x + 42, y + 26, it.note.replace('Reach level', 'Level'), C('e')).setOrigin(0, 0.5).setDepth(2));
        if (!it.isSilhouette) icon.setAlpha(0.4);
      } else {
        parts.push(this.add.image(x + 35, y + 26, 'icon_coin').setDepth(2), pixText(this, x + 42, y + 26, String(it.price), profile.coins >= it.price ? C('4') : C('3')).setOrigin(0, 0.5).setDepth(2));
        if (this.tab === 'items') parts.push(text(this, x + cardW - 5, y + 26, `x${consumableCount(it.id)}`, C('b')).setOrigin(1, 0.5).setDepth(2));
      }

      const hit = this.add.rectangle(x + cardW / 2, y + cardH / 2, cardW, cardH, 0xffffff, 0).setDepth(3).setInteractive();
      hit.on('pointerdown', () => { sfx.click(); this.selected = it.id; this.render(); });
      this.body.add([...parts, hit]);
    });

    if (list.length > maxItems) {
      if (this.page > 0) {
        const prev = makeButton(this, 30, 134, 36, 18, '<', 'plain', () => { sfx.click(); this.page--; this.render(); }, 5);
        this.body.add(prev.box);
      }
      this.body.add(text(this, 80, 134, `${this.page + 1}/${maxPage + 1}`, C('c'), 1, C('0')).setOrigin(0.5, 0.5).setDepth(5));
      if (this.page < maxPage) {
        const next = makeButton(this, 130, 134, 36, 18, '>', 'plain', () => { sfx.click(); this.page++; this.render(); }, 5);
        this.body.add(next.box);
      }
    }

    const it = list.find((x) => x.id === this.selected);
    const y0 = 136;
    if (!it) {
      this.body.add(text(this, W / 2, y0 + 16, 'Tap something to see what it does.', C('d'), 1, C('0')));
      return;
    }
    this.body.add(text(this, W / 2, y0 + 10, it.name, C('4'), 1, C('0')));
    const lines = it.desc.flatMap((d) => textBlock(this, W / 2, 0, d, C('c'), 380));
    lines.forEach((l, i) => { l.setY(y0 + 24 + i * 11); });
    this.body.add(lines);

    const label = it.state === 'owned' ? 'Owned' : it.state === 'locked' ? it.note : it.state === 'full' ? 'Stock full' : `Buy for ${it.price}`;
    const btnEnabled = it.state === 'buy';
    const buy = makeButton(this, W / 2, y0 + 64, 160, 24, label, 'go', () => this.buy(it), 6);
    buy.setEnabled(btnEnabled);
    this.body.add(buy.box);
  }

  private buy(it: Item): void {
    if (it.state !== 'buy') return;
    if (this.tab === 'skins') {
      equipSlingSkin(it.id);
      sfx.click();
      this.toast(`Equipped ${it.name}!`, C('5'));
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
    const t = text(this, W / 2, H - 42, msg, color, 1, C('0')).setDepth(20);
    this.toastTxt = t;
    this.tweens.add({ targets: t, alpha: 0, delay: 1400, duration: 400, onComplete: () => t.destroy() });
  }

  // ------------------------------------------------------------------ forge

  private renderForge(): void {
    const R = data.content.damageRules;
    const owned = data.content.weapons.filter((w) => owns('weapons', w.id));
    const cardW = 226;
    const cardH = 32;

    owned.forEach((w, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 10 + col * 234;
      const y = 46 + row * 36;
      const lv = weaponLevel(w.id);
      const g = panel(this, x, y, cardW, cardH, '8', '9', 'f', 1);
      const icon = this.add.image(x + 16, y + 16, weaponTexture(w.id)).setDepth(2);
      const nameTxt = text(this, x + 34, y + 9, shortWeaponName(w.id, w.name), C('c')).setOrigin(0, 0.5).setDepth(2);

      const now = Math.round(w.baseDamage * upgradeMult(w.id));
      const cost = upgradeCost(w.id);
      const after = Math.round(w.baseDamage * (1 + R.upgradeDamagePerStep * (lv + 1)));
      const dmgStr = cost === null ? `Dmg ${now} (Max)` : `Dmg ${now} -> ${after}`;
      const dmgTxt = text(this, x + 34, y + 22, dmgStr, cost === null ? C('4') : C('d')).setOrigin(0, 0.5).setDepth(2);

      const parts: Phaser.GameObjects.GameObject[] = [g, icon, nameTxt, dmgTxt];
      for (let p = 0; p < R.maxUpgradeLevel; p++) {
        parts.push(this.add.rectangle(x + 104 + p * 6, y + 9, 4, 6, p < lv ? C('4') : C('f')).setStrokeStyle(1, C('0')).setDepth(2));
      }

      const btn = makeButton(this, x + cardW - 32, y + 16, 50, 20, cost === null ? 'Max' : String(cost), 'go', () => this.upgrade(w.id), 6);
      btn.setEnabled(cost !== null);
      parts.push(btn.box);
      if (cost !== null) parts.push(this.add.image(x + cardW - 52, y + 16, 'icon_coin').setDepth(8));
      this.body.add(parts);
    });

    if (owned.length === 0) {
      this.body.add(text(this, W / 2, 80, 'Buy a weapon first.', C('d'), 1, C('0')));
    }
  }

  private upgrade(id: string): void {
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

  update(): void {
    void setText;
  }
}
