import Phaser from 'phaser';
import { C } from '../art/palette';
import { text } from '../art/font5x7';
import { beatPulse } from '../audio/beat';
import { sfx } from '../audio/sfx';
import { H, W } from '../config/constants';
import { goTo, irisOpen } from '../core/flow';
import { levelUnlocked, reachedLevel, starsFor } from '../core/profile';
import { data } from '../data/load';
import { coinCounter } from '../ui/coins';
import { makeButton, panel, type Btn } from '../ui/widgets';

const PANEL_H = 98;
const PANEL_Y0 = 30;
const PANEL_GAP = 4;

/** Realm lighting: sky bands top to bottom, then the ground strip. Each realm has its own light, not just its own tint. */
const LIGHT: Record<string, { sky: string[]; ground: string; edge: string; dots: string; dotCount: number }> = {
  hills: { sky: ['9', 'a', 'b'], ground: 'n', edge: '6', dots: 'c', dotCount: 5 }, // daylight, clouds
  wood: { sky: ['1', '8', '7'], ground: 'o', edge: '7', dots: 'b', dotCount: 12 }, // dusk, cyan fireflies
  keep: { sky: ['f', 'q', '3'], ground: 'm', edge: 'e', dots: '4', dotCount: 10 }, // fire glow, embers
};

/** Level nodes in three realm strips, lit by realm. A fresh player sees one open node. */
export default class MapScene extends Phaser.Scene {
  private pulse: { box: Phaser.GameObjects.Container }[] = [];

  constructor() {
    super('map');
  }

  create(): void {
    this.pulse = [];
    this.add.rectangle(W / 2, H / 2, W, H, C('f'));
    coinCounter(this, 6, 13);
    const realms = data.content.realms;
    const total = realms.reduce((n, r) => n + r.levels.filter((id) => data.levels[id]).length * 3, 0);
    const got = realms.reduce((n, r) => n + r.levels.reduce((m, id) => m + starsFor(id), 0), 0);
    text(this, W - 6, 13, `Stars ${got} of ${total}`, C('4'), 1, C('0')).setOrigin(1, 0.5);

    realms.forEach((realm, ri) => {
      const y0 = PANEL_Y0 + ri * (PANEL_H + PANEL_GAP);
      const light = LIGHT[realm.background ?? 'hills'] ?? LIGHT.hills;
      const open = realm.levels.some((id) => levelUnlocked(id));
      const prev = ri > 0 ? realms[ri - 1].name ?? realms[ri - 1].id : '';
      this.drawRealm(y0, light, realm.name ?? realm.id, open, prev);
      realm.levels.forEach((id, k) => this.node(id, k, y0, open));
    });

    makeButton(this, 58, H - 16, 80, 24, 'Shop', 'go', () => { sfx.click(); goTo(this, 'shop'); }, 6);
    makeButton(this, W - 58, H - 16, 80, 24, 'Title', 'plain', () => { sfx.click(); goTo(this, 'title'); }, 6);
    irisOpen(this);
  }

  private drawRealm(y0: number, light: (typeof LIGHT)[string], name: string, open: boolean, prev: string): void {
    const x = 6;
    const w = W - 12;
    panel(this, x, y0, w, PANEL_H, light.sky[0], light.sky[0], light.sky[0]);
    const g = this.add.graphics();
    const band = (c: string, from: number, h: number): void => { g.fillStyle(C(c), 1).fillRect(x, y0 + from, w, h); };
    band(light.sky[0], 0, 32);
    band(light.sky[1], 32, 30);
    band(light.sky[2], 62, 22);
    // a thin dithered seam between bands keeps it from looking like stripes
    g.fillStyle(C(light.sky[1]), 1);
    for (let i = 0; i < w; i += 2) g.fillRect(x + i, y0 + 31, 1, 1);
    g.fillStyle(C(light.sky[2]), 1);
    for (let i = 1; i < w; i += 2) g.fillRect(x + i, y0 + 61, 1, 1);
    band(light.ground, PANEL_H - 14, 14);
    band(light.edge, PANEL_H - 14, 2);
    g.fillStyle(C(light.dots), 1);
    for (let i = 0; i < light.dotCount; i++) g.fillRect(x + 8 + ((i * 53) % (w - 16)), y0 + 6 + ((i * 29) % 44), light.dots === 'c' ? 6 : 1, light.dots === 'c' ? 2 : 1);
    text(this, x + 6, y0 + 8, name, C('c'), 1, C('0')).setOrigin(0, 0.5);
    if (!open) {
      this.add.rectangle(x + w / 2, y0 + PANEL_H / 2, w, PANEL_H, C('0'), 0.55);
      text(this, W / 2, y0 + PANEL_H - 7, prev ? `Clear ${prev} to enter` : 'Locked', C('c'), 1, C('0')).setDepth(8);
    }
  }

  private node(id: number, k: number, y0: number, open: boolean): void {
    const x = 28 + k * 53;
    const y = y0 + 52 + (k % 2 === 0 ? 8 : -6);
    const built = !!data.levels[id];
    const unlocked = open && levelUnlocked(id);
    const cleared = starsFor(id) > 0;
    if (k < 3) {
      const g = this.add.graphics();
      g.fillStyle(C('c'), 0.8);
      const dir = k % 2 === 0 ? -1 : 1;
      for (let i = 1; i < 6; i++) g.fillRect(Math.round(x + 14 + (i * 25) / 6), Math.round(y + (dir * (i * 14)) / 6), 2, 2);
    }
    const kind = cleared ? 'go' : unlocked && id === reachedLevel() ? 'ability' : unlocked ? 'go' : 'plain';
    const btn: Btn = makeButton(this, x, y, 26, 24, built && unlocked ? String(id) : '', kind, () => {
      if (!built || !unlocked) return;
      sfx.click();
      goTo(this, 'loadout', { level: id });
    }, 6);
    if (!built || !unlocked) {
      btn.setEnabled(false);
      this.add.image(x, y - 1, 'icon_lock').setDepth(7);
    }
    if (unlocked && id === reachedLevel() && !cleared) this.pulse.push({ box: btn.box });
    const stars = starsFor(id);
    for (let s = 0; s < 3; s++) {
      this.add.image(x - 9 + s * 9, y + 22, s < stars ? 'star_on' : 'star_off').setScale(0.8).setDepth(6);
    }
  }

  update(time: number): void {
    const s = 1 + 0.08 * beatPulse(time);
    for (const p of this.pulse) p.box.setScale(s);
  }
}
