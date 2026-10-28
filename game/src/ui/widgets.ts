import Phaser from 'phaser';
import { C } from '../art/palette';
import { fitText, text, setText } from '../art/font5x7';
import { getSettings } from '../config/settings';
import { H, W } from '../config/constants';

export type BtnKind = 'go' | 'plain' | 'ability' | 'danger';

// face, highlight, shade (all Mash32)
const KIND: Record<BtnKind, [string, string, string]> = {
  go: ['6', '5', 'n'],
  plain: ['e', 'd', 'f'],
  ability: ['2', '3', 'q'],
  danger: ['q', '2', '1'],
};

export interface Btn {
  box: Phaser.GameObjects.Container;
  setLabel(s: string): void;
  setEnabled(on: boolean): void;
}

export type Panel = Phaser.GameObjects.Graphics | Phaser.GameObjects.NineSlice;

/** Optional menu art always has a drawn fallback. */
export function menuBackdrop(scene: Phaser.Scene): void {
  scene.add.rectangle(W / 2, H / 2, W, H, C('f'));
  if (scene.textures.exists('ui_backdrop')) scene.add.image(W / 2, H / 2, 'ui_backdrop')
    .setDisplaySize(W, H).setAlpha(getSettings().display.ui.backdropAlpha);
}

export function uiIcon(scene: Phaser.Scene, x: number, y: number, name: string, fallback: string, size = getSettings().display.ui.iconPx): Phaser.GameObjects.Image {
  const key = scene.textures.exists(`ui_icon_${name}`) ? `ui_icon_${name}` : fallback;
  return scene.add.image(x, y, key).setDisplaySize(size, size);
}

function buttonIcon(label: string): string | undefined {
  if (/^back|^title$/i.test(label)) return 'back';
  if (/^\?$|^help/i.test(label)) return 'help';
  if (/music/i.test(label)) return 'music';
  if (/settings|^sound/i.test(label)) return 'settings';
  if (/forge|create a weapon/i.test(label)) return 'forge';
  if (/build|create level/i.test(label)) return 'build';
  if (/arena/i.test(label)) return 'arena';
  if (/challenge/i.test(label)) return 'challenge';
  if (/daily/i.test(label)) return 'daily';
  if (/shop/i.test(label)) return 'shop';
  if (/^map$/i.test(label)) return 'map';
  if (/^play|^fling|^next level|^start turn/i.test(label)) return 'play';
  return undefined;
}

/**
 * Chunky sticker button: Ink outline, top highlight, 2px shade. Sinks 1px when pressed.
 * Hit area is at least 26 internal px each way (about 44 css px on a phone).
 */
export function makeButton(
  scene: Phaser.Scene, x: number, y: number, w: number, h: number, label: string, kind: BtnKind,
  onClick: () => void, depth = 10, iconName?: string,
): Btn {
  const ui = getSettings().display.ui;
  const [face, hl, sh] = KIND[kind];
  const g = scene.add.graphics();
  const key = kind === 'go' ? 'ui_button_go' : kind === 'ability' ? 'ui_button_gold' : 'ui_button_plain';
  const corner = Math.min(ui.buttonCorner, Math.floor(w / 2), Math.floor(h / 2));
  const skin = scene.textures.exists(key) ? scene.add.nineslice(0, 0, key, undefined, w, h, corner, corner, corner, corner) : undefined;
  const tint = (on: boolean, pressed = false): void => {
    skin?.setTint(!on ? C('d') : pressed ? C('d') : kind === 'danger' ? C('3') : 0xffffff);
    skin?.setAlpha(on ? 1 : ui.disabledAlpha);
    g.setAlpha(on ? pressed ? 0.75 : 1 : ui.disabledAlpha);
  };
  const draw = (on: boolean): void => {
    g.clear();
    tint(on);
    if (skin) return;
    g.fillStyle(C('0'), 1).fillRect(-w / 2 - 1, -h / 2 - 1, w + 2, h + 3);
    g.fillStyle(C(on ? sh : 'f'), 1).fillRect(-w / 2, -h / 2 + 2, w, h - 1);
    g.fillStyle(C(on ? face : 'e'), 1).fillRect(-w / 2, -h / 2, w, h - 2);
    g.fillStyle(C(on ? hl : 'd'), 1).fillRect(-w / 2, -h / 2, w, 1);
  };
  draw(true);
  const t = text(scene, 0, -1, '', C('c'), 1, C('0'));
  let enabled = true;
  let icon: Phaser.GameObjects.Image | undefined;
  const inner = scene.add.container(0, 0, [g, ...(skin ? [skin] : []), t]);
  const layoutLabel = (s: string): void => {
    icon?.destroy();
    icon = undefined;
    const name = iconName ?? buttonIcon(s);
    const padding = Math.min(ui.buttonPadding, w < 40 ? 3 : ui.buttonPadding);
    const size = Math.min(ui.iconPx, h - 6, w < 40 ? 8 : ui.iconPx);
    const hasIcon = name && scene.textures.exists(`ui_icon_${name}`);
    const room = w - padding * 2 - (hasIcon ? size + ui.iconGap : 0);
    const scale = s === 'PLAY' && w >= 130 ? 2 : 1;
    setText(t, scene, fitText(s, room / scale), C('c'), C('0'));
    t.setScale(scale);
    const total = t.displayWidth + (hasIcon ? size + ui.iconGap : 0);
    t.x = hasIcon ? (size + ui.iconGap) / 2 : 0;
    if (hasIcon) {
      icon = scene.add.image(-total / 2 + size / 2, -1, `ui_icon_${name}`).setDisplaySize(size, size).setAlpha(enabled ? 1 : ui.disabledAlpha);
      inner.add(icon);
    }
  };
  layoutLabel(label);
  const box = scene.add.container(x, y, [inner]).setDepth(depth);
  const hw = Math.max(w, 26);
  const hh = Math.max(h, 26);
  box.setSize(hw, hh).setInteractive();
  box.on('pointerdown', () => {
    if (enabled) { inner.y = 1; tint(true, true); }
  });
  box.on('pointerout', () => { inner.y = 0; tint(enabled); });
  box.on('pointerup', () => {
    if (!enabled) return;
    inner.y = 0;
    tint(true);
    onClick();
  });
  return {
    box,
    setLabel: layoutLabel,
    setEnabled: (on: boolean) => {
      enabled = on;
      draw(on);
      t.setAlpha(on ? 1 : ui.disabledAlpha);
      icon?.setAlpha(on ? 1 : ui.disabledAlpha);
      inner.y = 0;
    },
  };
}

/** Bevelled sticker panel with an Ink outline. (x, y) is the top-left corner. */
export function panel(
  scene: Phaser.Scene, x: number, y: number, w: number, h: number, face = '8', hl = '9', shade = 'f', depth = 0,
): Panel {
  if (scene.textures.exists('ui_panel')) {
    const corner = Math.min(getSettings().display.ui.panelCorner, Math.floor(w / 2), Math.floor(h / 2));
    return scene.add.nineslice(x + w / 2, y + h / 2, 'ui_panel', undefined, w, h, corner, corner, corner, corner).setDepth(depth);
  }
  const g = scene.add.graphics().setDepth(depth);
  g.fillStyle(C('0'), 1).fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle(C(shade), 1).fillRect(x, y, w, h);
  g.fillStyle(C(face), 1).fillRect(x, y, w, h - 2);
  g.fillStyle(C(hl), 1).fillRect(x, y, w, 1);
  return g;
}
