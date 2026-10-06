import {
  getWorldHeight,
  getWorldWidth,
  type Direction,
  type Rotation,
  type TextBlock,
  type WorldBounds,
} from './types';

/**
 * 旋转引擎：只回答「什么时候转 90°」。
 *
 * 规则：新句子太长、放不进当前方向的那一维时，就转 90° 并换下一个方向。
 * 于是文字会不断地「长一段 → 拐弯 → 再长一段」，整体形成螺旋。
 */

export interface RotationConfig {
  /** 超过当前方向可用长度的多少倍就转向 */
  threshold: number;
  /** 世界还很小的时候给一个下限，避免第一句就乱转 */
  minWorldSize: number;
}

export const DEFAULT_ROTATION_CONFIG: RotationConfig = {
  threshold: 1,
  minWorldSize: 160,
};

/** 顺时针螺旋：下 → 右 → 上 → 左 */
const NEXT_DIRECTION: Readonly<Record<Direction, Direction>> = {
  BOTTOM: 'RIGHT',
  RIGHT: 'TOP',
  TOP: 'LEFT',
  LEFT: 'BOTTOM',
};

const NEXT_ROTATION: Readonly<Record<Rotation, Rotation>> = {
  0: 90,
  90: 180,
  180: 270,
  270: 0,
};

/**
 * 判断是否转向只需要「原尺寸」这一个字段。
 * 用最小类型描述，布局时就不必为了探测而构造一个完整的 Block。
 */
export type RotationProbe = Pick<TextBlock, 'originalWidth'>;

export interface IRotationEngine {
  shouldRotate(block: RotationProbe, bounds: WorldBounds, direction: Direction): boolean;
  nextRotation(rotation: Rotation): Rotation;
  nextDirection(direction: Direction): Direction;
  applyRotation(block: TextBlock): TextBlock;
}

export class RotationEngine implements IRotationEngine {
  private readonly config: RotationConfig;

  constructor(config: Partial<RotationConfig> = {}) {
    this.config = { ...DEFAULT_ROTATION_CONFIG, ...config };
  }

  shouldRotate(block: RotationProbe, bounds: WorldBounds, direction: Direction): boolean {
    const worldWidth = Math.max(getWorldWidth(bounds), this.config.minWorldSize);
    const worldHeight = Math.max(getWorldHeight(bounds), this.config.minWorldSize);

    // 竖着长的时候比的是世界的高度，横着长的时候比的是宽度
    if (direction === 'TOP' || direction === 'BOTTOM') {
      return block.originalWidth > worldHeight * this.config.threshold;
    }
    return block.originalWidth > worldWidth * this.config.threshold;
  }

  nextRotation(rotation: Rotation): Rotation {
    return NEXT_ROTATION[rotation];
  }

  nextDirection(direction: Direction): Direction {
    return NEXT_DIRECTION[direction];
  }

  /** 只允许 90° 的整数倍，所以宽高直接交换即可 */
  applyRotation(block: TextBlock): TextBlock {
    const rotation = this.nextRotation(block.rotation);
    return {
      ...block,
      rotation,
      width: block.height,
      height: block.width,
    };
  }
}
