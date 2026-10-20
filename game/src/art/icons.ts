// Small icons for artifacts, consumables, coins and locks. Built with the same palette-bound kit as the sprites.
import Phaser from 'phaser';
import { Px, addTexture } from './textures';

export const iconKey = (id: string): string => `icon_${id}`;

export function registerIcons(scene: Phaser.Scene): void {
  const mk = (key: string, size: number, draw: (p: Px) => void, outline = true): void => {
    if (scene.textures.exists(key)) return;
    const p = new Px(size, size);
    draw(p);
    if (outline) p.outline();
    addTexture(scene, key, p);
  };

  // artifacts (12x12)
  mk(iconKey('r_gale_eye'), 12, (p) => {
    p.disc(7, 6, 4.4, ['c', 'b', 'a']);
    p.disc(7, 6, 2.2, 'c');
    p.rect(7, 5, 2, 2, '0');
    p.line(0, 4, 2, 4, 'b'); p.line(0, 7, 3, 7, 'b'); p.line(1, 10, 3, 10, 'b');
  });
  mk(iconKey('r_echo_stone'), 12, (p) => {
    p.disc(7.5, 4.5, 3.8, 'b');
    p.disc(5, 7, 4.2, ['c', 'd', 'e']);
    p.set(3, 5, 'c');
  });
  mk(iconKey('r_lodestone_bracer'), 12, (p) => {
    p.rect(1, 1, 3, 9, '2'); p.rect(8, 1, 3, 9, '2'); p.rect(1, 8, 10, 3, '2');
    p.rect(4, 1, 4, 7, '.');
    p.rect(1, 1, 3, 3, 'c'); p.rect(8, 1, 3, 3, 'c');
    p.rect(1, 8, 10, 1, '3');
  });
  mk(iconKey('r_analyst_lens'), 12, (p) => {
    p.disc(5, 5, 4.6, 'c');
    p.disc(5, 5, 3.2, 'a');
    p.set(3, 3, 'c'); p.set(4, 3, 'c'); p.set(3, 4, 'c');
    p.line(8, 8, 11, 11, 'g'); p.line(9, 8, 11, 10, 'g');
  });
  mk(iconKey('r_stormcaller_torc'), 12, (p) => {
    p.poly([[8, 0], [3, 7], [6, 7], [4, 12], [10, 4], [7, 4], [9, 0]], '4');
    p.line(8, 1, 5, 6, 'c');
  });
  mk(iconKey('r_gamblers_charm'), 12, (p) => {
    p.rectT(1, 1, 10, 10, ['3', '2', 'q']);
    for (const [x, y] of [[3, 3], [8, 3], [5, 5], [3, 8], [8, 8]]) p.rect(x, y, 2, 2, 'c');
  });

  // consumables (12x12)
  mk(iconKey('c_jury_rigged_bomb'), 12, (p) => {
    p.disc(6, 7, 4.6, ['e', 'm', 'f']);
    p.line(8, 3, 10, 1, 'g');
    p.rect(10, 0, 2, 2, '4');
    p.set(4, 5, 'c'); p.set(5, 5, 'c');
  });
  mk(iconKey('c_prime_serum'), 12, (p) => {
    p.rect(4, 0, 4, 3, 'g');
    p.rectT(2, 3, 8, 9, ['5', '6', 'n']);
    p.rect(3, 4, 2, 1, 'c'); p.rect(3, 5, 1, 3, 'c');
  });
  mk(iconKey('c_mindflash'), 12, (p) => {
    p.disc(6, 6, 2.6, 'c');
    p.line(6, 0, 6, 3, '4'); p.line(6, 9, 6, 11, '4'); p.line(0, 6, 3, 6, '4'); p.line(9, 6, 11, 6, '4');
    p.line(1, 1, 3, 3, '3'); p.line(10, 1, 8, 3, '3'); p.line(1, 10, 3, 8, '3'); p.line(10, 10, 8, 8, '3');
  });
  mk(iconKey('c_chainward_talisman'), 12, (p) => {
    p.disc(4.5, 4.5, 3.8, ['c', 'd', 'e']); p.disc(4.5, 4.5, 1.7, '.');
    p.disc(7.5, 7.5, 3.8, ['c', 'd', 'e']); p.disc(7.5, 7.5, 1.7, '.');
  });

  // coin and lock (small, no outline needed on the coin)
  mk('icon_coin', 7, (p) => {
    p.disc(3.5, 3.5, 3.4, ['4', '4', '3']);
    p.rect(3, 2, 1, 3, '3');
  }, false);
  mk('icon_lock', 9, (p) => {
    p.rect(2, 1, 5, 1, 'd'); p.rect(2, 2, 1, 3, 'd'); p.rect(6, 2, 1, 3, 'd');
    p.rect(1, 4, 7, 5, 'e'); p.rect(1, 4, 7, 1, 'd'); p.rect(4, 6, 1, 2, '0');
  });
}
