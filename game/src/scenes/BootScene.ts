import Phaser from 'phaser';
import { registerIcons } from '../art/icons';
import { applyGeneratedSprites, ensureMonsterTextures, preloadGeneratedSprites } from '../art/generatedSprites';
import { makeBattleTextures, registerArt } from '../art/textures';
import { gridTexture } from '../art/pix';
import { PAUSE_ICON, SPK_OFF, SPK_ON, STAR_OFF, STAR_ON, ZOOM_ICON } from '../art/sprites';
import { sfx } from '../audio/sfx';
import { checkRegistries } from '../content/validate';
import { DEBUG, debugLevel, loadoutSize, profile, startLevelParam } from '../core/profile';
import { targetAgeGate } from '@target-platform';
import { platform } from '../platform';
import { data } from '../data/load';

/** Creates every shared texture (data and save are already loaded by main.ts), then opens the title. */
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  private failed: { key: string; url: string }[] = [];
  private retries = 0;

  preload(): void {
    this.load.on('loaderror', (f: Phaser.Loader.File) => this.failed.push({ key: f.key, url: String(f.url) }));
    preloadGeneratedSprites(this);
    for (const m of data.content.monsters) for (const name of Object.keys(m.anim ?? {})) this.load.image(`${m.id}_${name}_strip`, `sprites/monsters/anim/${m.id}_${name}.png`);
    const ui = ['button_go', 'button_plain', 'button_gold', 'panel', 'emblem', 'backdrop',
      ...['play', 'shop', 'forge', 'build', 'arena', 'challenge', 'daily', 'coin', 'star', 'back', 'settings', 'lock', 'music', 'help', 'map'].map((name) => `icon_${name}`)];
    for (const name of ui) this.load.image(`ui_${name}`, `sprites/ui/ui_${name}.png`);
    // Backdrop plates (concept-art scenery)
    const BG_STYLES = ['hills', 'wood', 'keep', 'frost', 'ember', 'sky'];
    for (const style of BG_STYLES) {
      this.load.image(`bg_${style}`, `sprites/bg/${style}.png`);
    }
  }

  create(): void {
    // A sprite that failed to load (blocked or a network hiccup) gets two more tries before the placeholder art is used.
    if (this.failed.length && this.retries++ < 2) {
      const again = this.failed;
      this.failed = [];
      again.forEach((f) => this.load.image(f.key, f.url));
      this.load.once('complete', () => this.create());
      this.load.start();
      return;
    }
    if ((import.meta as any).env?.DEV) checkRegistries();
    registerArt(this);
    makeBattleTextures(this, []);
    applyGeneratedSprites(this);
    ensureMonsterTextures(this);
    // Monster animation strips (idle / fly / run): square frames side by side. A strip that failed to load is skipped and the still sprite stays.
    for (const m of data.content.monsters) {
      for (const [name, a] of Object.entries(m.anim ?? {})) {
        const key = `${m.id}_${name}`;
        if (!this.textures.exists(`${key}_strip`) || this.textures.exists(key)) continue;
        const strip = this.textures.get(`${key}_strip`).getSourceImage() as HTMLImageElement;
        const size = strip.height;
        const count = strip.width / size;
        if (!(size > 0) || !Number.isInteger(count) || count < 1) continue;
        this.textures.addSpriteSheet(key, strip, { frameWidth: size, frameHeight: size, endFrame: count - 1 });
        if (!this.anims.exists(key)) this.anims.create({ key, frames: this.anims.generateFrameNumbers(key), frameRate: a.fps, repeat: -1 });
      }
    }
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
    const loadout = (profile.equipped.loadout.length ? profile.equipped.loadout : Array.from({ length: loadoutSize() }, (_, i) => owned[i % owned.length])).slice();
    if (debugLevel) this.scene.start('game', { level: debugLevel, loadout });
    else if (DEBUG && startLevelParam) this.scene.start('game', { level: startLevelParam, loadout });
    else void this.startTitle();
  }

  /** The Android app asks the player's age once (scenes/AgeScene.ts) before the title; every other build goes straight there. */
  private async startTitle(): Promise<void> {
    const ageAsked = !targetAgeGate || !!(await platform.storage.get(targetAgeGate.key));
    this.scene.start(ageAsked ? 'title' : 'age');
  }
}
