import Phaser from 'phaser';
import { registerArt } from '../art';
import { gridTexture } from '../pix';
import { SPK_OFF, SPK_ON, STAR_OFF, STAR_ON, ZOOM_ICON } from '../sprites';
import { debugLevel, progress } from '../progress';

/** Loads data once, creates every shared texture, then hands over to the loadout picker. */
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload(): void {
    this.load.json('content', 'data/content.json');
    for (const n of [1, 2, 3, 4, 99]) this.load.json(`level${n}`, `data/level_${String(n).padStart(2, '0')}.json`);
  }

  create(): void {
    registerArt(this);
    gridTexture(this, 'spk_on', SPK_ON);
    gridTexture(this, 'spk_off', SPK_OFF);
    gridTexture(this, 'zoom_icon', ZOOM_ICON);
    gridTexture(this, 'star_on', STAR_ON);
    gridTexture(this, 'star_off', STAR_OFF);
    if (!this.textures.exists('px')) {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 1;
      cv.getContext('2d')!.fillStyle = '#fff';
      cv.getContext('2d')!.fillRect(0, 0, 1, 1);
      this.textures.addCanvas('px', cv);
    }
    if (debugLevel) this.scene.start('game', { level: debugLevel, loadout: ['w_militia_blade', 'w_iron_cleaver', 'w_ashwood_staff', 'w_blast_tube'] });
    else this.scene.start('loadout', { level: progress.level });
  }
}
