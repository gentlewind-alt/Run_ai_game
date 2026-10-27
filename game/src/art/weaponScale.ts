import type Phaser from 'phaser';
import { getSettings } from '../config/settings';
import type { WeaponDef } from '../data/types';

export type WeaponSize = 'flight' | 'sling' | 'queue';

/** Generated weapon art (art/generatedSprites.ts) is 32 px, procedural art 16-24 px. */
const isRelicArt = (srcW: number): boolean => srcW >= 32;

/**
 * Scale that draws a weapon texture at the size in config.display.weapon (world px): the target is for 16 px art, and relic
 * art gets `relicBonus` on top so it reads as special without dwarfing goblins and planks. A weapon's own `display.px` sets
 * its flight size.
 */
export function weaponScale(scene: Phaser.Scene, textureKey: string, size: WeaponSize, def?: WeaponDef): number {
  const d = getSettings().display.weapon;
  const srcW = scene.textures.get(textureKey)?.getSourceImage()?.width ?? 16;
  let px = size === 'flight' ? (def?.display?.px ?? d.flightPx) : size === 'sling' ? d.slingPx : d.queuePx;
  if (isRelicArt(srcW) && !(size === 'flight' && def?.display?.px)) px *= d.relicBonus;
  return px / srcW;
}

/** Height in px of a queued weapon, for resting it on the ground. */
export function weaponHeight(scene: Phaser.Scene, textureKey: string, scale: number): number {
  return (scene.textures.get(textureKey)?.getSourceImage()?.height ?? 16) * scale;
}
