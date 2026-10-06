import { visibleRect, type Camera } from '../core/Camera';
import type { TextBlock } from '../core/types';
import {
  CanvasTextMeasure,
  type IRenderer,
  type RenderContext,
  type RenderWorld,
  type ReadonlyData,
} from './Renderer';

/** Canvas 2D 渲染器。读取布局和动画状态，不修改文字块的布局数据。 */

export interface CanvasRendererOptions {
  background?: string;
  grid?: string;
  gridSize?: number;
  cardFill?: string;
}

const DEFAULTS: Required<CanvasRendererOptions> = {
  background: '#f7f8fc',
  grid: 'rgba(20, 22, 43, 0.07)',
  gridSize: 44,
  cardFill: '#ffffff',
};

export class CanvasRenderer implements IRenderer {
  private readonly options: Required<CanvasRendererOptions>;

  constructor(options: CanvasRendererOptions = {}) {
    this.options = { ...DEFAULTS, ...options };
  }

  render(
    world: RenderWorld,
    camera: Readonly<Camera>,
    { ctx, viewport, dpr, debug }: RenderContext,
    now = 0,
  ): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, viewport.width, viewport.height);
    ctx.fillStyle = this.options.background;
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    ctx.save();
    // 相机：先挪到视口中心，再缩放，转动画布，最后把世界原点对齐过去。
    // 按缩放、旋转、位移顺序应用变换，旋转中心为相机中心。
    ctx.translate(viewport.width / 2, viewport.height / 2);
    ctx.scale(camera.zoom, camera.zoom);
    if (camera.rotation % 360 !== 0) {
      ctx.rotate((camera.rotation * Math.PI) / 180);
    }
    ctx.translate(-camera.x, -camera.y);

    drawGrid(ctx, visibleRect(camera, viewport), this.options.grid, this.options.gridSize);

    // 图谱重排平滑过渡系数：0→1，让块从旧位置缓动到新位置
    const reflowT =
      world.reflowAt > 0
        ? easeOutCubic(Math.min(1, Math.max(0, (now - world.reflowAt) / REFLOW_MS)))
        : 1;

    const total = world.blocks.length;
    for (let i = 0; i < total; i += 1) {
      // 阴影保持固定尺寸，避免句数增多后阴影覆盖相邻文字。
      drawBlock(ctx, world.blocks[i], this.options.cardFill, reflowT);
    }

    if (debug) drawDebug(ctx, world, camera);
    ctx.restore();
  }

  /** 复用渲染器的 ctx 做文字测量，保证测量与绘制用的是同一套字体设置 */
  createTextMeasure(ctx: CanvasRenderingContext2D): CanvasTextMeasure {
    return new CanvasTextMeasure(ctx);
  }
}

