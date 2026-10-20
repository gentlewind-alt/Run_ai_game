// MASH combo: monsters killed within the combo window chain and multiply score and damage.
import type { BattleState } from './state';

const windowSteps = (b: BattleState): number => b.rules.comboWindowSeconds * 60;

export function comboMult(b: BattleState): number {
  if (!b.settings.features.combo) return 1;
  const list = b.rules.comboMultipliers;
  return list[Math.min(b.chain, list.length - 1)] ?? 1;
}

/** Once per gameplay step: the chain resets when the window runs out. */
export function step(b: BattleState): void {
  b.chainT++;
  if (b.chainT > windowSteps(b)) b.chain = 0;
}

/** Call when a monster dies, before scoring it. */
export function registerKill(b: BattleState): void {
  if (b.chainT < windowSteps(b)) b.chain++;
  else b.chain = 1;
  b.chainT = 0;
}

/** Call after scoring a monster kill: freezes the game for a beat and tells the HUD when the chain is big enough. */
export function announce(b: BattleState): void {
  if (!b.settings.features.combo || b.chain < b.tune.mashAt) return;
  b.hitStop = Math.max(b.hitStop, b.tune.mashHitStop);
  b.events.emit('combo', { count: b.chain, mult: comboMult(b) });
}
