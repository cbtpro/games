import type { Camera, Viewport } from '../core/Camera';
import type { ITextMeasure } from '../core/TextMeasure';
import type { Size, TextFont, TextBlock, WorldBounds } from '../core/types';

/** 渲染接口及 Canvas 文字测量实现。 */

export type ReadonlyData<T> = {
  readonly [K in keyof T]: T[K] extends object ? ReadonlyData<T[K]> : T[K];
};

export interface RenderWorld {
  readonly blocks: readonly ReadonlyData<TextBlock>[];
  readonly bounds: Readonly<WorldBounds>;
  readonly reflowAt: number;
}

export interface RenderContext {
  debug?: boolean;
  ctx: CanvasRenderingContext2D;
  viewport: Viewport;
  /** 设备像素比，用来画清楚 Retina 屏 */
  dpr: number;
}

export interface IRenderer {
  render(world: RenderWorld, camera: Readonly<Camera>, context: RenderContext, now?: number): void;
}

/** 用 Canvas 量文字：这是唯一需要真实字体度量的地方 */
export class CanvasTextMeasure implements ITextMeasure {
  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  measure(text: string, font: TextFont): Size {
    this.ctx.font = `${font.weight} ${font.size}px ${font.family}`;
    const metrics = this.ctx.measureText(text);
    return { width: Math.ceil(metrics.width), height: font.lineHeight };
  }
}
