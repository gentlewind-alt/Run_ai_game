import Phaser from 'phaser';
import { C } from '../art/palette';
import { setText, text, textBlock } from '../art/font5x7';
import { iconKey } from '../art/icons';
import { pixText } from '../art/pix';
import { weaponTexture } from '../art/textures';
import { sfx } from '../audio/sfx';
import { H, W } from '../config/constants';
import { goTo, irisOpen } from '../core/flow';
import {
  DEBUG, GOLD_QUIVER, buyArtifact, buyConsumable, buyWeapon, consumableCount, economy, equipSlingSkin, owns, profile, reachedLevel, upgradeCost, upgradeMult,
  upgradeWeapon, weaponLevel, weaponUnlockLevel,
} from '../core/profile';
import type { CosmeticDef } from '../data/types';
import { data } from '../data/load';
import { shortItemName, shortWeaponName } from '../data/lookup';
import { platform } from '../platform';
import { coinCounter } from '../ui/coins';
import { makeButton, panel, type Btn } from '../ui/widgets';

type Tab = 'weapons' | 'artifacts' | 'items' | 'forge' | 'skins';
const TABS: { id: Tab; label: string; w: number }[] = [
  { id: 'weapons', label: 'Weapons', w: 42 },
  { id: 'artifacts', label: 'Artifacts', w: 46 },
  { id: 'items', label: 'Items', w: 34 },
  { id: 'forge', label: 'Forge', w: 34 },
  { id: 'skins', label: 'Skins', w: 34 },
];

interface Item { id: string; name: string; desc: string[]; price: number; icon: string; scale: number; state: 'buy' | 'owned' | 'locked' | 'full'; note: string }

/** Weapons, artifacts and items for coins, and the forge for upgrades. Prices and unlocks come from content.json. */
export default class ShopScene extends Phaser.Scene {
  private tab: Tab = 'weapons';
  private selected: string | null = null;
  private body!: Phaser.GameObjects.Container;
  private tabBtns: Btn[] = [];
  private toastTxt?: Phaser.GameObjects.Image;

  constructor() {
    super('shop');
  }

  create(): void {
    this.tabBtns = [];
    this.add.rectangle(W / 2, H / 2, W, H, C('f'));
    coinCounter(this, 6, 13);
    text(this, W / 2 + 10, 13, 'Shop', C('c'), 1, C('0'));
    this.body = this.add.container(0, 0);
    makeButton(this, W / 2, H - 14, 100, 22, 'Back to map', 'plain', () => { sfx.click(); goTo(this, 'map'); }, 6);
    this.render();
    irisOpen(this);
  }

  private render(): void {
    this.body.removeAll(true);
    this.toastTxt = undefined;
    this.tabBtns.forEach((b) => b.box.destroy());
    this.tabBtns = [];
    let x = 6;
    TABS.forEach((t) => {
      const b = makeButton(this, x + t.w / 2, 36, t.w, 18, t.label, t.id === this.tab ? 'go' : 'plain', () => { sfx.click(); this.tab = t.id; this.selected = null; this.render(); }, 6);
      this.tabBtns.push(b);
      x += t.w + 4;
    });
    if (this.tab === 'forge') this.renderForge();
    else this.renderGrid();
  }

  // ------------------------------------------------------------------ grid tabs (weapons, artifacts, items)

