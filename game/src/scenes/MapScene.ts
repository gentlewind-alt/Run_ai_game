import Phaser from 'phaser';
import { C } from '../art/palette';
import { fitText, setText, text } from '../art/font5x7';
import { beatPulse } from '../audio/beat';
import { music } from '../audio/music';
import { sfx } from '../audio/sfx';
import { H, W } from '../config/constants';
import { goTo, irisOpen } from '../core/flow';
import { levelUnlocked, profile, reachedLevel, starsFor } from '../core/profile';
import { data } from '../data/load';
import { setDailyLevel } from '../data/lookup';
import { generateDailyLevel, getDailySeed } from '../content/levelKinds/daily';
import { platform } from '../platform';
import { coinCounter } from '../ui/coins';
import { menuBackdrop, uiIcon, makeButton, panel, type Btn } from '../ui/widgets';
import { helpButton, maybeTutorial } from '../ui/tutorial';

const PANEL_H = 64;
const PANEL_Y0 = 26;
const PANEL_GAP = 5;

/** Realm lighting: sky bands top to bottom, then the ground strip. */
const LIGHT: Record<string, { sky: string[]; ground: string; edge: string; dots: string; dotCount: number }> = {
  hills: { sky: ['9', 'a', 'b'], ground: 'n', edge: '6', dots: 'c', dotCount: 8 },
  wood: { sky: ['1', '8', '7'], ground: 'o', edge: '7', dots: 'b', dotCount: 14 },
  keep: { sky: ['f', 'q', '3'], ground: 'm', edge: 'e', dots: '4', dotCount: 12 },
  frost: { sky: ['8', '9', 'a'], ground: 'c', edge: 'd', dots: 'c', dotCount: 16 },
  sky: { sky: ['8', '9', 'a'], ground: 'm', edge: 'q', dots: 'b', dotCount: 16 },
  ember: { sky: ['1', '2', '3'], ground: 'f', edge: '3', dots: '4', dotCount: 16 },
};

const REALMS_PER_PAGE = 3;

/** Level nodes in three realm strips, lit by realm, with Daily card to the side. */
export default class MapScene extends Phaser.Scene {
  private pulse: { box: Phaser.GameObjects.Container }[] = [];
  private dailyCountdownText?: Phaser.GameObjects.Image;
  private nextCountdownTime = 0;
  /** Bumped on every create and shutdown so a slow server-time answer cannot draw into a scene that has gone. */
  private buildId = 0;
  private cachedServerTime = Date.now();
  private page = 0;

  constructor() {
    super('map');
  }

  init(d?: { page?: number }): void {
    const realms = data.content.realms;
    const furthest = realms.reduce((best, r, i) => (r.levels.some((id) => levelUnlocked(id)) ? i : best), 0);
    this.page = d?.page ?? Math.floor(furthest / REALMS_PER_PAGE);
  }

  create(): void {
    this.pulse = [];
    this.dailyCountdownText = undefined; // scene.restart() keeps the instance; the old image is already destroyed
    this.nextCountdownTime = 0;
    this.buildId++;
    this.events.once('shutdown', () => { this.buildId++; });
    menuBackdrop(this);
    coinCounter(this, 12, 13);

    const realms = data.content.realms;
    const total = realms.reduce((n, r) => n + r.levels.filter((id) => data.levels[id]).length * 3, 0);
    const got = realms.reduce((n, r) => n + r.levels.reduce((m, id) => m + starsFor(id), 0), 0);
    uiIcon(this, W - 130, 13, 'star', 'star_on', 12);
    text(this, W - 12, 13, fitText(`${got} of ${total}`, 104), C('4'), 1, C('0')).setOrigin(1, 0.5);

    realms.slice(this.page * REALMS_PER_PAGE, (this.page + 1) * REALMS_PER_PAGE).forEach((realm, li) => {
      const ri = this.page * REALMS_PER_PAGE + li;
      const y0 = PANEL_Y0 + li * (PANEL_H + PANEL_GAP);
      const light = LIGHT[realm.background ?? 'hills'] ?? LIGHT.hills;
      const open = realm.levels.some((id) => levelUnlocked(id));
      const prev = ri > 0 ? realms[ri - 1].name ?? realms[ri - 1].id : '';
      this.drawRealm(y0, light, realm.name ?? realm.id, open, prev);
      realm.levels.forEach((id, k) => this.node(id, k, y0, open, realm.levels.length));
    });

    if (realms.length > REALMS_PER_PAGE) {
      const lastPage = this.page >= Math.ceil(realms.length / REALMS_PER_PAGE) - 1;
      makeButton(this, W / 2, 13, 96, 16, lastPage ? '< First realms' : 'More realms >', 'plain', () => {
        sfx.click();
        this.scene.restart({ page: lastPage ? 0 : this.page + 1 });
      }, 6);
    }

    if (data.config.features?.daily !== false) {
      this.drawDaily(PANEL_Y0, this.buildId);
    }

    makeButton(this, Math.round(W * 0.12), H - 16, 76, 24, 'Shop', 'go', () => { sfx.click(); goTo(this, 'shop'); }, 6);
    makeButton(this, Math.round(W * 0.37), H - 16, 76, 24, 'Scores', 'ability', () => { sfx.click(); goTo(this, 'leaderboards'); }, 6);
    makeButton(this, Math.round(W * 0.63), H - 16, 76, 24, 'Credits', 'plain', () => { sfx.click(); goTo(this, 'credits'); }, 6);
    makeButton(this, Math.round(W * 0.88), H - 16, 76, 24, 'Title', 'plain', () => { sfx.click(); goTo(this, 'title'); }, 6);
    music.play({ theme: 'map' });
    helpButton(this, W / 2 + 78, 13, ['map', 'battle', 'loadout', 'abilities', 'flight', 'damage', 'shop', 'forge', 'challenges', 'builder', 'arena', 'leaderboards']);
    maybeTutorial(this, 'map');
    irisOpen(this);
  }

