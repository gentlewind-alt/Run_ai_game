import Phaser from 'phaser';
import { C } from '../art/palette';
import { setText, text } from '../art/font5x7';
import { beatPulse } from '../audio/beat';
import { sfx } from '../audio/sfx';
import { H, W } from '../config/constants';
import { goTo, irisOpen } from '../core/flow';
import { levelUnlocked, profile, reachedLevel, starsFor } from '../core/profile';
import { data } from '../data/load';
import { setDailyLevel } from '../data/lookup';
import { generateDailyLevel, getDailySeed } from '../content/levelKinds/daily';
import { platform } from '../platform';
import { coinCounter } from '../ui/coins';
import { makeButton, panel, type Btn } from '../ui/widgets';

const PANEL_W = 330;
const PANEL_H = 64;
const PANEL_Y0 = 26;
const PANEL_GAP = 5;

/** Realm lighting: sky bands top to bottom, then the ground strip. */
const LIGHT: Record<string, { sky: string[]; ground: string; edge: string; dots: string; dotCount: number }> = {
  hills: { sky: ['9', 'a', 'b'], ground: 'n', edge: '6', dots: 'c', dotCount: 8 },
  wood: { sky: ['1', '8', '7'], ground: 'o', edge: '7', dots: 'b', dotCount: 14 },
  keep: { sky: ['f', 'q', '3'], ground: 'm', edge: 'e', dots: '4', dotCount: 12 },
};

/** Level nodes in three realm strips, lit by realm, with Daily card to the side. */
export default class MapScene extends Phaser.Scene {
  private pulse: { box: Phaser.GameObjects.Container }[] = [];
  private dailyCountdownText?: Phaser.GameObjects.Image;
  private nextCountdownTime = 0;
  private cachedServerTime = Date.now();

  constructor() {
    super('map');
  }

  create(): void {
    this.pulse = [];
    this.add.rectangle(W / 2, H / 2, W, H, C('f'));
    coinCounter(this, 12, 13);

    const realms = data.content.realms;
    const total = realms.reduce((n, r) => n + r.levels.filter((id) => data.levels[id]).length * 3, 0);
    const got = realms.reduce((n, r) => n + r.levels.reduce((m, id) => m + starsFor(id), 0), 0);
    text(this, W - 12, 13, `Stars ${got} of ${total}`, C('4'), 1, C('0')).setOrigin(1, 0.5);

    realms.forEach((realm, ri) => {
      const y0 = PANEL_Y0 + ri * (PANEL_H + PANEL_GAP);
      const light = LIGHT[realm.background ?? 'hills'] ?? LIGHT.hills;
      const open = realm.levels.some((id) => levelUnlocked(id));
      const prev = ri > 0 ? realms[ri - 1].name ?? realms[ri - 1].id : '';
      this.drawRealm(y0, light, realm.name ?? realm.id, open, prev);
      realm.levels.forEach((id, k) => this.node(id, k, y0, open));
    });

    if (data.config.features?.daily !== false) {
      this.drawDaily(PANEL_Y0);
    }

    makeButton(this, Math.round(W * 0.15), H - 16, 76, 24, 'Shop', 'go', () => { sfx.click(); goTo(this, 'shop'); }, 6);
    makeButton(this, W / 2, H - 16, 76, 24, 'Credits', 'plain', () => { sfx.click(); goTo(this, 'credits'); }, 6);
    makeButton(this, Math.round(W * 0.85), H - 16, 76, 24, 'Title', 'plain', () => { sfx.click(); goTo(this, 'title'); }, 6);
    irisOpen(this);
  }

  private async drawDaily(y0: number): Promise<void> {
    const x = W - 132;
    const w = 124;
    const h = 202;
    panel(this, x, y0, w, h, '8', '9', 'f', 1);

    let nowMs = Date.now();
    try {
      nowMs = await platform.serverTime();
    } catch {
      nowMs = Date.now();
    }
    this.cachedServerTime = nowMs;
    const { dateStr } = getDailySeed(nowMs);
    const dInfo = profile.daily;
    const doneToday = dInfo.lastDay === dateStr;

    const cx = x + w / 2;
    text(this, cx, y0 + 16, 'Daily Mash', C('4'), 1, C('0')).setOrigin(0.5, 0.5).setDepth(2);
    text(this, cx, y0 + 32, dateStr, C('c'), 1, C('0')).setOrigin(0.5, 0.5).setDepth(2);

    const streakStr = dInfo.streak > 0 ? `Streak ${dInfo.streak}d` : 'Streak 0d';
    text(this, cx, y0 + 52, streakStr, C('4'), 1, C('0')).setOrigin(0.5, 0.5).setDepth(2);

    if (dInfo.streak === 6) {
      text(this, cx, y0 + 70, 'Day 7: +500c bonus!', C('4'), 1, C('0')).setOrigin(0.5, 0.5).setDepth(2);
    } else if (dInfo.best > 0) {
      text(this, cx, y0 + 70, `Best ${dInfo.best}`, C('d'), 1, C('0')).setOrigin(0.5, 0.5).setDepth(2);
    }

    if (doneToday) {
      text(this, cx, y0 + 116, 'Done today', C('6'), 1, C('0')).setOrigin(0.5, 0.5).setDepth(2);
      this.dailyCountdownText = text(this, cx, y0 + 134, this.formatCountdown(nowMs), C('b'), 1, C('0')).setOrigin(0.5, 0.5).setDepth(2);
    } else {
      makeButton(this, cx, y0 + 128, 88, 28, 'Play', 'ability', () => {
        sfx.click();
        const lvl = generateDailyLevel(nowMs);
        setDailyLevel(lvl);
        goTo(this, 'loadout', { level: 0 });
      }, 5);
    }
  }

