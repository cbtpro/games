import type { AnimationEngine } from './AnimationEngine';
import { fitCavity } from './CavityFit';
import { packingScore } from './PackingScore';
import { compactPosition } from './CompactPlacement';
import { CollisionEngine, type CollisionConfig, type ICollisionEngine } from './CollisionEngine';
import { fontForText } from './palette';
import { fitFontInSpace } from './FontFit';
import { analyzeMood } from './mood';
import { RotationEngine, type IRotationEngine, type RotationConfig } from './RotationEngine';
import { ApproximateTextMeasure, type ITextMeasure } from './TextMeasure';
import {
  rectBottom,
  rectRight,
  type Direction,
  type LayoutMode,
  type Mood,
  type Point,
  type Rect,
  type Rotation,
  type TextBlock,
  type TextFont,
  type WorldBounds,
} from './types';

/**
 * 布局引擎：决定「这句话最终放在哪里」。
 *
 * 一次 append 的完整链路：
 *   测量尺寸 → 判断是否旋转 → 贴到上一句的某条边 → 碰撞检测 → 换方向重试 → 落位 → 更新包围盒
 *
 * 硬约束：**不认识 Canvas、DOM、requestAnimationFrame**。
 * 文字尺寸由外部注入的 ITextMeasure 提供，因此核心算法可以在 Node 里直接跑。
 */

export interface LayoutConfig {
  /** MVP 默认螺旋，graph 保留为可选的按行平铺扩展。 */
  mode: LayoutMode;
  spiralShape: 'greedy' | 'compact';
  initialDirection: Direction;
  /** 块与块之间的间距（螺旋模式用） */
  gap: number;
  startX: number;
  startY: number;
  /** 文字到卡片边的内边距 */
  padding: number;
}

export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  mode: 'spiral',
  spiralShape: 'greedy',
  initialDirection: 'BOTTOM',
  gap: 20,
  startX: 0,
  startY: 0,
  padding: 12,
};

export interface LayoutDeps {
  measure?: ITextMeasure;
  collision?: ICollisionEngine;
  rotation?: IRotationEngine;
  animation: AnimationEngine;
  /** 自定义字体（默认按情绪取色） */
  font?: (index: number, mood: Mood) => TextFont;
  config?: Partial<LayoutConfig>;
  collisionConfig?: Partial<CollisionConfig>;
  rotationConfig?: Partial<RotationConfig>;
  /** id 生成器，便于测试 */
  createId?: () => string;
}

export interface ILayoutEngine {
  append(text: string, now?: number): TextBlock | null;
  getBlocks(): readonly TextBlock[];
  getBounds(): WorldBounds;
  clear(): void;
}

interface Placement {
  direction: Direction;
  rotation: Rotation;
  width: number;
  height: number;
}

const EMPTY_BOUNDS: WorldBounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 };

let seq = 0;

export class LayoutEngine implements ILayoutEngine {
  private readonly measure: ITextMeasure;
  private readonly collision: ICollisionEngine;
  private readonly rotation: IRotationEngine;
  private readonly animation: AnimationEngine;
  private readonly fontOf: (index: number, mood: Mood, text: string) => TextFont;
  private readonly fitTypography: boolean;
  private readonly config: LayoutConfig;
  private readonly createId: () => string;
  private readonly safeGap: number;

  private blocks: TextBlock[] = [];
  private bounds: WorldBounds = { ...EMPTY_BOUNDS };
  private last: TextBlock | null = null;
  private runBounds: WorldBounds = { ...EMPTY_BOUNDS };
  private runDistance = 0;
  private graphArea = 0;
  private graphRow: {
    cursor: number;
    y: number;
    height: number;
    used: number;
    limit: number;
    forward: boolean;
  } | null = null;
  /** 最近一次图谱重排的时刻（ms），渲染层用来做平滑过渡；0 表示没有活跃重排 */
  private reflowAtValue = 0;

