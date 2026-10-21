import Phaser from 'phaser';
import { C, rarityColor, rarityStroke } from '../art/palette';
import { text } from '../art/font5x7';
import { sfx } from '../audio/sfx';
import { H, W } from '../config/constants';
import { goTo } from '../core/flow';
import { addCoins, lastResult, levelUnlocked, profile } from '../core/profile';
import { beatBob, beatPhase } from '../audio/beat';
import { setText } from '../art/font5x7';
import { weaponTexture } from '../art/textures';
import { data } from '../data/load';
import { platform } from '../platform';
import type { Row } from '../platform/types';
import { makeButton, panel } from '../ui/widgets';

export interface ResultsData {
  levelId: number;
  won: boolean;
  why: 'shots' | 'escaped';
  stars: number;
  score: number;
  target: number;
  loadout: string[];
  relicUnlocked?: string;
}

/** Results overlay: stars, score, coins, and Next / Retry / Map. */
export default class ResultsScene extends Phaser.Scene {
  private ghosts: Phaser.GameObjects.Image[] = [];

  constructor() {
    super('results');
  }

  create(d: ResultsData): void {
    this.ghosts = [];
    this.add.rectangle(W / 2, H / 2, W, H, C('0'), 0.72);

    if (d.levelId === 0) {
      this.drawDailyResults(d);
      return;
    }

    const r = lastResult;
    const py = 18;
    const pw = 360;
    const px = (W - pw) / 2;
    panel(this, px, py, pw, 234, '8', '9', 'f', 1);

    const titleStr = d.won ? 'Level cleared!' : d.why === 'escaped' ? 'Runners escaped!' : 'Out of shots';
    const titleScale = d.won ? 2 : d.why === 'escaped' ? 1.5 : 2;
    text(this, W / 2, py + 18, titleStr, d.won ? C('4') : C('3'), titleScale, C('0')).setDepth(2);

    if (d.won) {
      const g1 = this.add.image(W / 2 - 76, py + 48, 'ghost_dance_1').setScale(1.4).setDepth(4);
      const g2 = this.add.image(W / 2 + 76, py + 48, 'ghost_dance_2').setScale(1.4).setDepth(4);
      this.ghosts = [g1, g2];
      for (let i = 0; i < 3; i++) {
        const star = this.add.image(W / 2 - 24 + i * 24, py + 48, 'star_off').setScale(2).setDepth(2);
        if (i < d.stars) {
          star.setTexture('star_on').setScale(0.1);
          this.tweens.add({
            targets: star, scale: 2.4, duration: 180, delay: 250 + i * 200, ease: 'Back.out',
            onStart: () => sfx.coin(), onComplete: () => this.tweens.add({ targets: star, scale: 2, duration: 100 }),
          });
        }
      }
      text(this, W / 2, py + 74, `Score ${d.score}`, C('c'), 1, C('0')).setDepth(2);
      if (d.target > 0) {
        text(this, W / 2, py + 88, d.stars === 3 ? 'Score target beaten' : `Beat ${d.target} for third star`, C('d')).setDepth(2);
      }
    } else {
      text(this, W / 2, py + 48, d.why === 'escaped' ? 'Stop the runners early.' : 'Try a different order.', C('c')).setDepth(2);
      text(this, W / 2, py + 64, `Score ${d.score}`, C('d')).setDepth(2);
    }

    let coinsTxt: Phaser.GameObjects.Image | undefined;
    if (r) {
      this.add.image(W / 2 - 34, py + 104, 'icon_coin').setDepth(2);
      coinsTxt = text(this, W / 2 - 26, py + 104, `+${r.credited} coins`, C('4'), 1, C('0')).setOrigin(0, 0.5).setDepth(2);
      text(this, W / 2, py + 117, r.credited < r.earned ? (d.won ? 'Replays pay less' : 'Losses pay a quarter') : `Total ${profile.coins}`, C('d')).setDepth(2);
    }

    const next = d.levelId + 1;
    const hasNext = d.won && !!data.levels[next] && levelUnlocked(next);
    const go = (key: string, payload?: object): void => { sfx.click(); goTo(this, key, payload); };

    if (d.won) {
      const y1 = py + 145;
      const y2 = py + 176;
      const y3 = py + 205;

      if (hasNext) {
        makeButton(this, W / 2 - 64, y1, 116, 24, 'Next level', 'go', () => go('loadout', { level: next }), 3);
      } else {
        makeButton(this, W / 2 - 64, y1, 116, 24, 'Map', 'go', () => go('map'), 3);
      }
      makeButton(this, W / 2 + 64, y1, 116, 24, 'Retry', 'plain', () => go('game', { level: d.levelId, loadout: d.loadout }), 3);

      if (data.config.features?.share !== false) {
        const shareBtn = makeButton(this, W / 2 - 64, y2, 116, 22, 'Share', 'ability', async () => {
          sfx.click();
          try {
            await platform.share(`I scored ${d.score} in MONSTER MASH on RUN! Can you beat my siege?`, { score: String(d.score), level: String(d.levelId) });
          } catch {
            // share error boundary
          }
          shareBtn.setLabel('Shared!');
        }, 3);
      }

      if (r && r.credited > 0 && data.config.features?.ads !== false) {
        void (async () => {
          try {
            const ready = await platform.ads.rewardedReady();
            if (!ready || !this.scene.isActive()) return;
            const adBtn = makeButton(this, W / 2 + 64, y2, 116, 22, '2x coins (Ad)', 'go', async () => {
              sfx.click();
              adBtn.setEnabled(false);
              try {
                const earned = await platform.ads.showRewarded();
                if (earned) {
                  addCoins(r.credited);
                  sfx.coin();
                  adBtn.setLabel('Doubled!');
                  if (coinsTxt) setText(coinsTxt, this, `+${r.credited * 2} coins!`, C('4'));
                  platform.track('rewarded_ad_complete', { coins: r.credited });
                } else {
                  adBtn.setEnabled(true);
                }
              } catch {
                adBtn.setEnabled(true);
              }
            }, 3);
          } catch {
            // ad ready check error boundary
          }
        })();
      }

      if (hasNext) {
        makeButton(this, W / 2, y3, 90, 20, 'Map', 'plain', () => go('map'), 3);
      }
    } else {
      const y1 = py + 148;
      const y2 = py + 182;
      makeButton(this, W / 2 - 64, y1, 116, 26, 'Try again', 'go', () => go('game', { level: d.levelId, loadout: d.loadout }), 3);
      makeButton(this, W / 2 + 64, y1, 116, 24, 'Change loadout', 'plain', () => go('loadout', { level: d.levelId }), 3);
      makeButton(this, W / 2, y2, 90, 22, 'Map', 'plain', () => go('map'), 3);
    }

    if (d.relicUnlocked) {
      this.showRelicUnlockToast(d.relicUnlocked);
    }
  }

