import Phaser from 'phaser';
import { registerIcons } from '../art/icons';
import { applyGeneratedSprites, preloadGeneratedSprites } from '../art/generatedSprites';
import { registerArt } from '../art/textures';
import { gridTexture } from '../art/pix';
import { PAUSE_ICON, SPK_OFF, SPK_ON, STAR_OFF, STAR_ON, ZOOM_ICON } from '../art/sprites';
import { sfx } from '../audio/sfx';
import { checkRegistries } from '../content/validate';
import { DEBUG, debugLevel, profile, startLevelParam } from '../core/profile';

/** Creates every shared texture (data and save are already loaded by main.ts), then opens the title. */
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload(): void {
    preloadGeneratedSprites(this);
  }

  create(): void {
    if ((import.meta as any).env?.DEV) checkRegistries();
    registerArt(this);
    applyGeneratedSprites(this);
    registerIcons(this);
    gridTexture(this, 'spk_on', SPK_ON);
    gridTexture(this, 'spk_off', SPK_OFF);
    gridTexture(this, 'zoom_icon', ZOOM_ICON);
    gridTexture(this, 'pause_icon', PAUSE_ICON);
    gridTexture(this, 'star_on', STAR_ON);
    gridTexture(this, 'star_off', STAR_OFF);
    if (!this.textures.exists('px')) {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 1;
      cv.getContext('2d')!.fillStyle = '#fff';
      cv.getContext('2d')!.fillRect(0, 0, 1, 1);
      this.textures.addCanvas('px', cv);
    }
    sfx.setMuted(profile.settings.muted);
    const owned = profile.owned.weapons;
    const loadout = (profile.equipped.loadout.length ? profile.equipped.loadout : Array.from({ length: 4 }, (_, i) => owned[i % owned.length])).slice();
    if (debugLevel) this.scene.start('game', { level: debugLevel, loadout });
    else if (DEBUG && startLevelParam) this.scene.start('game', { level: startLevelParam, loadout });
    else this.scene.start('title');
  }
}
