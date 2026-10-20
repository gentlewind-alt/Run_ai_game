import Phaser from 'phaser';
import BattleScene from './scenes/BattleScene';
import BootScene from './scenes/BootScene';
import LoadoutScene from './scenes/LoadoutScene';
import MapScene from './scenes/MapScene';
import ResultsScene from './scenes/ResultsScene';
import ShopScene from './scenes/ShopScene';
import TitleScene from './scenes/TitleScene';
import './style.css';
import { sfx } from './audio/sfx';
import { H, W } from './config/constants';
import { getSettings, initSettings } from './config/settings';
import { DEBUG, applyDebug, wireProfile } from './core/profile';
import { loadSave, wireSave } from './core/save';
import { data, loadData } from './data/load';
import { platform } from './platform';

let bootStep1Fired = false;

platform.lifecycle.onPause(() => {
  sfx.suspend();
  platform.track('game_paused');
});
platform.lifecycle.onResume(() => {
  sfx.resume();
  platform.track('game_resumed');
});
platform.lifecycle.onSleep(() => platform.track('game_sleep'));
platform.lifecycle.onQuit(() => platform.track('game_quit'));

async function bootstrap(): Promise<void> {
  try {
    await platform.init();
    await loadData();
    initSettings(data.config, data.content);
    wireProfile();
    wireSave();
    await loadSave();
    applyDebug();
    const S = getSettings();
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: W,
      height: H,
      parent: 'app',
      backgroundColor: '#1a1c2c',
      pixelArt: S.display.pixelArt,
      scene: [BootScene, TitleScene, MapScene, LoadoutScene, ShopScene, BattleScene, ResultsScene],
      physics: {
        default: 'matter',
        matter: {
          gravity: { x: 0, y: S.physics.gravityY },
          enableSleeping: S.physics.enableSleeping,
          autoUpdate: false,
          positionIterations: S.physics.positionIterations,
          velocityIterations: S.physics.velocityIterations,
          debug: false,
        },
      },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    };

    const game = new Phaser.Game(config);
    if ((import.meta as any).env?.DEV) (window as any).__game = game;
    if ((import.meta as any).env?.DEV || DEBUG) void import('./debug/testHook').then((m) => m.installTestHook(game));
    platform.track('game_loaded');
    if (!bootStep1Fired) {
      bootStep1Fired = true;
      platform.funnel(1, 'game_loaded', 'boot');
    }
    platform.log('[Main] Phaser game created');
  } catch (error) {
    console.error('[Main] Bootstrap error:', error);
  }
}

// Start the app
bootstrap();
