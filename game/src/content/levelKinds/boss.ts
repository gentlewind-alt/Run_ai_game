import type { LevelKind } from './types';

export const bossKind: LevelKind = {
  id: 'boss',
  name: 'Boss Fight',
  onStart(ctx) {
    ctx.fx.word(200, 180, 'BOSS BATTLE!');
  },
  onWin(ctx) {
    // S4-02: "The win unlocks the Gatebreaker Ram (if built) or gives a big coin reward."
    ctx.addCoins(500);
    ctx.fx.word(200, 180, '+500 COINS!');
  },
};
