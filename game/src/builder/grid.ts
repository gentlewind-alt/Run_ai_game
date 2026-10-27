import type { BuilderConfig, LevelBlock, LevelMonster } from '../data/types';

export type GridPoint = { x: number; y: number };
type GridConfig = Pick<BuilderConfig, 'grid' | 'minX' | 'minY' | 'worldW' | 'groundY'>;

export function cellAt(point: GridPoint, config: GridConfig): { x: number; y: number; w: number; h: number } | undefined {
  if (point.x < config.minX || point.x >= config.worldW || point.y < config.minY || point.y >= config.groundY) return undefined;
  return {
    x: config.minX + Math.floor((point.x - config.minX) / config.grid) * config.grid,
    y: config.minY + Math.floor((point.y - config.minY) / config.grid) * config.grid,
    w: config.grid,
    h: config.grid,
  };
}

export function quarterTurn(angle: number, direction = 1): number {
  return ((Math.round(angle / 90) * 90 + direction * 90) % 360 + 360) % 360;
}

/** Align the rotated footprint's edges to cells, including one-cell-wide posts. */
export function gridBlock(block: LevelBlock, point: GridPoint, config: GridConfig): LevelBlock {
  const angle = quarterTurn(block.angle ?? 0, 0);
  const halfW = (angle % 180 === 0 ? block.w : block.h) / 2;
  const halfH = (angle % 180 === 0 ? block.h : block.w) / 2;
  const left = config.minX + Math.round((point.x - halfW - config.minX) / config.grid) * config.grid;
  const top = config.minY + Math.round((point.y - halfH - config.minY) / config.grid) * config.grid;
  return { ...block, angle, x: left + halfW, y: top + halfH };
}

/** Targets occupy a column with their feet resting on a horizontal grid line. */
export function gridTarget(target: LevelMonster, point: GridPoint, size: { w: number; h: number }, config: GridConfig): LevelMonster {
  return {
    ...target,
    x: config.minX + (Math.floor((point.x - config.minX) / config.grid) + 0.5) * config.grid,
    y: config.minY + Math.round((point.y + size.h / 2 - config.minY) / config.grid) * config.grid - size.h / 2,
  };
}
