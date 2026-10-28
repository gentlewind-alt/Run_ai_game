import Phaser from 'phaser';
import { C } from '../art/palette';
import { fitText, setText, text } from '../art/font5x7';
import { uiIcon } from './widgets';
import { events } from '../core/events';
import { profile } from '../core/profile';

/** Coin icon and total at (x, y), kept up to date while the scene is alive. Left-aligned. */
export function coinCounter(scene: Phaser.Scene, x: number, y: number, depth = 10): Phaser.GameObjects.Image {
  uiIcon(scene, x + 3, y, 'coin', 'icon_coin', 12).setDepth(depth);
  const t = text(scene, x + 13, y, fitText(String(profile.coins), 100), C('4'), 1, C('0')).setOrigin(0, 0.5).setDepth(depth);
  const off = events.on('profile:changed', () => setText(t, scene, fitText(String(profile.coins), 100), C('4'), C('0')));
  scene.events.once('shutdown', off);
  return t;
}
