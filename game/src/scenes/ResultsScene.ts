import Phaser from 'phaser';
import { C } from '../art/palette';
import { text } from '../art/font5x7';
import { sfx } from '../audio/sfx';
import { H, W } from '../config/constants';
import { goTo } from '../core/flow';
import { addCoins, lastResult, levelUnlocked, profile } from '../core/profile';
import { beatBob, beatPhase } from '../audio/beat';
import { setText } from '../art/font5x7';
import { data } from '../data/load';
import { platform } from '../platform';
import { makeButton, panel } from '../ui/widgets';

export interface ResultsData {
  levelId: number;
  won: boolean;
  why: 'shots' | 'escaped';
  stars: number;
  score: number;
  target: number;
  loadout: string[];
}

/** Launched over a paused battle: stars, score, coins, then Next, Retry or Map. */
export default class ResultsScene extends Phaser.Scene {
  private ghosts: Phaser.GameObjects.Image[] = [];

  constructor() {
    super('results');
  }

  create(d: ResultsData): void {
    this.ghosts = [];
    this.add.rectangle(W / 2, H / 2, W, H, C('0'), 0.7);

    if (d.levelId === 0) {
      this.drawDailyResults(d);
      return;
    }

    const r = lastResult;
    const py = 50;
    panel(this, 16, py, W - 32, 276, '8', '9', 'f', 1);
    const titleStr = d.won ? 'Level cleared!' : d.why === 'escaped' ? 'Runners escaped!' : 'Out of shots';
    const titleScale = d.won ? 2 : d.why === 'escaped' ? 1.5 : 2;
    text(this, W / 2, py + 16, titleStr, d.won ? C('4') : C('3'), titleScale, C('0')).setDepth(2);
    if (d.won) {
      const g1 = this.add.image(W / 2 - 68, py + 52, 'ghost_dance_1').setScale(1.5).setDepth(4);
      const g2 = this.add.image(W / 2 + 68, py + 52, 'ghost_dance_2').setScale(1.5).setDepth(4);
      this.ghosts = [g1, g2];
      for (let i = 0; i < 3; i++) {
        const star = this.add.image(W / 2 - 24 + i * 24, py + 52, 'star_off').setScale(2).setDepth(2);
        if (i < d.stars) {
          star.setTexture('star_on').setScale(0.1);
          this.tweens.add({
            targets: star, scale: 2.4, duration: 180, delay: 250 + i * 200, ease: 'Back.out',
            onStart: () => sfx.coin(), onComplete: () => this.tweens.add({ targets: star, scale: 2, duration: 100 }),
          });
        }
      }
      text(this, W / 2, py + 84, `Score ${d.score}`, C('c'), 1, C('0')).setDepth(2);
      if (d.target > 0) text(this, W / 2, py + 98, d.stars === 3 ? 'Score target beaten' : `Beat ${d.target} for the third star`, C('d')).setDepth(2);
    } else {
      text(this, W / 2, py + 54, d.why === 'escaped' ? 'Stop the runners early.' : 'Try a different order.', C('c')).setDepth(2);
      text(this, W / 2, py + 70, `Score ${d.score}`, C('d')).setDepth(2);
    }
    let coinsTxt: Phaser.GameObjects.Image | undefined;
    if (r) {
      this.add.image(W / 2 - 34, py + 116, 'icon_coin').setDepth(2);
      coinsTxt = text(this, W / 2 - 26, py + 116, `+${r.credited} coins`, C('4'), 1, C('0')).setOrigin(0, 0.5).setDepth(2);
      text(this, W / 2, py + 130, r.credited < r.earned ? (d.won ? 'Replays pay less' : 'Losses pay a quarter') : `Total ${profile.coins}`, C('d')).setDepth(2);
    }

    const next = d.levelId + 1;
    const hasNext = d.won && !!data.levels[next] && levelUnlocked(next);
    const go = (key: string, payload?: object): void => { sfx.click(); goTo(this, key, payload); };
    let y = py + 148;
    if (d.won) {
      if (hasNext) makeButton(this, W / 2, y, 128, 24, 'Next level', 'go', () => go('game', { level: next, loadout: profile.equipped.loadout?.length ? profile.equipped.loadout : d.loadout }), 3);
      else makeButton(this, W / 2, y, 128, 24, 'Map', 'go', () => go('map'), 3);
      y += 28;

      if (r && r.credited > 0 && data.config.features?.ads !== false) {
        const adY = y;
        y += 26;
        void platform.ads.rewardedReady().then((ready) => {
          if (!ready || !this.scene.isActive()) return;
          const adBtn = makeButton(this, W / 2, adY, 128, 22, '2x coins (Ad)', 'go', async () => {
            sfx.click();
            adBtn.setEnabled(false);
            const earned = await platform.ads.showRewarded();
            if (earned) {
              addCoins(r.credited);
              sfx.coin();
              adBtn.setLabel('Coins doubled!');
              if (coinsTxt) setText(coinsTxt, this, `+${r.credited * 2} coins!`, C('4'));
              platform.track('rewarded_ad_complete', { coins: r.credited });
            } else {
              adBtn.setEnabled(true);
            }
          }, 3);
        });
      }

      makeButton(this, W / 2, y, 128, 22, 'Retry', 'plain', () => go('game', { level: d.levelId, loadout: d.loadout }), 3);
      y += 26;
      if (data.config.features?.share !== false) {
        const shareBtn = makeButton(this, W / 2, y, 128, 22, 'Share', 'ability', async () => {
          sfx.click();
          await platform.share(`I scored ${d.score} in MONSTER MASH on RUN! Can you beat my siege?`, { score: String(d.score), level: String(d.levelId) });
          shareBtn.setLabel('Shared!');
        }, 3);
        y += 26;
      }
      if (hasNext) makeButton(this, W / 2, y, 128, 22, 'Map', 'plain', () => go('map'), 3);
    } else {
      makeButton(this, W / 2, y, 128, 26, 'Try again', 'go', () => go('game', { level: d.levelId, loadout: d.loadout }), 3);
      y += 30;
      makeButton(this, W / 2, y, 128, 22, 'Change loadout', 'plain', () => go('loadout', { level: d.levelId }), 3);
      y += 26;
      makeButton(this, W / 2, y, 128, 22, 'Map', 'plain', () => go('map'), 3);
    }
  }