  constructor(deps: LayoutDeps) {
    this.measure = deps.measure ?? new ApproximateTextMeasure();
    this.collision = deps.collision ?? new CollisionEngine(deps.collisionConfig);
    this.rotation = deps.rotation ?? new RotationEngine(deps.rotationConfig);
    this.animation = deps.animation;
    this.safeGap = deps.collisionConfig?.safeGap ?? 16;
    this.fontOf = deps.font ?? fontForText;
    this.fitTypography = !deps.font;
    this.config = { ...DEFAULT_LAYOUT_CONFIG, ...deps.config };
    this.createId = deps.createId ?? (() => `b${(seq += 1)}`);
  }

  getBlocks(): readonly TextBlock[] {
    return this.blocks;
  }

  getBounds(): WorldBounds {
    return this.bounds;
  }

  /** 当前布局策略，UI 用来显示/切换 */
  get mode(): LayoutMode {
    return this.config.mode;
  }

  /** 最近一次图谱重排时刻，渲染层据此做位置平滑过渡 */
  get reflowAt(): number {
    return this.reflowAtValue;
  }

  /** 最新的一块，Camera 用来决定往哪儿看 */
  get lastBlock(): TextBlock | null {
    return this.last;
  }

  clear(): void {
    this.blocks = [];
    this.bounds = { ...EMPTY_BOUNDS };
    this.last = null;
    this.runBounds = { ...EMPTY_BOUNDS };
    this.runDistance = 0;
    this.graphArea = 0;
    this.graphRow = null;
    this.reflowAtValue = 0;
    this.animation.clear();
  }

  append(text: string, now = 0): TextBlock | null {
    const value = text.trim();
    if (value.length === 0) return null;

    const mood = analyzeMood(value);
    let font = this.fontOf(this.blocks.length, mood, value);
    const measured = this.measure.measure(value, font);
    let originalWidth = measured.width + this.config.padding * 2;
    let originalHeight = measured.height + this.config.padding * 2;
    const current = this.candidate(
      this.last?.rotation ?? 0,
      this.last?.direction ?? this.config.initialDirection,
      originalWidth,
      originalHeight,
    );
    let placement =
      this.config.mode === 'spiral'
        ? this.config.spiralShape === 'greedy'
          ? current
          : this.choosePlacement(current, originalWidth, originalHeight)
        : this.candidate(0, this.config.initialDirection, originalWidth, originalHeight);
    const cavity =
      this.config.mode === 'spiral' && this.config.spiralShape === 'greedy' && this.fitTypography
        ? fitCavity(
            value,
            font,
            this.bounds,
            this.blocks,
            this.config.padding,
            Math.max(this.safeGap, this.config.gap),
            this.measure,
            this.collision,
            placement.rotation,
          )
        : null;
    if (cavity) {
      font = cavity.font;
      originalWidth = cavity.originalWidth;
      originalHeight = cavity.originalHeight;
      placement = cavity;
    }
    let position =
      cavity ??
      (this.config.mode === 'spiral'
        ? this.place(placement, originalWidth, originalHeight)
        : this.placeGraph(originalWidth, originalHeight));
    if (!position) return null;
    if (this.config.mode === 'spiral' && !cavity && this.fitTypography) {
      const maxSize = Math.min([...value].length <= 8 ? 56 : 40, Math.ceil(font.size * 1.5));
      const fitted = fitFontInSpace(
        {
          ...position,
          width: placement.width,
          height: placement.height,
          originalWidth,
          originalHeight,
          font,
        },
        value,
        placement.rotation,
        this.bounds,
        this.blocks,
        this.config.padding,
        maxSize,
        this.measure,
        this.collision,
      );
      font = fitted.font;
      originalWidth = fitted.originalWidth;
      originalHeight = fitted.originalHeight;
      position = { x: fitted.x, y: fitted.y };
      placement.width = fitted.width;
      placement.height = fitted.height;
    }

    const block: TextBlock = {
      id: this.createId(),
      text: value,
      ...position,
      width: placement.width,
      height: placement.height,
      originalWidth,
      originalHeight,
      rotation: placement.rotation,
      direction: placement.direction,
      font,
      mood,
      area: originalWidth * originalHeight,
      animation: this.animation.create(now, value),
      createdAt: now,
    };

    if (this.config.mode === 'spiral') {
      const turned = !this.last || this.last.direction !== block.direction;
      if (turned) {
        this.runBounds = { ...this.bounds };
        this.runDistance = 0;
      }
      this.runDistance +=
        (block.direction === 'TOP' || block.direction === 'BOTTOM' ? block.height : block.width) +
        (turned ? 0 : Math.max(this.safeGap, this.config.gap));
    }
    this.blocks.push(block);
    this.last = block;
    this.growBounds(block);
    return block;
  }

