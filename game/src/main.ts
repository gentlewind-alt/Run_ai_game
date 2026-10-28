import ForgeScene from './scenes/ForgeScene';
import { loadForge } from './core/forge';
import Phaser from 'phaser';
import BattleScene from './scenes/BattleScene';
import BuilderScene from './scenes/BuilderScene';
import ArenaScene from './scenes/ArenaScene';
import PracticeScene from './scenes/PracticeScene';
import ChallengeScene from './scenes/ChallengeScene';
import ChallengesScene from './scenes/ChallengesScene';
import ChallengeWeaponsScene from './scenes/ChallengeWeaponsScene';
import BootScene from './scenes/BootScene';
import CreditsScene from './scenes/CreditsScene';
import LeaderboardScene from './scenes/LeaderboardScene';
import LoadoutScene from './scenes/LoadoutScene';
import MapScene from './scenes/MapScene';
import ExtraShotsScene from './scenes/ExtraShotsScene';
import ResultsScene from './scenes/ResultsScene';
import ShopScene from './scenes/ShopScene';
import TitleScene from './scenes/TitleScene';
import './style.css';
import { sfx } from './audio/sfx';
import { H, W, setLogicalWidth } from './config/constants';
import { TARGET } from './config/target';
import { feature, getSettings, initSettings } from './config/settings';
import { adminReady, onAdmin } from './core/admin';
import { DEBUG, applyDebug, setMuted, wireProfile } from './core/profile';
import { initResponsive } from './core/responsive';
import { loadSave, wireSave } from './core/save';
import { data, loadData } from './data/load';
import { platform } from './platform';
import { arena } from './core/arena';
import AgeScene from './scenes/AgeScene';
import { targetExit } from '@target-platform';
import { goTo } from './core/flow';

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
    await loadForge();
    applyDebug();
    const S = getSettings();
    if (TARGET === 'android') {
      // the app's own view size (immersive full screen), falling back to the physical screen
      const useView = window.innerWidth > 0 && window.innerHeight > 0;
      const width = useView ? window.innerWidth : window.screen.width;
      const height = useView ? window.innerHeight : window.screen.height;
      const longSide = Math.max(width, height);
      const shortSide = Math.max(1, Math.min(width, height));
      setLogicalWidth(Math.min(S.display.androidMaxWidth, Math.round(H * longSide / shortSide)));
    }
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: W,
      height: H,
      parent: 'app',
      backgroundColor: '#1a1c2c',
      pixelArt: S.display.pixelArt,
      roundPixels: true,
      scene: [BootScene, AgeScene, TitleScene, MapScene, LoadoutScene, ShopScene, ForgeScene, BattleScene, BuilderScene, ArenaScene, PracticeScene, ChallengesScene, ChallengeScene, ChallengeWeaponsScene, ExtraShotsScene, ResultsScene, CreditsScene, LeaderboardScene],
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
    if (feature('arena')) void arena.autoConnect();
    initResponsive(game);
    platform.lifecycle.onPause(() => {
      const battle = game.scene.getScene('game') as { setPaused?(on: boolean): void; scene?: { isActive(): boolean } } | null;
      if (battle?.scene?.isActive?.()) {
        battle.setPaused?.(true);
      }
    });
    // the Android back button: pause a battle, close the app from the title, otherwise go back to the title
    platform.lifecycle.onBack?.(() => {
      const active = game.scene.getScenes(true).filter((s) => s.scene.key !== 'boot');
      const battle = game.scene.getScene('game') as { setPaused?(on: boolean): void; scene?: { isActive(): boolean } } | null;
      if (battle?.scene?.isActive?.()) battle.setPaused?.(true);
      else if (active.some((s) => s.scene.key === 'title')) targetExit?.();
      else if (active.length) goTo(active[active.length - 1], 'title');
    });
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.code === 'KeyM' && !e.repeat) {
        sfx.unlock();
        const muted = !sfx.muted;
        sfx.setMuted(muted);
        setMuted(muted);
      }
    });
    if ((import.meta as any).env?.DEV) (window as any).__game = game;
    if ((import.meta as any).env?.DEV || DEBUG) void import('./debug/testHook').then((m) => m.installTestHook(game));
    if (DEBUG) {
      (window as any).__game = game;
      void import('./debug/debugPanel').then((m) => m.installDebugPanel(game));
    }
    // admin tools: only after the secret code was entered (see core/admin.ts); players never get them
    let adminTools = DEBUG;
    onAdmin(() => {
      if (adminTools) return;
      adminTools = true;
      (window as any).__game = game;
      void import('./debug/testHook').then((m) => m.installTestHook(game));
      void import('./debug/debugPanel').then((m) => m.installDebugPanel(game));
    });
    void adminReady;
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
