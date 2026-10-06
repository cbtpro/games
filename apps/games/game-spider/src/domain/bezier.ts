import type { Point } from './types';

/**
 * 螯肢的几何计算。
 *
 * 思路与双列表连线一致：把「肢体根部」和「猎物」两个端点换算到同一个坐标系，
 * 用三次贝塞尔曲线连接，再把已经算好的路径交给一个独立的 SVG 图层渲染。
 * 这里只做纯计算，不认识 DOM，也不认识 React。
 */

/** 线性插值 */
function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** 三次贝塞尔求点 */
export function cubicPoint(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const a = lerp(p0, p1, t);
  const b = lerp(p1, p2, t);
  const c = lerp(p2, p3, t);
  const d = lerp(a, b, t);
  const e = lerp(b, c, t);
  return lerp(d, e, t);
}

/**
 * 取曲线的前 t 段作为一条新曲线（de Casteljau 分割）。
 * 螯肢「一点点伸出去」的效果靠它实现，不需要 stroke-dasharray 的取巧。
 */
export function subCurve(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  t: number,
): [Point, Point, Point, Point] {
  const q0 = lerp(p0, p1, t);
  const q1 = lerp(p1, p2, t);
  const q2 = lerp(p2, p3, t);
  const r0 = lerp(q0, q1, t);
  const r1 = lerp(q1, q2, t);
  const s = lerp(r0, r1, t);
  return [p0, q0, r0, s];
}

export interface TendrilGeometry {
  p0: Point;
  p1: Point;
  p2: Point;
  p3: Point;
}

/**
 * 根据两端点生成一条带自然弯曲的螯肢：
 * 控制点沿端点连线方向外扩，并按 `wave` 做垂直抖动，让肢体像有骨节而不是橡皮筋。
 */
export function buildTendril(start: Point, end: Point, wave = 0.28): TendrilGeometry {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy) || 1;
  const nx = -dy / distance;
  const ny = dx / distance;
  const reach = Math.max(28, distance * 0.45);
  const lift = distance * wave;

  return {
    p0: start,
    p1: { x: start.x + (dx / distance) * reach + nx * lift, y: start.y + (dy / distance) * reach + ny * lift },
    p2: { x: end.x - (dx / distance) * reach * 0.6 - nx * lift * 0.5, y: end.y - (dy / distance) * reach * 0.6 - ny * lift * 0.5 },
    p3: end,
  };
}

/** 把四点写成 SVG path */
export function toPath({ p0, p1, p2, p3 }: TendrilGeometry): string {
  return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} C ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}, ${p2.x.toFixed(
    2,
  )} ${p2.y.toFixed(2)}, ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`;
}

/** 螯肢伸出到 `progress` 比例时的路径 */
export function tendrilPathAt(start: Point, end: Point, progress: number, wave?: number): string {
  const full = buildTendril(start, end, wave);
  if (progress >= 1) return toPath(full);
  const [a0, a1, a2, a3] = subCurve(full.p0, full.p1, full.p2, full.p3, Math.max(0, Math.min(1, progress)));
  return toPath({ p0: a0, p1: a1, p2: a2, p3: a3 });
}

/** 螯肢尖端（即猎物应当被拖到的位置）在 `t` 处的坐标 */
export function pointAlong(
  start: Point,
  end: Point,
  t: number,
  wave?: number,
): Point {
  const { p0, p1, p2, p3 } = buildTendril(start, end, wave);
  return cubicPoint(p0, p1, p2, p3, t);
}

/** 平滑到━━缓动 */
export const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;
export const easeInQuad = (t: number): number => t * t;
export const easeInOutQuad = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