/** 绘制最终布局边界与相机中心，不应用入场动画变换。 */
function drawDebug(
  ctx: CanvasRenderingContext2D,
  world: RenderWorld,
  camera: Readonly<Camera>,
): void {
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.filter = 'none';
  ctx.lineWidth = 1 / camera.zoom;
  ctx.font = `${12 / camera.zoom}px monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  for (const block of world.blocks) {
    ctx.strokeStyle = '#dc2626';
    ctx.strokeRect(block.x, block.y, block.width, block.height);
    ctx.fillStyle = '#991b1b';
    ctx.fillText(
      `${block.id} · ${block.direction} · ${block.rotation}°`,
      block.x,
      block.y - 3 / camera.zoom,
    );
  }
  const bounds = world.bounds;
  ctx.strokeStyle = '#2563eb';
  ctx.strokeRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  ctx.fillStyle = '#1d4ed8';
  ctx.fillText('WorldBounds', bounds.minX, bounds.maxY + 16 / camera.zoom);
  const radius = 8 / camera.zoom;
  ctx.beginPath();
  ctx.moveTo(camera.x - radius, camera.y);
  ctx.lineTo(camera.x + radius, camera.y);
  ctx.moveTo(camera.x, camera.y - radius);
  ctx.lineTo(camera.x, camera.y + radius);
  ctx.stroke();
  ctx.fillText(
    `Camera (${camera.x.toFixed(1)}, ${camera.y.toFixed(1)})`,
    camera.x + radius,
    camera.y - radius,
  );
  ctx.restore();
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  area: { x: number; y: number; width: number; height: number },
  color: string,
  size: number,
): void {
  const startX = Math.floor(area.x / size) * size;
  const startY = Math.floor(area.y / size) * size;
  const endX = area.x + area.width;
  const endY = area.y + area.height;

  ctx.fillStyle = color;
  for (let x = startX; x <= endX; x += size) {
    for (let y = startY; y <= endY; y += size) {
      ctx.fillRect(x, y, 1.5, 1.5);
    }
  }
}

function drawBlock(
  ctx: CanvasRenderingContext2D,
  block: ReadonlyData<TextBlock>,
  cardFill: string,
  reflowT = 1,
): void {
  const anim = block.animation;
  if (anim.opacity <= 0.001) return;

  // 重排过渡：块从上一帧的中心缓动到当前中心（图谱模式追加时会整体重排）
  const curCx = block.x + block.width / 2;
  const curCy = block.y + block.height / 2;
  const fromCx = block.prevCx ?? curCx;
  const fromCy = block.prevCy ?? curCy;
  const centerX = fromCx + (curCx - fromCx) * reflowT + anim.offsetX;
  const centerY = fromCy + (curCy - fromCy) * reflowT + anim.offsetY;
  const width = block.originalWidth;
  const height = block.originalHeight;

  ctx.save();
  ctx.globalAlpha = anim.opacity;
  if (anim.blur > 0.05) ctx.filter = `blur(${anim.blur.toFixed(2)}px)`;

  ctx.translate(centerX, centerY);
  ctx.rotate(((block.rotation + anim.rotationOffset) * Math.PI) / 180);
  ctx.scale(anim.scale, anim.scale);

  // 卡片：轻微投影用于区分卡片边缘，强化「一张图」的层次感（块之间并不重叠）
  ctx.beginPath();
  roundRect(ctx, -width / 2, -height / 2, width, height, 12);
  ctx.fillStyle = cardFill;
  ctx.shadowColor = 'rgba(20, 22, 43, 0.16)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  ctx.fill();
  // 情绪底色：在白卡上叠一层很淡的墨色，让情绪「看得见」又不伤文字对比
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = withAlpha(block.font.color, 0.07);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = withAlpha(block.font.color, 0.32);
  ctx.stroke();

  // 文字：单行展示。布局已保证卡片宽 ≥ 文字宽、高 = 单行高，所以按原字号居中一行即可；
  // 仅在极个别卡片被压缩到比文字还窄时，才等比缩小字号（仍保持单行，绝不换行）。
  const { font } = block;
  const text = visibleText(block.text, anim.textProgress);
  const maxW = Math.max(8, width - PAD * 2);
  let size = font.size;
  ctx.font = `${font.weight} ${size}px ${font.family}`;
  const textW = ctx.measureText(text).width;
  if (textW > maxW && maxW > 0) {
    size = Math.max(9, Math.floor((size * maxW) / textW));
    ctx.font = `${font.weight} ${size}px ${font.family}`;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = font.color;
  ctx.fillText(text, 0, 1);

  ctx.restore();
}

/** 卡片内边距：文字与卡片边留出空隙 */
const PAD = 10;

/** 重排过渡时长（ms） */
const REFLOW_MS = 550;

/** 缓动：先快后慢 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** 打字机效果：按进度截字。按码点切，避免把 emoji / 代理对切坏 */
function visibleText(text: string, progress: number): string {
  if (progress >= 1) return text;
  const chars = [...text];
  const count = Math.max(0, Math.round(chars.length * progress));
  return chars.slice(0, count).join('');
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

/** 给 #rrggbb 加透明度；非十六进制原样返回 */
function withAlpha(color: string, alpha: number): string {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return color;
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