  private showRelicUnlockToast(relicId: string): void {
    const w = data.content.weapons.find((x) => x.id === relicId);
    if (!w) return;

    const group: (Phaser.GameObjects.GameObject | { destroy(): void })[] = [];
    const darkBg = this.add.rectangle(W / 2, H / 2, W, H, C('0'), 0.76).setDepth(20).setInteractive();
    group.push(darkBg);

    const py = H / 2 - 95;
    const p = panel(this, W / 2 - 90, py, 180, 190, '0', rarityStroke(w.rarity ?? 'legendary'), 'f', 21);
    group.push(p);

    const t1 = text(this, W / 2, py + 18, 'RELIC FOUND!', rarityColor(w.rarity), 2, C('0')).setDepth(22);
    group.push(t1);

    const ico = this.add.image(W / 2, py + 56, weaponTexture(w.id)).setScale(2.5).setDepth(22);
    group.push(ico);

    const t2 = text(this, W / 2, py + 86, w.name, rarityColor(w.rarity), 1, C('0')).setDepth(22);
    group.push(t2);

    const t3 = text(this, W / 2, py + 102, (w.rarity ?? 'rare').toUpperCase(), C('d'), 1).setDepth(22);
    group.push(t3);

    const eff = (w.tap || w.launch || '').slice(0, 32);
    const t4 = text(this, W / 2, py + 120, eff, C('c'), 1).setDepth(22);
    group.push(t4);

    const btn = makeButton(this, W / 2, py + 156, 100, 24, 'Claim', 'go', () => {
      sfx.click();
      group.forEach((g) => g.destroy());
    }, 22);
    group.push(btn.box);

    sfx.unlock();
    this.tweens.add({
      targets: ico,
      scale: 3.2,
      duration: 260,
      ease: 'Back.out',
      yoyo: true,
      repeat: 1,
    });
  }