  private async drawDaily(y0: number, build: number): Promise<void> {
    const x = W - 132;
    const w = 124;
    const h = 202;
    if (build !== this.buildId) return;
    panel(this, x, y0, w, h, '8', '9', 'f', 1);

    let nowMs = Date.now();
    try {
      nowMs = await platform.serverTime();
    } catch {
      nowMs = Date.now();
    }
    if (build !== this.buildId) return; // the scene was restarted or left while the server time was on its way
    this.cachedServerTime = nowMs;
    const { dateStr } = getDailySeed(nowMs);
    const dInfo = profile.daily;
    const doneToday = dInfo.lastDay === dateStr;

    const cx = x + w / 2;
    uiIcon(this, cx - 43, y0 + 16, 'daily', 'star_on', 14).setDepth(2);
    text(this, cx + 8, y0 + 16, 'Daily Mash', C('4'), 1, C('0')).setOrigin(0.5, 0.5).setDepth(2);
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
    if (!this.dailyCountdownText?.scene) return;
    this.cachedServerTime += 1000;
    const str = this.formatCountdown(this.cachedServerTime);
    setText(this.dailyCountdownText, this, str, C('b'), C('0'));
  }

  private drawRealm(y0: number, light: (typeof LIGHT)[string], name: string, open: boolean, prev: string): void {
    const x = 8;
    const w = W - 150;
    panel(this, x, y0, w, PANEL_H, light.sky[0], light.sky[0], light.sky[0]);
    const g = this.add.graphics();
    const innerX = x + 6, innerY = y0 + 14, innerW = w - 12, innerH = PANEL_H - 20;
    const band = (c: string, from: number, h: number): void => { g.fillStyle(C(c), 1).fillRect(innerX, innerY + from, innerW, Math.min(h, innerH - from)); };
    band(light.sky[0], 0, 20);
    band(light.sky[1], 20, 20);
    band(light.sky[2], 40, 14);
    g.fillStyle(C(light.sky[1]), 1);
    for (let i = 0; i < innerW; i += 2) g.fillRect(innerX + i, innerY + 19, 1, 1);
    g.fillStyle(C(light.sky[2]), 1);
    for (let i = 1; i < innerW; i += 2) g.fillRect(innerX + i, innerY + 39, 1, 1);
    band(light.ground, innerH - 10, 10);
    band(light.edge, innerH - 10, 2);
    g.fillStyle(C(light.dots), 1);
    for (let i = 0; i < light.dotCount; i++) {
      g.fillRect(innerX + 8 + ((i * 47) % (innerW - 16)), innerY + 4 + ((i * 23) % 26), light.dots === 'c' ? 6 : 1, light.dots === 'c' ? 2 : 1);
    }
    text(this, x + 8, y0 + 8, fitText(name, w - 16), C('c'), 1, C('0')).setOrigin(0, 0.5);
    if (!open) {
      this.add.rectangle(x + w / 2, y0 + PANEL_H / 2, w, PANEL_H, C('0'), 0.55);
      text(this, x + w / 2, y0 + PANEL_H / 2, fitText(prev ? `Clear ${prev} to enter` : 'Locked', w - 16), C('c'), 1, C('0')).setDepth(8);
    }
  }

  private node(id: number, k: number, y0: number, open: boolean, count: number): void {
    const panelW = W - 150;
    const step = count > 1 ? (panelW - 56) / (count - 1) : 0;
    const x = count > 1 ? 8 + 28 + k * step : 8 + panelW / 2;
    const y = y0 + 34 + (k % 2 === 0 ? 3 : -3);
    const built = !!data.levels[id];
    const unlocked = open && levelUnlocked(id);
    const cleared = starsFor(id) > 0;
    if (k < count - 1) {
      const g = this.add.graphics();
      g.fillStyle(C('c'), 0.8);
      for (let i = 1; i < 7; i++) {
        const t = i / 7;
        const nextY = y0 + 34 + ((k + 1) % 2 === 0 ? 3 : -3);
        g.fillRect(Math.round(x + 16 + (step - 32) * t), Math.round(y + (nextY - y) * t), 2, 2);
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
      uiIcon(this, x, y - 1, 'lock', 'icon_lock', 12).setDepth(7);
    }
    if (unlocked && id === reachedLevel() && !cleared) this.pulse.push({ box: btn.box });
    const stars = starsFor(id);
    for (let s = 0; s < 3; s++) {
      if (s < stars) uiIcon(this, x - 9 + s * 9, y + 16, 'star', 'star_on', 8).setDepth(6);
      else this.add.image(x - 9 + s * 9, y + 16, 'star_off').setScale(0.8).setDepth(6);
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
