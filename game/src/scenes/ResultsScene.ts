import Phaser from 'phaser';
import { C } from '../art/palette';
import { text } from '../art/font5x7';
import { sfx } from '../audio/sfx';
import { H, W } from '../config/constants';
import { goTo } from '../core/flow';
import { lastResult, levelUnlocked, profile } from '../core/profile';
import { data } from '../data/load';
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
  constructor() {
    super('results');
  }

  create(d: ResultsData): void {
    const r = lastResult;
    this.add.rectangle(W / 2, H / 2, W, H, C('0'), 0.7);
    const py = 70;
    panel(this, 16, py, W - 32, 236, '8', '9', 'f', 1);
    text(this, W / 2, py + 16, d.won ? 'Level cleared!' : d.why === 'escaped' ? 'Too many got away' : 'Out of shots', d.won ? C('4') : C('3'), 2, C('0')).setDepth(2);
    if (d.won) {
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
    if (r) {
      this.add.image(W / 2 - 34, py + 116, 'icon_coin').setDepth(2);
      text(this, W / 2 - 26, py + 116, `+${r.credited} coins`, C('4'), 1, C('0')).setOrigin(0, 0.5).setDepth(2);
      text(this, W / 2, py + 130, r.credited < r.earned ? (d.won ? 'Replays pay less' : 'Losses pay a quarter') : `Total ${profile.coins}`, C('d')).setDepth(2);
    }

    const next = d.levelId + 1;
    const hasNext = d.won && !!data.levels[next] && levelUnlocked(next);
    const go = (key: string, payload?: object): void => { sfx.click(); goTo(this, key, payload); };
    let y = py + 158;
    if (d.won) {
      if (hasNext) makeButton(this, W / 2, y, 128, 26, 'Next level', 'go', () => go('loadout', { level: next }), 3);
      else makeButton(this, W / 2, y, 128, 26, 'Map', 'go', () => go('map'), 3);
      y += 32;
      makeButton(this, W / 2, y, 128, 22, 'Retry', 'plain', () => go('game', { level: d.levelId, loadout: d.loadout }), 3);
      if (hasNext) makeButton(this, W / 2, y + 28, 128, 22, 'Map', 'plain', () => go('map'), 3);
    } else {
      makeButton(this, W / 2, y, 128, 26, 'Try again', 'go', () => go('game', { level: d.levelId, loadout: d.loadout }), 3);
      y += 32;
      makeButton(this, W / 2, y, 128, 22, 'Change loadout', 'plain', () => go('loadout', { level: d.levelId }), 3);
      makeButton(this, W / 2, y + 28, 128, 22, 'Map', 'plain', () => go('map'), 3);
    }
  }
}