  private async drawDailyResults(d: ResultsData): Promise<void> {
    const py = 16;
    const leftW = 200;
    const rightW = 236;
    const h = 238;

    // Left summary panel
    panel(this, 16, py, leftW, h, '8', '9', 'f', 1);
    text(this, 16 + leftW / 2, py + 16, d.won ? 'Daily Cleared!' : 'Daily Attempt', d.won ? C('4') : C('3'), 2, C('0')).setDepth(2);
    text(this, 16 + leftW / 2, py + 36, `Score ${d.score}`, C('c'), 1, C('0')).setDepth(2);
    text(this, 16 + leftW / 2, py + 50, `Streak: ${profile.daily.streak}d`, C('4'), 1, C('0')).setDepth(2);
    if (profile.daily.streak % 7 === 0 && profile.daily.streak > 0) {
      text(this, 16 + leftW / 2, py + 66, 'Day 7 Bonus: +500 Coins!', C('4'), 1, C('0')).setDepth(2);
    }

    if (d.won) {
      await platform.leaderboard.submit('daily', d.score);
    }

    const shareBtn = makeButton(this, 16 + leftW / 2, py + 140, 120, 26, 'Share', 'ability', async () => {
      sfx.click();
      await platform.share(`I scored ${d.score} in MONSTER MASH on RUN! Can you beat my siege?`, { score: String(d.score), level: 'daily' });
      shareBtn.setLabel('Shared!');
    }, 4);

    makeButton(this, 16 + leftW / 2, py + 180, 120, 24, 'Map', 'go', () => {
      sfx.click();
      goTo(this, 'map');
    }, 4);

    // Right leaderboard panel
    const rx = 228;
    panel(this, rx, py, rightW, h, '0', 'f', 'f', 2);
    text(this, rx + rightW / 2, py + 12, 'Daily Leaderboard', C('4'), 1, C('0')).setDepth(3);

    let rows: Row[] = [];
    let myRank: Row | null = null;
    try {
      rows = await platform.leaderboard.top('daily', 10);
      myRank = await platform.leaderboard.myRank('daily');
    } catch {
      rows = [];
      myRank = null;
    }

    rows.forEach((r, i) => {
      const isMe = r.name === 'You';
      const ry = py + 30 + i * 17;
      text(this, rx + 10, ry, `#${r.rank} ${r.name.slice(0, 13)}`, isMe ? C('4') : C('c'), 1, C('0')).setOrigin(0, 0.5).setDepth(3);
      text(this, rx + rightW - 10, ry, String(r.score), isMe ? C('4') : C('d'), 1, C('0')).setOrigin(1, 0.5).setDepth(3);
    });

    const rankStr = myRank ? `Your rank: #${myRank.rank} (Best ${myRank.score})` : `Your score: ${d.score}`;
    text(this, rx + rightW / 2, py + 220, rankStr, C('4'), 1, C('0')).setOrigin(0.5, 0.5).setDepth(3);
  }

  update(time: number): void {
    if (this.ghosts.length >= 2) {
      const p = beatPhase(time);
      const bob = Math.abs(beatBob(time, 0)) * 4;
      const tex1 = p < 0.5 ? 'ghost_dance_1' : 'ghost_dance_2';
      const tex2 = p < 0.5 ? 'ghost_dance_2' : 'ghost_dance_1';
      this.ghosts[0].setTexture(tex1).setY(66 - bob);
      this.ghosts[1].setTexture(tex2).setY(66 - bob);
    }
  }
}
