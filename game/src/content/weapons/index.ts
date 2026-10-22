import { blade } from './blade';
import { blastTube } from './blastTube';
import { boomerang } from './boomerang';
import { brahmastraArrow } from './brahmastraArrow';
import { bulwarkDisc } from './bulwarkDisc';
import { cleaver } from './cleaver';
import { cometFists } from './cometFists';
import { kineticPalms } from './kineticPalms';
import { omnitrixDial } from './omnitrixDial';
import { pike } from './pike';
import { scattergun } from './scattergun';
import { scepter } from './scepter';
import { silklineShooters } from './silklineShooters';
import { blackHoleMarble } from './blackHoleMarble';
import { chainRod } from './chainRod';
import { earthwormDrill } from './earthwormDrill';
import { hailstormCauldron } from './hailstormCauldron';
import { pinataMirv } from './pinataMirv';
import { rollingMillstone } from './rollingMillstone';
import { skyforgeMaul } from './skyforgeMaul';
import { staff } from './staff';
import { steersongArrow } from './steersongArrow';
import type { WeaponDef } from '../../data/types';
import type { WeaponImpl } from './types';

/** Behaviour per weapon id in content.json. Stats and numbers come from the data row. */
export const WEAPONS: Record<string, WeaponImpl> = {
  w_militia_blade: blade,
  w_iron_cleaver: cleaver,
  w_ashwood_staff: staff,
  w_scrapheap_scattergun: scattergun,
  w_hunters_pike: pike,
  w_hunters_boomerang: boomerang,
  w_blast_tube: blastTube,
  w_horned_scepter: scepter,
  w_comet_fists: cometFists,
  w_bulwark_disc: bulwarkDisc,
  w_skyforge_maul: skyforgeMaul,
  w_steersong_arrow: steersongArrow,
  w_silkline_shooters: silklineShooters,
  w_kinetic_palms: kineticPalms,
  w_brahmastra_arrow: brahmastraArrow,
  w_omnitrix_dial: omnitrixDial,
  w_pinata_mirv: pinataMirv,
  w_hailstorm_cauldron: hailstormCauldron,
  w_rolling_millstone: rollingMillstone,
  w_earthworm_drill: earthwormDrill,
  w_chain_rod: chainRod,
  w_black_hole_marble: blackHoleMarble,
};

/** The behaviour for a weapon row: `params.behavior` names another weapon's behaviour to reuse, otherwise the row's own id. */
export const weaponImpl = (def: WeaponDef): WeaponImpl => WEAPONS[(def.params as Record<string, unknown> | undefined)?.behavior as string] ?? WEAPONS[def.id] ?? blade;
