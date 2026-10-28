import Phaser from 'phaser';
import { C } from '../art/palette';
import { fitText, text, textBlock } from '../art/font5x7';
import { weaponTexture } from '../art/textures';
import { sfx } from '../audio/sfx';
import { goTo, irisOpen } from '../core/flow';
import { compileForgeRecipe, forgeCost, forgeEnabled, forgePrice, forgeRecipe, forgeRecipes, saveForgeRecipe } from '../core/forge';
import { drawForgeWeapon } from '../art/forgeTextures';
import { owns, profile, upgradeMult } from '../core/profile';
import { data } from '../data/load';
import type { ForgeRecipe } from '../data/forgeTypes';
import { menuBackdrop, uiIcon, makeButton, panel } from '../ui/widgets';

type Tab = 'Body' | 'Trait' | 'Ability' | 'Aura' | 'Legends';

/** One build per shape: the player chooses the weapon, trait, power and radiance separately. */
export default class ForgeScene extends Phaser.Scene {
  private recipe!: ForgeRecipe;
  private tab: Tab = 'Body';
  private kind: 'bless' | 'curse' = 'bless';
  private body!: Phaser.GameObjects.Container;
  private returnTo = 'shop';
  private level = 1;
  private saving = false;
  private message = '';
  private preview?: Phaser.GameObjects.Image;
  private aura?: Phaser.GameObjects.Graphics;
  private legendsPage = 0;

