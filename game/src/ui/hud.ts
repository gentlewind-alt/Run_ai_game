// Battle HUD on the fixed UI camera: coins, score, escapes, mute, view-all, ability button, hint, MASH banner and the results panel.
import Phaser from 'phaser';
import { C } from '../art/palette';
import { setText, text, textBlock } from '../art/font5x7';
import { sfx } from '../audio/sfx';
import { msToNextBeat } from '../audio/beat';
import { H, W } from '../config/constants';
import { setMuted, profile } from '../core/profile';
import { platform } from '../platform';
import { makeButton, type Btn } from './widgets';
import type { BattleUi } from '../battle/state';

/** What the HUD needs from the scene hosting the battle. */
export interface HudHost {
  scene: Phaser.Scene;
  /** Run `fn` with newly created objects routed to the fixed UI camera. */
  inUi<T>(fn: () => T): T;
}

export interface Hud {
  ui: BattleUi;
  setCoins(n: number): void;
  setScore(n: number): void;
  mash(mult: number): void;
}

export function createHud(
  host: HudHost,
  o: { escapeLimit?: number; hint?: string; abilityLabel: string; onAbility: () => void; onToggleView: () => void; showZoom: boolean },
): Hud {
  const { scene } = host;
  const sa = platform.safeArea();
  const top = Math.max(6, sa.top * scene.scale.displayScale.y);

  let coinsTxt!: Phaser.GameObjects.Image;
  let scoreTxt!: Phaser.GameObjects.Image;
  let escTxt: Phaser.GameObjects.Image | undefined;
  let muteBtn!: Phaser.GameObjects.Image;
  let ability!: Btn;

  host.inUi(() => {
    coinsTxt = text(scene, 4, top + 5, 'Coins 0', C('4')).setOrigin(0, 0.5).setDepth(10);
    scoreTxt = text(scene, 4, top + 17, 'Score 0', C('c')).setOrigin(0, 0.5).setDepth(10);
    if (o.escapeLimit !== undefined) escTxt = text(scene, 4, top + 29, `Escaped 0 of ${o.escapeLimit}`, C('d')).setOrigin(0, 0.5).setDepth(10);

    muteBtn = scene.add.image(W - 10, top + 4, sfx.muted ? 'spk_off' : 'spk_on').setDepth(10);
    muteBtn.setInteractive(new Phaser.Geom.Rectangle(-6, -10, 25, 27), Phaser.Geom.Rectangle.Contains);
    muteBtn.on('pointerdown', () => {
      sfx.unlock();
      setMuted(!profile.settings.muted);
      sfx.setMuted(profile.settings.muted);
      muteBtn.setTexture(sfx.muted ? 'spk_off' : 'spk_on');
      sfx.click();
    });
    if (o.showZoom) {
      const zoomBtn = scene.add.image(W - 30, top + 4, 'zoom_icon').setDepth(10);
      zoomBtn.setInteractive(new Phaser.Geom.Rectangle(-8, -10, 25, 27), Phaser.Geom.Rectangle.Contains);
      zoomBtn.on('pointerdown', () => { sfx.unlock(); sfx.click(); o.onToggleView(); });
    }

    ability = makeButton(scene, W - 30, H - 28, 52, 32, o.abilityLabel, 'ability', o.onAbility);
    ability.box.setVisible(false);

    if (o.hint) {
      const hint = textBlock(scene, W / 2, top + 44, o.hint, C('c'), 190, C('0'));
      hint.forEach((h) => h.setDepth(10));
      scene.tweens.add({ targets: hint, alpha: 0, delay: 5200, duration: 700, onComplete: () => hint.forEach((h) => h.destroy()) });
    }
  });

  const ui: BattleUi = {
    setAbilityLabel: (label) => ability.setLabel(label),
    showAbility: (inAir, ready, scale) => {
      ability.box.setVisible(inAir);
      ability.setEnabled(ready);
      ability.box.setScale(scale);
    },
    setEscaped: (escaped, limit) => {
      if (escTxt) setText(escTxt, scene, `Escaped ${escaped} of ${limit}`, escaped > limit ? C('2') : C('d'));
    },
  };

  return {
    ui,
    setCoins: (n) => setText(coinsTxt, scene, `Coins ${n}`, C('4')),
    setScore: (n) => setText(scoreTxt, scene, `Score ${n}`, C('c')),

    /** MASH! lands on the next beat: a white flash and shake, then the banner drops. */
    mash(mult) {
      const delay = msToNextBeat(scene.game.getTime());
      scene.time.delayedCall(Math.min(delay, 500), () => {
        scene.cameras.main.flash(120, 255, 255, 255);
        scene.cameras.main.shake(220, 0.012);
        sfx.win();
        const [t, m] = host.inUi(() => [
          text(scene, W / 2, -20, 'MASH!', C('4'), 5, C('q')).setDepth(30),
          text(scene, W / 2, 124, `x${mult} combo`, C('c'), 1, C('0')).setDepth(30).setAlpha(0),
        ]);
        scene.tweens.add({
          targets: t, y: 96, duration: 220, ease: 'Back.out',
          onComplete: () => {
            scene.tweens.add({ targets: m, alpha: 1, duration: 120 });
            scene.tweens.add({ targets: [t, m], alpha: 0, delay: 800, duration: 300, onComplete: () => { t.destroy(); m.destroy(); } });
          },
        });
      });
    },

  };
}
