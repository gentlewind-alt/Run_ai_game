// Consumables: one use per item per level, taken from the player's stock. Targeted ones wait for a tap in the world.
import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { CONSUMABLES } from '../content/consumables';
import { consumableCount, useConsumable } from '../core/profile';
import { data } from '../data/load';
import type { Params } from '../data/types';
import type { Ent } from './BattleCtx';
import { popWord } from './fx';
import type { BattleState } from './state';

/** The items the player owns, in data order. Built when the battle is created. */
export function buildConsumables(b: BattleState): void {
  b.consumables = data.content.consumables
    .filter((c) => consumableCount(c.id) > 0 && CONSUMABLES[c.id])
    .map((c) => ({ id: c.id, name: c.name, impl: CONSUMABLES[c.id], params: (c.params ?? {}) as Params, used: false }));
}

const usable = (b: BattleState): boolean => b.state === 'ready' || b.state === 'aiming' || b.state === 'flying' || b.state === 'settling' || b.state === 'loading';

/** The tray icon was pressed. */
export function pressConsumable(b: BattleState, i: number): void {
  const slot = b.consumables[i];
  if (!slot || slot.used || b.paused || !usable(b)) return;
  if (slot.impl.targeted) {
    // pressing it again cancels
    b.targeting = b.targeting === i ? null : i;
    b.ui.setTargeting(b.targeting !== null, slot.impl.pickRadius ? 'Tap a monster' : 'Tap where it should land');
    return;
  }
  spend(b, i);
}

function spend(b: BattleState, i: number, target?: { x: number; y: number; ent?: Ent }): void {
  const slot = b.consumables[i];
  slot.used = true;
  useConsumable(slot.id);
  b.targeting = null;
  b.ui.setTargeting(false);
  b.ui.consumableUsed(i);
  sfx.click();
  slot.impl.use(b.ctx, slot.params, target);
  b.view.free = false;
}

/** A tap in the world while a targeted item is armed. Returns true if the tap was taken. */
export function targetTap(b: BattleState, wx: number, wy: number): boolean {
  if (b.targeting === null) return false;
  const i = b.targeting;
  const slot = b.consumables[i];
  if (!slot) {
    b.targeting = null;
    return false;
  }
  let ent: Ent | undefined;
  if (slot.impl.pickRadius) {
    ent = b.ctx.nearestMonsters(wx, wy, 1)[0];
    const near = ent && Phaser.Math.Distance.Between(wx, wy, ent.body.position.x, ent.body.position.y) <= slot.impl.pickRadius(slot.params);
    if (!near) {
      popWord(b, wx, wy - 8, 'no monster there');
      return true;
    }
  }
  spend(b, i, { x: wx, y: wy, ent });
  return true;
}