  /** 按自然文字尺寸蛇形分行；行宽随内容面积扩展，已有文字块不重排。 */
  private placeGraph(width: number, height: number): Point | null {
    const gap = Math.max(this.safeGap, this.config.gap);
    const area = this.graphArea + width * height;
    let row = this.graphRow;
    if (!row || row.used + gap + width > row.limit) {
      const forward = row ? !row.forward : true;
      row = {
        cursor: !this.last ? this.config.startX : forward ? this.bounds.minX : this.bounds.maxX,
        y: row ? row.y + row.height + gap : this.config.startY,
        height: 0,
        used: 0,
        limit: Math.max(480, width, Math.sqrt(area * 4)),
        forward,
      };
    }
    const x = row.forward ? row.cursor : row.cursor - width;
    const direction = row.forward ? 'RIGHT' : 'LEFT';
    const position = this.collision.findFreePosition(
      { x, y: row.y, width, height },
      direction,
      this.blocks,
    );
    if (!position) return null;
    this.graphRow = {
      ...row,
      cursor: row.forward ? position.x + width + gap : position.x - gap,
      used: row.used + width + (row.used ? gap : 0),
      height: Math.max(row.height, height),
    };
    this.graphArea = area;
    return position;
  }

  /** 按「旋转 + 方向」组装一个落位方案：90/270 时宽高交换 */
  private candidate(
    rotation: Rotation,
    direction: Direction,
    originalWidth: number,
    originalHeight: number,
  ): Placement {
    const swapped = rotation === 90 || rotation === 270;
    return {
      rotation,
      direction,
      width: swapped ? originalHeight : originalWidth,
      height: swapped ? originalWidth : originalHeight,
    };
  }

  /**
   * 决定要不要转向。
   *
   * 转向会让文字拐弯并继续生长，多次转向之后自然形成螺旋。
   */
  private choosePlacement(
    current: Placement,
    originalWidth: number,
    originalHeight: number,
  ): Placement {
    if (!this.last) return current;

    const advance =
      current.direction === 'TOP' || current.direction === 'BOTTOM'
        ? current.height
        : current.width;
    const exhausted = this.rotation.shouldRotate(
      { originalWidth: this.runDistance + Math.max(this.safeGap, this.config.gap) + advance },
      this.runBounds,
      current.direction,
    );
    if (
      !exhausted &&
      !this.rotation.shouldRotate({ originalWidth }, this.bounds, current.direction)
    )
      return current;

    return this.candidate(
      this.rotation.nextRotation(current.rotation),
      this.rotation.nextDirection(current.direction),
      originalWidth,
      originalHeight,
    );
  }

  /** 贴到上一句的对应边 */
  private attach(placement: Placement, anchor: TextBlock): Rect {
    const gap = Math.max(this.safeGap, this.config.gap);
    if (placement.direction !== anchor.direction) {
      switch (placement.direction) {
        case 'BOTTOM':
          return {
            x: this.bounds.minX - placement.width - gap,
            y: this.bounds.minY,
            width: placement.width,
            height: placement.height,
          };
        case 'RIGHT':
          return {
            x: this.bounds.minX,
            y: this.bounds.maxY + gap,
            width: placement.width,
            height: placement.height,
          };
        case 'TOP':
          return {
            x: this.bounds.maxX + gap,
            y: this.bounds.maxY - placement.height,
            width: placement.width,
            height: placement.height,
          };
        case 'LEFT':
          return {
            x: this.bounds.maxX - placement.width,
            y: this.bounds.minY - placement.height - gap,
            width: placement.width,
            height: placement.height,
          };
      }
    }
    switch (placement.direction) {
      case 'BOTTOM':
        return {
          x: rectRight(anchor) - placement.width,
          y: rectBottom(anchor) + gap,
          width: placement.width,
          height: placement.height,
        };
      case 'RIGHT':
        return {
          x: rectRight(anchor) + gap,
          y: anchor.y,
          width: placement.width,
          height: placement.height,
        };
      case 'TOP':
        return {
          x: anchor.x,
          y: anchor.y - placement.height - gap,
          width: placement.width,
          height: placement.height,
        };
      case 'LEFT':
        return {
          x: anchor.x - placement.width - gap,
          y: rectBottom(anchor) - placement.height,
          width: placement.width,
          height: placement.height,
        };
    }
  }

