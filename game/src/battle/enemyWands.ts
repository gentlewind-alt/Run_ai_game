import { enemyWandPose } from '../content/monsters/wand';
import type { Ent } from './BattleCtx';
import type { BattleState } from './state';

export function createEnemyWand(b: BattleState, m: Ent): void {
  const W = m.def!.wand!;
  const color = parseInt(W.tipColor.slice(1), 16);
  const wand = b.scene.add.graphics().setDepth(m.sprite.depth + W.depthOffset);
  wand.lineStyle(W.shaftWidth, parseInt(W.woodColor.slice(1), 16));
  wand.lineBetween(0, 0, W.length, 0);
  wand.fillStyle(color, W.glowAlpha);
  wand.fillCircle(W.length, 0, W.glowRadius);
  wand.fillStyle(color);
  wand.fillCircle(W.length, 0, W.tipRadius);
  m.wand = wand;
  syncEnemyWand(m);
}

export function syncEnemyWand(m: Ent): void {
  if (!m.wand) return;
  const pose = enemyWandPose(m);
  m.wand.setPosition(pose.hand.x, pose.hand.y).setRotation(pose.angle);
}
