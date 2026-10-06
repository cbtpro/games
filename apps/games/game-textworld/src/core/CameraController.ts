import {
  centerOf,
  clamp,
  fitZoom,
  screenToWorld,
  shortestAngleDelta,
  type Camera,
  type Viewport,
} from './Camera';
import type { Point, Rect, TextBlock, WorldBounds } from './types';

/**
 * 相机控制器：追着文字世界走。
 *
 * 三种行为叠在一起：
 *   1. 最新文字比视口大时缩小到完整可见，全景则适配世界；
 *   2. 最新文字保持屏幕居中，周围大字较多时适度拉远镜头；
 *   3. 整块画布跟着最新一句的朝向反向转，保证新文字永远是正的。
 * 用户手动拖拽 / 缩放 / 旋转后会暂停自动跟随，松手一段时间再恢复。
 */

/** 小于这个差值就直接吸附到目标，否则指数补间永远差最后一丝 */
const EPSILON = 0.02;

export interface CameraControllerOptions {
  /** 自动缩放时给世界留的边距 */
  padding?: number;
  minZoom?: number;
  maxZoom?: number;
  /** 跟随速度：越大越跟手 */
  stiffness?: number;
  /** 旋转速度独立于平移与缩放。 */
  rotationStiffness?: number;
  autoFollow?: boolean;
  /** 画布是否自动旋转，让最新一句保持水平 */
  autoSpin?: boolean;
}

export class CameraController {
  private current: Camera;
  private target: Camera;
  private readonly options: Required<CameraControllerOptions>;
  private manualUntil = 0;

  constructor(camera: Partial<Camera> = {}, options: CameraControllerOptions = {}) {
    this.options = {
      padding: 32,
      minZoom: 0.15,
      maxZoom: 1,
      stiffness: 4,
      rotationStiffness: 20,
      autoFollow: true,
      autoSpin: true,
      ...options,
    };
    this.current = { ...{ x: 0, y: 0, zoom: 1, rotation: 0 }, ...camera };
    this.target = { ...this.current };
  }

  get camera(): Camera {
    return this.current;
  }

  /** 新内容到来时恢复位置跟随，保留当前旋转偏好。 */
  resumeFollow(): void {
    this.manualUntil = 0;
    this.options.autoFollow = true;
  }

  /** 用户是否正在手动操作（此时不抢镜） */
  get isManual(): boolean {
    return Date.now() < this.manualUntil;
  }

  get autoSpin(): boolean {
    return this.options.autoSpin;
  }

  /**
   * 开关「自动摆正画布」。
   *
   * 关掉只是不再自动重新瞄准，**当前角度保持不变** ——
   * 恢复水平使用 level()，此方法保留当前角度。
   */
  setAutoSpin(enabled: boolean): void {
    this.options.autoSpin = enabled;
  }

  reset(): void {
    this.current = { x: 0, y: 0, zoom: 1, rotation: 0 };
    this.target = { ...this.current };
    this.manualUntil = 0;
    this.options.autoSpin = true;
    this.options.autoFollow = true;
  }

  /** 立刻把某个世界坐标挪到视口中心 */
  focus(point: Point): void {
    this.current = { ...this.current, x: point.x, y: point.y };
    this.target = { ...this.current };
  }

