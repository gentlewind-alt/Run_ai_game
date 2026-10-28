// Battle HUD on the fixed UI camera: coins, score, escapes, mute, pause, view-all, ability button, item tray, hint,
// the MASH banner and the pause menu.
import Phaser from 'phaser';
import { C } from '../art/palette';
import { fitText, setText, text, textBlock, textWidth } from '../art/font5x7';
import { sfx } from '../audio/sfx';
import { msToNextBeat } from '../audio/beat';
import { H, W } from '../config/constants';
import { TARGET } from '../config/target';
import { music } from '../audio/music';
import { setMuted, setMusicOn, profile } from '../core/profile';
import { platform } from '../platform';
import { makeButton, panel, uiIcon, type Btn } from './widgets';
import { helpButton } from './tutorial';
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
  showPause(h: { resume?: () => void; restart?: () => void; map: () => void; mapLabel?: string; title?: string }): void;
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
  const android = TARGET === 'android';
  const top = Math.max(android ? 12 : 6, sa.top * scene.scale.displayScale.y);
  const controlsY = top + (android ? 9 : 6);

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
    uiIcon(scene, 14, top + 6, 'coin', 'icon_coin', 12).setDepth(10);
    coinsTxt = text(scene, 24, top + 6, '0', C('4'), 1, C('0')).setOrigin(0, 0.5).setDepth(10);
    scoreTxt = text(scene, 8, top + 18, 'Score 0', C('c'), 1, C('0')).setOrigin(0, 0.5).setDepth(10);
    if (o.escapeLimit !== undefined) {
      escTxt = text(scene, 8, top + 30, fitText(`Runners out 0/${o.escapeLimit}`, 96), C('c'), 1, C('0')).setOrigin(0, 0.5).setDepth(10);
    }

    muteBtn = scene.add.image(W - (android ? 21 : 14), controlsY, sfx.muted ? 'spk_off' : 'spk_on').setDepth(10);
    muteBtn.setInteractive(android ? new Phaser.Geom.Rectangle(muteBtn.displayOriginX - 13, muteBtn.displayOriginY - 13, 26, 26) : new Phaser.Geom.Rectangle(-6, -10, 25, 27), Phaser.Geom.Rectangle.Contains);
    muteBtn.on('pointerdown', () => {
      sfx.unlock();
      setMuted(!profile.settings.muted);
      sfx.setMuted(profile.settings.muted);
      muteBtn.setTexture(sfx.muted ? 'spk_off' : 'spk_on');
      sfx.click();
    });

    const pauseBtn = scene.add.image(W - (android ? 45 : 38), controlsY, 'pause_icon').setDepth(10);
    pauseBtn.setInteractive(android ? new Phaser.Geom.Rectangle(pauseBtn.displayOriginX - 13, pauseBtn.displayOriginY - 13, 26, 26) : new Phaser.Geom.Rectangle(-8, -10, 25, 27), Phaser.Geom.Rectangle.Contains);
    pauseBtn.on('pointerdown', () => { sfx.unlock(); sfx.click(); o.onPause(); });

    if (o.showZoom) {
      const zoomBtn = scene.add.image(W - (android ? 69 : 62), controlsY, 'zoom_icon').setDepth(10);
      zoomBtn.setInteractive(android ? new Phaser.Geom.Rectangle(zoomBtn.displayOriginX - 13, zoomBtn.displayOriginY - 13, 26, 26) : new Phaser.Geom.Rectangle(-8, -10, 25, 27), Phaser.Geom.Rectangle.Contains);
      zoomBtn.on('pointerdown', () => { sfx.unlock(); sfx.click(); o.onToggleView(); });
    }

    ability = makeButton(scene, W - (android ? 41 : 40), H - 28, 62, 34, o.abilityLabel, 'ability', o.onAbility);
    ability.box.setVisible(false);

    // Consumable tray bottom-left row
    o.consumables.forEach((c, i) => {
      const x = (android ? 22 : 20) + i * 32;
      const y = H - (android ? 22 : 18);
      const box = scene.add.rectangle(x, y, 26, 26, C('0')).setStrokeStyle(1, C('d')).setDepth(10).setInteractive();
      const icon = scene.add.image(x, y, c.icon).setDepth(11);
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
      const textLines = textBlock(scene, bx + 27, by + 10, o.hint, C('c'), bubbleW - 38, C('0'), 2);
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
          pipCircle = host.inUi(() => scene.add.circle(ability.box.x + 22, ability.box.y - 12, 3, C('4')).setStrokeStyle(1, C('0')).setDepth(12));
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
      if (android) {
        ability.box.setPosition(W - Math.max(41, 8 + 32 * scale), H - Math.max(28, 8 + 19 * scale));
        pipCircle?.setPosition(ability.box.x + 22, ability.box.y - 12);
      }
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
          const nameTxt = text(scene, 0, 1, fitText(name ?? 'Boss', 138), C('4'), 1, C('0')).setOrigin(0.5, 0.5);
          container.add([bg, fill, nameTxt]);
          bossBar = { container, nameTxt, fill, bg };
        });
      }
      if (bossBar) {
        bossBar.container.setVisible(true);
        if (name && bossBar.nameTxt) setText(bossBar.nameTxt, scene, fitText(name, 138), C('4'), C('0'));
        const frac = Math.max(0, Math.min(1, hp / maxHp));
        bossBar.fill.width = Math.max(1, Math.round(126 * frac));
      }
    },
    setEscaped: (escaped, limit) => {
      if (escTxt) setText(escTxt, scene, fitText(`Runners out ${escaped}/${limit}`, 96), escaped > limit ? C('2') : C('c'), C('0'));
    },
    setTargeting: (on, label) => {
      targetTxt?.destroy();
      targetTxt = undefined;
      tray.forEach((t) => t.box.setStrokeStyle(1, C('d')));
      if (on && label) {
        targetTxt = host.inUi(() => text(scene, W / 2, H - 42, fitText(label, 220), C('4'), 1, C('0')).setDepth(12));
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
    setCoins: (n) => setText(coinsTxt, scene, fitText(String(n), 96), C('4'), C('0')),
    setScore: (n) => setText(scoreTxt, scene, fitText(`Score ${n}`, 112), C('c'), C('0')),

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
        const g = panel(scene, W / 2 - 90, 35, 180, 207, '8', '9', 'f', 41);
        const titleScale = textWidth(h.title ?? 'Paused') * 2 <= 110 ? 2 : 1;
        const title = text(scene, W / 2, 54, fitText(h.title ?? 'Paused', 110 / titleScale), C('4'), titleScale, C('0')).setDepth(42);
        const soundLabel = (): string => (profile.settings.muted ? 'Sound is off' : 'Sound is on');
        const sound = makeButton(scene, W / 2, 148, 126, 22, soundLabel(), 'plain', () => {
          setMuted(!profile.settings.muted);
          sfx.setMuted(profile.settings.muted);
          muteBtn.setTexture(sfx.muted ? 'spk_off' : 'spk_on');
          sound.setLabel(soundLabel());
        }, 42);
        const musicLabel = (): string => (profile.settings.musicOn === false ? 'Music is off' : 'Music is on');
        const musicBtn = makeButton(scene, W / 2, 174, 126, 22, musicLabel(), 'plain', () => {
          setMusicOn(profile.settings.musicOn === false);
          music.updateVolume();
          sfx.click();
          musicBtn.setLabel(musicLabel());
        }, 42);
        const fsLabel = (): string => (platform.fullscreen.active() ? 'Exit full screen' : 'Full screen');
        const fsBtn = platform.fullscreen.available()
          ? makeButton(scene, W / 2, 194, 126, 22, fsLabel(), 'plain', () => {
            void platform.fullscreen.toggle().then(() => {
              fsBtn?.setLabel(fsLabel());
              sfx.click();
              const why = platform.fullscreen.note();
              if (why) {
                const lines = textBlock(scene, W / 2, 248, why, C('c'), W - 40, C('0'), 1);
                lines.forEach((l) => l.setDepth(43));
                pauseObjs.push(...lines);
              }
            });
          }, 42)
          : undefined;
        sound.box.setY(138);
        musicBtn.box.setY(166);
        pauseObjs = [
          dim, g, title, sound.box, musicBtn.box,
          ...(h.resume ? [makeButton(scene, W / 2, 82, 126, 26, 'Resume', 'go', () => { sfx.click(); h.resume?.(); }, 42).box] : []),
          ...(h.restart ? [makeButton(scene, W / 2, 110, 126, 22, 'Restart', 'plain', () => { sfx.click(); h.restart?.(); }, 42).box] : []),
          makeButton(scene, W / 2, 222, 126, 22, h.mapLabel ?? 'Back to map', 'plain', () => { sfx.click(); h.map(); }, 42).box,
          ...(fsBtn ? [fsBtn.box] : []),
          helpButton(scene, W / 2 + 74, 47, ['battle', 'abilities', 'flight', 'reach', 'damage'], 44).box,
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
