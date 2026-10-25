import Phaser from 'phaser';
import { C } from '../art/palette';
import { text, textBlock } from '../art/font5x7';
import { weaponTexture } from '../art/textures';
import { sfx } from '../audio/sfx';
import { H, W } from '../config/constants';
import { SHOTS_MAX, SHOTS_MIN, challengeLevel, joinOnce, publishChallenge, updateRules, type Challenge } from '../core/challenges';
import { goTo, irisOpen } from '../core/flow';
import { owns } from '../core/profile';
import { data } from '../data/load';
import { shortWeaponName } from '../data/lookup';
import type { BuilderDocument } from '../builder/document';
import { createItemCard } from '../ui/cards';
import { makeButton, type Btn } from '../ui/widgets';

type Mode = 'publish' | 'edit' | 'play';
const PAGE_SIZE = 10;
const CARD_W = 122;

/**
 * One weapon picker, three jobs. publish/edit: the author chooses which weapons (and how many shots) challengers may use.
 * play: a challenger fills the shots with weapons from their own arsenal that the author allows.
 */
export default class ChallengeWeaponsScene extends Phaser.Scene {
  private mode: Mode = 'play';
  private doc?: BuilderDocument;
  private challenge?: Challenge;
  private allowed = new Set<string>();
  private shots = 5;
  private slots: (string | null)[] = [];
  private page = 0;
  private gridObjs: Phaser.GameObjects.GameObject[] = [];
  private panelObjs: Phaser.GameObjects.GameObject[] = [];
  private statusLines: Phaser.GameObjects.Image[] = [];
  private goBtn?: Btn;
  private busy = false;

  constructor() {
    super('challengeWeapons');
  }

  init(d: { mode: Mode; doc?: BuilderDocument; challenge?: Challenge }): void {
    this.mode = d.mode;
    this.doc = d.doc;
    this.challenge = d.challenge;
    this.page = 0;
    this.busy = false;
    this.gridObjs = [];
    this.panelObjs = [];
    this.statusLines = [];
    this.shots = d.challenge?.shots ?? 5;
    this.allowed = new Set(d.challenge?.allowed ?? data.content.weapons.filter((w) => w.rarity !== 'legendary').map((w) => w.id));
    this.slots = Array.from({ length: this.shots }, () => null);
  }

  private pool(): typeof data.content.weapons {
    if (this.mode === 'play') return data.content.weapons.filter((w) => this.challenge!.allowed.includes(w.id) && owns('weapons', w.id));
    return data.content.weapons;
  }

  create(): void {
    this.add.rectangle(W / 2, H / 2, W, H, C('f'));
    this.add.rectangle(264, H / 2, 2, H - 20, C('0'), 0.4);
    const heading = this.mode === 'play' ? this.challenge!.title : this.mode === 'publish' ? 'Share as a Global Challenge' : `Rules: ${this.challenge!.title}`;
    text(this, 370, 10, heading.slice(0, 32), C('4'), 1, C('0'));
    textBlock(this, 370, 22, this.mode === 'play'
      ? 'Fill your shots. Only weapons you own and the author allows are shown.'
      : 'Tap the weapons challengers may use from their own arsenal.', C('d'), 196);
    this.renderGrid();
    this.renderPanel();
    makeButton(this, 305, H - 18, 64, 24, 'Back', 'plain', () => {
      sfx.click();
      if (this.mode === 'publish') goTo(this, 'builder');
      else goTo(this, this.mode === 'edit' || this.mode === 'play' ? 'challenge' : 'challenges', { id: this.challenge?.id, challenge: this.challenge });
    }, 6);
    irisOpen(this);
  }

  private say(message: string): void {
    this.statusLines.forEach((l) => l.destroy());
    this.statusLines = textBlock(this, 316, 156, message, C('4'), 150, C('0'));
  }

  private renderGrid(): void {
    this.gridObjs.forEach((o) => o.destroy());
    this.gridObjs = [];
    const pool = this.pool();
    const maxPage = Math.max(0, Math.ceil(pool.length / PAGE_SIZE) - 1);
    this.page = Math.min(this.page, maxPage);
    if (!pool.length) {
      this.gridObjs.push(...textBlock(this, 132, 100, 'You do not own any weapon this challenge allows. Visit the Shop or the Forge, then come back.', C('4'), 200, C('0')));
    }
    pool.slice(this.page * PAGE_SIZE, this.page * PAGE_SIZE + PAGE_SIZE).forEach((w, idx) => {
      const x = 8 + (idx % 2) * 128;
      const y = 30 + Math.floor(idx / 2) * 42;
      const picked = this.mode !== 'play' && this.allowed.has(w.id);
      const card = createItemCard({
        scene: this, x, y, w: CARD_W, icon: weaponTexture(w.id), name: shortWeaponName(w.id, w.name), rarity: w.rarity, selected: picked,
        onClick: () => { sfx.unlock(); this.pick(w.id); },
      });
      this.gridObjs.push(...card.objects);
      if (picked) this.gridObjs.push(text(this, x + CARD_W - 8, y + 26, 'OK', C('4'), 1, C('0')).setOrigin(1, 0.5).setDepth(5));
    });
    if (pool.length > PAGE_SIZE) {
      const py = 246;
      if (this.page > 0) this.gridObjs.push(makeButton(this, 50, py, 40, 20, '<', 'plain', () => { sfx.click(); this.page--; this.renderGrid(); }, 5).box);
      this.gridObjs.push(text(this, 132, py, `${this.page + 1}/${maxPage + 1}`, C('c'), 1, C('0')).setDepth(5));
      if (this.page < maxPage) this.gridObjs.push(makeButton(this, 214, py, 40, 20, '>', 'plain', () => { sfx.click(); this.page++; this.renderGrid(); }, 5).box);
    }
  }

