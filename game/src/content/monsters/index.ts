import type { MonsterDef } from '../../data/types';
import { archer } from './archer';
import { basic } from './basic';
import { bomber } from './bomber';
import { hexer } from './hexer';
import { imp } from './imp';
import { runner } from './runner';
import { troll } from './troll';
import { ironWarlord } from './ironWarlord';
import { goblinChief } from './goblinChief';
import { darkElfMatron } from './darkElfMatron';
import type { MonsterBehavior } from './types';

/** Behaviours keyed by the monster row's `behavior` (default: the monster id, then 'basic'). */
export const MONSTERS: Record<string, MonsterBehavior> = {
  basic, bomber, archer, hexer, runner, imp, troll,
  iron_warlord: ironWarlord,
  goblin_chief: goblinChief,
  dark_elf_matron: darkElfMatron,
};

export const behaviorFor = (def: MonsterDef): MonsterBehavior => MONSTERS[def.behavior ?? def.id] ?? basic;