  /**
   * 先在当前方向找位置；被占了就顺着螺旋换方向再试。
   *
   * 四个方向均搜索失败时返回 null，不提交会发生碰撞的位置。
   */
  private place(placement: Placement, originalWidth: number, originalHeight: number): Point | null {
    if (!this.last) {
      return { x: this.config.startX, y: this.config.startY };
    }

    const base = compactPosition(
      this.attach(placement, this.last),
      placement.direction,
      this.blocks,
      this.bounds,
      Math.max(this.safeGap, this.config.gap),
      this.collision,
    );
    if (this.config.spiralShape === 'greedy') {
      const candidates: { rect: Rect; placement: Placement; score: number }[] = [];
      let next = placement;
      for (let turn = 0; turn < 4; turn++) {
        const current = next;
        const score = (rect: Rect) =>
          packingScore(
            rect,
            current.rotation,
            this.blocks,
            this.bounds,
            Math.max(this.safeGap, this.config.gap),
          );
        const rect = compactPosition(
          this.attach(current, this.last),
          current.direction,
          this.blocks,
          this.bounds,
          Math.max(this.safeGap, this.config.gap),
          this.collision,
          score,
        );
        if (!this.collision.hasCollision(rect, this.blocks))
          candidates.push({ rect, placement: current, score: score(rect) });
        next = this.candidate(
          this.rotation.nextRotation(current.rotation),
          this.rotation.nextDirection(current.direction),
          originalWidth,
          originalHeight,
        );
      }
      candidates.sort((a, b) => a.score - b.score);
      for (const candidate of candidates) {
        const free = this.collision.findFreePosition(
          candidate.rect,
          candidate.placement.direction,
          this.blocks,
        );
        if (free) {
          Object.assign(placement, candidate.placement);
          return free;
        }
      }
    }
    const free = this.collision.findFreePosition(base, placement.direction, this.blocks);
    if (free) return free;

    let next = placement;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      next = this.candidate(
        this.rotation.nextRotation(next.rotation),
        this.rotation.nextDirection(next.direction),
        originalWidth,
        originalHeight,
      );
      const retry = compactPosition(
        this.attach(next, this.last),
        next.direction,
        this.blocks,
        this.bounds,
        Math.max(this.safeGap, this.config.gap),
        this.collision,
      );
      const hit = this.collision.findFreePosition(retry, next.direction, this.blocks);
      if (hit) {
        // 换方向成功：把最终采用的旋转与尺寸写回，保证碰撞尺寸与实际朝向一致
        placement.rotation = next.rotation;
        placement.direction = next.direction;
        placement.width = next.width;
        placement.height = next.height;
        return hit;
      }
    }

    return null;
  }

  private growBounds(block: TextBlock): void {
    if (this.blocks.length === 1) {
      this.bounds = {
        minX: block.x,
        minY: block.y,
        maxX: block.x + block.width,
        maxY: block.y + block.height,
      };
      return;
    }
    this.bounds = {
      minX: Math.min(this.bounds.minX, block.x),
      minY: Math.min(this.bounds.minY, block.y),
      maxX: Math.max(this.bounds.maxX, block.x + block.width),
      maxY: Math.max(this.bounds.maxY, block.y + block.height),
    };
  }
}