  private pick(id: string): void {
    if (this.busy) return;
    if (this.mode === 'play') {
      const i = this.slots.findIndex((s) => s === null);
      if (i < 0) { this.say('All slots full. Tap a slot to clear it.'); return; }
      sfx.click();
      this.slots[i] = id;
    } else {
      sfx.click();
      if (this.allowed.has(id)) this.allowed.delete(id);
      else this.allowed.add(id);
      this.renderGrid();
    }
    this.renderPanel();
  }

  private renderPanel(): void {
    this.panelObjs.forEach((o) => o.destroy());
    this.panelObjs = [];
    if (this.mode === 'play') {
      const n = this.shots;
      const perRow = Math.ceil(n / 2);
      this.slots.forEach((id, i) => {
        const row = i < perRow ? 0 : 1;
        const col = row === 0 ? i : i - perRow;
        const count = row === 0 ? perRow : n - perRow;
        const sx = 370 + (col - (count - 1) / 2) * 42;
        const sy = 62 + row * 32;
        const box = this.add.rectangle(sx, sy, 26, 26, C('0')).setStrokeStyle(1, C('d')).setInteractive();
        box.on('pointerdown', () => { if (this.busy) return; sfx.click(); this.slots[i] = null; this.renderPanel(); });
        this.panelObjs.push(box, text(this, sx - 9, sy - 9, String(i + 1), C('4')).setDepth(3));
        if (id) {
          const tex = weaponTexture(id);
          const w = this.textures.get(tex)?.getSourceImage()?.width ?? 16;
          this.panelObjs.push(this.add.image(sx, sy, tex).setScale(w >= 32 ? 0.75 : 1.3).setDepth(2));
        }
      });
      this.panelObjs.push(text(this, 370, 124, `${this.shots} shots, fired in order`, C('d'), 1, C('0')));
      this.goBtn?.box.destroy();
      this.goBtn = makeButton(this, 415, H - 18, 110, 26, 'Fling!', 'go', () => this.fling(), 6);
      this.goBtn.setEnabled(this.slots.every((s) => s !== null));
      return;
    }
    // author view: shots stepper, select all or none, publish / save
    this.panelObjs.push(text(this, 316, 62, 'Shots', C('d'), 1, C('0')).setOrigin(0, 0.5));
    this.panelObjs.push(
      makeButton(this, 376, 62, 28, 22, '-', 'plain', () => { if (this.shots > SHOTS_MIN) { this.shots--; this.renderPanel(); } }, 6).box,
      text(this, 410, 62, String(this.shots), C('4'), 2, C('0')),
      makeButton(this, 444, 62, 28, 22, '+', 'plain', () => { if (this.shots < SHOTS_MAX) { this.shots++; this.renderPanel(); } }, 6).box,
    );
    this.panelObjs.push(text(this, 316, 92, `${this.allowed.size} weapons allowed`, C('c'), 1, C('0')).setOrigin(0, 0.5));
    this.panelObjs.push(
      makeButton(this, 332, 114, 60, 22, 'All', 'plain', () => { this.allowed = new Set(data.content.weapons.map((w) => w.id)); this.renderGrid(); this.renderPanel(); }, 6).box,
      makeButton(this, 400, 114, 60, 22, 'None', 'plain', () => { this.allowed.clear(); this.renderGrid(); this.renderPanel(); }, 6).box,
    );
    this.goBtn?.box.destroy();
    this.goBtn = makeButton(this, 415, H - 18, 110, 26, this.mode === 'publish' ? 'Share' : 'Save rules', 'go', () => { void this.submit(); }, 6);
    this.goBtn.setEnabled(this.allowed.size > 0 && !this.busy);
  }

  private async submit(): Promise<void> {
    if (this.busy || !this.allowed.size) return;
    this.busy = true;
    this.goBtn?.setEnabled(false);
    this.say(this.mode === 'publish' ? 'Sharing your level...' : 'Saving rules...');
    const allowed = [...this.allowed];
    if (this.mode === 'publish') {
      const res = await publishChallenge(this.doc!, allowed, this.shots);
      if (!this.scene.isActive()) return;
      if (res.challenge) goTo(this, 'challenge', { id: res.challenge.id, challenge: res.challenge });
      else { this.busy = false; this.say(res.error ?? 'Could not share.'); this.goBtn?.setEnabled(true); }
    } else {
      const ok = await updateRules(this.challenge!, allowed, this.shots);
      if (!this.scene.isActive()) return;
      if (ok) goTo(this, 'challenge', { id: this.challenge!.id });
      else { this.busy = false; this.say('Could not save. Try again.'); this.goBtn?.setEnabled(true); }
    }
  }

  private fling(): void {
    if (!this.slots.every((s) => s !== null)) return;
    const loadout = this.slots as string[];
    const c = this.challenge!;
    sfx.click();
    void joinOnce(c);
    goTo(this, 'game', { level: 1000, loadout, customLevel: challengeLevel(c, loadout), challenge: c });
  }
}
