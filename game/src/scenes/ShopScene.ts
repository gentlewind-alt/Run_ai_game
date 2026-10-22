import Phaser from 'phaser';
import { C, rarityColor } from '../art/palette';
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
import { monsterDef, shortItemName, shortWeaponName } from '../data/lookup';
import { coinCounter } from '../ui/coins';
import { createItemCard } from '../ui/cards';
import { makeButton, panel, type Btn } from '../ui/widgets';

type Tab = 'weapons' | 'relics' | 'artifacts' | 'items' | 'forge' | 'slingshots';
const TABS: { id: Tab; label: string; w: number }[] = [
  { id: 'weapons', label: 'Weapons', w: 56 },
  { id: 'relics', label: 'Relics', w: 46 },
  { id: 'artifacts', label: 'Artifacts', w: 56 },
  { id: 'items', label: 'Items', w: 46 },
  { id: 'forge', label: 'Forge', w: 46 },
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

    const showSlingshots = data.config.features?.slingshots !== false;
    const showRelics = data.config.features?.relics !== false;
    const tabs = TABS.filter((t) => (t.id !== 'slingshots' || showSlingshots) && (t.id !== 'relics' || showRelics));
    if (this.tab === 'slingshots' && !showSlingshots) this.tab = 'weapons';
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
        const icon = sk.id === 's_quicksilver' ? 'sling_quicksilver' : sk.id === 's_gemini' ? 'sling_gemini' : sk.id;
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
      const x = 10 + col * 116;
      const y = 46 + row * 42;
      const sel = it.id === this.selected;
      const card = createItemCard({
        scene: this, x, y, w: cardW, icon: it.icon, iconScale: it.scale === 2 ? 1.2 : it.scale,
        name: it.name, rarity: it.rarity, selected: sel, locked: it.state === 'locked',
        isSilhouette: it.isSilhouette, onClick: () => { sfx.click(); this.selected = it.id; this.render(); },
      });
      const extra: Phaser.GameObjects.GameObject[] = [];

      if (this.tab === 'slingshots') {
        extra.push(text(this, x + 31, y + 26, it.note, it.note === 'Equipped' ? C('4') : C('c'), 1, C('0')).setOrigin(0, 0.5).setDepth(2));
      } else if (it.state === 'owned') {
        extra.push(text(this, x + 31, y + 26, 'Owned', C('5'), 1, C('0')).setOrigin(0, 0.5).setDepth(2));
      } else if (it.state === 'locked') {
        extra.push(this.add.image(x + 35, y + 26, 'icon_lock').setDepth(2), text(this, x + 42, y + 26, it.note.replace('Reach level', 'Level'), C('e')).setOrigin(0, 0.5).setDepth(2));
        if (!it.isSilhouette) card.icon.setAlpha(0.4);
      } else {
        extra.push(this.add.image(x + 35, y + 26, 'icon_coin').setDepth(2), pixText(this, x + 42, y + 26, String(it.price), profile.coins >= it.price ? C('4') : C('3')).setOrigin(0, 0.5).setDepth(2));
        if (this.tab === 'items') extra.push(text(this, x + cardW - 5, y + 26, `x${consumableCount(it.id)}`, C('b')).setOrigin(1, 0.5).setDepth(2));
      }

      this.body.add([...card.objects, ...extra]);
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
    const y0 = 132;
    if (!it) {
      this.body.add(text(this, W / 2, y0 + 16, 'Tap something to see what it does.', C('d'), 1, C('0')));
      return;
    }
    // 1. Title
    const titleCol = it.rarity ? rarityColor(it.rarity) : C('4');
    this.body.add(text(this, W / 2, y0 + 7, it.name, titleCol, 1, C('0')));

    // 2. Rarity and source line
    const metaParts: string[] = [];
    if (it.rarity) metaParts.push(it.rarity.toUpperCase());
    if (it.source) metaParts.push(it.source);
    const metaStr = metaParts.join(' - ');
    const metaY = y0 + 18;
    this.body.add(text(this, W / 2, metaY, metaStr, C('d'), 1, C('0')));

    // 3. Description (wrapped, at most 4 lines)
    const descStartY = metaY + 11;
    const lines: Phaser.GameObjects.Image[] = [];
    const maxWidth = 420;
    for (const d of it.desc) {
      if (lines.length >= 4) break;
      const wrapped = textBlock(this, W / 2, 0, d, C('c'), maxWidth);
      for (const wLine of wrapped) {
        if (lines.length < 4) lines.push(wLine);
        else wLine.destroy();
      }
    }
    const lineSpacing = 10;
    lines.forEach((l, i) => { l.setY(descStartY + i * lineSpacing); });
    this.body.add(lines);

    // 4. Button anchored below with fixed gap
    const descBottom = lines.length > 0 ? descStartY + (lines.length - 1) * lineSpacing + 5 : metaY + 5;
    const gap = 8;
    const btnH = 20;
    const btnY = Math.round(descBottom + gap + btnH / 2);

    const isSlingEquip = this.tab === 'slingshots' && owns('cosmetics', it.id);
    const label = isSlingEquip ? (profile.equipped.slingSkin === it.id ? 'Equipped' : 'Equip') :
                  it.state === 'owned' ? 'Owned' : it.state === 'locked' ? it.note : it.state === 'full' ? 'Stock full' : `Buy for ${it.price}`;
    const btnEnabled = this.tab === 'slingshots' ? profile.equipped.slingSkin !== it.id : it.state === 'buy';
    const buy = makeButton(this, W / 2, btnY, 150, btnH, label, 'go', () => this.buy(it), 6);
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
