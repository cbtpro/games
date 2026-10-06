import type { Point, Rect, Size, WorldBounds } from './types';

/** 相机坐标转换。x、y 表示视口中心对应的世界坐标，缩放以视口中心为锚点。 */

export interface Camera {
  x: number;
  y: number;
  zoom: number;
  /**
   * 整块画布的旋转角度（度）。正数 = 顺时针，与 canvas 的 rotate 同向。
   *
   * 文字块自己带 0/90/180/270 的朝向，直接照画会导致新句子越转越歪甚至倒过来。
   * 画布反向旋转同样的角度，最新那句就始终是正的 —— 代价是老句子跟着世界一起转，
   * 这正是「文字迷宫在生长」的观感。
   */
  rotation: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export const DEFAULT_CAMERA: Camera = { x: 0, y: 0, zoom: 1, rotation: 0 };

const RAD = Math.PI / 180;

/** 绕原点旋转一个向量，rad 为正表示顺时针（屏幕坐标 y 轴向下） */
export function rotateVector(x: number, y: number, rad: number): Point {
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

export function worldToScreen(point: Point, camera: Camera, viewport: Viewport): Point {
  const spun = rotateVector(point.x - camera.x, point.y - camera.y, camera.rotation * RAD);
  return {
    x: spun.x * camera.zoom + viewport.width / 2,
    y: spun.y * camera.zoom + viewport.height / 2,
  };
}

export function screenToWorld(point: Point, camera: Camera, viewport: Viewport): Point {
  const spun = rotateVector(
    (point.x - viewport.width / 2) / camera.zoom,
    (point.y - viewport.height / 2) / camera.zoom,
    -camera.rotation * RAD,
  );
  return { x: camera.x + spun.x, y: camera.y + spun.y };
}

/** 矩形旋转之后的外接尺寸（轴对齐，因此会变大） */
export function rotatedSize(width: number, height: number, rotation: number): Size {
  const cos = Math.abs(Math.cos(rotation * RAD));
  const sin = Math.abs(Math.sin(rotation * RAD));
  return {
    width: Math.abs(width) * cos + Math.abs(height) * sin,
    height: Math.abs(width) * sin + Math.abs(height) * cos,
  };
}

/** 当前可见的世界区域（旋转后取外接矩形，保证网格铺满屏幕） */
export function visibleRect(camera: Camera, viewport: Viewport): Rect {
  const size = rotatedSize(
    viewport.width / camera.zoom,
    viewport.height / camera.zoom,
    camera.rotation,
  );
  return { x: camera.x - size.width / 2, y: camera.y - size.height / 2, ...size };
}

/**
 * 角度差取最短路径（-180, 180]。
 * 画布旋转是连续量，直接跳 270° 会让画面猛地反向甩一大圈。
 */
export function shortestAngleDelta(target: number, current: number): number {
  return ((((target - current) % 360) + 540) % 360) - 180;
}

export const centerOf = (rect: Rect): Point => ({
  x: rect.x + rect.width / 2,
  y: rect.y + rect.height / 2,
});

export const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

/**
 * 让整片世界刚好装进视口的缩放值。
 *
 * 世界是斜着的时候，占位的是它旋转后的外接矩形 —— 否则转个 45° 就会露出边角。
 */
export function fitZoom(
  bounds: WorldBounds,
  viewport: Viewport,
  padding = 80,
  maxZoom = 1,
  rotation = 0,
): number {
  const size = rotatedSize(
    Math.max(1, bounds.maxX - bounds.minX),
    Math.max(1, bounds.maxY - bounds.minY),
    rotation,
  );
  const available = {
    width: Math.max(1, viewport.width - padding * 2),
    height: Math.max(1, viewport.height - padding * 2),
  };
  return clamp(
    Math.min(
      available.width / Math.max(1, size.width),
      available.height / Math.max(1, size.height),
    ),
    0.02,
    maxZoom,
  );
}
