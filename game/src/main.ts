import Phaser from 'phaser';
import GameScene, { W, H } from './scenes/GameScene';
import BootScene from './scenes/BootScene';
import LoadoutScene from './scenes/LoadoutScene';
import './style.css';
import RundotGameAPI from "@series-inc/rundot-game-sdk/api";
import { sfx } from './audio';

let bootStep1Fired = false;

RundotGameAPI.lifecycles.onPause(() => {
  sfx.suspend();
  RundotGameAPI.analytics.recordCustomEvent('game_paused');
});
RundotGameAPI.lifecycles.onResume(() => {
  sfx.resume();
  RundotGameAPI.analytics.recordCustomEvent('game_resumed');
});
RundotGameAPI.lifecycles.onSleep(() => {
  RundotGameAPI.analytics.recordCustomEvent('game_sleep');
});
RundotGameAPI.lifecycles.onQuit(() => {
  RundotGameAPI.analytics.recordCustomEvent('game_quit');
});

async function bootstrap(): Promise<void> {
  try {
    // Create Phaser game
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: W,
      height: H,
      parent: "app",
      backgroundColor: "#1a1c2c",
      pixelArt: true,
      scene: [BootScene, LoadoutScene, GameScene],
      physics: {
        default: "matter",
        matter: {
          gravity: { x: 0, y: 1 },
          enableSleeping: true,
          autoUpdate: false,
          positionIterations: 8,
          velocityIterations: 6,
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
    RundotGameAPI.analytics.recordCustomEvent('game_loaded');
    if (!bootStep1Fired) {
      bootStep1Fired = true;
      RundotGameAPI.analytics.trackFunnelStep(1, 'game_loaded', 'boot', 1);
    }
    RundotGameAPI.log("[Main] Phaser game created");
  } catch (error) {
    console.error("[Main] Bootstrap error:", error);
  }
}

// Start the app
bootstrap();
