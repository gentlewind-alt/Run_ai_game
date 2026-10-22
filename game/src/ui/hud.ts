// Battle HUD on the fixed UI camera: coins, score, escapes, mute, pause, view-all, ability button, item tray, hint,
// the MASH banner and the pause menu.
import Phaser from 'phaser';
import { C } from '../art/palette';
import { setText, text, textBlock } from '../art/font5x7';
import { sfx } from '../audio/sfx';
import { msToNextBeat } from '../audio/beat';
import { H, W } from '../config/constants';
import { setMuted, profile } from '../core/profile';
import { platform } from '../platform';
import { makeButton, panel, type Btn } from './widgets';
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
  showPause(h: { resume: () => void; restart: () => void; map: () => void }): void;
  hidePause(): void;
  setMuted(m: boolean): void;
}

export function createHud(
  host: HudHost,
  o: {
    escapeLimit?: number; hint?: string; abilityLabel: string; onAbility: () => void; onToggleView: () => void; showZoom: boolean;
    consumables: { icon: string; label: string }[]; onUse: (i: number) => void; onPause: () => void;
  },
): Hud {
  const { scene } = host;
  const sa = platform.safeArea();
  const top = Math.max(6, sa.top * scene.scale.displayScale.y);

  let coinsTxt!: Phaser.GameObjects.Image;
  let scoreTxt!: Phaser.GameObjects.Image;
  let escTxt: Phaser.GameObjects.Image | undefined;
  let muteBtn!: Phaser.GameObjects.Image;
  let ability!: Btn;
  let pipCircle: Phaser.GameObjects.Arc | undefined;
  let bossBar: { container: Phaser.GameObjects.Container; nameTxt: Phaser.GameObjects.Image; fill: Phaser.GameObjects.Rectangle; bg: Phaser.GameObjects.Rectangle } | undefined;
  let targetTxt: Phaser.GameObjects.Image | undefined;
  const tray: { box: Phaser.GameObjects.Rectangle; icon: Phaser.GameObjects.Image }[] = [];
  let pauseObjs: Phaser.GameObjects.GameObject[] = [];

  host.inUi(() => {
    coinsTxt = text(scene, 8, top + 6, 'Coins 0', C('4')).setOrigin(0, 0.5).setDepth(10);
    scoreTxt = text(scene, 8, top + 18, 'Score 0', C('c')).setOrigin(0, 0.5).setDepth(10);
    if (o.escapeLimit !== undefined) {
      escTxt = text(scene, 8, top + 30, `Runners out 0/${o.escapeLimit}`, C('d')).setOrigin(0, 0.5).setDepth(10);
    }

    muteBtn = scene.add.image(W - 14, top + 6, sfx.muted ? 'spk_off' : 'spk_on').setDepth(10);
    muteBtn.setInteractive(new Phaser.Geom.Rectangle(-6, -10, 25, 27), Phaser.Geom.Rectangle.Contains);
    muteBtn.on('pointerdown', () => {
      sfx.unlock();
      setMuted(!profile.settings.muted);
      sfx.setMuted(profile.settings.muted);
      muteBtn.setTexture(sfx.muted ? 'spk_off' : 'spk_on');
      sfx.click();
    });

    const pauseBtn = scene.add.image(W - 38, top + 6, 'pause_icon').setDepth(10);
    pauseBtn.setInteractive(new Phaser.Geom.Rectangle(-8, -10, 25, 27), Phaser.Geom.Rectangle.Contains);
    pauseBtn.on('pointerdown', () => { sfx.unlock(); sfx.click(); o.onPause(); });

    if (o.showZoom) {
      const zoomBtn = scene.add.image(W - 62, top + 6, 'zoom_icon').setDepth(10);
      zoomBtn.setInteractive(new Phaser.Geom.Rectangle(-8, -10, 25, 27), Phaser.Geom.Rectangle.Contains);
      zoomBtn.on('pointerdown', () => { sfx.unlock(); sfx.click(); o.onToggleView(); });
    }

    ability = makeButton(scene, W - 40, H - 28, 62, 34, o.abilityLabel, 'ability', o.onAbility);
    ability.box.setVisible(false);

    // Consumable tray bottom-left row
    o.consumables.forEach((c, i) => {
      const x = 20 + i * 32;
      const box = scene.add.rectangle(x, H - 18, 26, 26, C('0')).setStrokeStyle(1, C('d')).setDepth(10).setInteractive();
      const icon = scene.add.image(x, H - 18, c.icon).setDepth(11);
      box.on('pointerdown', () => { sfx.unlock(); o.onUse(i); });
      tray.push({ box, icon });
    });

    if (o.hint) {
      const bubbleW = Math.min(260, W - 40);
      const bubbleH = 34;
      const bx = (W - bubbleW) / 2;
      const by = top + 26;
      const bubblePanel = panel(scene, bx, by, bubbleW, bubbleH, '8', '9', 'f', 10);
      const face = scene.add.image(bx + 14, by + bubbleH / 2, 'goblin_grunt').setScale(1.1).setDepth(11);
      const textLines = textBlock(scene, bx + 27, by + 10, o.hint, C('c'), bubbleW - 32, C('0'));
      textLines.forEach((t) => t.setOrigin(0, 0.5).setDepth(11));
      const bubbleTail = scene.add.triangle(bx + 20, by + bubbleH + 4, 0, 0, 8, 0, 4, 6, C('8')).setDepth(10);
      const allHint = [bubblePanel, face, ...textLines, bubbleTail];
      scene.tweens.add({
        targets: allHint,
        alpha: 0,
        delay: 5500,
        duration: 600,
        onComplete: () => allHint.forEach((h) => h.destroy()),
      });
    }
  });

  const ui: BattleUi = {
    setAbilityLabel: (label) => ability.setLabel(label),
    showAbility: (inAir, ready, scale, charges) => {
      ability.box.setVisible(inAir);
      if (charges !== undefined) {
        if (!pipCircle) {
          pipCircle = host.inUi(() => scene.add.circle(W - 18, H - 40, 3, C('4')).setStrokeStyle(1, C('0')).setDepth(12));
        }
        pipCircle.setVisible(inAir);
        pipCircle.setFillStyle(charges.left > 0 ? C('4') : C('f'));
        pipCircle.setScale(scale);
        if (charges.left <= 0) ready = false;
      } else {
        pipCircle?.setVisible(false);
      }
      ability.setEnabled(ready);
      ability.box.setScale(scale);
    },
    setBossHp: (hp, maxHp, name) => {
      if (hp <= 0) {
        bossBar?.container.setVisible(false);
        return;
      }
      if (!bossBar) {
        host.inUi(() => {
          const container = scene.add.container(W / 2, top + 6).setDepth(15);
          const bg = scene.add.rectangle(0, 10, 130, 7, C('0')).setStrokeStyle(1, C('4'));
          const fill = scene.add.rectangle(-63, 10, 126, 5, C('2')).setOrigin(0, 0.5);
          const nameTxt = text(scene, 0, 1, name ?? 'Boss', C('4'), 1, C('0')).setOrigin(0.5, 0.5);
          container.add([bg, fill, nameTxt]);
          bossBar = { container, nameTxt, fill, bg };
        });
      }
      if (bossBar) {
        bossBar.container.setVisible(true);
        if (name && bossBar.nameTxt) setText(bossBar.nameTxt, scene, name, C('4'));
        const frac = Math.max(0, Math.min(1, hp / maxHp));
        bossBar.fill.width = Math.max(1, Math.round(126 * frac));
      }
    },
    setEscaped: (escaped, limit) => {
      if (escTxt) setText(escTxt, scene, `Runners out ${escaped}/${limit}`, escaped > limit ? C('2') : C('d'));
    },
    setTargeting: (on, label) => {
      targetTxt?.destroy();
      targetTxt = undefined;
      tray.forEach((t) => t.box.setStrokeStyle(1, C('d')));
      if (on && label) {
        targetTxt = host.inUi(() => text(scene, W / 2, H - 42, label, C('4'), 1, C('0')).setDepth(12));
        scene.tweens.add({ targets: targetTxt, alpha: 0.4, duration: 360, yoyo: true, repeat: -1 });
      }
    },
    consumableUsed: (i) => {
      const t = tray[i];
      if (!t) return;
      t.icon.setAlpha(0.3);
      t.box.setStrokeStyle(1, C('f')).disableInteractive();
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
        platform.haptic('heavy');
        sfx.win();
        const [t, m] = host.inUi(() => [
          text(scene, W / 2, -20, 'MASH!', C('4'), 5, C('q')).setDepth(30),
          text(scene, W / 2, 108, `x${mult} combo`, C('c'), 1, C('0')).setDepth(30).setAlpha(0),
        ]);
        scene.tweens.add({
          targets: t, y: 78, duration: 220, ease: 'Back.out',
          onComplete: () => {
            scene.tweens.add({ targets: m, alpha: 1, duration: 120 });
            scene.tweens.add({ targets: [t, m], alpha: 0, delay: 800, duration: 300, onComplete: () => { t.destroy(); m.destroy(); } });
          },
        });
      });
    },

    showPause(h) {
      if (pauseObjs.length) return;
      host.inUi(() => {
        const dim = scene.add.rectangle(W / 2, H / 2, W, H, C('0'), 0.74).setDepth(40).setInteractive();
        const g = panel(scene, W / 2 - 90, 35, 180, 195, '8', '9', 'f', 41);
        const title = text(scene, W / 2, 54, 'Paused', C('4'), 2, C('0')).setDepth(42);
        const soundLabel = (): string => (profile.settings.muted ? 'Sound is off' : 'Sound is on');
        const sound = makeButton(scene, W / 2, 148, 126, 22, soundLabel(), 'plain', () => {
          setMuted(!profile.settings.muted);
          sfx.setMuted(profile.settings.muted);
          muteBtn.setTexture(sfx.muted ? 'spk_off' : 'spk_on');
          sound.setLabel(soundLabel());
        }, 42);
        pauseObjs = [
          dim, g, title, sound.box,
          makeButton(scene, W / 2, 88, 126, 26, 'Resume', 'go', () => { sfx.click(); h.resume(); }, 42).box,
          makeButton(scene, W / 2, 120, 126, 22, 'Restart', 'plain', () => { sfx.click(); h.restart(); }, 42).box,
          makeButton(scene, W / 2, 176, 126, 22, 'Back to map', 'plain', () => { sfx.click(); h.map(); }, 42).box,
        ];
      });
    },
    hidePause() {
      pauseObjs.forEach((p) => p.destroy());
      pauseObjs = [];
    },
    setMuted(m) {
      muteBtn.setTexture(m ? 'spk_off' : 'spk_on');
    },
  };
}
