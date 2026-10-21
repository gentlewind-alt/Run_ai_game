import Phaser from 'phaser';
import { C, rarityColor, rarityStroke } from '../art/palette';
import { text } from '../art/font5x7';
import { panel } from './widgets';

export interface CardOptions {
  scene: Phaser.Scene;
  x: number;
  y: number;
  w: number;
  h?: number;
  icon: string;
  iconScale?: number;
  name: string;
  rarity?: string;
  selected?: boolean;
  locked?: boolean;
  isSilhouette?: boolean;
  onClick?: () => void;
}

export interface CardResult {
  panel: Phaser.GameObjects.Graphics;
  iconBox: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Image;
  nameTxt: Phaser.GameObjects.Image;
  hit: Phaser.GameObjects.Rectangle;
  objects: Phaser.GameObjects.GameObject[];
}

/** Standard item card used across Loadout and Shop grids. */
export function createItemCard(opts: CardOptions): CardResult {
  const h = opts.h ?? 38;
  const baseStroke = opts.rarity ? rarityStroke(opts.rarity) : '9';
  const stroke = opts.selected ? 'a' : baseStroke;
  const p = panel(opts.scene, opts.x, opts.y, opts.w, h, opts.selected ? '9' : '8', stroke, 'f', 1);
  if (opts.selected) {
    p.lineStyle(1, C('4'), 1).strokeRect(opts.x - 1, opts.y - 1, opts.w + 2, h + 2);
  }

  const iconBox = opts.scene.add.rectangle(opts.x + 15, opts.y + 19, 24, 30, C('0'))
    .setStrokeStyle(1, C(baseStroke)).setDepth(2);
  const icon = opts.scene.add.image(opts.x + 15, opts.y + 19, opts.icon)
    .setScale(opts.iconScale ?? 1.2).setDepth(2);
  if (opts.locked && (opts.isSilhouette || opts.icon.startsWith('wpn_'))) {
    icon.setTint(0x1a1c2c).setAlpha(0.6);
  }

  const nameColor = opts.locked ? C('e') : opts.rarity ? rarityColor(opts.rarity) : C('c');
  const nameTxt = text(opts.scene, opts.x + 31, opts.y + 10, opts.name, nameColor)
    .setOrigin(0, 0.5).setDepth(2);

  const hit = opts.scene.add.rectangle(opts.x + opts.w / 2, opts.y + h / 2, opts.w, h, 0xffffff, 0)
    .setDepth(3).setInteractive();
  if (opts.onClick) {
    hit.on('pointerdown', opts.onClick);
  }

  return {
    panel: p, iconBox, icon, nameTxt, hit,
    objects: [p, iconBox, icon, nameTxt, hit],
  };
}