  private items(): Item[] {
    const c = data.content;
    if (this.tab === 'weapons') {
      return c.weapons.filter((w) => w.enabled !== false).map((w) => {
        const lock = weaponUnlockLevel(w.unlock);
        const owned = owns('weapons', w.id);
        const locked = !owned && !DEBUG && lock > reachedLevel();
        return {
          id: w.id, name: shortWeaponName(w.id, w.name), price: w.price ?? 0, icon: weaponTexture(w.id), scale: 2,
          desc: [`Damage ${Math.round(w.baseDamage)}, ${w.element}.`, w.launch ?? '', w.tap ?? ''].filter(Boolean),
          state: owned ? 'owned' : locked ? 'locked' : 'buy', note: locked ? `Reach level ${lock}` : '',
        };
      });
    }
    if (this.tab === 'artifacts') {
      return c.artifacts.map((a) => ({
        id: a.id, name: shortItemName(a.id, a.name.replace('Gamblers', "Gambler's")), price: a.price, icon: iconKey(a.id), scale: 2, desc: [a.name, a.effect],
        state: owns('artifacts', a.id) ? 'owned' : 'buy', note: '',
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
    const cardW = 99;
    const cardH = 40;
    list.forEach((it, i) => {
      const x = 6 + (i % 2) * 105;
      const y = 52 + Math.floor(i / 2) * 43;
      const sel = it.id === this.selected;
      const g = panel(this, x, y, cardW, cardH, sel ? '9' : '8', sel ? 'a' : '9', 'f', 1);
      if (sel) g.lineStyle(1, C('4'), 1).strokeRect(x - 1, y - 1, cardW + 2, cardH + 2);
      const icon = this.add.image(x + 18, y + 20, it.icon).setScale(it.scale).setDepth(2);
      const name = text(this, x + 36, y + 11, it.name, it.state === 'locked' ? C('e') : C('c')).setOrigin(0, 0.5).setDepth(2);
      const parts: Phaser.GameObjects.GameObject[] = [g, icon, name];
      if (this.tab === 'skins') {
        parts.push(text(this, x + 36, y + 28, it.note, it.note === 'Equipped' ? C('4') : C('c'), 1, C('0')).setOrigin(0, 0.5).setDepth(2));
      } else if (it.state === 'owned') {
        parts.push(text(this, x + 36, y + 28, 'Owned', C('5'), 1, C('0')).setOrigin(0, 0.5).setDepth(2));
      } else if (it.state === 'locked') {
        parts.push(this.add.image(x + 40, y + 28, 'icon_lock').setDepth(2), text(this, x + 48, y + 28, it.note.replace('Reach level', 'Level'), C('e')).setOrigin(0, 0.5).setDepth(2));
        icon.setAlpha(0.4);
      } else {
        parts.push(this.add.image(x + 40, y + 28, 'icon_coin').setDepth(2), pixText(this, x + 47, y + 28, String(it.price), profile.coins >= it.price ? C('4') : C('3')).setOrigin(0, 0.5).setDepth(2));
        if (this.tab === 'items') parts.push(text(this, x + cardW - 5, y + 28, `x${consumableCount(it.id)}`, C('b')).setOrigin(1, 0.5).setDepth(2));
      }
      const hit = this.add.rectangle(x + cardW / 2, y + cardH / 2, cardW, cardH, 0xffffff, 0).setDepth(3).setInteractive();
      hit.on('pointerdown', () => { sfx.click(); this.selected = it.id; this.render(); });
      this.body.add([...parts, hit]);
    });

    const it = list.find((x) => x.id === this.selected);
    const y0 = 52 + Math.ceil(list.length / 2) * 43 + 6;
    if (!it) {
      this.body.add(text(this, W / 2, y0 + 14, 'Tap something to see what it does.', C('d'), 1, C('0')));
      return;
    }
    this.body.add(text(this, W / 2, y0 + 6, it.name, C('4'), 1, C('0')));
    const lines = it.desc.flatMap((d) => textBlock(this, W / 2, 0, d, C('c'), 196));
    lines.forEach((l, i) => { l.setY(y0 + 22 + i * 12); });
    this.body.add(lines);
    let label = it.state === 'owned' ? 'Owned' : it.state === 'locked' ? it.note : it.state === 'full' ? 'Stock full' : `Buy for ${it.price}`;
    let btnEnabled = it.state === 'buy';
    if (this.tab === 'skins') {
      const isQuiver = it.id === 's_gold_quiver' || it.id === 'gold_quiver';
      if (isQuiver) {
        const has = owns('cosmetics', 's_gold_quiver') || owns('cosmetics', GOLD_QUIVER);
        label = has ? '5 Slots Active' : `Unlock (${it.price} Bits)`;
        btnEnabled = !has;
      } else {
        const has = owns('cosmetics', it.id);
        const eq = profile.equipped.slingSkin === it.id;
        if (eq) {
          label = 'Equipped (Tap to remove)';
          btnEnabled = true;
        } else if (has) {
          label = 'Equip this skin';
          btnEnabled = true;
        } else {
          label = `Unlock (${it.price} Bits)`;
          btnEnabled = true;
        }
      }
    }
    const buy = makeButton(this, W / 2, H - 46, 140, 26, label, 'go', () => this.buy(it), 6);
    buy.setEnabled(btnEnabled);
    this.body.add(buy.box);
  }

  private buy(it: Item): void {
    if (this.tab === 'skins') {
      const isQuiver = it.id === 's_gold_quiver' || it.id === 'gold_quiver';
      if (!isQuiver && owns('cosmetics', it.id)) {
        const cur = profile.equipped.slingSkin;
        equipSlingSkin(cur === it.id ? undefined : it.id);
        sfx.click();
        this.render();
        this.toast(profile.equipped.slingSkin === it.id ? `${it.name} equipped!` : 'Default sling equipped.', C('5'));
        return;
      }
      void platform.iap.buy(it.id).then((ok) => {
        if (ok) {
          sfx.coin();
          if (!profile.owned.cosmetics.includes(it.id)) profile.owned.cosmetics.push(it.id);
          if (isQuiver && !profile.owned.cosmetics.includes(GOLD_QUIVER)) profile.owned.cosmetics.push(GOLD_QUIVER);
          if (!isQuiver) equipSlingSkin(it.id);
          this.render();
          this.toast(`${it.name} unlocked!`, C('5'));
        } else {
          sfx.lose();
          this.toast('Purchase cancelled.', C('3'));
        }
      });
      return;
    }
    const r = this.tab === 'weapons' ? buyWeapon(it.id) : this.tab === 'artifacts' ? buyArtifact(it.id) : buyConsumable(it.id);
    if (r === 'ok') {
      sfx.coin();
      this.render();
      this.toast(`${it.name} is yours.`, C('5'));
    } else if (r === 'coins') {
      sfx.lose();
      this.toast(`Need ${it.price - profile.coins} more coins.`, C('3'));
    }
  }

  private toast(msg: string, color: number): void {
    this.toastTxt?.destroy();
    const t = text(this, W / 2, H - 66, msg, color, 1, C('0')).setDepth(20);
    this.toastTxt = t;
    this.tweens.add({ targets: t, alpha: 0, delay: 1400, duration: 400, onComplete: () => t.destroy() });
  }

  // ------------------------------------------------------------------ forge

  private renderForge(): void {
    const R = data.content.damageRules;
    const owned = data.content.weapons.filter((w) => owns('weapons', w.id));
    owned.forEach((w, i) => {
      const y = 52 + i * 34;
      const lv = weaponLevel(w.id);
      const g = panel(this, 6, y, W - 12, 31, '8', '9', 'f', 1);
      const parts: Phaser.GameObjects.GameObject[] = [g, this.add.image(22, y + 15, weaponTexture(w.id)).setDepth(2)];
      parts.push(text(this, 38, y + 9, shortWeaponName(w.id, w.name), C('c')).setOrigin(0, 0.5).setDepth(2));
      const now = Math.round(w.baseDamage * upgradeMult(w.id));
      const cost = upgradeCost(w.id);
      const after = Math.round(w.baseDamage * (1 + R.upgradeDamagePerStep * (lv + 1)));
      parts.push(text(this, 38, y + 22, cost === null ? `Damage ${now}, maxed` : `Damage ${now} to ${after}`, cost === null ? C('4') : C('d')).setOrigin(0, 0.5).setDepth(2));
      for (let p = 0; p < R.maxUpgradeLevel; p++) {
        parts.push(this.add.rectangle(111 + p * 6, y + 9, 4, 6, p < lv ? C('4') : C('f')).setStrokeStyle(1, C('0')).setDepth(2));
      }
      const btn = makeButton(this, W - 40, y + 15, 56, 20, cost === null ? 'Max' : String(cost), 'go', () => this.upgrade(w.id), 6);
      btn.setEnabled(cost !== null);
      parts.push(btn.box);
      if (cost !== null) parts.push(this.add.image(W - 62, y + 15, 'icon_coin').setDepth(8));
      this.body.add(parts);
    });
    if (owned.length === 0) this.body.add(text(this, W / 2, 80, 'Buy a weapon first.', C('d'), 1, C('0')));
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
