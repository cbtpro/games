import { AnimationEngine, type AnimationEngineOptions } from './AnimationEngine';
import type { CollisionConfig } from './CollisionEngine';
import { LayoutEngine, type LayoutConfig, type LayoutDeps } from './LayoutEngine';
import type { RotationConfig } from './RotationEngine';
import type { ITextMeasure } from './TextMeasure';
import type { LayoutMode, Point, Rotation, TextBlock, WorldBounds } from './types';

/** 文字世界，负责组装布局和动画引擎，提供追加、更新和重置接口。 */

export interface TextWorldOptions {
  measure?: ITextMeasure;
  layout?: Partial<LayoutConfig>;
  collision?: Partial<CollisionConfig>;
  rotation?: Partial<RotationConfig>;
  animation?: AnimationEngineOptions;
}

const EMPTY_BOUNDS: WorldBounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 };

export class TextWorld {
  readonly layout: LayoutEngine;
  readonly animation: AnimationEngine;

  /** 每次结构变化 +1，渲染层据此判断要不要重排缓存 */
  private revision = 0;
  private currentTime = 0;
  private resetRevision = 0;

  get time(): number {
    return this.currentTime;
  }

  get resetVersion(): number {
    return this.resetRevision;
  }

  constructor(options: TextWorldOptions = {}) {
    this.animation = new AnimationEngine(options.animation);
    const deps: LayoutDeps = {
      measure: options.measure,
      animation: this.animation,
      config: options.layout,
      collisionConfig: options.collision,
      rotationConfig: options.rotation,
    };
    this.layout = new LayoutEngine(deps);
  }

  get blocks(): readonly TextBlock[] {
    return this.layout.getBlocks();
  }

  get bounds(): WorldBounds {
    return this.layout.getBounds();
  }

  get size(): number {
    return this.blocks.length;
  }

  /**
   * 最新一句的朝向。画布按它的反向旋转，新句子就永远是正的。
   * 世界为空时返回 0（此时也没有东西需要摆正）。
   */
  get frontierRotation(): Rotation {
    return this.layout.lastBlock?.rotation ?? 0;
  }

  get version(): number {
    return this.revision;
  }

  get isEmpty(): boolean {
    return this.blocks.length === 0;
  }

  /** 当前布局策略，UI 用来显示 / 切换 */
  get layoutMode(): LayoutMode {
    return this.layout.mode;
  }

  /** 最近一次图谱重排时刻，渲染层据此做位置平滑过渡（0 表示无活跃重排） */
  get reflowAt(): number {
    return this.layout.reflowAt;
  }

  /** 追加一句话；空白内容会被忽略，返回 null */
  append(text: string, now = this.currentTime): TextBlock | null {
    const block = this.layout.append(text, now);
    if (block) this.revision += 1;
    return block;
  }

  /** 推进所有动画；返回是否还有动画在跑 */
  update(now: number): boolean {
    this.currentTime = now;
    let running = false;
    for (const block of this.blocks) {
      if (block.animation.done) continue;
      block.animation = this.animation.advance(block.animation, now);
      running = true;
    }
    return running;
  }

  clear(): void {
    this.layout.clear();
    this.currentTime = 0;
    this.resetRevision += 1;
    this.revision += 1;
  }

  /** 命中测试：世界坐标落在哪一块上（后面的块盖在上面，因此倒序查找） */
  blockAt(point: Point): TextBlock | null {
    for (let i = this.blocks.length - 1; i >= 0; i -= 1) {
      const block = this.blocks[i];
      if (
        point.x >= block.x &&
        point.x <= block.x + block.width &&
        point.y >= block.y &&
        point.y <= block.y + block.height
      ) {
        return block;
      }
    }
    return null;
  }
}

export { EMPTY_BOUNDS };
