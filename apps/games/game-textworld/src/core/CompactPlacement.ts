import type { ICollisionEngine } from './CollisionEngine';
import {
  rectBottom,
  rectRight,
  type Direction,
  type Rect,
  type TextBlock,
  type WorldBounds,
} from './types';

/** 从已有矩形的接触边选择紧贴位置，优先利用世界内部空白，再向外扩展。 */
export function compactPosition(
  preferred: Rect,
  direction: Direction,
  blocks: readonly TextBlock[],
  bounds: WorldBounds,
  gap: number,
  collision: ICollisionEngine,
  score?: (rect: Rect) => number,
): Rect {
  const last = blocks[blocks.length - 1];
  if (!last) return preferred;
  const origin = blocks[0];
  const centerX = origin.x + origin.width / 2;
  const centerY = origin.y + origin.height / 2;
  let best = preferred;
  let bestCost = Infinity;
  let bestDistance = Infinity;
  const consider = (x: number, y: number): void => {
    const rect = { ...preferred, x, y };
    if (collision.hasCollision(rect, blocks)) return;
    const width = Math.max(bounds.maxX, x + rect.width) - Math.min(bounds.minX, x);
    const height = Math.max(bounds.maxY, y + rect.height) - Math.min(bounds.minY, y);
    const cost = score ? score(rect) : width * height + Math.max(width, height) ** 2 / 2;
    const distance = Math.hypot(x + rect.width / 2 - centerX, y + rect.height / 2 - centerY);
    if (cost < bestCost || (cost === bestCost && distance < bestDistance)) {
      best = rect;
      bestCost = cost;
      bestDistance = distance;
    }
  };
  consider(preferred.x, preferred.y);
  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i];
    const xs = [
      block.x,
      rectRight(block) - preferred.width,
      Math.max(
        block.x - preferred.width,
        Math.min(rectRight(block), centerX - preferred.width / 2),
      ),
    ];
    const ys = [
      block.y,
      rectBottom(block) - preferred.height,
      Math.max(
        block.y - preferred.height,
        Math.min(rectBottom(block), centerY - preferred.height / 2),
      ),
    ];
    const edges: Record<Direction, () => void> = {
      BOTTOM: () => xs.forEach((x) => consider(x, rectBottom(block) + gap)),
      RIGHT: () => ys.forEach((y) => consider(rectRight(block) + gap, y)),
      TOP: () => xs.forEach((x) => consider(x, block.y - preferred.height - gap)),
      LEFT: () => ys.forEach((y) => consider(block.x - preferred.width - gap, y)),
    };
    edges[direction]();
    for (const edge of ['BOTTOM', 'RIGHT', 'TOP', 'LEFT'] as const)
      if (edge !== direction) edges[edge]();
  }
  return best;
}
