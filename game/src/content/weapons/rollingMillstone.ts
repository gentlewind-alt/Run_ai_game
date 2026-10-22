import { weaponTexture } from '../../art/textures';
import { blade } from './blade';
import type { WeaponImpl } from './types';

/**
 * Rolling Millstone (rare): the Blade's rolling behaviour on a heavy stone wheel. The tap sends it rolling along the ground
 * for 1.5 s, crushing blocks and monsters in its path; the heavier, slower roll and wider crush radius are in the data row.
 */
export const rollingMillstone: WeaponImpl = { ...blade, texture: weaponTexture('w_rolling_millstone') };