  /** 按屏幕位移拖动（画布转过之后，屏幕上的「右」不再是世界的 +x） */
  panBy(screenDx: number, screenDy: number): void {
    this.hold();
    const rad = (-this.current.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    this.current = {
      ...this.current,
      x: this.current.x - (screenDx * cos - screenDy * sin) / this.current.zoom,
      y: this.current.y - (screenDx * sin + screenDy * cos) / this.current.zoom,
    };
    this.target = { ...this.current };
  }

  /** 手动转动画布，步长通常为 ±90° */
  rotateBy(deg: number): void {
    this.hold();
    // 手动旋转后关闭自动摆正，保留用户选择的角度。
    this.options.autoSpin = false;
    this.target = { ...this.target, rotation: this.target.rotation + deg };
  }

  /**
   * 让最新的一句立刻转正：画布转到与它相反的朝向。
   * 关掉自动旋转后用它「摆正当前这句话」。
   */
  level(frontierRotation: number): void {
    this.hold();
    // 保留手动设置的角度。
    this.options.autoSpin = false;
    this.target = {
      ...this.target,
      rotation:
        this.current.rotation + shortestAngleDelta(-frontierRotation, this.current.rotation),
    };
  }

  /** 以屏幕上某个点为锚缩放 */
  zoomAt(factor: number, anchor: Point, viewport: Viewport): void {
    this.hold();
    const before = screenToWorld(anchor, this.current, viewport);
    const zoom = clamp(
      this.current.zoom * factor,
      this.options.minZoom,
      Math.max(this.options.maxZoom, 2),
    );
    const next: Camera = { ...this.current, zoom };
    const after = screenToWorld(anchor, next, viewport);
    this.current = {
      ...this.current,
      zoom,
      x: this.current.x + (before.x - after.x),
      y: this.current.y + (before.y - after.y),
    };
    this.target = { ...this.current };
  }

  /**
   * 每帧调用：把相机平滑推到目标位置。
   *
   * @param frontierRotation 最新一句的朝向（0/90/180/270），画布据此反向旋转
   * @returns 是否还在移动（渲染层据此决定要不要继续画下一帧）
   */
  follow(
    bounds: WorldBounds,
    viewport: Viewport,
    dt: number,
    frontierRotation = 0,
    latest?: Rect,
    blocks: readonly TextBlock[] = [],
  ): boolean {
    if (this.options.autoFollow && !this.isManual) {
      const center = centerOf(
        latest ?? {
          x: bounds.minX,
          y: bounds.minY,
          width: bounds.maxX - bounds.minX,
          height: bounds.maxY - bounds.minY,
        },
      );
      // 用「转完之后」的角度算缩放，否则斜着的世界会顶出视口。
      // 关掉自动摆正时保留用户手动转到的角度，不强行归零。
      const spin = this.options.autoSpin
        ? this.target.rotation + shortestAngleDelta(-frontierRotation, this.target.rotation)
        : this.target.rotation;
      const nearby = latest
        ? blocks.filter(
            (block) =>
              Math.hypot(
                block.x + block.width / 2 - center.x,
                block.y + block.height / 2 - center.y,
              ) <=
              Math.max(viewport.width, viewport.height) / 2,
          )
        : [];
      const largeCount = nearby.filter((block) => block.font.size >= 32).length;
      const averageSize = nearby.length
        ? nearby.reduce((sum, block) => sum + block.font.size, 0) / nearby.length
        : 24;
      const contextZoom = largeCount >= 3 ? clamp(24 / averageSize, 0.6, 1) : 1;
      const zoom = Math.min(
        latest ? contextZoom : this.options.maxZoom,
        this.options.maxZoom,
        fitZoom(
          latest
            ? {
                minX: latest.x,
                minY: latest.y,
                maxX: latest.x + latest.width,
                maxY: latest.y + latest.height,
              }
            : bounds,
          viewport,
          this.options.padding,
          this.options.maxZoom,
          spin,
        ),
      );
      this.target = { x: center.x, y: center.y, zoom, rotation: spin };
    }

    const t = 1 - Math.exp(-this.options.stiffness * Math.max(0, Math.min(dt, 0.1)));
    const step = (from: number, to: number): number =>
      Math.abs(to - from) < EPSILON ? to : from + (to - from) * t;

    this.current = {
      x: step(this.current.x, this.target.x),
      y: step(this.current.y, this.target.y),
      zoom: step(this.current.zoom, this.target.zoom),
      rotation:
        Math.abs(this.target.rotation - this.current.rotation) < EPSILON
          ? this.target.rotation
          : this.current.rotation +
            (this.target.rotation - this.current.rotation) *
              (1 - Math.exp(-this.options.rotationStiffness * Math.max(0, Math.min(dt, 0.1)))),
    };

    return (
      Math.abs(this.target.x - this.current.x) > 0.1 ||
      Math.abs(this.target.y - this.current.y) > 0.1 ||
      Math.abs(this.target.zoom - this.current.zoom) > 0.0005 ||
      Math.abs(this.target.rotation - this.current.rotation) > 0.05
    );
  }

  /** 手动操作后 1.6 秒内不自动跟随 */
  private hold(): void {
    this.manualUntil = Date.now() + 1600;
  }
}