  constructor() { super('forge'); }
  init(d: { returnTo?: string; level?: number } = {}): void {
    this.returnTo = d.returnTo ?? 'shop';
    this.level = d.level ?? 1;
  }
  create(): void {
    if (!forgeEnabled()) { this.scene.start(this.returnTo, { level: this.level }); return; }
    this.tab = 'Body';
    this.saving = false;
    this.message = '';
    this.legendsPage = 0;
    this.recipe = forgeRecipe(data.forge.weapons[0].id);
    this.kind = data.forge.traits.find((t) => t.id === this.recipe.traitId)!.kind;
    menuBackdrop(this, true);
    text(this, 16, 14, 'WEAPON FORGE', C('4'), 2, C('0')).setOrigin(0, 0.5);
    uiIcon(this, 234, 14, 'coin', 'icon_coin', 12);
    text(this, 302, 14, fitText(String(profile.coins), 56), C('4'), 1, C('0')).setOrigin(1, 0.5);
    sfx.preload(['forge_craft']);
    this.body = this.add.container(0, 0);
    this.render();
    irisOpen(this);
  }
  private render(): void {
    this.body.removeAll(true);
    this.preview = undefined;
    this.aura = undefined;
    const before = new Set(this.children.list);
    const tabs: Tab[] = ['Body', 'Trait', 'Ability', 'Aura', 'Legends'];
    tabs.forEach((tab, i) => {
      makeButton(this, 37 + i * 61, 43, 55, 26, tab, this.tab === tab ? 'go' : 'plain', () => {
        if (this.saving) return;
        sfx.click(); this.tab = tab; this.message = ''; this.render();
      });
    });
    panel(this, 8, 65, 300, 169, 'f', 'e', '0');
    panel(this, 320, 8, 152, 226, '8', '9', '0');
    if (this.tab === 'Body') {
      text(this, 158, 79, 'Choose a weapon shape', C('d'));
      data.forge.weapons.forEach((w, i) => {
        const x = 58 + i % 3 * 100;
        const y = 114 + Math.floor(i / 3) * 60;
        const selected = w.id === this.recipe.weaponId;
        makeButton(this, x, y + 16, 92, 32, '', selected ? 'go' : 'plain', () => {
          if (this.saving) return;
          this.recipe = forgeRecipe(w.id);
          this.kind = data.forge.traits.find((t) => t.id === this.recipe.traitId)!.kind;
          this.message = ''; sfx.click(); this.render();
        });
        const key = `forge_body_${w.id}`;
        drawForgeWeapon(this, { ...this.recipe, weaponId: w.id }, key);
        this.add.image(x, y - 14, key).setScale(1.25).setDepth(2);
        this.caption(x, y + 16, w.name.replace('Forge ', ''), data.forge.costs.weapons[w.id]);
      });
    } else if (this.tab === 'Trait') {
      makeButton(this, 104, 84, 86, 26, 'Bless', this.kind === 'bless' ? 'go' : 'plain', () => { if (!this.saving) { this.kind = 'bless'; this.render(); } });
      makeButton(this, 211, 84, 86, 26, 'Curse', this.kind === 'curse' ? 'ability' : 'plain', () => { if (!this.saving) { this.kind = 'curse'; this.render(); } });
      const options = data.forge.traits.filter((t) => t.kind === this.kind);
      options.forEach((t, i) => this.choice(t.name, i, 119, t.id === this.recipe.traitId, () => { this.recipe.traitId = t.id; }, data.forge.costs.traits[t.id]));
      text(this, 158, 199, 'One trait: empower you or weaken enemies.', C('d'));
    } else if (this.tab === 'Ability') {
      text(this, 158, 79, 'Every power uses your chosen weapon.', C('d'));
      data.forge.abilities.forEach((a, i) => this.choice(a.name, i, 108, a.id === this.recipe.abilityId, () => { this.recipe.abilityId = a.id; }, data.forge.costs.abilities[a.id]));
    } else if (this.tab === 'Aura') {
      text(this, 158, 79, 'Radiance colors the blade and its glow.', C('d'));
      data.forge.radiances.forEach((a, i) => {
        this.choice(a.name, i, 108, a.id === this.recipe.radianceId, () => { this.recipe.radianceId = a.id; }, data.forge.costs.radiances[a.id]);
        this.add.rectangle(18 + i % 3 * 100, 108 + Math.floor(i / 3) * 37, 4, 18, C(a.color)).setDepth(12);
      });
    } else {
      text(this, 158, 79, 'Legendary collection - original powers', C('4'));
      const legends = data.content.weapons.filter((w) => w.rarity === 'legendary');
      const pages = Math.ceil(legends.length / 6);
      legends.slice(this.legendsPage * 6, this.legendsPage * 6 + 6).forEach((w, i) => {
        const x = 82 + i % 2 * 150;
        const y = 107 + Math.floor(i / 2) * 37;
        const owned = owns('weapons', w.id);
        this.add.image(x - 54, y, weaponTexture(w.id)).setDisplaySize(24, 24).setTint(owned ? C('c') : C('0'));
        text(this, x - 35, y - 5, fitText(w.name, 104), owned ? C('4') : C('d')).setOrigin(0, 0.5);
        text(this, x - 35, y + 7, owned ? 'Owned' : 'Earn in campaign', C('d')).setOrigin(0, 0.5);
      });
      if (pages > 1) {
        makeButton(this, 75, 213, 40, 24, '<', 'plain', () => { this.legendsPage = (this.legendsPage + pages - 1) % pages; this.render(); });
        text(this, 158, 213, `${this.legendsPage + 1}/${pages}`, C('d'));
        makeButton(this, 241, 213, 40, 24, '>', 'plain', () => { this.legendsPage = (this.legendsPage + 1) % pages; this.render(); });
      }
    }
    this.renderPreview();
    const price = forgePrice(this.recipe);
    const cost = forgeCost(this.recipe);
    const poor = price > profile.coins;
    if (this.tab !== 'Legends') {
      const p = cost.parts;
      text(this, 158, 224, fitText(`Body ${p.body} Power ${p.ability} Trait ${p.trait} Aura ${p.radiance} Total ${cost.total}`, 284), C('c'), 1, C('0'));
    }
    makeButton(this, 59, 252, 96, 26, 'Back', 'plain', () => {
      if (!this.saving) goTo(this, this.returnTo, { level: this.level });
    });
    const label = this.saving ? 'Forging...' : price === 0 ? 'Saved' : this.isSaved() ? 'Saved' : `Forge for ${price}`;
    const save = makeButton(this, 396, 252, 148, 26, label, poor ? 'plain' : 'go', () => { void this.save(); });
    save.setEnabled(!this.saving && this.tab !== 'Legends' && price > 0 && !poor);
    const status = this.message || (poor ? `Need ${price - profile.coins} more coins` : price === 0 ? 'Saved build' : forgeRecipes().some((r) => r.weaponId === this.recipe.weaponId) ? `Change costs ${price} (half price)` : 'New weapon');
    text(this, 213, 251, fitText(status, 200), this.message ? C('4') : poor ? C('3') : C('c'), 1, C('0'));
    this.children.list.filter((o) => !before.has(o) && o !== this.body).forEach((o) => this.body.add(o));
  }
  private choice(label: string, i: number, top: number, selected: boolean, apply: () => void, price?: number): void {
    const x = 58 + i % 3 * 100;
    const y = top + Math.floor(i / 3) * 37;
    makeButton(this, x, y, 92, 30, price === undefined ? label : '', selected ? 'go' : 'plain', () => {
      if (this.saving) return;
      apply(); sfx.click(); this.message = ''; this.render();
    });
    if (price !== undefined) this.caption(x, y, label, price);
  }
  /** Name on top, coin price underneath, both inside the button. */
  private caption(x: number, y: number, label: string, price: number): void {
    text(this, x, y - 6, fitText(label, 80), C('c'), 1, C('0')).setDepth(12);
    text(this, x, y + 7, fitText(price === 0 ? 'free' : `${price} coins`, 80), C('4'), 1, C('0')).setDepth(12);
  }
  private isSaved(): boolean {
    return forgeRecipes().some((r) => JSON.stringify(r) === JSON.stringify(this.recipe));
  }
  private renderPreview(): void {
    const w = compileForgeRecipe(this.recipe);
    const trait = data.forge.traits.find((t) => t.id === this.recipe.traitId)!;
    const ability = data.forge.abilities.find((a) => a.id === this.recipe.abilityId)!;
    const aura = data.forge.radiances.find((a) => a.id === this.recipe.radianceId)!;
    text(this, 396, 24, fitText(w.name.replace('Forge ', ''), 136), C('c'), 1, C('0'));
    this.aura = this.add.graphics().setDepth(2);
    this.aura.lineStyle(2, C(aura.color), 0.8).strokeCircle(396, 65, 27);
    this.aura.lineStyle(1, C('c'), 0.25).strokeCircle(396, 65, 30);
    drawForgeWeapon(this, this.recipe, 'forge_preview');
    this.preview = this.add.image(396, 65, 'forge_preview').setScale(2).setDepth(3);
    text(this, 396, 104, `${Math.round(w.baseDamage * upgradeMult(w.id) * (w.params.damageMult ?? 1))} base damage`, C('4'));
    text(this, 396, 122, fitText(`${trait.kind === 'bless' ? 'Bless' : 'Curse'}: ${trait.name}`, 136), C('b'), 1, C('0'));
    textBlock(this, 396, 136, trait.description, C('c'), 136, C('0'), 2);
    text(this, 396, 172, ability.name, C('4'));
    textBlock(this, 396, 185, ability.description, C('c'), 136, C('0'), 2);
    text(this, 396, 225, `${aura.name} radiance`, C(aura.color));
  }
  private async save(): Promise<void> {
    if (this.saving || this.tab === 'Legends') return;
    this.saving = true; this.render();
    try {
      await saveForgeRecipe(this.recipe);
      drawForgeWeapon(this, this.recipe);
      this.message = 'Forged! In your arsenal'; sfx.sample('forge_craft');
    } catch (error) { this.message = error instanceof Error && error.message === 'Not enough coins.' ? 'Not enough coins' : 'Save failed. Retry.'; }
    this.saving = false;
    if (this.scene.isActive()) this.render();
  }
  update(time: number): void {
    this.preview?.setRotation(Math.sin(time / 1100) * 0.12);
    this.aura?.setAlpha(0.6 + Math.sin(time / 350) * 0.25);
  }
}
