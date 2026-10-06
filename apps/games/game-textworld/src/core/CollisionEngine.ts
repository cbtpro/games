import type { Direction, Point, Rect, TextBlock } from './types';

/** 矩形碰撞与位置搜索，接收旋转后的布局尺寸。 */

export interface CollisionConfig {
  /** 块与块之间保留的安全间距 */
  safeGap: number;
  /** 位置被占时，每步挪多远再试 */
  searchStep: number;
  /** 最多试多少步，防止死循环 */
  maxSearchSteps: number;
}

export const DEFAULT_COLLISION_CONFIG: CollisionConfig = {
  safeGap: 16,
  searchStep: 12,
  maxSearchSteps: 100,
};

export interface ICollisionEngine {
  intersects(a: Rect, b: Rect): boolean;
  hasCollision(rect: Rect, blocks: readonly TextBlock[]): boolean;
  findFreePosition(rect: Rect, direction: Direction, blocks: readonly TextBlock[]): Point | null;
}

export class CollisionEngine implements ICollisionEngine {
  private readonly config: CollisionConfig;

  constructor(config: Partial<CollisionConfig> = {}) {
    this.config = { ...DEFAULT_COLLISION_CONFIG, ...config };
  }

  /** 把 b 向外扩 safeGap 再判断，等价于「两块距离是否小于 safeGap」 */
  intersects(a: Rect, b: Rect): boolean {
    const gap = this.config.safeGap;

    const left = b.x - gap;
    const top = b.y - gap;
    const right = b.x + b.width + gap;
    const bottom = b.y + b.height + gap;

    return !(a.x + a.width <= left || a.x >= right || a.y + a.height <= top || a.y >= bottom);
  }

  hasCollision(rect: Rect, blocks: readonly TextBlock[]): boolean {
    for (const block of blocks) {
      const target: Rect = {
        x: block.x,
        y: block.y,
        width: block.width,
        height: block.height,
      };
      if (this.intersects(rect, target)) return true;
    }
    return false;
  }

  /**
   * 沿当前方向一步步挪，直到找到不冲突的位置。
   *
   * 使用线性碰撞扫描，并限制搜索步数。
   */
  findFreePosition(rect: Rect, direction: Direction, blocks: readonly TextBlock[]): Point | null {
    const candidate: Rect = { ...rect };

    for (let step = 0; step < this.config.maxSearchSteps; step += 1) {
      if (!this.hasCollision(candidate, blocks)) {
        return { x: candidate.x, y: candidate.y };
      }
      shift(candidate, direction, this.config.searchStep);
    }

    return null;
  }
}

export function shift(rect: Rect, direction: Direction, distance: number): void {
  switch (direction) {
    case 'RIGHT':
      rect.x += distance;
      break;
    case 'LEFT':
      rect.x -= distance;
      break;
    case 'BOTTOM':
      rect.y += distance;
      break;
    case 'TOP':
      rect.y -= distance;
      break;
  }
}