  private formatCountdown(nowMs: number): string {
    const d = new Date(nowMs);
    const nextMidnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0);
    const remainingMs = Math.max(0, nextMidnight - nowMs);
    const totalSec = Math.floor(remainingMs / 1000);
    const hh = String(Math.floor(totalSec / 3600)).padStart(2, '0');
    const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
    const ss = String(totalSec % 60).padStart(2, '0');
    return `next in ${hh}:${mm}:${ss}`;
  }

  private tickDailyCountdown(): void {
    if (!this.dailyCountdownText) return;
    this.cachedServerTime += 1000;
    const str = this.formatCountdown(this.cachedServerTime);
    setText(this.dailyCountdownText, this, str, C('b'), C('0'));
  }

  private drawRealm(y0: number, light: (typeof LIGHT)[string], name: string, open: boolean, prev: string): void {
    const x = 8;
    const w = PANEL_W;
    panel(this, x, y0, w, PANEL_H, light.sky[0], light.sky[0], light.sky[0]);
    const g = this.add.graphics();
    const band = (c: string, from: number, h: number): void => { g.fillStyle(C(c), 1).fillRect(x, y0 + from, w, h); };
    band(light.sky[0], 0, 20);
    band(light.sky[1], 20, 20);
    band(light.sky[2], 40, 14);
    g.fillStyle(C(light.sky[1]), 1);
    for (let i = 0; i < w; i += 2) g.fillRect(x + i, y0 + 19, 1, 1);
    g.fillStyle(C(light.sky[2]), 1);
    for (let i = 1; i < w; i += 2) g.fillRect(x + i, y0 + 39, 1, 1);
    band(light.ground, PANEL_H - 10, 10);
    band(light.edge, PANEL_H - 10, 2);
    g.fillStyle(C(light.dots), 1);
    for (let i = 0; i < light.dotCount; i++) {
      g.fillRect(x + 8 + ((i * 47) % (w - 16)), y0 + 4 + ((i * 23) % 32), light.dots === 'c' ? 6 : 1, light.dots === 'c' ? 2 : 1);
    }
    text(this, x + 8, y0 + 8, name, C('c'), 1, C('0')).setOrigin(0, 0.5);
    if (!open) {
      this.add.rectangle(x + w / 2, y0 + PANEL_H / 2, w, PANEL_H, C('0'), 0.55);
      text(this, x + w / 2, y0 + PANEL_H / 2, prev ? `Clear ${prev} to enter` : 'Locked', C('c'), 1, C('0')).setDepth(8);
    }
  }

  private node(id: number, k: number, y0: number, open: boolean): void {
    const x = 50 + k * 74;
    const y = y0 + 34 + (k % 2 === 0 ? 3 : -3);
    const built = !!data.levels[id];
    const unlocked = open && levelUnlocked(id);
    const cleared = starsFor(id) > 0;
    if (k < 3) {
      const g = this.add.graphics();
      g.fillStyle(C('c'), 0.8);
      const dir = k % 2 === 0 ? -1 : 1;
      for (let i = 1; i < 7; i++) {
        g.fillRect(Math.round(x + 14 + (i * 46) / 7), Math.round(y + (dir * (i * 6)) / 7), 2, 2);
      }
    }
    const kind = cleared ? 'go' : unlocked && id === reachedLevel() ? 'ability' : unlocked ? 'go' : 'plain';
    const btn: Btn = makeButton(this, x, y, 28, 22, built && unlocked ? String(id) : '', kind, () => {
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
      this.add.image(x - 9 + s * 9, y + 16, s < stars ? 'star_on' : 'star_off').setScale(0.8).setDepth(6);
    }
  }

  update(time: number): void {
    const s = 1 + 0.08 * beatPulse(time);
    for (const p of this.pulse) p.box.setScale(s);
    if (this.nextCountdownTime <= time) {
      this.nextCountdownTime = time + 1000;
      this.tickDailyCountdown();
    }
  }
}