  private async drawDailyResults(d: ResultsData): Promise<void> {
    const py = 16;
    panel(this, 12, py, W - 24, 352, '8', '9', 'f', 1);

    text(this, W / 2, py + 14, d.won ? 'Daily Cleared!' : 'Daily Attempt', d.won ? C('4') : C('3'), 2, C('0')).setDepth(2);
    text(this, W / 2, py + 30, `Score ${d.score}  •  Streak ${profile.daily.streak}d`, C('c'), 1, C('0')).setDepth(2);
    if (profile.daily.streak % 7 === 0 && profile.daily.streak > 0) {
      text(this, W / 2, py + 42, 'Day 7 Streak Reward: +500 Coins!', C('4'), 1, C('0')).setDepth(2);
    }

    if (d.won) {
      await platform.leaderboard.submit('daily', d.score);
    }

    const lby = py + 48;
    panel(this, 18, lby, W - 36, 238, '0', 'f', 'f', 2);
    text(this, W / 2, lby + 10, 'Daily Leaderboard', C('4'), 1, C('0')).setDepth(3);

    const rows = await platform.leaderboard.top('daily', 10);
    const myRank = await platform.leaderboard.myRank('daily');

    rows.forEach((r, i) => {
      const isMe = r.name === 'You';
      const ry = lby + 26 + i * 18;
      text(this, 26, ry, `#${r.rank} ${r.name.slice(0, 13)}`, isMe ? C('4') : C('c'), 1, C('0')).setOrigin(0, 0.5).setDepth(3);
      text(this, W - 26, ry, String(r.score), isMe ? C('4') : C('d'), 1, C('0')).setOrigin(1, 0.5).setDepth(3);
    });

    const rankStr = myRank ? `Your rank: #${myRank.rank} (Best ${myRank.score})` : `Your score: ${d.score}`;
    text(this, W / 2, lby + 222, rankStr, C('4'), 1, C('0')).setOrigin(0.5, 0.5).setDepth(3);

    const by = py + 308;
    const shareBtn = makeButton(this, W / 2 - 44, by, 76, 26, 'Share', 'ability', async () => {
      sfx.click();
      await platform.share(`I scored ${d.score} in MONSTER MASH on RUN! Can you beat my siege?`, { score: String(d.score), level: 'daily' });
      shareBtn.setLabel('Shared!');
    }, 4);

    makeButton(this, W / 2 + 44, by, 76, 26, 'Map', 'go', () => {
      sfx.click();
      goTo(this, 'map');
    }, 4);
  }

  update(time: number): void {
    if (this.ghosts.length >= 2) {
      const p = beatPhase(time);
      const bob = Math.abs(beatBob(time, 0)) * 4;
      const tex1 = p < 0.5 ? 'ghost_dance_1' : 'ghost_dance_2';
      const tex2 = p < 0.5 ? 'ghost_dance_2' : 'ghost_dance_1';
      this.ghosts[0].setTexture(tex1).setY(102 - bob);
      this.ghosts[1].setTexture(tex2).setY(102 - bob);
    }
  }
}
