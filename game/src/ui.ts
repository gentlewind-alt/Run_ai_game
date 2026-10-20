import Phaser from 'phaser';
import { C } from './palette';
import { text, setText } from './font5x7';

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

/**
 * Chunky sticker button: Ink outline, top highlight, 2px shade. Sinks 1px when pressed.
 * Hit area is at least 26 internal px each way (about 44 css px on a phone).
 */
export function makeButton(
  scene: Phaser.Scene, x: number, y: number, w: number, h: number, label: string, kind: BtnKind,
  onClick: () => void, depth = 10,
): Btn {
  const [face, hl, sh] = KIND[kind];
  const g = scene.add.graphics();
  const draw = (on: boolean): void => {
    g.clear();
    g.fillStyle(C('0'), 1).fillRect(-w / 2 - 1, -h / 2 - 1, w + 2, h + 3);
    g.fillStyle(C(on ? sh : 'f'), 1).fillRect(-w / 2, -h / 2 + 2, w, h - 1);
    g.fillStyle(C(on ? face : 'e'), 1).fillRect(-w / 2, -h / 2, w, h - 2);
    g.fillStyle(C(on ? hl : 'd'), 1).fillRect(-w / 2, -h / 2, w, 1);
  };
  draw(true);
  const t = text(scene, 0, -1, label, C('c'), 1, C('0'));
  const inner = scene.add.container(0, 0, [g, t]);
  const box = scene.add.container(x, y, [inner]).setDepth(depth);
  const hw = Math.max(w, 26);
  const hh = Math.max(h, 26);
  box.setSize(hw, hh).setInteractive();
  let enabled = true;
  box.on('pointerdown', () => {
    if (enabled) inner.y = 1;
  });
  box.on('pointerout', () => { inner.y = 0; });
  box.on('pointerup', () => {
    if (!enabled) return;
    inner.y = 0;
    onClick();
  });
  return {
    box,
    setLabel: (s: string) => setText(t, scene, s, C('c'), C('0')),
    setEnabled: (on: boolean) => {
      enabled = on;
      draw(on);
      inner.y = 0;
    },
  };
}
