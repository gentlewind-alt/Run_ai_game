import type Phaser from 'phaser';
import { gridTexture } from './pix';

/** One alien forearm, fist pointing down. 0 = outline, D = dark, M = mid, L = light (replaced per arm kind). */
const ARM = [
  '..000000..',
  '.0DDDDDD0.',
  '.0LMMMMD0.',
  '.0LMMMMD0.',
  '..0DDDD0..',
  '.0LMMMMD0.',
  '.0LMMMMD0.',
  '.0LMMMMD0.',
  '.0LMLLMD0.',
  '.0LMMMMD0.',
  '.0LMMMMD0.',
  '.0LMMMMD0.',
  '.0LMLLMD0.',
  '.0LMMMMD0.',
  '.0LMMMMD0.',
  '.0LMMMMD0.',
  '0LLMMMMDD0',
  '0LMMMMMMD0',
  '0LMLMLMMD0',
  '0LMMMMMMD0',
  '0MMMMMMMD0',
  '0MMMMMMDD0',
  '.0MMMMDD0.',
  '..0DDDD0..',
  '...0000...',
];

/** Palette chars (dark, mid, light) for each of the five arms the Omnitrix Dial drops. */
export const OMNI_ARM_COLORS: Record<string, [string, string, string]> = {
  fire: ['2', '3', '4'],
  brute: ['n', '6', '5'],
  crystal: ['7', 'a', 'b'],
  stone: ['e', 'd', 'c'],
  lightning: ['3', '4', 't'],
};

export const omniArmKey = (kind: string): string => `omni_arm_${kind}`;

export function registerOmnitrixTextures(scene: Phaser.Scene): void {
  for (const [kind, [d, m, l]] of Object.entries(OMNI_ARM_COLORS)) {
    const rows = ARM.map((r) => [...r].map((ch) => (ch === 'D' ? d : ch === 'M' ? m : ch === 'L' ? l : ch)).join(''));
    gridTexture(scene, omniArmKey(kind), rows);
  }
}
